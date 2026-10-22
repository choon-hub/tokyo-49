import { useRouter } from "expo-router";
import { ScrollView, StyleSheet, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ConquestCount } from "../../src/components/ConquestCount";
import { MunicipalityRow } from "../../src/components/MunicipalityRow";
import { RecordVisitButton } from "../../src/components/RecordVisitButton";
import { MUNICIPALITIES } from "../../src/data/municipalities";
import { useConquest } from "../../src/hooks/use-conquest";
import { useTheme } from "../../theme/use-theme";

export default function List() {
  const theme = useTheme();
  const router = useRouter();
  const { visitedCodes, visitedCount, loadFailed } = useConquest();
  return (
    <SafeAreaView
      edges={["top"]}
      style={[styles.container, { backgroundColor: theme.background }]}
      testID="list-screen"
    >
      <ConquestCount visited={visitedCount} total={MUNICIPALITIES.length} />
      {loadFailed && (
        <Text role="alert" style={[styles.error, { color: theme.text }]}>
          訪問記録を読み込めませんでした。しばらくしてからもう一度お試しください。
        </Text>
      )}
      <ScrollView>
        {MUNICIPALITIES.map((municipality) => (
          <MunicipalityRow
            key={municipality.code}
            name={municipality.name}
            visited={visitedCodes.has(municipality.code)}
            onPress={() =>
              router.push({
                pathname: "/municipality/[code]",
                params: { code: municipality.code },
              })
            }
          />
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
  error: {
    marginHorizontal: 16,
    marginBottom: 8,
    fontSize: 14,
  },
});
