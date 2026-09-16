import AsyncStorage from "@react-native-async-storage/async-storage";
import { gcm } from "@noble/ciphers/aes.js";
import { bytesToHex, bytesToUtf8, hexToBytes, utf8ToBytes } from "@noble/ciphers/utils.js";
import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";

const prefix = "psalmo.auth.";

function names(key: string) {
  return { secret: `${prefix}${key}.key`, data: `${prefix}${key}.data` };
}

async function clear(key: string): Promise<void> {
  const item = names(key);
  await AsyncStorage.removeItem(item.data);
  await SecureStore.deleteItemAsync(item.secret);
}

// A Supabase session is too large for SecureStore. Keep only a 256-bit key in
// Keychain/Keystore; authenticated AES-GCM ciphertext lives in AsyncStorage.
export const secureAuthStorage = {
  async getItem(key: string): Promise<string | null> {
    const item = names(key);
    const [secret, payload] = await Promise.all([
      SecureStore.getItemAsync(item.secret),
      AsyncStorage.getItem(item.data),
    ]);
    if (!secret || !payload) {
      if (secret || payload) await clear(key);
      return null;
    }
    try {
      const [nonce, ciphertext] = payload.split(":");
      if (!nonce || !ciphertext) throw new Error("Incomplete session payload");
      return bytesToUtf8(gcm(hexToBytes(secret), hexToBytes(nonce)).decrypt(hexToBytes(ciphertext)));
    } catch {
      await clear(key);
      return null;
    }
  },
  async setItem(key: string, value: string): Promise<void> {
    const item = names(key);
    const secret = bytesToHex(Crypto.getRandomBytes(32));
    const nonce = Crypto.getRandomBytes(12);
    const ciphertext = gcm(hexToBytes(secret), nonce).encrypt(utf8ToBytes(value));
    // A crash between writes leaves an unusable pair that getItem clears.
    await AsyncStorage.setItem(item.data, `${bytesToHex(nonce)}:${bytesToHex(ciphertext)}`);
    try {
      await SecureStore.setItemAsync(item.secret, secret);
    } catch (error) {
      await AsyncStorage.removeItem(item.data);
      throw error;
    }
  },
  removeItem: clear,
};
