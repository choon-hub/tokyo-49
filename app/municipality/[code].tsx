import { useLocalSearchParams } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { VisitHistoryItem } from "../../src/components/VisitHistoryItem";
import {
  findMunicipalityByCode,
  type Municipality,
} from "../../src/data/municipalities";
import { useMunicipalityVisits } from "../../src/hooks/use-municipality-visits";
import { useTheme } from "../../theme/use-theme";

// 区市の詳細（ボトムシート）。いまは訪問履歴の閲覧だけ。
// 追記・編集・削除は #7〜#9 でこのシートに足す。
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
  const { visits, loadFailed } = useMunicipalityVisits(municipality.code);

  return (
    <>
      <Text role="heading" style={[styles.heading, { color: theme.text }]}>
        {municipality.name}
      </Text>
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
        <ScrollView testID="visit-history">
          {visits.map((visit) => (
            <VisitHistoryItem key={visit.id} visit={visit} />
          ))}
        </ScrollView>
      )}
    </>
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
  message: {
    marginHorizontal: 16,
    marginVertical: 8,
    fontSize: 14,
  },
});
