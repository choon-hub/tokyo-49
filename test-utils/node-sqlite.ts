/// <reference types="node" />
import type { SQLiteDatabase } from "expo-sqlite";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";

// テスト用: Node 組み込みの SQLite（インメモリ）で expo-sqlite の非同期 API の一部を再現する。
// src/db が使うメソッドだけを持つ。本物の SQLite で DDL・制約・PRAGMA を確かめるために使う。

type Params = SQLInputValue[];

export type TestDatabase = {
  /** src/db に渡す DB */
  db: SQLiteDatabase;
  /** テストから直接 SQL を流して中身を確かめるための生の DB */
  raw: DatabaseSync;
};

export function openTestDatabase(): TestDatabase {
  const raw = new DatabaseSync(":memory:");
  const api = {
    async execAsync(source: string) {
      raw.exec(source);
    },
    async runAsync(source: string, params: Params = []) {
      const result = raw.prepare(source).run(...params);
      return {
        lastInsertRowId: Number(result.lastInsertRowid),
        changes: Number(result.changes),
      };
    },
    async getFirstAsync<T>(source: string, params: Params = []) {
      return (raw.prepare(source).get(...params) ?? null) as T | null;
    },
    async getAllAsync<T>(source: string, params: Params = []) {
      return raw.prepare(source).all(...params) as T[];
    },
    async withExclusiveTransactionAsync(
      task: (txn: SQLiteDatabase) => Promise<void>,
    ) {
      raw.exec("BEGIN EXCLUSIVE");
      try {
        await task(db);
        raw.exec("COMMIT");
      } catch (error) {
        raw.exec("ROLLBACK");
        throw error;
      }
    },
  };
  const db = api as unknown as SQLiteDatabase;
  return { db, raw };
}
