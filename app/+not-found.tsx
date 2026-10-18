import { Link } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

export default function NotFound() {
  return (
    <View style={styles.container}>
      <Text role="heading" style={styles.title}>
        ページが見つかりません
      </Text>
      <Text style={styles.message}>表示しようとしたページは存在しません。</Text>
      <Link href="/" replace style={styles.link}>
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
    color: "#208AEF",
  },
});
