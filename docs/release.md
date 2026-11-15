# 配布手順（APK を直接インストールする）

個人利用の APK を、**同じ署名で上書き更新できる形**で作るための手順です。
鍵の作成・保管と APK のビルドは人が行います（鍵はリポジトリに入れません）。

## 決まっていること

| 項目 | 値 | 注意 |
|---|---|---|
| applicationId | `com.tokyo49.app`（`app.json` の `android.package`） | **確定。以後は変更しない** |
| 署名鍵 | 自分で作った鍵 1 本 | **失くすと上書き更新できなくなる** |

applicationId か署名鍵のどちらかが変わると、Android は別のアプリとして扱います。
上書きインストールができず、端末内の訪問履歴（`user.db`）も引き継げません。
その場合は、古いアプリの設定画面（制覇数の長押し）から JSON をエクスポートし、新しいアプリでインポートしてください。

## 1. 署名鍵を作る（最初の1回だけ）

JDK に入っている `keytool` で作ります。リポジトリの外に置いてください。

```sh
keytool -genkeypair -v \
  -keystore ~/keys/tokyo-49-release.jks \
  -alias tokyo49 \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -storetype PKCS12
```

- パスワードを聞かれるので決めて、控えておきます（PKCS12 では、鍵のパスワードは鍵ストアと同じになります）。
- **鍵ファイルとパスワードは、PC の外にも控えを取ってください**（パスワードマネージャー、暗号化した外部ストレージなど）。
- `.gitignore` で `*.jks` `*.keystore` などは除外していますが、そもそもリポジトリの中に置かないのが安全です。

## 2. 鍵の場所を Gradle に伝える（PC ごとに1回）

`~/.gradle/gradle.properties`（Windows は `C:\Users\<ユーザー名>\.gradle\gradle.properties`）に次を書きます。
このファイルはリポジトリの外にあるので、コミットされません。

```properties
TOKYO49_RELEASE_STORE_FILE=C:/Users/<ユーザー名>/keys/tokyo-49-release.jks
TOKYO49_RELEASE_STORE_PASSWORD=<鍵ストアのパスワード>
TOKYO49_RELEASE_KEY_ALIAS=tokyo49
TOKYO49_RELEASE_KEY_PASSWORD=<鍵のパスワード>
```

- パスは `/` 区切りの絶対パスで書きます。
- この4つを読んでリリースビルドに署名する設定は、config plugin（`plugins/with-release-signing.js`）が prebuild のときに入れます。
- **プロパティが無い PC では、リリースビルドもデバッグ鍵で署名されます。** デバッグ鍵の APK は、自分の鍵の APK と互いに上書きできません。配布用は必ずこの設定をした PC で作ってください。

## 3. リリース APK を作る

```sh
npm ci
npm run check
npx expo prebuild --platform android --clean
cd android
./gradlew assembleRelease        # Windows は gradlew.bat assembleRelease
```

できあがる APK: `android/app/build/outputs/apk/release/app-release.apk`

自分の鍵で署名されたかを確かめます（Android SDK の build-tools にある `apksigner` を使います）。

```sh
apksigner verify --print-certs android/app/build/outputs/apk/release/app-release.apk
keytool -list -v -keystore ~/keys/tokyo-49-release.jks -alias tokyo49
```

2つの SHA-256 が同じなら、自分の鍵で署名されています。
`CN=Android Debug` と出たら、手順 2 の設定が読まれていません。

## 4. 端末に入れる

```sh
adb install -r android/app/build/outputs/apk/release/app-release.apk
```

または APK を端末にコピーして、ファイルアプリから開きます（提供元不明のアプリのインストールを許可する必要があります）。

## 5. 更新するとき

1. `app.json` の `version` を上げ、`android.versionCode` を前回より大きい整数にします（無ければ追加します。Android は versionCode が小さい APK での上書きを拒否します）。
2. 手順 3・4 をやり直します。**同じ鍵**で署名していれば、訪問履歴を残したまま上書きされます。
3. 辞書を作り直した場合は、`docs/data-sources.md` のとおり辞書の版を上げてあることを確かめます。起動時に辞書だけが入れ替わり、訪問履歴には触れません。

## 初回配布の前に確かめること

- [ ] 手順 3 の `apksigner` で、自分の鍵の証明書が出る
- [ ] インストールして、訪問を1件記録する
- [ ] version / versionCode を上げて作り直した APK を `adb install -r` で上書きし、記録が残っている
- [ ] 機種変更を想定して、エクスポート → 別端末（またはアンインストール後）でインポートできる

## うまくいかないとき

| 症状 | 原因と対処 |
|---|---|
| `INSTALL_FAILED_UPDATE_INCOMPATIBLE` | 端末に入っているアプリと署名が違う（デバッグ鍵の版や Development Build が入っている）。エクスポートしてからアンインストールし、入れ直してインポートする |
| `INSTALL_FAILED_VERSION_DOWNGRADE` | versionCode が端末の版より小さい。versionCode を上げる |
| prebuild が「署名設定が見つかりません」で止まる | Expo のテンプレートの形が変わった。`plugins/with-release-signing.js` の置き換え箇所を、新しい `android/app/build.gradle` に合わせて直す |
