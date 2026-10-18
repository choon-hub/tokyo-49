import { fireEvent, renderRouter, screen } from "expo-router/testing-library";
import * as RN from "react-native";

import { darkPalette, lightPalette } from "../theme/palette";

describe("未マッチ画面", () => {
  it("存在しないパスで日本語の画面が出て、英語の既定画面は出ない", async () => {
    renderRouter("./app", { initialUrl: "/foo" });

    expect(await screen.findByText("ページが見つかりません")).toBeTruthy();
    expect(screen.getByText("ホームへ戻る")).toBeTruthy();

    // expo-router 既定の未マッチ画面の文言
    expect(screen.queryByTestId("expo-router-unmatched")).toBeNull();
    expect(screen.queryByText("Unmatched Route")).toBeNull();
    expect(screen.queryByText("Page could not be found.")).toBeNull();
    expect(screen.queryByText("Go back")).toBeNull();
    expect(screen.queryByText("Sitemap")).toBeNull();
  });

  it.each([
    ["dark", darkPalette],
    ["light", lightPalette],
  ] as const)("%s のときそのテーマのトークン色で描画される", async (scheme, palette) => {
    const spy = jest.spyOn(RN, "useColorScheme").mockReturnValue(scheme);
    try {
      renderRouter("./app", { initialUrl: "/foo" });
      const title = await screen.findByText("ページが見つかりません");
      expect(title).toHaveStyle({ color: palette.text });
      expect(screen.getByText("ホームへ戻る")).toHaveStyle({
        color: palette.link,
      });
    } finally {
      spy.mockRestore();
    }
  });

  it("「ホームへ戻る」でホームに戻れる", async () => {
    const { getPathname } = renderRouter("./app", { initialUrl: "/foo" });
    expect(getPathname()).toBe("/foo");

    fireEvent.press(await screen.findByText("ホームへ戻る"));
    expect(getPathname()).toBe("/");
    expect(screen.queryByText("ページが見つかりません")).toBeNull();
  });
});
