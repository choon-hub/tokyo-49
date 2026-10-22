import { useFocusEffect } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useState } from "react";

import { listVisitsByMunicipality, type Visit } from "../db/visits";

export type MunicipalityVisits = {
  /** 訪問日の新しい順。最初の読み込みが終わるまでは null */
  visits: Visit[] | null;
  /** 直近の読み込みに失敗した */
  loadFailed: boolean;
};

/**
 * 1つの区市の訪問履歴を、user.db の visits から読む。
 * 画面にフォーカスが来るたびに読み直し、再読み込み中は前回の値を残す。
 * 区市コードはマスタにあるものを渡す（検証は呼び出し側で行う）。
 */
export function useMunicipalityVisits(
  municipalityCode: string,
): MunicipalityVisits {
  const db = useSQLiteContext();
  const [visits, setVisits] = useState<Visit[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  useFocusEffect(
    useCallback(() => {
      // フォーカスを外れた後や、区市が変わった後に届いた結果は捨てる。
      let active = true;
      const load = async () => {
        try {
          const result = await listVisitsByMunicipality(db, municipalityCode);
          if (!active) return;
          setVisits(result);
          setLoadFailed(false);
        } catch {
          if (active) setLoadFailed(true);
        }
      };
      void load();
      return () => {
        active = false;
      };
    }, [db, municipalityCode]),
  );

  return { visits, loadFailed };
}
