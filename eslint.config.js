// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*"],
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
]);
