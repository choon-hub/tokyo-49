import { useColorScheme } from "react-native";

import { darkPalette, lightPalette, type Palette } from "./palette";

/** システム設定に追従したパレット。取れないとき（null など）はライト。 */
export function useTheme(): Palette {
  return useColorScheme() === "dark" ? darkPalette : lightPalette;
}
