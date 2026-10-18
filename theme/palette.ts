// 色は役割の名前で持つ。画面はこのトークンだけで色を付ける。
const light = {
  text: "#11181C",
  textSecondary: "#5B6670",
  background: "#FFFFFF",
  surface: "#F2F4F6",
  border: "#D0D5DA",
  primary: "#0B6BCB",
  onPrimary: "#FFFFFF",
  link: "#0B6BCB",
} as const;

export type Palette = { [K in keyof typeof light]: string };

export const lightPalette: Palette = light;

// Palette 型を満たさないと（キーの過不足があると）型エラーになる。
export const darkPalette: Palette = {
  text: "#ECEDEE",
  textSecondary: "#9BA1A6",
  background: "#0F1417",
  surface: "#1B2126",
  border: "#323A41",
  primary: "#6CB6FF",
  onPrimary: "#0F1417",
  link: "#6CB6FF",
};
