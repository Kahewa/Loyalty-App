import { useState } from 'react';
import { View, Text, Alert, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuth } from '../../src/auth-context';
import { Screen, Card, Field, Button, Title, Dim } from '../../src/components/ui';
import { colors, spacing } from '../../src/theme';

const MESSAGES = {
  'auth/invalid-email': 'That email address does not look right.',
  'auth/invalid-credential': 'Email or password is incorrect.',
  'auth/wrong-password': 'Email or password is incorrect.',
  'auth/user-not-found': 'No account with that email — try creating one.',
  'auth/email-already-in-use': 'That email already has an account. Try signing in.',
  'auth/weak-password': 'Password must be at least 6 characters.',
  'auth/too-many-requests': 'Too many attempts. Wait a minute and try again.',
  'auth/network-request-failed': 'No connection to Firebase. Check your internet.',
};

export default function Login() {
  const { user, signIn, register, resetPassword } = useAuth();
  const [mode, setMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (user) return <Redirect href="/home" />;

  const isRegister = mode === 'register';

  async function submit() {
    setError('');
    if (!email.trim() || !password) return setError('Email and password are required.');
    if (isRegister && !businessName.trim()) return setError('Give your business a name.');

    setBusy(true);
    try {
      if (isRegister) await register(email, password, businessName);
      else await signIn(email, password);
    } catch (e) {
      setError(MESSAGES[e.code] || e.message);
    } finally {
      setBusy(false);
    }
  }

  async function forgot() {
    if (!email.trim()) return setError('Type your email above first, then tap this again.');
    try {
      await resetPassword(email);
      Alert.alert('Check your inbox', `A reset link is on its way to ${email.trim()}.`);
    } catch (e) {
      setError(MESSAGES[e.code] || e.message);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Screen style={s.screen}>
        <View style={s.header}>
          <Text style={s.mark}>◆</Text>
          <Title style={s.brand}>Loyalty</Title>
          <Dim style={{ textAlign: 'center' }}>
            Punch cards for your regulars, without the punch cards.
          </Dim>
        </View>

        <Card>
          {isRegister && (
            <Field
              label="BUSINESS NAME"
              placeholder="The Corner Cafe"
              value={businessName}
              onChangeText={setBusinessName}
              autoCapitalize="words"
              hint="Shown to customers in emails and on your signup page."
            />
          )}

          <Field
            label="EMAIL"
            placeholder="you@yourbusiness.com"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
          />

          <Field
            label="PASSWORD"
            placeholder={isRegister ? 'At least 6 characters' : '••••••••'}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            onSubmitEditing={submit}
            returnKeyType="go"
          />

          {!!error && <Text style={s.error}>{error}</Text>}

          <Button
            title={isRegister ? 'Create account' : 'Sign in'}
            onPress={submit}
            loading={busy}
            style={{ marginTop: spacing(1) }}
          />

          <Button
            title={isRegister ? 'I already have an account' : 'Create a new business account'}
            variant="ghost"
            onPress={() => {
              setMode(isRegister ? 'signin' : 'register');
              setError('');
            }}
          />

          {!isRegister && (
            <Text style={s.link} onPress={forgot}>
              Forgot your password?
            </Text>
          )}
        </Card>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  screen: { justifyContent: 'center', flexGrow: 1, padding: spacing(2.5) },
  header: { alignItems: 'center', gap: spacing(0.75), marginBottom: spacing(2) },
  mark: { color: colors.accent, fontSize: 40 },
  brand: { fontSize: 30, letterSpacing: -0.5 },
  error: { color: colors.danger, fontSize: 14, marginTop: spacing(0.5) },
  link: {
    color: colors.accent,
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: spacing(1),
  },
});
