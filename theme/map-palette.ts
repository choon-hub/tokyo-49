import { useColorScheme } from "react-native";

// 地図専用の配色。訪問済みと未訪問をどちらのテーマでもはっきり見分けられるよう、
// 共通パレットとは別に持つ（要件書 §2.4）。コントラストは __tests__/map-palette.test.ts で確かめる。
export type MapPalette = {
  /** 訪問済みの区市 */
  visited: string;
  /** 未訪問の区市 */
  unvisited: string;
  /** 区市の境界線 */
  border: string;
  /** 地図の背景（区市の外側） */
  background: string;
};

export const lightMapPalette: MapPalette = {
  visited: "#1F7AD9",
  unvisited: "#FFFFFF",
  border: "#1B2733",
  background: "#DCE6EE",
};

export const darkMapPalette: MapPalette = {
  visited: "#C4E2FF",
  unvisited: "#5C6974",
  border: "#05080A",
  background: "#1B2228",
};

/** システム設定に追従した地図のパレット。取れないときはライト。 */
export function useMapPalette(): MapPalette {
  return useColorScheme() === "dark" ? darkMapPalette : lightMapPalette;
}
