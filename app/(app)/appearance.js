import { useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { useAuth } from '../../src/auth-context';
import { updateBusiness } from '../../src/data';
import { showAlert } from '../../src/components/alert';
import { useTheme, useThemedStyles } from '../../src/theme-context';
import { buildTheme, PRESETS, DEFAULT_PALETTE, font, radius, shadow, spacing } from '../../src/theme';
import { hslToHex, hexToHsl, mix } from '../../src/color';
import { StampRow } from '../../src/components/stamps';
import { Card, Button, Dim, SectionLabel } from '../../src/components/ui';

// A hue wheel you can actually hit with a thumb, plus the neutrals people
// reach for when they want a quiet brand.
const HUES = [0, 18, 34, 48, 70, 96, 130, 160, 185, 205, 225, 260, 290, 320, 340];
const NEUTRALS = ['#8C8C87', '#6E7370', '#4F5551', '#9A8F80', '#7A6A5B'];

// Paper stays pale — a dark background would fight every colour on top of it.
const PAPERS = [
  '#F7F3EA', '#FAF7F0', '#F9F1E9', '#EFF4F2',
  '#F1F3F6', '#FBF2F7', '#FAF4E4', '#FFFFFF',
];

export default function Appearance() {
  const { user, business } = useAuth();
  const s = useThemedStyles(makeStyles);
  const live = useTheme();

  const saved = business?.theme || DEFAULT_PALETTE;
  const [draft, setDraft] = useState(saved);
  const [hue, setHue] = useState(() => hexToHsl(saved.accent || DEFAULT_PALETTE.accent).h);
  const [busy, setBusy] = useState(false);

  // If the business document arrives after first render, adopt it once.
  useEffect(() => {
    if (business?.theme) {
      setDraft(business.theme);
      setHue(hexToHsl(business.theme.accent).h);
    }
  }, [business?.theme?.accent, business?.theme?.paper]);

  // Preview the draft rather than what is saved, so choices are visible before
  // committing them.
  const preview = buildTheme(draft);
  const dirty =
    draft.accent !== saved.accent || draft.paper !== saved.paper || draft.ink !== saved.ink;

  const shades = [26, 33, 40, 47, 54].map((l) => hslToHex(hue, 38, l));

  async function save() {
    setBusy(true);
    try {
      await updateBusiness(user.uid, { theme: draft });
    } catch (e) {
      showAlert('Could not save', e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: live.colors.bg }}
      contentContainerStyle={s.content}
    >
      {/* ---------------------------------------------------------- preview */}
      <View style={[s.preview, { backgroundColor: preview.colors.bg }]}>
        <Text style={[s.previewLabel, { color: preview.colors.textFaint }]}>PREVIEW</Text>

        <View
          style={[
            s.previewCard,
            { backgroundColor: preview.colors.surface, borderColor: preview.colors.border },
          ]}
        >
          <View style={s.previewTop}>
            <View
              style={[
                s.previewAvatar,
                {
                  backgroundColor: preview.colors.accentSoft,
                  borderColor: preview.colors.accentEdge,
                },
              ]}
            >
              <Text style={[s.previewAvatarText, { color: preview.colors.accent }]}>ST</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.previewName, { color: preview.colors.text }]}>Sam Taylor</Text>
              <Text style={[s.previewMeta, { color: preview.colors.textDim }]}>
                3 more visits to go
              </Text>
            </View>
            <Text style={[s.previewTally, { color: preview.colors.accent }]}>7</Text>
          </View>

          <View style={s.previewStamps}>
            <ThemedStamps theme={preview} balance={7} target={10} />
          </View>

          <View style={[s.previewBtn, { backgroundColor: preview.colors.accent }]}>
            <Text style={[s.previewBtnText, { color: preview.colors.accentText }]}>+1 visit</Text>
          </View>
        </View>
      </View>

      {/* ---------------------------------------------------------- presets */}
      <SectionLabel>READY-MADE</SectionLabel>
      <View style={s.presetGrid}>
        {PRESETS.map((p) => {
          const on = draft.accent === p.accent && draft.paper === p.paper;
          return (
            <Pressable
              key={p.id}
              onPress={() => {
                setDraft({ accent: p.accent, paper: p.paper, ink: p.ink });
                setHue(hexToHsl(p.accent).h);
              }}
              style={[s.preset, { backgroundColor: p.paper }, on && s.presetOn]}
            >
              <View style={s.presetDots}>
                <View style={[s.presetDot, { backgroundColor: p.accent }]} />
                <View style={[s.presetDot, { backgroundColor: mix(p.paper, p.ink, 0.25) }]} />
                <View style={[s.presetDot, { backgroundColor: p.ink }]} />
              </View>
              <Text style={[s.presetName, { color: p.ink }]} numberOfLines={1}>
                {p.name}
              </Text>
              {on && <Text style={[s.presetCheck, { color: p.accent }]}>✓</Text>}
            </Pressable>
          );
        })}
      </View>

      {/* ----------------------------------------------------- custom accent */}
      <SectionLabel>YOUR OWN COLOUR</SectionLabel>
      <Card>
        <Text style={s.pickerLabel}>Pick a hue</Text>
        <View style={s.swatchWrap}>
          {HUES.map((h) => (
            <Pressable
              key={h}
              onPress={() => {
                setHue(h);
                setDraft((d) => ({ ...d, accent: hslToHex(h, 38, 40) }));
              }}
              style={[
                s.hueSwatch,
                { backgroundColor: hslToHex(h, 55, 52) },
                hue === h && s.swatchOn,
              ]}
            />
          ))}
          {NEUTRALS.map((c) => (
            <Pressable
              key={c}
              onPress={() => {
                setHue(hexToHsl(c).h);
                setDraft((d) => ({ ...d, accent: c }));
              }}
              style={[s.hueSwatch, { backgroundColor: c }, draft.accent === c && s.swatchOn]}
            />
          ))}
        </View>

        <Text style={[s.pickerLabel, { marginTop: spacing(1.5) }]}>Then a shade</Text>
        <View style={s.swatchWrap}>
          {shades.map((c) => (
            <Pressable
              key={c}
              onPress={() => setDraft((d) => ({ ...d, accent: c }))}
              style={[
                s.shadeSwatch,
                { backgroundColor: c },
                draft.accent === c && s.swatchOn,
              ]}
            />
          ))}
        </View>

        <View style={s.currentRow}>
          <View style={[s.currentChip, { backgroundColor: draft.accent }]} />
          <Text style={s.currentHex}>{String(draft.accent).toUpperCase()}</Text>
        </View>
      </Card>

      {/* ------------------------------------------------------ custom paper */}
      <SectionLabel>BACKGROUND</SectionLabel>
      <Card>
        <View style={s.swatchWrap}>
          {PAPERS.map((c) => (
            <Pressable
              key={c}
              onPress={() => setDraft((d) => ({ ...d, paper: c }))}
              style={[s.paperSwatch, { backgroundColor: c }, draft.paper === c && s.swatchOn]}
            />
          ))}
        </View>
        <Dim>
          Backgrounds stay pale on purpose. Text, borders and button labels are worked out from
          whatever you pick, so nothing you choose here can end up unreadable.
        </Dim>
      </Card>

      <View style={{ gap: spacing(1), marginTop: spacing(1) }}>
        <Button
          title={dirty ? 'Use these colours' : 'Saved ✓'}
          glyph={dirty ? '🎨' : undefined}
          variant={dirty ? 'primary' : 'secondary'}
          onPress={save}
          loading={busy}
          disabled={!dirty}
        />
        {dirty && (
          <Button title="Discard changes" variant="ghost" onPress={() => setDraft(saved)} />
        )}
        <Button
          title="Back to Loyalty Link colours"
          variant="ghost"
          onPress={() => {
            setDraft(DEFAULT_PALETTE);
            setHue(hexToHsl(DEFAULT_PALETTE.accent).h);
          }}
        />
      </View>
    </ScrollView>
  );
}

