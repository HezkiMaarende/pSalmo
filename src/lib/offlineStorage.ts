import AsyncStorage from "@react-native-async-storage/async-storage";
import { bytesToHex } from "@noble/ciphers/utils.js";
import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import {
  OfflineSnapshotV1,
  openOfflineSnapshot,
  sealOfflineSnapshot,
} from "../domain/offline";

const KEY_NAME = "psalmo.offline.v1.key";
const DATA_NAME = "psalmo.offline.v1.data";

export async function clearOfflineSnapshot(): Promise<void> {
  await Promise.all([
    AsyncStorage.removeItem(DATA_NAME),
    SecureStore.deleteItemAsync(KEY_NAME),
  ]);
}

export async function readOfflineSnapshot(): Promise<OfflineSnapshotV1 | null> {
  const [secret, payload] = await Promise.all([
    SecureStore.getItemAsync(KEY_NAME),
    AsyncStorage.getItem(DATA_NAME),
  ]);
  if (!secret || !payload) {
    if (secret || payload) await clearOfflineSnapshot();
    return null;
  }
  try {
    return openOfflineSnapshot(payload, secret);
  } catch {
    await clearOfflineSnapshot();
    return null;
  }
}

export async function replaceOfflineSnapshot(
  snapshot: OfflineSnapshotV1,
): Promise<void> {
  let secret = await SecureStore.getItemAsync(KEY_NAME);
  const created = !secret;
  if (!secret) {
    secret = bytesToHex(Crypto.getRandomBytes(32));
    await SecureStore.setItemAsync(KEY_NAME, secret);
  }
  const payload = sealOfflineSnapshot(
    snapshot,
    secret,
    Crypto.getRandomBytes(12),
  );
  try {
    await AsyncStorage.setItem(DATA_NAME, payload);
  } catch (error) {
    if (created) await SecureStore.deleteItemAsync(KEY_NAME);
    throw error;
  }
}
