import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text } from "react-native";

import { useTheme } from "../../theme/use-theme";

// ホームの各タブから訪問入力画面へ進むボタン。
export function RecordVisitButton() {
  const theme = useTheme();
  const router = useRouter();
  return (
    <Pressable
      role="button"
      onPress={() => router.push("/visit/new")}
      style={[styles.button, { backgroundColor: theme.primary }]}
    >
      <Text style={[styles.label, { color: theme.onPrimary }]}>訪問を記録</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    margin: 16,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
  },
  label: {
    fontSize: 16,
    fontWeight: "bold",
  },
});
