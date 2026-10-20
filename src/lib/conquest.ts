import { findMunicipalityByCode } from "../data/municipalities";
import type { MunicipalityVisitCount } from "../db/visits";

export type ConquestSummary = {
  /** 訪問済みの区市コードの集合（49区市のマスタにあるものだけ） */
  visitedCodes: ReadonlySet<string>;
  /** 訪問済みの区市の数（制覇数） */
  visitedCount: number;
};

/**
 * 区市ごとの訪問回数から、訪問済みの区市と制覇数を求める。
 * 回数が1以上の区市だけを訪問済みとし、何回訪問しても1と数える。
 * マスタにないコードは数えない（user.db には外部キーがないため）。
 */
export function summarizeConquest(
  counts: readonly MunicipalityVisitCount[],
): ConquestSummary {
  const visitedCodes = new Set<string>();
  for (const { municipalityCode, visitCount } of counts) {
    if (visitCount > 0 && findMunicipalityByCode(municipalityCode)) {
      visitedCodes.add(municipalityCode);
    }
  }
  return { visitedCodes, visitedCount: visitedCodes.size };
}