/** Stamps drawn in the *preview* palette rather than the live one. */
function ThemedStamps({ theme, balance, target }) {
  return (
    <View style={{ flexDirection: 'row', gap: 6 }}>
      {Array.from({ length: target }, (_, i) => (
        <View
          key={i}
          style={{
            width: 16,
            height: 16,
            borderRadius: 8,
            borderWidth: 2,
            backgroundColor: i < balance ? theme.colors.accent : 'transparent',
            borderColor: i < balance ? theme.colors.accent : theme.colors.stampEmpty,
          }}
        />
      ))}
    </View>
  );
}

const makeStyles = ({ colors }) => ({
  content: { padding: spacing(2), paddingBottom: spacing(6), gap: spacing(1) },

  preview: {
    borderRadius: radius.xl,
    padding: spacing(2),
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing(1),
  },
  previewLabel: { ...font.label, fontSize: 10 },
  previewCard: { borderRadius: radius.lg, borderWidth: 1, padding: spacing(1.75), gap: spacing(1.5) },
  previewTop: { flexDirection: 'row', alignItems: 'center', gap: spacing(1.25) },
  previewAvatar: {
    width: 42,
    height: 42,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewAvatarText: { fontWeight: '800', fontSize: 14 },
  previewName: { ...font.heading, fontSize: 16 },
  previewMeta: { fontSize: 12, fontWeight: '600', marginTop: 1 },
  previewTally: { fontSize: 22, fontWeight: '900' },
  previewStamps: { alignItems: 'flex-start' },
  previewBtn: {
    borderRadius: radius.pill,
    paddingVertical: spacing(1.4),
    alignItems: 'center',
  },
  previewBtnText: { fontSize: 15, fontWeight: '800' },

  presetGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing(1) },
  preset: {
    width: '48%',
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.border,
    padding: spacing(1.25),
    gap: spacing(0.75),
    ...shadow(colors.shadow, 0.5),
  },
  presetOn: { borderColor: colors.accent },
  presetDots: { flexDirection: 'row', gap: 5 },
  presetDot: { width: 18, height: 18, borderRadius: 9 },
  presetName: { fontSize: 12, fontWeight: '800' },
  presetCheck: { position: 'absolute', top: spacing(1), right: spacing(1.25), fontWeight: '900' },

  pickerLabel: { ...font.label, color: colors.textDim },
  swatchWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing(1) },
  hueSwatch: { width: 34, height: 34, borderRadius: radius.pill, borderWidth: 2, borderColor: 'transparent' },
  shadeSwatch: { width: 46, height: 38, borderRadius: radius.sm, borderWidth: 2, borderColor: 'transparent' },
  paperSwatch: {
    width: 46,
    height: 46,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: colors.border,
  },
  swatchOn: { borderColor: colors.text },

  currentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(1),
    marginTop: spacing(1),
  },
  currentChip: {
    width: 26,
    height: 26,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  currentHex: { fontFamily: 'monospace', fontSize: 13, color: colors.textDim, fontWeight: '700' },
});
