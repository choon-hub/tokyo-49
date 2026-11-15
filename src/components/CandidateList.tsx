import { Pressable, StyleSheet, Text, View } from "react-native";

import { useTheme } from "../../theme/use-theme";
import {
  candidateLabel,
  type Candidate,
  type SearchResult,
} from "../db/dict-search";

type Props = {
  result: SearchResult;
  onSelect: (candidate: Candidate) => void;
};

// 訪問入力の候補（駅・町域）。表示するのは上限までで、残りは「他N件」とだけ示す。
// 候補が無いときは「候補なし」と出し、区市の直接選択へ誘導する（都外かどうかは示さない）。
export function CandidateList({ result, onSelect }: Props) {
  const theme = useTheme();
  const rest = result.total - result.candidates.length;

  if (result.candidates.length === 0) {
    return (
      <View style={styles.empty} testID="candidate-list">
        <Text style={[styles.emptyTitle, { color: theme.text }]}>候補なし</Text>
        <Text style={[styles.note, { color: theme.textSecondary }]}>
          入力した名前のまま記録できます。下の一覧から区市を選んでください。
        </Text>
      </View>
    );
  }

  return (
    <View
      style={[styles.list, { borderColor: theme.border }]}
      testID="candidate-list"
    >
      {result.candidates.map((candidate) => (
        <Pressable
          key={`${candidate.source}-${candidate.id}`}
          role="button"
          onPress={() => onSelect(candidate)}
          style={[styles.row, { borderBottomColor: theme.border }]}
        >
          <Text style={[styles.rowText, { color: theme.text }]}>
            {candidateLabel(candidate)}
          </Text>
        </Pressable>
      ))}
      {rest > 0 && (
        <Text style={[styles.rest, { color: theme.textSecondary }]}>
          {`他${rest}件（入力を続けて絞り込んでください）`}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    marginHorizontal: 16,
    marginTop: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
  },
  row: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowText: {
    fontSize: 16,
  },
  rest: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  empty: {
    marginHorizontal: 16,
    marginTop: 8,
  },
  emptyTitle: {
    fontSize: 16,
  },
  note: {
    marginTop: 4,
    fontSize: 13,
  },
});
