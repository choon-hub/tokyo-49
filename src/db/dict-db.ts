import {
  importDatabaseFromAssetAsync,
  openDatabaseAsync,
  type SQLiteDatabase,
} from "expo-sqlite";

import { DICT_VERSION } from "../data/dict-version";

// 辞書 DB（駅・町域）。事前に作ったものをアプリに同梱し、読み取り専用で使う（要件書 §4.2・§5）。
// ユーザーデータの user.db とは別ファイルで、ここからは user.db に一切触れない。
export const DICT_DB_NAME = "dict.db";

/** 端末内の辞書を、同梱している辞書で入れ替えるべきか。installed は端末内の版（無ければ null）。 */
export function shouldReplaceDict(
  installed: number | null,
  bundled: number,
): boolean {
  return installed === null || installed < bundled;
}

/** 辞書の版（meta.dict_version）を読む。辞書が空・壊れているなどで読めなければ null。 */
export async function readDictVersion(
  db: SQLiteDatabase,
): Promise<number | null> {
  try {
    const row = await db.getFirstAsync<{ value: string }>(
      "SELECT value FROM meta WHERE key = 'dict_version'",
    );
    const version = Number(row?.value);
    return row && Number.isInteger(version) ? version : null;
  } catch {
    // まだ辞書をコピーしていない端末では meta テーブルが無い。
    return null;
  }
}

/**
 * 辞書 DB を開く。端末内に辞書が無いか、同梱版のほうが新しければ、
 * 同梱の dict.db で丸ごと上書きしてから開く。
 */
export async function openDictDb(): Promise<SQLiteDatabase> {
  const db = await openDatabaseAsync(DICT_DB_NAME);
  const installed = await readDictVersion(db);
  if (!shouldReplaceDict(installed, DICT_VERSION)) return db;

  await db.closeAsync();
  await importDatabaseFromAssetAsync(DICT_DB_NAME, {
    assetId: require("../../assets/dict/dict.db"),
    forceOverwrite: true,
  });
  return openDatabaseAsync(DICT_DB_NAME);
}
