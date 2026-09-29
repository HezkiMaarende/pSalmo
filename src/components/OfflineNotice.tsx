import React from "react";
import { useChurch } from "../context/ChurchContext";
import { Card, Body } from "./ui";

export function OfflineNotice() {
  const church = useChurch();
  if (church.connection !== "offline") return null;
  return (
    <Card>
      <Body>Mode offline · hanya baca</Body>
      <Body muted>
        Menampilkan salinan terakhir. Perubahan, video, Song Bank, dan Practice
        memerlukan internet.
      </Body>
    </Card>
  );
}
