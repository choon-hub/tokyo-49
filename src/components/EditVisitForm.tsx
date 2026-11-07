import { useSQLiteContext } from "expo-sqlite";

import type { Municipality } from "../data/municipalities";
import { updateVisit, type Visit } from "../db/visits";
import { VisitForm, type VisitFormValues } from "./VisitForm";

type Props = {
  /** 編集する訪問の区市（変えられない。Q20） */
  municipality: Municipality;
  visit: Visit;
  /** 保存が成功した後に呼ぶ */
  onSaved: () => void;
  onCancel: () => void;
};

// 区市シートの編集フォーム。場所名・訪問日・メモだけを変えられる。
export function EditVisitForm({
  municipality,
  visit,
  onSaved,
  onCancel,
}: Props) {
  const db = useSQLiteContext();

  const submit = async (values: VisitFormValues) => {
    await updateVisit(db, visit.id, values);
  };

  return (
    <VisitForm
      municipality={municipality}
      initialValues={{
        placeName: visit.placeName,
        visitedOn: visit.visitedOn,
        memo: visit.memo ?? "",
      }}
      onSubmit={submit}
      onSaved={onSaved}
      onCancel={onCancel}
      testID="edit-visit-form"
    />
  );
}
