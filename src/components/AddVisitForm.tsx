import { useSQLiteContext } from "expo-sqlite";
import { useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { useTheme } from "../../theme/use-theme";
import type { Municipality } from "../data/municipalities";
import { addVisit } from "../db/visits";
import { toLocalDateString } from "../lib/date";
import { MemoField } from "./MemoField";
import { VisitDateField } from "./VisitDateField";

type Props = {
  /** 追記先の区市（シートで確定しているので選ばせない） */
  municipality: Municipality;
  /** 保存が成功した後に呼ぶ */
  onSaved: () => void;
  onCancel: () => void;
};

// 区市シートの追記フォーム。場所名・訪問日・メモだけを入力する。
// 辞書を通さないので source は 'manual'。
export function AddVisitForm({ municipality, onSaved, onCancel }: Props) {
  const theme = useTheme();
  const db = useSQLiteContext();

  const [placeName, setPlaceName] = useState("");
  const [visitedOn, setVisitedOn] = useState(() =>
    toLocalDateString(new Date()),
  );
  const [memo, setMemo] = useState("");
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
      await addVisit(db, {
        municipalityCode: municipality.code,
        visitedOn,
        memo,
        source: "manual",
        // 場所名が空なら、区市だけを選んだとき（Q16）と同じく区市名を入れる。
        placeName: trimmed === "" ? municipality.name : trimmed,
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
    <View style={styles.form} testID="add-visit-form">
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
