import { Pressable, StyleSheet, Text, View } from "react-native";

import { useTheme } from "../../theme/use-theme";
import type { Visit } from "../db/visits";
import { formatJapaneseDate } from "../lib/date";

type Props = {
  visit: Visit;
  /** 渡したときだけ「編集」ボタンを出す */
  onEdit?: () => void;
};

// 区市シートの履歴1件。メモが無い訪問では、メモの行そのものを出さない。
export function VisitHistoryItem({ visit, onEdit }: Props) {
  const theme = useTheme();
  const date = formatJapaneseDate(visit.visitedOn);
  return (
    <View
      style={[styles.item, { borderBottomColor: theme.border }]}
      testID="visit-history-item"
    >
      <Text style={[styles.date, { color: theme.textSecondary }]}>{date}</Text>
      <Text style={[styles.place, { color: theme.text }]}>
        {visit.placeName}
      </Text>
      {visit.memo !== null && (
        <Text style={[styles.memo, { color: theme.text }]}>{visit.memo}</Text>
      )}
      {/* 行の操作。#9 で削除ボタンをここに並べる。 */}
      {onEdit && (
        <View style={styles.actions}>
          <Pressable
            role="button"
            onPress={onEdit}
            // 同じボタンが行の数だけ並ぶので、読み上げではどの訪問かを添える。
            accessibilityLabel={`${date} ${visit.placeName}を編集`}
            style={[
              styles.actionButton,
              { borderColor: theme.border, borderWidth: 1 },
            ]}
          >
            <Text style={[styles.actionLabel, { color: theme.text }]}>
              編集
            </Text>
          </Pressable>
        </View>
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
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
    marginTop: 8,
  },
  actionButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  actionLabel: {
    fontSize: 14,
  },
});
