import { createClient } from "@supabase/supabase-js";
import { AppState, Platform } from "react-native";
import "react-native-url-polyfill/auto";
import { secureAuthStorage } from "./secureAuthStorage";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const isConfigured = Boolean(url && publishableKey);

export const supabase = createClient(
  url || "https://placeholder.supabase.co",
  publishableKey || "missing",
  {
    auth: {
      ...(Platform.OS !== "web" ? { storage: secureAuthStorage } : {}),
      autoRefreshToken: true,
      persistSession: Platform.OS !== "web",
      detectSessionInUrl: false,
    },
  },
);

if (Platform.OS !== "web") {
  AppState.addEventListener("change", (state) => {
    if (state === "active") supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
