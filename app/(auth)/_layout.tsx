import { Stack } from "expo-router";

const Layout = () => {
  return (
    <Stack>
      <Stack.Screen name="combined-auth" options={{ headerShown: false }} />
    </Stack>
  );
};

export default Layout;