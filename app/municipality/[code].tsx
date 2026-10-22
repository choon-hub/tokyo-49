import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { AddVisitForm } from "../../src/components/AddVisitForm";
import { VisitHistoryItem } from "../../src/components/VisitHistoryItem";
import {
  findMunicipalityByCode,
  type Municipality,
} from "../../src/data/municipalities";
import { useMunicipalityVisits } from "../../src/hooks/use-municipality-visits";
import { useTheme } from "../../theme/use-theme";

// 区市の詳細（ボトムシート）。訪問履歴の閲覧と追記ができる。
// 編集・削除は #8・#9 でこのシートに足す。
export default function MunicipalitySheet() {
  const theme = useTheme();
  const { code } = useLocalSearchParams<{ code: string }>();
  // 不正な URL でも落ちないよう、DB を読む前にマスタと突き合わせる。
  const municipality =
    typeof code === "string" ? findMunicipalityByCode(code) : undefined;

  return (
    <View
      style={[styles.container, { backgroundColor: theme.background }]}
      testID="municipality-sheet"
    >
      {municipality ? (
        // 区市が変わったら前の区市の履歴を残さないよう、作り直す。
        <VisitHistory key={municipality.code} municipality={municipality} />
      ) : (
        <Text style={[styles.message, { color: theme.text }]}>
          区市が見つかりません。
        </Text>
      )}
    </View>
  );
}

function VisitHistory({ municipality }: { municipality: Municipality }) {
  const theme = useTheme();
  const { visits, loadFailed, reload } = useMunicipalityVisits(
    municipality.code,
  );
  const [adding, setAdding] = useState(false);

  // 保存してもシートのフォーカスは変わらないので、履歴は自分で読み直す。
  // フォームは閉じる（アンマウントで入力もリセットされる）が、シートは開いたまま。
  const handleSaved = () => {
    setAdding(false);
    reload();
  };

  return (
    // キーボードを出しても入力欄までスクロールできるよう、中身全体をスクロールさせる。
    <ScrollView keyboardShouldPersistTaps="handled">
      <Text role="heading" style={[styles.heading, { color: theme.text }]}>
        {municipality.name}
      </Text>
      {adding ? (
        <AddVisitForm
          municipality={municipality}
          onSaved={handleSaved}
          onCancel={() => setAdding(false)}
        />
      ) : (
        <Pressable
          role="button"
          onPress={() => setAdding(true)}
          style={[styles.addButton, { backgroundColor: theme.primary }]}
        >
          <Text style={[styles.addLabel, { color: theme.onPrimary }]}>
            追記
          </Text>
        </Pressable>
      )}
      {loadFailed && (
        <Text role="alert" style={[styles.message, { color: theme.text }]}>
          訪問記録を読み込めませんでした。しばらくしてからもう一度お試しください。
        </Text>
      )}
      {visits !== null && visits.length === 0 && (
        <Text style={[styles.message, { color: theme.textSecondary }]}>
          まだ訪問の記録はありません
        </Text>
      )}
      {visits !== null && visits.length > 0 && (
        <View testID="visit-history">
          {visits.map((visit) => (
            <VisitHistoryItem key={visit.id} visit={visit} />
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 16,
  },
  heading: {
    marginHorizontal: 16,
    marginBottom: 8,
    fontSize: 20,
    fontWeight: "bold",
  },
  addButton: {
    marginHorizontal: 16,
    marginBottom: 8,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  addLabel: {
    fontSize: 16,
    fontWeight: "bold",
  },
  message: {
    marginHorizontal: 16,
    marginVertical: 8,
    fontSize: 14,
  },
});
