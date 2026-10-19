import { Stack, ThemeProvider } from "expo-router";
import { SQLiteProvider } from "expo-sqlite";
import { StatusBar } from "expo-status-bar";
import { useColorScheme } from "react-native";

import { migrateUserDb, USER_DB_NAME } from "../src/db/user-db";
import {
  darkNavigationTheme,
  lightNavigationTheme,
} from "../theme/navigation-theme";

export default function RootLayout() {
  const dark = useColorScheme() === "dark";
  return (
    <SQLiteProvider databaseName={USER_DB_NAME} onInit={migrateUserDb}>
      <ThemeProvider value={dark ? darkNavigationTheme : lightNavigationTheme}>
        <StatusBar style="auto" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen
            name="visit/new"
            options={{ headerShown: true, title: "訪問を記録" }}
          />
        </Stack>
      </ThemeProvider>
    </SQLiteProvider>
  );
}
