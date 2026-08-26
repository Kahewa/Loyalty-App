import { Stack, Redirect } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { useAuth } from '../../src/auth-context';
import { colors } from '../../src/theme';

export default function AppLayout() {
  const { user, initialising } = useAuth();

  if (initialising) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center' }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  // The guard: no session, no business data. Rules enforce this server-side too.
  if (!user) return <Redirect href="/login" />;

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: '800' },
        headerShadowVisible: false,
        headerBackTitle: 'Back',
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="home" options={{ headerShown: false }} />
      <Stack.Screen name="customer/[id]" options={{ title: '' }} />
      <Stack.Screen name="add-customer" options={{ title: 'Add customer', presentation: 'modal' }} />
      <Stack.Screen name="rewards" options={{ title: 'Rewards' }} />
      <Stack.Screen name="templates" options={{ title: 'Email templates' }} />
      <Stack.Screen name="share" options={{ title: 'Your signup QR' }} />
      <Stack.Screen name="settings" options={{ title: 'Settings' }} />
    </Stack>
  );
}
