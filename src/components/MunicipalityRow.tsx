import { Pressable, StyleSheet, Text } from "react-native";

import { useTheme } from "../../theme/use-theme";

type Props = {
  name: string;
  visited: boolean;
  onPress: () => void;
};

// 一覧の1行。訪問済みは色だけでなく「✓」の有無でも分かる。
// 読み上げは行全体のラベル（「千代田区 訪問済み」）で伝え、押すとボタンとして働く。
export function MunicipalityRow({ name, visited, onPress }: Props) {
  const theme = useTheme();
  return (
    <Pressable
      role="button"
      accessibilityLabel={`${name} ${visited ? "訪問済み" : "未訪問"}`}
      onPress={onPress}
      style={[styles.row, { borderBottomColor: theme.border }]}
    >
      <Text style={[styles.name, { color: theme.text }]}>{name}</Text>
      {visited && (
        <Text style={[styles.mark, { color: theme.primary }]}>✓</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  name: {
    fontSize: 16,
  },
  mark: {
    fontSize: 16,
    fontWeight: "bold",
  },
});
