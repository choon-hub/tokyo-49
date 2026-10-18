import { View } from "react-native";

import { useTheme } from "../theme/use-theme";

export default function Home() {
  const theme = useTheme();
  return <View style={{ flex: 1, backgroundColor: theme.background }} />;
}
