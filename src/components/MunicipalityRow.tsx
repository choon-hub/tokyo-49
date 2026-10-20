import { StyleSheet, Text, View } from "react-native";

import { useTheme } from "../../theme/use-theme";

type Props = {
  name: string;
  visited: boolean;
};

// 一覧の1行。訪問済みは色だけでなく「✓」の有無でも分かる。
// 読み上げは行全体のラベル（「千代田区 訪問済み」）で伝える。
export function MunicipalityRow({ name, visited }: Props) {
  const theme = useTheme();
  return (
    <View
      accessible
      accessibilityLabel={`${name} ${visited ? "訪問済み" : "未訪問"}`}
      style={[styles.row, { borderBottomColor: theme.border }]}
    >
      <Text style={[styles.name, { color: theme.text }]}>{name}</Text>
      {visited && (
        <Text style={[styles.mark, { color: theme.primary }]}>✓</Text>
      )}
    </View>
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
