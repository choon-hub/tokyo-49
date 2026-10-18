import { StyleSheet, Text } from "react-native";

type Props = {
  visited: number;
  total: number;
};

// 制覇数を「訪問済み / 全体」の形で表示する。数値は呼び出し側が決める。
export function ConquestCount({ visited, total }: Props) {
  return (
    <Text role="heading" style={styles.text}>
      {`${visited} / ${total}`}
    </Text>
  );
}

const styles = StyleSheet.create({
  text: {
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
    paddingVertical: 12,
  },
});
