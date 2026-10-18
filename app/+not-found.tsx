import { Link } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { useTheme } from "../theme/use-theme";

export default function NotFound() {
  const theme = useTheme();
  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Text role="heading" style={[styles.title, { color: theme.text }]}>
        ページが見つかりません
      </Text>
      <Text style={[styles.message, { color: theme.textSecondary }]}>
        表示しようとしたページは存在しません。
      </Text>
      <Link href="/" replace style={[styles.link, { color: theme.link }]}>
        ホームへ戻る
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
  },
  message: {
    marginTop: 8,
    fontSize: 16,
  },
  link: {
    marginTop: 24,
    fontSize: 16,
  },
});
