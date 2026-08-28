import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useTheme, useThemedStyles } from '../theme-context';
import { font, radius, shadow, spacing } from '../theme';

export function Screen({ children, scroll = true, style, ...rest }) {
  const s = useThemedStyles(makeStyles);
  const Container = scroll ? ScrollView : View;
  return (
    <Container
      style={[s.screen, !scroll && style]}
      contentContainerStyle={scroll ? [s.screenContent, style] : undefined}
      keyboardShouldPersistTaps="handled"
      {...rest}
    >
      {children}
    </Container>
  );
}

export function Card({ children, style, tone }) {
  const s = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  return (
    <View
      style={[
        s.card,
        tone && { backgroundColor: colors[`${tone}Soft`], borderColor: colors[tone] },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  glyph,
  style,
}) {
  const s = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const off = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      style={({ pressed }) => [
        s.btn,
        s[`btn_${variant}`],
        pressed && !off && s.btnPressed,
        off && s.btnDisabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? colors.accentText : colors.accent} />
      ) : (
        <View style={s.btnInner}>
          {!!glyph && <Text style={[s.btnGlyph, s[`btnText_${variant}`]]}>{glyph}</Text>}
          <Text style={[s.btnText, s[`btnText_${variant}`]]}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
}

export function Field({ label, hint, error, style, ...inputProps }) {
  const s = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  return (
    <View style={[s.field, style]}>
      {!!label && <Text style={s.label}>{label}</Text>}
      <TextInput
        placeholderTextColor={colors.textFaint}
        style={[s.input, inputProps.multiline && s.inputMultiline, !!error && s.inputError]}
        {...inputProps}
      />
      {!!hint && !error && <Text style={s.hint}>{hint}</Text>}
      {!!error && <Text style={s.error}>{error}</Text>}
    </View>
  );
}

export const Title = ({ children, style }) => {
  const s = useThemedStyles(makeStyles);
  return <Text style={[s.title, style]}>{children}</Text>;
};

export const Heading = ({ children, style }) => {
  const s = useThemedStyles(makeStyles);
  return <Text style={[s.heading, style]}>{children}</Text>;
};

export const Body = ({ children, style }) => {
  const s = useThemedStyles(makeStyles);
  return <Text style={[s.body, style]}>{children}</Text>;
};

export const Dim = ({ children, style }) => {
  const s = useThemedStyles(makeStyles);
  return <Text style={[s.dim, style]}>{children}</Text>;
};

export function SectionLabel({ children, style }) {
  const s = useThemedStyles(makeStyles);
  return <Text style={[s.sectionLabel, style]}>{children}</Text>;
}

export function Badge({ children, tone = 'accent' }) {
  const s = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const color = colors[tone] || colors.accent;
  const soft = colors[`${tone}Soft`] || colors.accentSoft;
  return (
    <View style={[s.badge, { backgroundColor: soft, borderColor: color }]}>
      <Text style={[s.badgeText, { color }]}>{children}</Text>
    </View>
  );
}

export function Empty({ title, subtitle, glyph = '🌿' }) {
  const s = useThemedStyles(makeStyles);
  return (
    <View style={s.empty}>
      <Text style={s.emptyGlyph}>{glyph}</Text>
      <Text style={s.emptyTitle}>{title}</Text>
      {!!subtitle && <Text style={[s.dim, { textAlign: 'center' }]}>{subtitle}</Text>}
    </View>
  );
}

export function Loading({ label = 'Loading…' }) {
  const s = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  return (
    <View style={s.loading}>
      <ActivityIndicator color={colors.accent} />
      <Text style={[s.dim, { marginTop: spacing(1) }]}>{label}</Text>
    </View>
  );
}

export function Row({ children, style }) {
  const s = useThemedStyles(makeStyles);
  return <View style={[s.row, style]}>{children}</View>;
}

const makeStyles = ({ colors }) => ({
  screen: { flex: 1, backgroundColor: colors.bg },
  screenContent: { padding: spacing(2), paddingBottom: spacing(6), gap: spacing(1.5) },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing(2),
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing(1),
    ...shadow(colors.shadow, 1),
  },

  btn: {
    borderRadius: radius.pill,
    paddingVertical: spacing(1.85),
    paddingHorizontal: spacing(2.5),
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 54,
  },
  btnInner: { flexDirection: 'row', alignItems: 'center', gap: spacing(0.75) },
  btn_primary: { backgroundColor: colors.accent, ...shadow(colors.accent, 1) },
  btn_secondary: { backgroundColor: colors.accentSoft, borderWidth: 1, borderColor: colors.accentEdge },
  btn_ghost: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: colors.border },
  btn_danger: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: colors.danger },
  btnPressed: { opacity: 0.82, transform: [{ scale: 0.985 }] },
  btnDisabled: { opacity: 0.4 },
  btnText: { ...font.heading, fontSize: 16 },
  btnGlyph: { fontSize: 17, fontWeight: '800' },
  btnText_primary: { color: colors.accentText },
  btnText_secondary: { color: colors.accent },
  btnText_ghost: { color: colors.text },
  btnText_danger: { color: colors.danger },

  field: { gap: spacing(0.75) },
  label: { ...font.label, color: colors.textDim },
  input: {
    backgroundColor: colors.bg,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing(1.75),
    paddingVertical: spacing(1.5),
    color: colors.text,
    fontSize: 16,
    minHeight: 52,
  },
  inputMultiline: { minHeight: 140, textAlignVertical: 'top', lineHeight: 22 },
  inputError: { borderColor: colors.danger },
  hint: { ...font.small, fontSize: 12, color: colors.textFaint, lineHeight: 17 },
  error: { ...font.small, color: colors.danger },

  title: { ...font.title, color: colors.text },
  heading: { ...font.heading, color: colors.text },
  body: { ...font.body, color: colors.text, lineHeight: 22 },
  dim: { ...font.small, color: colors.textDim, lineHeight: 19 },
  sectionLabel: { ...font.label, color: colors.textFaint, marginTop: spacing(1) },

  badge: {
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: spacing(1.25),
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  badgeText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.3 },

  empty: { padding: spacing(4), alignItems: 'center', gap: spacing(0.75) },
  emptyGlyph: { fontSize: 34, marginBottom: spacing(0.5) },
  emptyTitle: { ...font.heading, color: colors.text },

  loading: { padding: spacing(4), alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing(1.5) },
});
