// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*", "scripts/build-data/.cache/*"],
  },
  {
    // オフラインで動作する前提なので、コードからの外部通信を禁止する。
    // 依存パッケージ経由の通信は AGENTS.md とレビューで止める。
    rules: {
      "no-restricted-globals": [
        "error",
        ...["fetch", "XMLHttpRequest", "WebSocket"].map((name) => ({
          name,
          message: "このアプリは通信を使わない。外部通信のコードは追加しない（AGENTS.md の Constraints）。",
        })),
      ],
    },
  },
  {
    // 辞書・地図の元データを取得するビルド用スクリプトだけは通信してよい。
    // 開発者の PC で実行するもので、アプリには含まれない（docs/data-sources.md）。
    files: ["scripts/build-data/download.mjs"],
    rules: {
      "no-restricted-globals": "off",
    },
  },
]);
