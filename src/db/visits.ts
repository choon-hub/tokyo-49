import type { SQLiteDatabase } from "expo-sqlite";

import { findMunicipalityByCode } from "../data/municipalities";
import { isValidDateString } from "../lib/date";
import type { TransferVisit } from "../lib/transfer";

// visits テーブルへの読み書きはこのモジュールに集める（要件書 §5.2）。

export type VisitSource = "station" | "town" | "manual";

export type NewVisit = {
  municipalityCode: string;
  /** 'YYYY-MM-DD'（ローカル日付） */
  visitedOn: string;
  memo: string | null;
  source: VisitSource;
  placeName: string;
  /** 候補から選んだときの辞書の id（参考値。§5.2）。手動のときは省く */
  refId?: number | null;
};

export type Visit = {
  id: number;
  placeName: string;
  municipalityCode: string;
  source: VisitSource;
  refId: number | null;
  visitedOn: string;
  memo: string | null;
  createdAt: string;
  updatedAt: string;
};

type VisitRow = {
  id: number;
  place_name: string;
  municipality_code: string;
  source: VisitSource;
  ref_id: number | null;
  visited_on: string;
  memo: string | null;
  created_at: string;
  updated_at: string;
};

/** 空・空白だけのメモは NULL にする。 */
function normalizeMemo(memo: string | null): string | null {
  if (memo === null) return null;
  return memo.trim() === "" ? null : memo;
}

/** 訪問で編集できる列（区市・source・ref_id は変えられない。Q20）。 */
export type VisitChanges = {
  placeName: string;
  /** 'YYYY-MM-DD'（ローカル日付） */
  visitedOn: string;
  memo: string | null;
};

/** 追加と編集で共通の検証。 */
function validateVisitFields(input: {
  placeName: string;
  visitedOn: string;
}): void {
  if (!isValidDateString(input.visitedOn)) {
    throw new Error(`訪問日の形式が正しくありません: ${input.visitedOn}`);
  }
  if (input.placeName.trim() === "") {
    throw new Error("場所名が空です");
  }
}

/** 訪問を1行追加し、追加した行の id を返す。 */
export async function addVisit(
  db: SQLiteDatabase,
  input: NewVisit,
): Promise<number> {
  // 外部キーがないので、区市コードはここでマスタと突き合わせる（§5）。
  if (!findMunicipalityByCode(input.municipalityCode)) {
    throw new Error(`49区市にない区市コードです: ${input.municipalityCode}`);
  }
  validateVisitFields(input);
  const now = new Date().toISOString();
  const result = await db.runAsync(
    `INSERT INTO visits
  (place_name, municipality_code, source, ref_id, visited_on, memo, created_at, updated_at)
VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.placeName,
      input.municipalityCode,
      input.source,
      input.refId ?? null,
      input.visitedOn,
      normalizeMemo(input.memo),
      now,
      now,
    ],
  );
  return result.lastInsertRowId;
}

/**
 * 訪問1行の場所名・訪問日・メモを更新し、updated_at を保存した時刻にする。
 * 場所名は前後の空白を除く。指定した id の行が無ければ拒否する。
 */
export async function updateVisit(
  db: SQLiteDatabase,
  id: number,
  changes: VisitChanges,
): Promise<void> {
  validateVisitFields(changes);
  const result = await db.runAsync(
    `UPDATE visits
SET place_name = ?, visited_on = ?, memo = ?, updated_at = ?
WHERE id = ?`,
    [
      changes.placeName.trim(),
      changes.visitedOn,
      normalizeMemo(changes.memo),
      new Date().toISOString(),
      id,
    ],
  );
  if (result.changes === 0) {
    throw new Error(`訪問が見つかりません: ${id}`);
  }
}

/** 訪問を1行削除する。指定した id の行が無ければ拒否する。 */
export async function deleteVisit(
  db: SQLiteDatabase,
  id: number,
): Promise<void> {
  const result = await db.runAsync("DELETE FROM visits WHERE id = ?", [id]);
  if (result.changes === 0) {
    throw new Error(`訪問が見つかりません: ${id}`);
  }
}

/** インポートの取り込み方（要件書 §2.5）。 */
export type ImportMode = "merge" | "overwrite";

export type ImportResult = {
  /** 追加した件数 */
  added: number;
  /** 既存と重複していて取り込まなかった件数（上書きでは常に 0） */
  skipped: number;
};

/** 重複判定キー（placeName + municipalityCode + visitedOn）。 */
const duplicateKey = (
  placeName: string,
  municipalityCode: string,
  visitedOn: string,
) => JSON.stringify([placeName, municipalityCode, visitedOn]);

/**
 * 検証済みの訪問を取り込む（要件書 §2.5）。検証は parseImport で済ませておく。
 * - merge: 取り込み前からある行と重複判定キーが一致する行はスキップし、残りを追加する
 * - overwrite: 既存の訪問をすべて削除してから、全件を追加する
 * どちらも1トランザクションで行い、途中で失敗したら何も変わらない。
 */
export async function importVisits(
  db: SQLiteDatabase,
  visits: readonly TransferVisit[],
  mode: ImportMode,
): Promise<ImportResult> {
  let added = 0;
  let skipped = 0;
  const now = new Date().toISOString();
  await db.withExclusiveTransactionAsync(async (txn) => {
    const existing = new Set<string>();
    if (mode === "overwrite") {
      await txn.runAsync("DELETE FROM visits");
    } else {
      const rows = await txn.getAllAsync<
        Pick<VisitRow, "place_name" | "municipality_code" | "visited_on">
      >("SELECT place_name, municipality_code, visited_on FROM visits");
      for (const row of rows) {
        existing.add(
          duplicateKey(row.place_name, row.municipality_code, row.visited_on),
        );
      }
    }
    for (const visit of visits) {
      if (
        existing.has(
          duplicateKey(visit.placeName, visit.municipalityCode, visit.visitedOn),
        )
      ) {
        skipped++;
        continue;
      }
      await txn.runAsync(
        `INSERT INTO visits
  (place_name, municipality_code, source, ref_id, visited_on, memo, created_at, updated_at)
VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          visit.placeName,
          visit.municipalityCode,
          visit.source,
          visit.refId,
          visit.visitedOn,
          visit.memo,
          visit.createdAt ?? now,
          visit.updatedAt ?? visit.createdAt ?? now,
        ],
      );
      added++;
    }
  });
  return { added, skipped };
}

