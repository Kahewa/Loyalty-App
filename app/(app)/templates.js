import { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useAuth } from '../../src/auth-context';
import { updateBusiness } from '../../src/data';
import { PLACEHOLDERS, PREVIEW_VARS, DEFAULT_TEMPLATES, render } from '../../src/templates';
import { Screen, Card, Field, Button, Dim, Loading } from '../../src/components/ui';
import { colors, radius, spacing } from '../../src/theme';

const TABS = [
  { key: 'welcome', label: 'Welcome email', hint: 'Sent the moment someone signs up via your QR code.' },
  { key: 'reward', label: 'Reward earned', hint: 'Sent automatically when a visit tips them over the threshold.' },
];

export default function Templates() {
  const { user, business } = useAuth();
  const [tab, setTab] = useState('welcome');
  const [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (business && !draft) {
      setDraft({
        welcomeEmailSubject: business.welcomeEmailSubject ?? DEFAULT_TEMPLATES.welcomeEmailSubject,
        welcomeEmailBody: business.welcomeEmailBody ?? DEFAULT_TEMPLATES.welcomeEmailBody,
        rewardEmailSubject: business.rewardEmailSubject ?? DEFAULT_TEMPLATES.rewardEmailSubject,
        rewardEmailBody: business.rewardEmailBody ?? DEFAULT_TEMPLATES.rewardEmailBody,
      });
    }
  }, [business, draft]);

  if (!draft) return <Loading label="Loading templates..." />;

  const subjectKey = tab === 'welcome' ? 'welcomeEmailSubject' : 'rewardEmailSubject';
  const bodyKey = tab === 'welcome' ? 'welcomeEmailBody' : 'rewardEmailBody';
  const current = TABS.find((t) => t.key === tab);

  // The preview runs the exact substitution the Cloud Function will run.
  const vars = { ...PREVIEW_VARS, business_name: business?.businessName || PREVIEW_VARS.business_name };
  const previewSubject = render(draft[subjectKey], vars);
  const previewBody = render(draft[bodyKey], vars);

  const set = (key) => (value) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setSaved(false);
  };

  function insert(token) {
    setDraft((d) => ({ ...d, [bodyKey]: `${d[bodyKey]}${token}` }));
    setSaved(false);
  }

  async function save() {
    setBusy(true);
    try {
      await updateBusiness(user.uid, draft);
      setSaved(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <Screen>
        <View style={s.tabs}>
          {TABS.map((t) => (
            <Pressable
              key={t.key}
              onPress={() => setTab(t.key)}
              style={[s.tab, tab === t.key && s.tabActive]}
            >
              <Text style={[s.tabText, tab === t.key && s.tabTextActive]}>{t.label}</Text>
            </Pressable>
          ))}
        </View>

        <Dim>{current.hint}</Dim>

        <Card>
          <Field label="SUBJECT" value={draft[subjectKey]} onChangeText={set(subjectKey)} />
          <Field label="BODY" value={draft[bodyKey]} onChangeText={set(bodyKey)} multiline />

          <Text style={s.placeholderLabel}>Tap to insert</Text>
          <View style={s.chips}>
            {PLACEHOLDERS.map((p) => (
              <Pressable key={p.token} style={s.chip} onPress={() => insert(p.token)}>
                <Text style={s.chipText}>{p.token}</Text>
              </Pressable>
            ))}
          </View>
        </Card>

        <Text style={s.previewHeading}>LIVE PREVIEW</Text>
        <View style={s.preview}>
          <View style={s.previewHeader}>
            <Text style={s.previewFrom}>{business?.businessName || 'Your business'}</Text>
            <Text style={s.previewSubject}>{previewSubject}</Text>
          </View>
          <Text style={s.previewBody}>{previewBody}</Text>
        </View>

        <Button
          title={saved ? 'Saved ✓' : 'Save templates'}
          onPress={save}
          loading={busy}
          variant={saved ? 'secondary' : 'primary'}
        />

        <Button
          title="Reset this email to the default wording"
          variant="ghost"
          onPress={() => {
            setDraft((d) => ({
              ...d,
              [subjectKey]: DEFAULT_TEMPLATES[subjectKey],
              [bodyKey]: DEFAULT_TEMPLATES[bodyKey],
            }));
            setSaved(false);
          }}
        />
      </Screen>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  tabs: { flexDirection: 'row', gap: spacing(1) },
  tab: {
    flex: 1,
    paddingVertical: spacing(1.25),
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  tabActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  tabText: { color: colors.textDim, fontWeight: '700', fontSize: 14 },
  tabTextActive: { color: colors.accentText },
  placeholderLabel: {
    color: colors.textDim,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    marginTop: spacing(1),
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing(0.75) },
  chip: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.pill,
    paddingHorizontal: spacing(1.25),
    paddingVertical: spacing(0.75),
  },
  chipText: { color: colors.accent, fontSize: 12, fontFamily: 'monospace' },
  previewHeading: {
    color: colors.textDim,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    marginTop: spacing(1),
  },
  preview: {
    backgroundColor: '#FFFFFF',
    borderRadius: radius.lg,
    padding: spacing(2),
    gap: spacing(1.5),
  },
  previewHeader: { borderBottomWidth: 1, borderBottomColor: '#E2E8F0', paddingBottom: spacing(1) },
  previewFrom: { color: '#64748B', fontSize: 12, fontWeight: '600' },
  previewSubject: { color: '#0F172A', fontSize: 17, fontWeight: '800', marginTop: 2 },
  previewBody: { color: '#334155', fontSize: 15, lineHeight: 23 },
});
