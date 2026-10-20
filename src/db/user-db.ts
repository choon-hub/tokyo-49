import type { SQLiteDatabase } from "expo-sqlite";

// ユーザーデータ（訪問記録）を入れる DB。辞書の dict.db とは別ファイル（要件書 §3・§5）。
export const USER_DB_NAME = "user.db";

// スキーマの版は PRAGMA user_version で管理する。
// MIGRATIONS[i] を適用すると版が i + 1 になる。スキーマを変えるときは末尾に足す。
const MIGRATIONS: readonly string[] = [
  // v1: 要件書 §5.2 の visits
  `CREATE TABLE visits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  place_name TEXT NOT NULL,
  municipality_code TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('station','town','manual')),
  ref_id INTEGER,
  visited_on TEXT NOT NULL,
  memo TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_visits_muni ON visits(municipality_code);`,
];

export const USER_DB_VERSION = MIGRATIONS.length;

/** 未適用のマイグレーションを順に流す。適用済みなら何もしない。 */
export async function migrateUserDb(db: SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>(
    "PRAGMA user_version",
  );
  const current = row?.user_version ?? 0;
  if (current >= USER_DB_VERSION) return;

  await db.withExclusiveTransactionAsync(async (txn) => {
    for (let version = current; version < USER_DB_VERSION; version++) {
      await txn.execAsync(MIGRATIONS[version]);
    }
    // PRAGMA はパラメータを取れない。値は定数なので埋め込んでよい。
    await txn.execAsync(`PRAGMA user_version = ${USER_DB_VERSION}`);
  });
}
