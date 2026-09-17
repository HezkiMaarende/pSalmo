export type ThemeMode = "light" | "dark";
export const themeStorageKey = "psalmo:theme:v1";
export const parseThemeMode = (value: string | null): ThemeMode =>
  value === "dark" ? "dark" : "light";
export const palettes = {
  light: {
    background: "#FFFFFF",
    surface: "#F3F7F9",
    teal: "#2F6782",
    ink: "#162F38",
    muted: "#526B78",
    border: "#D8E4EA",
    onAccent: "#FFFFFF",
    error: "#A52A30",
    transport: "#2F6782",
  },
  dark: {
    background: "#192026",
    surface: "#252F38",
    teal: "#FF9B45",
    ink: "#F5F7FA",
    muted: "#B7C1C9",
    border: "#36414B",
    onAccent: "#192026",
    error: "#FF9E9E",
    transport: "#3A3A3A",
  },
};
export type ThemeColors = typeof palettes.light;
export interface ThemeStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

// Serialized writes make rapid toggles deterministic; auth never owns this key.
export class ThemePreference {
  private writes: Promise<void> = Promise.resolve();
  constructor(private storage: ThemeStorage) {}
  async read(): Promise<ThemeMode> {
    return parseThemeMode(await this.storage.getItem(themeStorageKey));
  }
  save(mode: ThemeMode): Promise<void> {
    const write = this.writes.then(() =>
      this.storage.setItem(themeStorageKey, mode),
    );
    this.writes = write.catch(() => {});
    return write;
  }
}
