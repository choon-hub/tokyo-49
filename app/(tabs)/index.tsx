import { View } from "react-native";

import { useTheme } from "../../theme/use-theme";

// 地図の中身は #19・#20 で作る。ここでは空の枠だけ置く。
export default function MapTab() {
  const theme = useTheme();
  return (
    <View
      style={{ flex: 1, backgroundColor: theme.background }}
      testID="map-screen"
    />
  );
}
