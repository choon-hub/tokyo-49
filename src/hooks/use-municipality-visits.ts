import { useFocusEffect } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useRef, useState } from "react";

import { listVisitsByMunicipality, type Visit } from "../db/visits";

export type MunicipalityVisits = {
  /** 訪問日の新しい順。最初の読み込みが終わるまでは null */
  visits: Visit[] | null;
  /** 直近の読み込みに失敗した */
  loadFailed: boolean;
  /** 履歴を読み直す（フォーカスが変わらない画面内の保存の後に使う） */
  reload: () => void;
};

/**
 * 1つの区市の訪問履歴を、user.db の visits から読む。
 * 画面にフォーカスが来るたびと reload() のたびに読み直し、再読み込み中は前回の値を残す。
 * 区市コードはマスタにあるものを渡す（検証は呼び出し側で行う）。
 */
export function useMunicipalityVisits(
  municipalityCode: string,
): MunicipalityVisits {
  const db = useSQLiteContext();
  const [visits, setVisits] = useState<Visit[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  // 読み込みごとに番号を振り、最新の読み込みの結果だけを反映する。
  // フォーカスを外れたときや区市が変わったときも番号を進め、届いた結果を捨てる。
  const latestRequest = useRef(0);

  const load = useCallback(() => {
    const request = ++latestRequest.current;
    const run = async () => {
      try {
        const result = await listVisitsByMunicipality(db, municipalityCode);
        if (request !== latestRequest.current) return;
        setVisits(result);
        setLoadFailed(false);
      } catch {
        if (request === latestRequest.current) setLoadFailed(true);
      }
    };
    void run();
  }, [db, municipalityCode]);

  useFocusEffect(
    useCallback(() => {
      load();
      return () => {
        latestRequest.current++;
      };
    }, [load]),
  );

  return { visits, loadFailed, reload: load };
}
