import type { SQLiteDatabase } from "expo-sqlite";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import { openDictDb } from "./dict-db";

// SQLiteProvider は user.db に使っているので、辞書 DB は別の Context で配る。
const DictDbContext = createContext<SQLiteDatabase | null>(null);

/**
 * 起動時に辞書 DB を用意して、子に配る。
 * 用意が終わるまで、または失敗したときは null のまま。その間も画面は表示し、
 * 候補検索だけが使えない（区市の直接選択では記録できる）。
 */
export function DictDbProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<SQLiteDatabase | null>(null);

  useEffect(() => {
    let active = true;
    openDictDb().then(
      (opened) => {
        if (active) setDb(opened);
      },
      () => {
        // 辞書が使えなくても、アプリは動かす。
      },
    );
    return () => {
      active = false;
    };
  }, []);

  return (
    <DictDbContext.Provider value={db}>{children}</DictDbContext.Provider>
  );
}

/** 辞書 DB。まだ使えないときは null。 */
export function useDictDb(): SQLiteDatabase | null {
  return useContext(DictDbContext);
}
