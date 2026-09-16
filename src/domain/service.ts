export type MembershipRole = "owner" | "admin" | "member";
export type ServiceStatus = "draft" | "approved" | "archived" | "cancelled";
export type ServiceType = "ir_1_2" | "ir_3";

export interface SongStructureSection {
  section: string;
  bars: number | null;
}

export interface SetlistItemDraft {
  songId?: string;
  proposedTitle?: string;
  artist?: string;
  key?: string;
  bpm?: number;
  timeSignature?: string;
  structure?: SongStructureSection[];
  lyricsOrChords?: string;
  arrangementUrl?: string;
  notes?: string;
}
