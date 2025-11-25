export type ThemeMode = "light" | "dark" | "system";
export type InterfaceLanguage = "es" | "en";

export interface BlobLike {
  data: string;
  mimeType: string;
}

export interface GeneratedOutput {
  platform: string;
  content: string;
}
