import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ConquestCount } from "../../src/components/ConquestCount";
import { MUNICIPALITIES } from "../../src/data/municipalities";

export default function List() {
  return (
    <SafeAreaView edges={["top"]} style={styles.container} testID="list-screen">
      {/* 訪問済みの数は #5 で訪問データから求める。ここでは 0 のまま */}
      <ConquestCount visited={0} total={MUNICIPALITIES.length} />
      <ScrollView>
        {MUNICIPALITIES.map((municipality) => (
          <View key={municipality.code} style={styles.row}>
            <Text style={styles.name}>{municipality.name}</Text>
          </View>
        ))}
      </ScrollView>
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
    borderBottomColor: "#CCCCCC",
  },
  name: {
    fontSize: 16,
  },
});
