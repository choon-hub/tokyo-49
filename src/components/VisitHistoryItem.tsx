import { StyleSheet, Text, View } from "react-native";

import { useTheme } from "../../theme/use-theme";
import type { Visit } from "../db/visits";
import { formatJapaneseDate } from "../lib/date";

type Props = {
  visit: Visit;
};

// 区市シートの履歴1件。メモが無い訪問では、メモの行そのものを出さない。
export function VisitHistoryItem({ visit }: Props) {
  const theme = useTheme();
  return (
    <View
      style={[styles.item, { borderBottomColor: theme.border }]}
      testID="visit-history-item"
    >
      <Text style={[styles.date, { color: theme.textSecondary }]}>
        {formatJapaneseDate(visit.visitedOn)}
      </Text>
      <Text style={[styles.place, { color: theme.text }]}>
        {visit.placeName}
      </Text>
      {visit.memo !== null && (
        <Text style={[styles.memo, { color: theme.text }]}>{visit.memo}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  item: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  date: {
    fontSize: 13,
  },
  place: {
    marginTop: 2,
    fontSize: 16,
  },
  memo: {
    marginTop: 4,
    fontSize: 14,
  },
});
