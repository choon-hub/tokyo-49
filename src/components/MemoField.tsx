import { StyleSheet, Text, TextInput } from "react-native";

import { useTheme } from "../../theme/use-theme";

type Props = {
  value: string;
  onChangeText: (value: string) => void;
};

// 訪問のメモ欄（任意・複数行）。
export function MemoField({ value, onChangeText }: Props) {
  const theme = useTheme();
  return (
    <>
      <Text style={[styles.label, { color: theme.textSecondary }]}>
        メモ（任意）
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder="メモ"
        placeholderTextColor={theme.textSecondary}
        multiline
        accessibilityLabel="メモ"
        style={[
          styles.field,
          styles.memo,
          { backgroundColor: theme.surface, color: theme.text },
        ]}
      />
    </>
  );
}

const styles = StyleSheet.create({
  label: {
    marginTop: 12,
    fontSize: 13,
  },
  field: {
    marginTop: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
  },
  memo: {
    minHeight: 64,
    fontSize: 16,
    textAlignVertical: "top",
  },
});
