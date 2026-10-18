import { Tabs } from "expo-router/js-tabs";

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" options={{ title: "地図" }} />
      <Tabs.Screen name="list" options={{ title: "一覧" }} />
    </Tabs>
  );
}
