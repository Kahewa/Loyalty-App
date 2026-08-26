import { Redirect } from 'expo-router';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useAuth } from '../src/auth-context';
import { isConfigured } from '../src/firebase';
import { colors, spacing } from '../src/theme';

export default function Index() {
  const { user, initialising } = useAuth();

  if (!isConfigured) {
    return (
      <View style={s.wrap}>
        <Text style={s.title}>Firebase isn't configured yet</Text>
        <Text style={s.body}>
          Copy <Text style={s.code}>.env.example</Text> to <Text style={s.code}>.env</Text>, paste
          in your Firebase web-app keys, then restart with{'\n'}
          <Text style={s.code}>npx expo start -c</Text>.
        </Text>
        <Text style={s.body}>Step-by-step instructions are in SETUP.md.</Text>
      </View>
    );
  }

  if (initialising) {
    return (
      <View style={s.wrap}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return <Redirect href={user ? '/home' : '/login'} />;
}

const s = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing(3),
    gap: spacing(2),
  },
  title: { color: colors.text, fontSize: 20, fontWeight: '800', textAlign: 'center' },
  body: { color: colors.textDim, fontSize: 15, lineHeight: 22, textAlign: 'center' },
  code: { color: colors.accent, fontFamily: 'monospace' },
});
