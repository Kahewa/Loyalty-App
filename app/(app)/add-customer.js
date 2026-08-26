import { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../../src/auth-context';
import { addCustomer } from '../../src/data';
import { isValidEmail } from '../../src/format';
import { Screen, Card, Field, Button, Dim } from '../../src/components/ui';
import { colors, spacing } from '../../src/theme';

export default function AddCustomer() {
  const params = useLocalSearchParams();
  const { user } = useAuth();
  const router = useRouter();

  const [name, setName] = useState(params.name ? String(params.name) : '');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function save(thenOpen) {
    setError('');
    if (!name.trim()) return setError('A name is required.');
    if (email.trim() && !isValidEmail(email)) return setError('That email does not look right.');

    setBusy(true);
    try {
      const id = await addCustomer(user.uid, { name, email });
      if (thenOpen) router.replace(`/customer/${id}`);
      else router.back();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Screen>
        <Card>
          <Field
            label="NAME"
            placeholder="Sam Taylor"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
            autoFocus
          />
          <Field
            label="EMAIL (OPTIONAL)"
            placeholder="sam@example.com"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            hint="Without an email they still collect points -- you just cannot send them the reward notice."
          />
          {!!error && <Text style={s.error}>{error}</Text>}

          <View style={{ gap: spacing(1), marginTop: spacing(1) }}>
            <Button title="Save and open card" onPress={() => save(true)} loading={busy} />
            <Button title="Save and add another" variant="secondary" onPress={() => save(false)} disabled={busy} />
          </View>
        </Card>

        <Dim>
          Adding someone here does not send them the welcome email -- that only goes out when they
          sign themselves up through your QR code.
        </Dim>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  error: { color: colors.danger, fontSize: 14 },
});
