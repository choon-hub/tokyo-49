import appJson from "../app.json";
import { darkPalette } from "../theme/palette";

// アプリの土台となる設定。値を変えるのは要件の変更にあたるので、
// 意図して変えるときはこのテストも合わせて直すこと。
describe("app.json の土台設定", () => {
  const { expo } = appJson;

  it("アプリ名と slug は tokyo-49", () => {
    expect(expo.name).toBe("tokyo-49");
    expect(expo.slug).toBe("tokyo-49");
  });

  it("画面の向きは縦固定", () => {
    expect(expo.orientation).toBe("portrait");
  });

  it("ライト／ダークはシステム設定に追従（automatic）", () => {
    expect(expo.userInterfaceStyle).toBe("automatic");
  });

  it("スプラッシュのダーク背景はダークパレットの background と一致", () => {
    const splash = expo.plugins.find(
      (p) => Array.isArray(p) && p[0] === "expo-splash-screen",
    ) as [string, { dark: { backgroundColor: string } }];
    expect(splash[1].dark.backgroundColor).toBe(darkPalette.background);
  });

  it("対応プラットフォームは Android のみ", () => {
    expect(expo.platforms).toEqual(["android"]);
  });

  it("applicationId は暫定値 com.tokyo49.app（確定は #29）", () => {
    expect(expo.android.package).toBe("com.tokyo49.app");
  });
});
