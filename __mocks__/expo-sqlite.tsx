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
