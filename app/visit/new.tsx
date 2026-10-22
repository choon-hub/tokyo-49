import { useRouter } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { MemoField } from "../../src/components/MemoField";
import { VisitDateField } from "../../src/components/VisitDateField";
import {
  MUNICIPALITIES,
  type Municipality,
} from "../../src/data/municipalities";
import { addVisit } from "../../src/db/visits";
import { toLocalDateString } from "../../src/lib/date";
import { useTheme } from "../../theme/use-theme";

// 訪問入力画面。いまは区市の直接選択だけ。
// 駅・町域の入力欄は #14 以降でこの画面の上部に足す。
export default function NewVisit() {
  const theme = useTheme();
  const router = useRouter();
  const db = useSQLiteContext();

  const [municipality, setMunicipality] = useState<Municipality | null>(null);
  const [visitedOn, setVisitedOn] = useState(() =>
    toLocalDateString(new Date()),
  );
  const [memo, setMemo] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  // state の更新は次の描画まで反映されないので、連打は ref で止める。
  const savingRef = useRef(false);

  const save = async () => {
    if (!municipality || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setSaveFailed(false);
    try {
      await addVisit(db, {
        municipalityCode: municipality.code,
        visitedOn,
        memo,
        source: "manual",
        placeName: municipality.name,
      });
      router.back();
    } catch {
      // 失敗したときは知らせて、もう一度押せるようにする。
      savingRef.current = false;
      setSaving(false);
      setSaveFailed(true);
    }
  };

  const canSave = municipality !== null && !saving;

  return (
    <SafeAreaView
      edges={["bottom"]}
      style={[styles.container, { backgroundColor: theme.background }]}
      testID="visit-new-screen"
    >
      <View style={styles.form}>
        <Text style={[styles.label, { color: theme.textSecondary }]}>区市</Text>
        <Text
          style={[
            styles.value,
            { color: municipality ? theme.text : theme.textSecondary },
          ]}
          testID="selected-municipality"
        >
          {municipality ? municipality.name : "下の一覧から選んでください"}
        </Text>

        <VisitDateField value={visitedOn} onChange={setVisitedOn} />
        <MemoField value={memo} onChangeText={setMemo} />
      </View>

      <ScrollView style={styles.list} testID="municipality-picker">
        {MUNICIPALITIES.map((m) => {
          const selected = m.code === municipality?.code;
          return (
            <Pressable
              key={m.code}
              role="radio"
              accessibilityState={{ selected }}
              onPress={() => setMunicipality(m)}
              style={[
                styles.row,
                { borderBottomColor: theme.border },
                selected && { backgroundColor: theme.surface },
              ]}
            >
              <Text
                style={[
                  styles.rowText,
                  { color: theme.text },
                  selected && styles.rowTextSelected,
                ]}
              >
                {m.name}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {saveFailed && (
        <Text role="alert" style={[styles.error, { color: theme.text }]}>
          保存できませんでした。もう一度お試しください。
        </Text>
      )}
      <Pressable
        role="button"
        onPress={save}
        disabled={!canSave}
        accessibilityState={{ disabled: !canSave }}
        style={[
          styles.saveButton,
          {
            backgroundColor: canSave ? theme.primary : theme.border,
          },
        ]}
      >
        <Text
          style={[
            styles.saveLabel,
            { color: canSave ? theme.onPrimary : theme.textSecondary },
          ]}
        >
          保存
        </Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  form: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  label: {
    marginTop: 12,
    fontSize: 13,
  },
  value: {
    marginTop: 4,
    fontSize: 16,
  },
  list: {
    flex: 1,
    marginTop: 12,
  },
  row: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowText: {
    fontSize: 16,
  },
  rowTextSelected: {
    fontWeight: "bold",
  },
  error: {
    marginTop: 12,
    marginHorizontal: 16,
    fontSize: 14,
  },
  saveButton: {
    margin: 16,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
  },
  saveLabel: {
    fontSize: 16,
    fontWeight: "bold",
  },
});