function toVisit(row: VisitRow): Visit {
  return {
    id: row.id,
    placeName: row.place_name,
    municipalityCode: row.municipality_code,
    source: row.source,
    refId: row.ref_id,
    visitedOn: row.visited_on,
    memo: row.memo,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** 全訪問を、訪問日の新しい順（同日なら追加の新しい順）で返す。 */
export async function listVisits(db: SQLiteDatabase): Promise<Visit[]> {
  const rows = await db.getAllAsync<VisitRow>(
    "SELECT * FROM visits ORDER BY visited_on DESC, id DESC",
  );
  return rows.map(toVisit);
}

/**
 * 1つの区市の訪問を、訪問日の新しい順（同日なら追加の新しい順）で返す。
 * 絞り込みには idx_visits_muni が使われる（要件書 §5.2）。
 */
export async function listVisitsByMunicipality(
  db: SQLiteDatabase,
  municipalityCode: string,
): Promise<Visit[]> {
  const rows = await db.getAllAsync<VisitRow>(
    `SELECT * FROM visits
WHERE municipality_code = ?
ORDER BY visited_on DESC, id DESC`,
    [municipalityCode],
  );
  return rows.map(toVisit);
}

/** 区市コードごとの訪問回数。 */
export type MunicipalityVisitCount = {
  municipalityCode: string;
  visitCount: number;
};

/**
 * 区市コードごとの訪問回数を返す（要件書 §5.2 の制覇判定クエリ）。
 * 行のない区市は結果に含まれない。マスタとの突き合わせは呼び出し側で行う。
 */
export async function countVisitsByMunicipality(
  db: SQLiteDatabase,
): Promise<MunicipalityVisitCount[]> {
  const rows = await db.getAllAsync<{
    municipality_code: string;
    visit_count: number;
  }>(
    `SELECT municipality_code, COUNT(*) AS visit_count
FROM visits
GROUP BY municipality_code
ORDER BY municipality_code`,
  );
  return rows.map((row) => ({
    municipalityCode: row.municipality_code,
    visitCount: row.visit_count,
  }));
}
