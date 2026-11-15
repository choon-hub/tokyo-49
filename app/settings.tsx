import { useSQLiteContext } from "expo-sqlite";
import { useRef, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  importVisits,
  listVisits,
  type ImportMode,
} from "../src/db/visits";
import { toLocalDateString } from "../src/lib/date";
import {
  buildExport,
  parseImport,
  type TransferVisit,
} from "../src/lib/transfer";
import { pickTextFile, shareTextFile } from "../src/lib/transfer-io";
import { useTheme } from "../theme/use-theme";

type Notice = { kind: "info" | "error"; text: string };

// 設定画面。機種変更の引き継ぎ用の JSON エクスポート／インポートだけを置く（要件書 §2.5）。
// 通常の画面にはここへのボタンを出さず、制覇数の長押しで開く。
export default function Settings() {
  const theme = useTheme();
  const db = useSQLiteContext();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  // state の更新は次の描画まで反映されないので、連打は ref で止める。
  const busyRef = useRef(false);

  /** 処理を1つずつ実行する。処理中は他のボタンを受け付けない。 */
  const run = async (task: () => Promise<Notice | null>, failure: string) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setNotice(null);
    try {
      setNotice(await task());
    } catch {
      setNotice({ kind: "error", text: failure });
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const exportVisits = () =>
    run(async () => {
      const now = new Date();
      const visits = await listVisits(db);
      const json = JSON.stringify(buildExport(visits, now), null, 2);
      const date = toLocalDateString(now).replaceAll("-", "");
      await shareTextFile(`tokyo-49-export-${date}.json`, json);
      return { kind: "info", text: `${visits.length}件の訪問を書き出しました。` };
    }, "エクスポートできませんでした。もう一度お試しください。");

  const runImport = (visits: TransferVisit[], mode: ImportMode) =>
    run(async () => {
      const { added, skipped } = await importVisits(db, visits, mode);
      return {
        kind: "info",
        text:
          mode === "overwrite"
            ? `上書きしました。追加${added}件`
            : `取り込みました。追加${added}件・スキップ${skipped}件`,
      };
    }, "インポートできませんでした。訪問履歴は変更していません。");

  const importFromFile = () =>
    run(async () => {
      const text = await pickTextFile();
      if (text === null) return null;
      // 1件でも不正ならファイル全体を拒否し、DB には触れない。
      const parsed = parseImport(text);
      if (!parsed.ok) {
        return {
          kind: "error",
          text: `このファイルはインポートできません。${parsed.error}`,
        };
      }
      // 破壊的になり得る操作なので、取り込む前に必ず確認する。
      Alert.alert(
        "インポート",
        `${parsed.visits.length}件の訪問が入っています。\n\n` +
          "マージ: いまの履歴に追加します。場所名・区市・訪問日が同じものは取り込みません。\n\n" +
          "上書き: いまの訪問履歴をすべて削除して、ファイルの内容に置き換えます。元に戻せません。",
        [
          { text: "キャンセル", style: "cancel" },
          {
            text: "マージ（追加のみ）",
            onPress: () => void runImport(parsed.visits, "merge"),
          },
          {
            text: "上書き（すべて削除）",
            style: "destructive",
            onPress: () => void runImport(parsed.visits, "overwrite"),
          },
        ],
      );
      return null;
    }, "ファイルを読み込めませんでした。もう一度お試しください。");

  return (
    <SafeAreaView
      edges={["bottom"]}
      style={[styles.container, { backgroundColor: theme.background }]}
      testID="settings-screen"
    >
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.heading, { color: theme.text }]}>
          データの引き継ぎ
        </Text>
        <Text style={[styles.description, { color: theme.textSecondary }]}>
          訪問履歴を JSON
          ファイルに書き出して、別の端末で読み込めます。バックアップは自動では取られません。
        </Text>

        <Pressable
          role="button"
          onPress={() => void exportVisits()}
          disabled={busy}
          accessibilityState={{ disabled: busy }}
          style={[
            styles.button,
            { backgroundColor: busy ? theme.border : theme.primary },
          ]}
        >
          <Text
            style={[
              styles.buttonLabel,
              { color: busy ? theme.textSecondary : theme.onPrimary },
            ]}
          >
            エクスポート
          </Text>
        </Pressable>

        <Pressable
          role="button"
          onPress={() => void importFromFile()}
          disabled={busy}
          accessibilityState={{ disabled: busy }}
          style={[styles.button, { borderColor: theme.border, borderWidth: 1 }]}
        >
          <Text style={[styles.buttonLabel, { color: theme.text }]}>
            インポート
          </Text>
        </Pressable>

        {notice && (
          <Text
            role={notice.kind === "error" ? "alert" : undefined}
            style={[styles.notice, { color: theme.text }]}
            testID="settings-notice"
          >
            {notice.text}
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  heading: {
    fontSize: 18,
    fontWeight: "bold",
  },
  description: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
  },
  button: {
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
  },
  buttonLabel: {
    fontSize: 16,
    fontWeight: "bold",
  },
  notice: {
    marginTop: 16,
    fontSize: 14,
    lineHeight: 20,
  },
});
