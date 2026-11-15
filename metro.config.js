// https://docs.expo.dev/guides/customizing-metro/
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// 同梱する辞書（assets/dict/dict.db）をアセットとして扱う。
config.resolver.assetExts.push("db");

module.exports = config;
