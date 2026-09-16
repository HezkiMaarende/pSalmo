import React, { useState } from "react";
import { View, Platform } from "react-native";
import { WebView } from "react-native-webview";
import appConfig from "../../app.json";
import { youtubeId } from "../domain/youtube";
import { Body, Button, Feedback, openLink, useAction } from "./ui";
export function VideoReference({ label, url }: { label: string; url: string }) {
  const [expanded, setExpanded] = useState(false);
  const [failed, setFailed] = useState(false);
  const action = useAction();
  const id = youtubeId(url);
  return (
    <View style={{ gap: 10 }}>
      <Button
        title={`${expanded ? "Tutup" : "Lihat"} video · ${label}`}
        onPress={() => setExpanded(!expanded)}
      />
      {expanded && (
        <>
          {id && !failed && Platform.OS !== "web" ? (
            <WebView
              style={{ height: 220, backgroundColor: "#eef3f5" }}
              source={{
                uri: `https://www.youtube.com/embed/${id}?autoplay=0&playsinline=1`,
                headers: {
                  Referer: `https://${Platform.OS === "ios" ? appConfig.expo.ios.bundleIdentifier : appConfig.expo.android.package}/`,
                },
              }}
              allowsFullscreenVideo
              mediaPlaybackRequiresUserAction
              javaScriptEnabled
              originWhitelist={["https://*"]}
              onError={() => setFailed(true)}
              onHttpError={() => setFailed(true)}
              onShouldStartLoadWithRequest={(request) =>
                request.url === "about:blank" ||
                /^https:\/\/(www\.)?youtube\.com\//.test(request.url)
              }
            />
          ) : (
            <Body muted>
              Gunakan tautan eksternal jika video tidak dapat diputar.
            </Body>
          )}
          <Button
            title="Buka referensi eksternal"
            onPress={() => void action.run(() => openLink(url))}
          />
          <Feedback error={action.error} />
        </>
      )}
    </View>
  );
}
