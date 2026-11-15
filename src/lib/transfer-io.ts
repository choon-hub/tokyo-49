import * as DocumentPicker from "expo-document-picker";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";

// エクスポート／インポートのファイルの受け渡し。端末の中だけで完結し、通信はしない。

/**
 * 文字列をキャッシュ領域のファイルに書き出し、Android の共有シートで渡す。
 * 保存先や渡す相手（ファイルアプリ・ドライブなど）は、利用者が共有シートで選ぶ。
 */
export async function shareTextFile(
  fileName: string,
  content: string,
): Promise<void> {
  const file = new File(Paths.cache, fileName);
  file.create({ overwrite: true });
  file.write(content);
  await Sharing.shareAsync(file.uri, {
    mimeType: "application/json",
    dialogTitle: "訪問履歴を書き出す",
  });
}

/**
 * 端末の標準のファイル選択画面でファイルを1つ選ばせ、中身を文字列で返す。
 * 選ばずに閉じたときは null。
 */
export async function pickTextFile(): Promise<string | null> {
  const result = await DocumentPicker.getDocumentAsync({
    // .json を別の種類として扱うファイルアプリがあるので、種類では絞らない。中身は読んでから検証する。
    type: "*/*",
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled) return null;
  return new File(result.assets[0].uri).text();
}
