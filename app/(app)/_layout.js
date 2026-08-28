import { Stack, Redirect } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { useAuth } from '../../src/auth-context';
import { useTheme } from '../../src/theme-context';

export default function AppLayout() {
  const { user, initialising } = useAuth();
  const { colors } = useTheme();

  if (initialising) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center' }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  // The guard: no session, no screens. Rules enforce this server-side too.
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
      <Stack.Screen name="customers" options={{ title: 'All customers' }} />
      <Stack.Screen name="customer/[id]" options={{ title: '' }} />
      <Stack.Screen name="add-customer" options={{ title: 'Add customer', presentation: 'modal' }} />
      <Stack.Screen name="pending" options={{ title: 'Signup requests' }} />
      <Stack.Screen name="rewards" options={{ title: 'Rewards' }} />
      <Stack.Screen name="templates" options={{ title: 'Email templates' }} />
      <Stack.Screen name="appearance" options={{ title: 'Appearance' }} />
      <Stack.Screen name="share" options={{ title: 'Your signup QR' }} />
      <Stack.Screen name="settings" options={{ title: 'Settings' }} />
    </Stack>
  );
}
