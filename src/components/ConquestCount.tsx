import { StyleSheet, Text } from "react-native";

import { useTheme } from "../../theme/use-theme";

type Props = {
  visited: number;
  total: number;
  /**
   * 長押ししたとき。設定画面への隠し導線に使う（要件書 §2.5）。
   * 通常の操作では目に入らないよう、見た目や読み上げには何も足さない。
   */
  onLongPress?: () => void;
};

// 制覇数を「訪問済み / 全体」の形で表示する。数値は呼び出し側が決める。
export function ConquestCount({ visited, total, onLongPress }: Props) {
  const theme = useTheme();
  return (
    <Text
      role="heading"
      onLongPress={onLongPress}
      // 長押しを付けても、押したときに色が変わらないようにする。
      suppressHighlighting
      style={[styles.text, { color: theme.text }]}
    >
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
