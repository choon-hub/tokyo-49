# tokyo-49

Android スマホ向けアプリ（Expo Router + React Native + TypeScript）。
画面は縦固定・日本語のみ。通信を必要とせず、外部サービスに依存しない。

要件は [docs/requirements.md](docs/requirements.md) を参照。

## 前提環境

- Node.js 20 以上（動作確認: v24）
- Android Studio（Android SDK / エミュレータ）または USB デバッグを有効にした Android 実機
- JDK 17 以上
- 環境変数 `ANDROID_HOME` が Android SDK を指していること（`adb` に PATH が通っていること）

## セットアップ

```bash
npm install
```

## 開発ビルドの起動手順

ネイティブコードを含む開発ビルド（Development Build）で起動する。Expo Go は使わない。

1. エミュレータを起動するか、実機を USB 接続する（`adb devices` で認識されること）
2. 開発ビルドをインストールして起動する

   ```bash
   npm run android
   ```

   初回は `android/` が自動生成（prebuild）され、Gradle ビルド後に端末へインストールされる。
   `android/` は生成物のため Git 管理しない。

3. 以降は開発サーバーだけ起動すれば、インストール済みの開発ビルドに接続できる

   ```bash
   npm start
   ```

起動すると、縦固定の空のホーム画面が表示される。端末を横に倒しても回転しない。

## 実機・エミュレータでの確認

土台（#34）の確認項目。実機・エミュレータでの確認は人が行う。

- ランチャーのアプリ名が「tokyo-49」で、起動するとホーム画面が出る
- 端末を横に倒しても画面が回転しない
- 存在しないパスを開くと、日本語の「ページが見つかりません」が出て、「ホームへ戻る」でホームに戻れる

  ```bash
  adb shell am start -a android.intent.action.VIEW -d tokyo49://foo
  ```

- 機内モードでも起動してホーム画面が出る。開発ビルドは Metro に接続するため、Metro に依存しない release バリアントで確認する

  ```bash
  npx expo run:android --variant release
  ```

  インストール後、端末を機内モードにしてからアプリを起動し直す。
  release バリアントは prebuild 既定のデバッグ署名で動く。正式な署名鍵は #29 で扱う。

## スクリプト

| コマンド | 内容 |
| --- | --- |
| `npm start` | 開発サーバーを起動（`expo start`） |
| `npm run android` | 開発ビルドを作成して Android 端末で起動（`expo run:android`） |
| `npm run typecheck` | 型チェック（`tsc --noEmit`） |
| `npm run lint` | ESLint による静的解析（`expo lint`） |
| `npm test` | テスト実行（Jest / jest-expo） |
| `npm run check` | typecheck → lint → test を順に実行（CI と同じ。変更後は必ず通す） |

## 構成

```
app/            Expo Router のルート（app/index.tsx がホーム画面、app/+not-found.tsx が未マッチ画面）
assets/images/  アイコン・スプラッシュ画像
__tests__/      テスト
```

## 補足

- `applicationId`（`android.package`）は暫定値 `com.tokyo49.app`。確定は #29 で行う。
- Expo SDK 57 を使用。依存パッケージは `npx expo install --check` で SDK との整合性を確認できる。
- `react-dom` は expo のオプショナル peer 依存の解決（npm の ERESOLVE 回避）のため `19.2.3` に固定している。Web 向けには使用しない。
