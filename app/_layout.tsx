import { Stack, ThemeProvider } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useColorScheme } from "react-native";

import {
  darkNavigationTheme,
  lightNavigationTheme,
} from "../theme/navigation-theme";

export default function RootLayout() {
  const dark = useColorScheme() === "dark";
  return (
    <ThemeProvider value={dark ? darkNavigationTheme : lightNavigationTheme}>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }} />
    </ThemeProvider>
  );
}
