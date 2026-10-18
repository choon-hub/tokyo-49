import { DarkTheme, DefaultTheme } from "expo-router";

import { darkPalette, lightPalette, type Palette } from "./palette";

function create(base: typeof DefaultTheme, dark: boolean, palette: Palette) {
  return {
    ...base,
    dark,
    colors: {
      ...base.colors,
      primary: palette.primary,
      background: palette.background,
      card: palette.surface,
      text: palette.text,
      border: palette.border,
    },
  };
}

export const lightNavigationTheme = create(DefaultTheme, false, lightPalette);
export const darkNavigationTheme = create(DarkTheme, true, darkPalette);
