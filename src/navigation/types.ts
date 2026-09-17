export type Routes = {
  Home: undefined;
  Schedule: undefined;
  Library: undefined;
  Announcements: undefined;
  Profile: undefined;
  Week: { day: string };
  Service: { id: string };
  Practice: { serviceId: string };
  Arrangement: { serviceId: string; itemId: string };
  AddSongs: { serviceId: string };
  Song: { id: string };
  SongEdit: { id?: string } | undefined;
  Targets: { songId: string };
  People: undefined;
  ManageServices: undefined;
  Rules: undefined;
};
export type RootRoutes = {
  MainTabs: undefined;
  Practice: { serviceId: string };
  MetronomeAddSongs: { serviceId: string };
};
