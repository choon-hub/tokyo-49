import { renderHook } from "@testing-library/react-native";
import * as RN from "react-native";

import { contrastRatio } from "../theme/contrast";
import { darkPalette, lightPalette, type Palette } from "../theme/palette";
import { useTheme } from "../theme/use-theme";

describe("contrastRatio", () => {
  it("白と黒は 21:1", () => {
    expect(contrastRatio("#FFFFFF", "#000000")).toBeCloseTo(21, 5);
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 5);
  });

  it("同じ色どうしは 1:1", () => {
    expect(contrastRatio("#0B6BCB", "#0B6BCB")).toBeCloseTo(1, 5);
  });

  it("従来のブランド色 #208AEF と白は AA に届かない（約3.5:1）", () => {
    expect(contrastRatio("#208AEF", "#FFFFFF")).toBeLessThan(4.5);
  });
});

const textPairs: [keyof Palette, keyof Palette][] = [
  ["text", "background"],
  ["text", "surface"],
  ["textSecondary", "background"],
  ["textSecondary", "surface"],
  ["link", "background"],
  ["link", "surface"],
  ["onPrimary", "primary"],
];

describe.each([
  ["ライト", lightPalette],
  ["ダーク", darkPalette],
])("%s パレットの文字コントラスト（WCAG AA 4.5:1）", (_name, palette) => {
  it.each(textPairs)("%s / %s", (fg, bg) => {
    expect(contrastRatio(palette[fg], palette[bg])).toBeGreaterThanOrEqual(4.5);
  });
});

describe("useTheme", () => {
  const spy = jest.spyOn(RN, "useColorScheme");
  afterEach(() => spy.mockReset());

  it.each([
    ["dark", darkPalette],
    ["light", lightPalette],
    [null, lightPalette],
    [undefined, lightPalette],
  ] as const)("%s のとき期待のパレット", (scheme, expected) => {
    spy.mockReturnValue(scheme as RN.ColorSchemeName);
    expect(renderHook(() => useTheme()).result.current).toBe(expected);
  });
});
