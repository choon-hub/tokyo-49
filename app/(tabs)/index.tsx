import { View } from "react-native";

import { RecordVisitButton } from "../../src/components/RecordVisitButton";
import { useTheme } from "../../theme/use-theme";

// 地図の中身は #19・#20 で作る。ここでは空の枠と、訪問入力への導線だけ置く。
export default function MapTab() {
  const theme = useTheme();
  return (
    <View
      style={{
        flex: 1,
        justifyContent: "flex-end",
        backgroundColor: theme.background,
      }}
      testID="map-screen"
    >
      <RecordVisitButton />
    </View>
  );
}
