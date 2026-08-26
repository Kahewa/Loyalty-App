import { useEffect, useState } from 'react';
import { View, Text, Alert, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/auth-context';
import { updateBusiness, watchRedemptions } from '../../src/data';
import { fullDate } from '../../src/format';
import { Screen, Card, Field, Button, Dim, Empty } from '../../src/components/ui';
import { colors, radius, spacing } from '../../src/theme';

export default function Settings() {
  const { user, business, signOut } = useAuth();
  const router = useRouter();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [redemptions, setRedemptions] = useState([]);

  useEffect(() => {
    if (business?.businessName != null) setName(business.businessName);
  }, [business?.businessName]);

  useEffect(() => (user ? watchRedemptions(user.uid, setRedemptions, 20) : undefined), [user]);

  async function save() {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await updateBusiness(user.uid, { businessName: name.trim() });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      Alert.alert('Could not save', e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Card>
        <Field
          label="BUSINESS NAME"
          value={name}
          onChangeText={(t) => {
            setName(t);
            setSaved(false);
          }}
          autoCapitalize="words"
          hint="Appears on your signup page and in every email you send."
        />
        <Button
          title={saved ? 'Saved ✓' : 'Save'}
          variant={saved ? 'secondary' : 'primary'}
          onPress={save}
          loading={busy}
        />
      </Card>

      <Card>
        <Text style={s.rowLabel}>Signed in as</Text>
        <Text style={s.rowValue}>{user?.email}</Text>
        <Text style={[s.rowLabel, { marginTop: spacing(1.5) }]}>Business ID</Text>
        <Text style={s.mono} selectable>
          {user?.uid}
        </Text>
        <Dim>
          This is your Firebase auth uid doing double duty as the business id -- it is what makes
          the security rules a single line, and what the join link points at.
        </Dim>
      </Card>

      <Text style={s.sectionTitle}>RECENT REDEMPTIONS</Text>
      {redemptions.length === 0 ? (
        <Empty title="None yet" subtitle="Rewards you hand out will be listed here." />
      ) : (
        redemptions.map((r) => (
          <View key={r.id} style={s.redemption}>
            <View style={{ flex: 1 }}>
              <Text style={s.rowValue}>{r.customerName || 'Customer'}</Text>
              <Text style={s.rowLabel}>
                {r.rewardName} {'·'} {fullDate(r.redeemedAt)}
              </Text>
            </View>
            <Text style={s.spent}>-{r.pointsSpent}</Text>
          </View>
        ))
      )}

      <Pressable
        onPress={() =>
          Alert.alert('Sign out?', 'You will need your email and password to get back in.', [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Sign out',
              style: 'destructive',
              onPress: async () => {
                await signOut();
                router.replace('/login');
              },
            },
          ])
        }
        style={s.signOut}
      >
        <Text style={s.signOutText}>Sign out</Text>
      </Pressable>
    </Screen>
  );
}

const s = StyleSheet.create({
  rowLabel: { color: colors.textDim, fontSize: 12, fontWeight: '600', letterSpacing: 0.3 },
  rowValue: { color: colors.text, fontSize: 15, fontWeight: '600' },
  mono: { color: colors.accent, fontSize: 12, fontFamily: 'monospace' },
  sectionTitle: {
    color: colors.textDim,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    marginTop: spacing(1),
  },
  redemption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(1.5),
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing(1.5),
  },
  spent: { color: colors.warning, fontSize: 15, fontWeight: '800' },
  signOut: { padding: spacing(2.5), alignItems: 'center', marginTop: spacing(2) },
  signOutText: { color: colors.danger, fontSize: 15, fontWeight: '700' },
});
