import type { SQLiteDatabase } from "expo-sqlite";

import {
  escapeLike,
  normalizeKana,
  normalizeName,
} from "../lib/search-normalize";

// dict.db に対する候補検索（要件書 §6）。

/** 一度に表示する候補の上限。これを超えた分は「他N件」で示す。 */
export const CANDIDATE_LIMIT = 30;

export type Candidate = {
  source: "station" | "town";
  /** 辞書の id（visits.ref_id に入れる参考値） */
  id: number;
  /** 駅名（「駅」なし）または町域名 */
  name: string;
  municipalityCode: string;
  municipalityName: string;
};

export type SearchResult = {
  /** 駅が先、次に町域。それぞれ名前順で、最大 CANDIDATE_LIMIT 件 */
  candidates: Candidate[];
  /** 上限で切る前の全ヒット件数 */
  total: number;
};

const EMPTY: SearchResult = { candidates: [], total: 0 };

// 名前はひらがな化する前の入力（?1）、読みはひらがな化した入力（?2）で前方一致させる。
// 要件書の SQL は両方を同じ値で引くが、それだと「天王洲アイル」のようにカタカナを含む名前が
// カタカナ入力で一致しなくなるため、名前用と読み用を分けている。
const STATION_WHERE = `s.name LIKE ?1 || '%' ESCAPE '!' OR s.kana LIKE ?2 || '%' ESCAPE '!'`;
const TOWN_WHERE = `t.name LIKE ?1 || '%' ESCAPE '!' OR t.kana LIKE ?2 || '%' ESCAPE '!'`;

const SEARCH_SQL = `
SELECT 'station' AS source, s.id AS id, s.name AS name,
       m.code AS municipalityCode, m.name AS municipalityName
  FROM stations s JOIN municipalities m ON m.code = s.municipality_code
 WHERE ${STATION_WHERE}
UNION ALL
SELECT 'town', t.id, t.name, m.code, m.name
  FROM towns t JOIN municipalities m ON m.code = t.municipality_code
 WHERE ${TOWN_WHERE}
ORDER BY source, 3, 4 LIMIT ${CANDIDATE_LIMIT}`;

const COUNT_SQL = `
SELECT (SELECT COUNT(*) FROM stations s WHERE ${STATION_WHERE})
     + (SELECT COUNT(*) FROM towns t WHERE ${TOWN_WHERE}) AS total`;

/**
 * 入力に前方一致する駅・町域を探す。部分一致はしない。
 * 正規化して空になる入力（空白だけ・「駅」だけ）は、何も返さない。
 */
export async function searchCandidates(
  db: SQLiteDatabase,
  input: string,
): Promise<SearchResult> {
  const name = normalizeName(input);
  if (name === "") return EMPTY;
  const params = [escapeLike(name), escapeLike(normalizeKana(input))];

  const candidates = await db.getAllAsync<Candidate>(SEARCH_SQL, params);
  // 上限に届いていなければ、表示している件数が全ヒット件数。
  if (candidates.length < CANDIDATE_LIMIT) {
    return { candidates, total: candidates.length };
  }
  const row = await db.getFirstAsync<{ total: number }>(COUNT_SQL, params);
  return { candidates, total: row?.total ?? candidates.length };
}

/** 候補の表示名。駅は「上野駅」、町域は町域名のまま（Q18）。保存する場所名にも使う。 */
export function candidatePlaceName(candidate: Candidate): string {
  return candidate.source === "station" ? `${candidate.name}駅` : candidate.name;
}

/** 候補の一覧での表示。`上野駅（台東区）` / `西新宿（新宿区）` */
export function candidateLabel(candidate: Candidate): string {
  return `${candidatePlaceName(candidate)}（${candidate.municipalityName}）`;
}
