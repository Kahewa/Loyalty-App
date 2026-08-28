import { useEffect, useState } from 'react';
import { View, Text, Pressable, Switch } from 'react-native';
import { showAlert } from '../../src/components/alert';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/auth-context';
import { updateBusiness, watchRedemptions } from '../../src/data';
import { fullDate } from '../../src/format';
import { MAIL_APPS, detectInstalled } from '../../src/mail-apps';
import { Screen, Card, Field, Button, Dim, Empty } from '../../src/components/ui';
import { font, radius, shadow, spacing } from '../../src/theme';
import { useTheme, useThemedStyles } from '../../src/theme-context';

export default function Settings() {
  const s = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const { user, business, signOut } = useAuth();
  const router = useRouter();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [redemptions, setRedemptions] = useState([]);
  const [installed, setInstalled] = useState(null);

  useEffect(() => {
    if (business?.businessName != null) setName(business.businessName);
  }, [business?.businessName]);

  useEffect(() => (user ? watchRedemptions(user.uid, setRedemptions, 20) : undefined), [user]);

  useEffect(() => {
    detectInstalled().then(setInstalled).catch(() => setInstalled(null));
  }, []);

  async function save() {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await updateBusiness(user.uid, { businessName: name.trim() });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      showAlert('Could not save', e.message);
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

      <Pressable onPress={() => router.push('/appearance')}>
        <Card style={s.linkCard}>
          <Text style={s.linkGlyph}>🎨</Text>
          <View style={{ flex: 1 }}>
            <Text style={s.rowValue}>Appearance</Text>
            <Dim>Pick the colours your shop's app wears</Dim>
          </View>
          <View style={s.swatchPreview}>
            <View style={[s.previewDot, { backgroundColor: colors.accent }]} />
            <View style={[s.previewDot, { backgroundColor: colors.bg }]} />
          </View>
          <Text style={s.chevron}>›</Text>
        </Card>
      </Pressable>

      <Card>
        <Text style={s.rowLabel}>SEND EMAIL WITH</Text>
        {MAIL_APPS.map((app) => {
          const chosen = (business?.mailApp || 'default') === app.id;
          const missing = installed && app.scheme && installed[app.id] === false;
          return (
            <Pressable
              key={app.id}
              style={[s.mailRow, chosen && s.mailRowOn]}
              onPress={() =>
                updateBusiness(user.uid, { mailApp: app.id }).catch((e) =>
                  showAlert('Could not save', e.message)
                )
              }
            >
              <View style={[s.radio, chosen && s.radioOn]}>
                {chosen && <View style={s.radioDot} />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.mailName}>{app.name}</Text>
                <Text style={s.mailDetail}>
                  {app.detail}
                  {missing ? ' · not detected on this phone' : ''}
                </Text>
              </View>
            </Pressable>
          );
        })}
        <Dim>
          Every prepared email opens here. Inside Expo Go we cannot reliably detect which mail apps
          you have installed, so all of them are listed — if one does not open, pick another.
        </Dim>
      </Card>

      <Card>
        <View style={s.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.rowValue}>Email on every visit</Text>
            <Dim>
              After each visit you log, offer to email the customer how far they are from their
              reward. The reward email itself is always offered, whichever way this sits.
            </Dim>
          </View>
          <Switch
            value={business?.emailOnVisit !== false}
            onValueChange={(v) =>
              updateBusiness(user.uid, { emailOnVisit: v }).catch((e) =>
                showAlert('Could not save', e.message)
              )
            }
            trackColor={{ true: colors.accent, false: colors.surfaceAlt }}
            thumbColor={colors.text}
          />
        </View>
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
          showAlert('Sign out?', 'You will need your email and password to get back in.', [
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

const makeStyles = ({ colors }) => ({
  linkCard: { flexDirection: 'row', alignItems: 'center', gap: spacing(1.25) },
  linkGlyph: { fontSize: 22 },
  swatchPreview: { flexDirection: 'row', gap: 4 },
  previewDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  chevron: { color: colors.textDim, fontSize: 22, fontWeight: '800' },
  rowLabel: { color: colors.textDim, fontSize: 12, fontWeight: '600', letterSpacing: 0.3 },
  mailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(1.25),
    paddingVertical: spacing(1.25),
    paddingHorizontal: spacing(1.25),
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  mailRowOn: { borderColor: colors.accent, backgroundColor: colors.accent + '14' },
  radio: {
    width: 22,
    height: 22,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: { borderColor: colors.accent },
  radioDot: { width: 10, height: 10, borderRadius: radius.pill, backgroundColor: colors.accent },
  mailName: { color: colors.text, fontSize: 15, fontWeight: '700' },
  mailDetail: { color: colors.textDim, fontSize: 12, marginTop: 1 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing(1.5) },
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
