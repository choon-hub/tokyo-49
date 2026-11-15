import { findMunicipalityByCode } from "../data/municipalities";
import { isValidDateString } from "./date";

// JSON エクスポート／インポートの形式と検証（要件書 §2.5）。DB には触れない。

export const TRANSFER_VERSION = 1;

type Source = "station" | "town" | "manual";
const SOURCES: readonly string[] = ["station", "town", "manual"];

/** エクスポートファイルの訪問1件。 */
export type TransferVisit = {
  placeName: string;
  municipalityCode: string;
  source: Source;
  /** 辞書の id。参考値として保持するだけで、整合は取らない */
  refId: number | null;
  /** 'YYYY-MM-DD' */
  visitedOn: string;
  memo: string | null;
  /** ISO 8601。古いファイルや手書きのファイルには無いことがある */
  createdAt: string | null;
  updatedAt: string | null;
};

export type TransferFile = {
  version: typeof TRANSFER_VERSION;
  /** ISO 8601 (UTC) */
  exportedAt: string;
  visits: TransferVisit[];
};

/** 全訪問からエクスポートファイルの中身を作る。辞書は対象外。 */
export function buildExport(
  visits: readonly TransferVisit[],
  now: Date,
): TransferFile {
  return {
    version: TRANSFER_VERSION,
    exportedAt: now.toISOString(),
    visits: visits.map((visit) => ({
      placeName: visit.placeName,
      municipalityCode: visit.municipalityCode,
      source: visit.source,
      refId: visit.refId,
      visitedOn: visit.visitedOn,
      memo: visit.memo,
      createdAt: visit.createdAt,
      updatedAt: visit.updatedAt,
    })),
  };
}

export type ParseImportResult =
  | { ok: true; visits: TransferVisit[] }
  /** error は、最初に見つかった不正箇所の説明 */
  | { ok: false; error: string };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** 訪問1件を検証する。不正なら理由の文字列、正しければ取り込む形を返す。 */
function parseVisit(value: unknown, at: string): TransferVisit | string {
  if (!isRecord(value)) return `${at} がオブジェクトではありません`;

  for (const key of [
    "placeName",
    "municipalityCode",
    "source",
    "visitedOn",
  ] as const) {
    if (value[key] === undefined || value[key] === null) {
      return `${at}.${key} がありません`;
    }
    if (typeof value[key] !== "string") {
      return `${at}.${key} が文字列ではありません`;
    }
  }
  const { placeName, municipalityCode, source, visitedOn } = value as Record<
    "placeName" | "municipalityCode" | "source" | "visitedOn",
    string
  >;

  if (placeName.trim() === "") return `${at}.placeName が空です`;
  if (!findMunicipalityByCode(municipalityCode)) {
    return `${at}.municipalityCode が49区市のコードではありません（${municipalityCode}）`;
  }
  if (!SOURCES.includes(source)) {
    return `${at}.source が station / town / manual のいずれでもありません（${source}）`;
  }
  if (!isValidDateString(visitedOn)) {
    return `${at}.visitedOn が実在する YYYY-MM-DD の日付ではありません（${visitedOn}）`;
  }

  const memo = value.memo ?? null;
  if (memo !== null && typeof memo !== "string") {
    return `${at}.memo が文字列でも null でもありません`;
  }
  const refId = value.refId ?? null;
  if (refId !== null && !Number.isSafeInteger(refId)) {
    return `${at}.refId が整数でも null でもありません`;
  }
  for (const key of ["createdAt", "updatedAt"] as const) {
    const timestamp = value[key] ?? null;
    if (timestamp !== null && typeof timestamp !== "string") {
      return `${at}.${key} が文字列ではありません`;
    }
  }

  return {
    placeName,
    municipalityCode,
    source: source as Source,
    refId: refId as number | null,
    visitedOn,
    // アプリで保存するときと同じく、空・空白だけのメモは null にする。
    memo: memo === null || memo.trim() === "" ? null : memo,
    createdAt: (value.createdAt ?? null) as string | null,
    updatedAt: (value.updatedAt ?? null) as string | null,
  };
}

/**
 * インポートするファイルの中身を検証する。
 * 1件でも不正ならファイル全体を拒否し、最初の不正箇所を返す。
 */
export function parseImport(text: string): ParseImportResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: "JSON として読み取れません" };
  }
  if (!isRecord(data)) {
    return { ok: false, error: "ファイルの形式が正しくありません" };
  }
  if (data.version !== TRANSFER_VERSION) {
    return {
      ok: false,
      error: `version が ${TRANSFER_VERSION} ではありません`,
    };
  }
  if (!Array.isArray(data.visits)) {
    return { ok: false, error: "visits が配列ではありません" };
  }

  const visits: TransferVisit[] = [];
  for (let i = 0; i < data.visits.length; i++) {
    const parsed = parseVisit(data.visits[i], `visits[${i}]`);
    if (typeof parsed === "string") return { ok: false, error: parsed };
    visits.push(parsed);
  }
  return { ok: true, visits };
}
