const { withAppBuildGradle } = require("expo/config-plugins");

// リリースビルドを自分の署名鍵で署名するための config plugin。
// android/ は prebuild の生成物で編集できないので、生成時に app/build.gradle を書き換える。
//
// 鍵の場所とパスワードはリポジトリに置かず、開発者の PC の ~/.gradle/gradle.properties から読む。
// プロパティが無い環境（CI や鍵を持たない PC）では、これまでどおりデバッグ鍵で署名する。
// 手順は docs/release.md。

const STORE_FILE = "TOKYO49_RELEASE_STORE_FILE";
const STORE_PASSWORD = "TOKYO49_RELEASE_STORE_PASSWORD";
const KEY_ALIAS = "TOKYO49_RELEASE_KEY_ALIAS";
const KEY_PASSWORD = "TOKYO49_RELEASE_KEY_PASSWORD";

const SIGNING_CONFIGS = /signingConfigs \{\n/;
// buildTypes の release ブロックにある、デバッグ鍵での署名の指定。
const RELEASE_SIGNING = /(release \{[^}]*?)signingConfig signingConfigs\.debug/;

const RELEASE_CONFIG = `signingConfigs {
        release {
            if (project.hasProperty('${STORE_FILE}')) {
                storeFile file(project.property('${STORE_FILE}'))
                storePassword project.property('${STORE_PASSWORD}')
                keyAlias project.property('${KEY_ALIAS}')
                keyPassword project.property('${KEY_PASSWORD}')
            }
        }
`;

/** app/build.gradle の中身に、リリース用の署名設定を足す。 */
function applyReleaseSigning(gradle) {
  if (gradle.includes(STORE_FILE)) return gradle; // 適用済み
  if (!SIGNING_CONFIGS.test(gradle) || !RELEASE_SIGNING.test(gradle)) {
    // テンプレートの形が変わったら、黙ってデバッグ鍵のままにせず止める。
    throw new Error(
      "with-release-signing: app/build.gradle の署名設定が見つかりません。Expo のテンプレートが変わった可能性があります。",
    );
  }
  return gradle
    .replace(SIGNING_CONFIGS, RELEASE_CONFIG)
    .replace(
      RELEASE_SIGNING,
      `$1signingConfig project.hasProperty('${STORE_FILE}') ? signingConfigs.release : signingConfigs.debug`,
    );
}

function withReleaseSigning(config) {
  return withAppBuildGradle(config, (mod) => {
    mod.modResults.contents = applyReleaseSigning(mod.modResults.contents);
    return mod;
  });
}

module.exports = withReleaseSigning;
module.exports.applyReleaseSigning = applyReleaseSigning;
