import { useSQLiteContext } from "expo-sqlite";

import type { Municipality } from "../data/municipalities";
import { addVisit } from "../db/visits";
import { toLocalDateString } from "../lib/date";
import { VisitForm, type VisitFormValues } from "./VisitForm";

type Props = {
  /** 追記先の区市（シートで確定しているので選ばせない） */
  municipality: Municipality;
  /** 保存が成功した後に呼ぶ */
  onSaved: () => void;
  onCancel: () => void;
};

// 区市シートの追記フォーム。初期値は今日・空欄。
// 辞書を通さないので source は 'manual'。
export function AddVisitForm({ municipality, onSaved, onCancel }: Props) {
  const db = useSQLiteContext();

  const submit = async (values: VisitFormValues) => {
    await addVisit(db, {
      municipalityCode: municipality.code,
      visitedOn: values.visitedOn,
      memo: values.memo,
      source: "manual",
      placeName: values.placeName,
    });
  };

  return (
    <VisitForm
      municipality={municipality}
      // 初期値はフォームを開いたときに一度だけ読まれる。
      initialValues={{
        placeName: "",
        visitedOn: toLocalDateString(new Date()),
        memo: "",
      }}
      onSubmit={submit}
      onSaved={onSaved}
      onCancel={onCancel}
      testID="add-visit-form"
    />
  );
}
