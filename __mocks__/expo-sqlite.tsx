import type { ReactNode } from "react";

// jest ではネイティブの SQLite が動かないので差し替える（node_modules の自動モック）。
// DB の読み書きは src/db のテストで偽の DB を渡して確かめる。
// 画面のテストでは src/db のモジュールをモックし、ここの DB には触れさせない。
const db = {};

export function SQLiteProvider({ children }: { children: ReactNode }) {
  return children;
}

export function useSQLiteContext() {
  return db;
}

// 辞書 DB（src/db/dict-db.ts）用。版を読めない空の辞書として振る舞い、同梱版のコピーは何もしない。
const dictDb = {
  async getFirstAsync() {
    return null;
  },
  async closeAsync() {},
};

export async function openDatabaseAsync() {
  return dictDb;
}

export async function importDatabaseFromAssetAsync() {}
