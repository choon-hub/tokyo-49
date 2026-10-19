import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ConquestCount } from "../../src/components/ConquestCount";
import { RecordVisitButton } from "../../src/components/RecordVisitButton";
import { MUNICIPALITIES } from "../../src/data/municipalities";
import { useTheme } from "../../theme/use-theme";

export default function List() {
  const theme = useTheme();
  return (
    <SafeAreaView
      edges={["top"]}
      style={[styles.container, { backgroundColor: theme.background }]}
      testID="list-screen"
    >
      {/* 訪問済みの数は #5 で訪問データから求める。ここでは 0 のまま */}
      <ConquestCount visited={0} total={MUNICIPALITIES.length} />
      <ScrollView>
        {MUNICIPALITIES.map((municipality) => (
          <View
            key={municipality.code}
            style={[styles.row, { borderBottomColor: theme.border }]}
          >
            <Text style={[styles.name, { color: theme.text }]}>
              {municipality.name}
            </Text>
          </View>
        ))}
      </ScrollView>
      <RecordVisitButton />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  row: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  name: {
    fontSize: 16,
  },
});
