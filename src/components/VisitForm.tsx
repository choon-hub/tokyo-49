import { useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { useTheme } from "../../theme/use-theme";
import type { Municipality } from "../data/municipalities";
import { MemoField } from "./MemoField";
import { VisitDateField } from "./VisitDateField";

export type VisitFormValues = {
  placeName: string;
  /** 'YYYY-MM-DD'（ローカル日付） */
  visitedOn: string;
  memo: string;
};

type Props = {
  /** 訪問先の区市（シートで確定しているので選ばせない） */
  municipality: Municipality;
  initialValues: VisitFormValues;
  /** 保存する。場所名は trim 済みで、空なら区市名が入っている */
  onSubmit: (values: VisitFormValues) => Promise<void>;
  /** 保存が成功した後に呼ぶ */
  onSaved: () => void;
  onCancel: () => void;
  testID: string;
};

// 区市シートの追記・編集で共通のフォーム。場所名・訪問日・メモだけを入力する。
export function VisitForm({
  municipality,
  initialValues,
  onSubmit,
  onSaved,
  onCancel,
  testID,
}: Props) {
  const theme = useTheme();

  const [placeName, setPlaceName] = useState(initialValues.placeName);
  const [visitedOn, setVisitedOn] = useState(initialValues.visitedOn);
  const [memo, setMemo] = useState(initialValues.memo);
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  // state の更新は次の描画まで反映されないので、連打は ref で止める。
  const savingRef = useRef(false);

  const save = async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setSaveFailed(false);
    const trimmed = placeName.trim();
    try {
      await onSubmit({
        // 場所名が空なら、区市だけを選んだとき（Q16）と同じく区市名を入れる。
        placeName: trimmed === "" ? municipality.name : trimmed,
        visitedOn,
        memo,
      });
      onSaved();
    } catch {
      // 失敗したときは知らせて、入力を残したままもう一度押せるようにする。
      savingRef.current = false;
      setSaving(false);
      setSaveFailed(true);
    }
  };

  return (
    <View style={styles.form} testID={testID}>
      <Text style={[styles.label, { color: theme.textSecondary }]}>
        場所名（任意）
      </Text>
      <TextInput
        value={placeName}
        onChangeText={setPlaceName}
        placeholder={municipality.name}
        placeholderTextColor={theme.textSecondary}
        accessibilityLabel="場所名"
        style={[
          styles.field,
          { backgroundColor: theme.surface, color: theme.text },
        ]}
      />
      <VisitDateField value={visitedOn} onChange={setVisitedOn} />
      <MemoField value={memo} onChangeText={setMemo} />

      {saveFailed && (
        <Text role="alert" style={[styles.error, { color: theme.text }]}>
          保存できませんでした。もう一度お試しください。
        </Text>
      )}
      <View style={styles.actions}>
        <Pressable
          role="button"
          onPress={onCancel}
          disabled={saving}
          accessibilityState={{ disabled: saving }}
          style={[styles.button, { borderColor: theme.border, borderWidth: 1 }]}
        >
          <Text style={[styles.buttonLabel, { color: theme.text }]}>
            キャンセル
          </Text>
        </Pressable>
        <Pressable
          role="button"
          onPress={save}
          disabled={saving}
          accessibilityState={{ disabled: saving }}
          style={[
            styles.button,
            { backgroundColor: saving ? theme.border : theme.primary },
          ]}
        >
          <Text
            style={[
              styles.buttonLabel,
              { color: saving ? theme.textSecondary : theme.onPrimary },
            ]}
          >
            保存
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  form: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  label: {
    marginTop: 12,
    fontSize: 13,
  },
  field: {
    marginTop: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    fontSize: 16,
  },
  error: {
    marginTop: 12,
    fontSize: 14,
  },
  actions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 16,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  buttonLabel: {
    fontSize: 16,
    fontWeight: "bold",
  },
});
