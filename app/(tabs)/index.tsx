import { useRouter } from "expo-router";
import { StyleSheet, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ConquestCount } from "../../src/components/ConquestCount";
import { RecordVisitButton } from "../../src/components/RecordVisitButton";
import { TokyoMap } from "../../src/components/TokyoMap";
import { MUNICIPALITIES } from "../../src/data/municipalities";
import { useConquest } from "../../src/hooks/use-conquest";
import { useTheme } from "../../theme/use-theme";

// 地図タブ。訪問済みの区市を塗り分け、区市をタップすると一覧と同じシートを開く。
export default function MapTab() {
  const theme = useTheme();
  const router = useRouter();
  const { visitedCodes, visitedCount, loadFailed } = useConquest();
  return (
    <SafeAreaView
      edges={["top"]}
      style={[styles.container, { backgroundColor: theme.background }]}
      testID="map-screen"
    >
      <ConquestCount
        visited={visitedCount}
        total={MUNICIPALITIES.length}
        onLongPress={() => router.push("/settings")}
      />
      {loadFailed && (
        <Text role="alert" style={[styles.error, { color: theme.text }]}>
          訪問記録を読み込めませんでした。しばらくしてからもう一度お試しください。
        </Text>
      )}
      <TokyoMap
        visitedCodes={visitedCodes}
        onPressMunicipality={(code) =>
          router.push({ pathname: "/municipality/[code]", params: { code } })
        }
      />
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
