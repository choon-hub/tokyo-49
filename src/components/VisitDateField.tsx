import { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { Pressable, StyleSheet, Text } from "react-native";

import { useTheme } from "../../theme/use-theme";
import {
  formatJapaneseDate,
  parseLocalDate,
  toLocalDateString,
} from "../lib/date";

type Props = {
  /** 'YYYY-MM-DD'（ローカル日付） */
  value: string;
  onChange: (value: string) => void;
};

// 訪問日の欄。押すと Android の日付ピッカーを開く。
// 過去日・未来日とも選べるよう、最小日・最大日は指定しない。
export function VisitDateField({ value, onChange }: Props) {
  const theme = useTheme();

  const openDatePicker = () => {
    DateTimePickerAndroid.open({
      value: parseLocalDate(value),
      mode: "date",
      onChange: (event, date) => {
        // キャンセル（dismissed）では日付を変えない。
        if (event.type === "set" && date) {
          onChange(toLocalDateString(date));
        }
      },
    });
  };

  return (
    <>
      <Text style={[styles.label, { color: theme.textSecondary }]}>訪問日</Text>
      <Pressable
        role="button"
        accessibilityLabel="訪問日を変更"
        onPress={openDatePicker}
        style={[styles.field, { backgroundColor: theme.surface }]}
      >
        <Text style={[styles.value, { color: theme.text }]}>
          {formatJapaneseDate(value)}
        </Text>
      </Pressable>
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
  value: {
    marginTop: 4,
    fontSize: 16,
  },
});
