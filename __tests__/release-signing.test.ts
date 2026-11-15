import { readFileSync } from "node:fs";
import { join } from "node:path";

import appJson from "../app.json";

const { applyReleaseSigning } = jest.requireActual<{
  applyReleaseSigning: (gradle: string) => string;
}>("../plugins/with-release-signing");

// Expo SDK 57 の prebuild テンプレート（android/app/build.gradle）の写し。
const TEMPLATE = readFileSync(
  join(__dirname, "fixtures", "app-build.gradle"),
  "utf8",
).replace(/\r\n/g, "\n");

describe("リリース署名の config plugin", () => {
  const result = applyReleaseSigning(TEMPLATE);

  it("app.json に登録されている", () => {
    expect(appJson.expo.plugins).toContain("./plugins/with-release-signing");
  });

  it("signingConfigs に、gradle プロパティから鍵を読む release を足す（debug は残す）", () => {
    const block = /signingConfigs \{[\s\S]*?\n {4}\}/.exec(result)?.[0] ?? "";
    expect(block).toContain("release {");
    expect(block).toContain(
      "storeFile file(project.property('TOKYO49_RELEASE_STORE_FILE'))",
    );
    expect(block).toContain(
      "storePassword project.property('TOKYO49_RELEASE_STORE_PASSWORD')",
    );
    expect(block).toContain(
      "keyAlias project.property('TOKYO49_RELEASE_KEY_ALIAS')",
    );
    expect(block).toContain(
      "keyPassword project.property('TOKYO49_RELEASE_KEY_PASSWORD')",
    );
    expect(block).toContain("storeFile file('debug.keystore')");
  });

  it("release ビルドは、鍵のプロパティがあれば release 鍵、無ければ debug 鍵で署名する", () => {
    const buildTypes = /buildTypes \{[\s\S]*?\n {4}\}/.exec(result)?.[0] ?? "";
    const [debug, release] = buildTypes.split("release {");
    expect(release).toContain(
      "signingConfig project.hasProperty('TOKYO49_RELEASE_STORE_FILE') ? signingConfigs.release : signingConfigs.debug",
    );
    // debug ビルドの署名は変えない
    expect(debug).toContain("signingConfig signingConfigs.debug");
    expect(debug).not.toContain("TOKYO49");
  });

  it("鍵の場所やパスワードそのものは書き込まない", () => {
    const added = result
      .split("\n")
      .filter((line) => !TEMPLATE.split("\n").includes(line));
    expect(added.join("\n")).not.toMatch(/\.jks|\.keystore|password\s*=/i);
  });

  it("署名以外の行は変えず、括弧の対応も崩さない", () => {
    const count = (text: string, char: string) => text.split(char).length - 1;
    expect(count(result, "{")).toBe(count(result, "}"));
    for (const line of TEMPLATE.split("\n")) {
      if (line.trim() === "signingConfig signingConfigs.debug") continue;
      expect(result).toContain(line);
    }
  });

  it("2回適用しても同じ結果になる", () => {
    expect(applyReleaseSigning(result)).toBe(result);
  });

  it("テンプレートの形が変わって署名設定が見つからなければ、失敗して知らせる", () => {
    expect(() => applyReleaseSigning("android {\n}\n")).toThrow(
      /署名設定が見つかりません/,
    );
  });
});
