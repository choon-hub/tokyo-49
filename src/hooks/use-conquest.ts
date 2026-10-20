import { useFocusEffect } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useState } from "react";

import { countVisitsByMunicipality } from "../db/visits";
import { summarizeConquest, type ConquestSummary } from "../lib/conquest";

export type Conquest = ConquestSummary & {
  /** 直近の読み込みに失敗した */
  loadFailed: boolean;
};

const EMPTY: ConquestSummary = { visitedCodes: new Set(), visitedCount: 0 };

/**
 * 訪問済みの区市と制覇数を、user.db の visits から求める。
 * 画面にフォーカスが来るたびに読み直すので、訪問入力から戻ったときも最新になる。
 * 最初の読み込みが終わるまでは「0 件・印なし」で、再読み込み中は前回の値を残す。
 */
export function useConquest(): Conquest {
  const db = useSQLiteContext();
  const [summary, setSummary] = useState(EMPTY);
  const [loadFailed, setLoadFailed] = useState(false);

  useFocusEffect(
    useCallback(() => {
      // フォーカスを外れた後に届いた結果は捨てる（戻ったときにまた読み直す）。
      let active = true;
      const load = async () => {
        try {
          const counts = await countVisitsByMunicipality(db);
          if (!active) return;
          setSummary(summarizeConquest(counts));
          setLoadFailed(false);
        } catch {
          if (active) setLoadFailed(true);
        }
      };
      void load();
      return () => {
        active = false;
      };
    }, [db]),
  );

  return { ...summary, loadFailed };
}
