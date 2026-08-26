import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { colors, radius, spacing } from '../theme';

export function Screen({ children, scroll = true, style, ...rest }) {
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

export function Card({ children, style }) {
  return <View style={[s.card, style]}>{children}</View>;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  style,
}) {
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
        <ActivityIndicator color={variant === 'primary' ? colors.accentText : colors.text} />
      ) : (
        <Text style={[s.btnText, s[`btnText_${variant}`]]}>{title}</Text>
      )}
    </Pressable>
  );
}

export function Field({ label, hint, error, style, ...inputProps }) {
  return (
    <View style={[s.field, style]}>
      {!!label && <Text style={s.label}>{label}</Text>}
      <TextInput
        placeholderTextColor={colors.textDim}
        style={[s.input, inputProps.multiline && s.inputMultiline, !!error && s.inputError]}
        {...inputProps}
      />
      {!!hint && !error && <Text style={s.hint}>{hint}</Text>}
      {!!error && <Text style={s.error}>{error}</Text>}
    </View>
  );
}

export const Title = ({ children, style }) => <Text style={[s.title, style]}>{children}</Text>;
export const Body = ({ children, style }) => <Text style={[s.body, style]}>{children}</Text>;
export const Dim = ({ children, style }) => <Text style={[s.dim, style]}>{children}</Text>;

export function Badge({ children, tone = 'accent' }) {
  return (
    <View style={[s.badge, { backgroundColor: colors[tone] + '22', borderColor: colors[tone] }]}>
      <Text style={[s.badgeText, { color: colors[tone] }]}>{children}</Text>
    </View>
  );
}

export function Empty({ title, subtitle }) {
  return (
    <View style={s.empty}>
      <Text style={s.emptyTitle}>{title}</Text>
      {!!subtitle && <Text style={s.dim}>{subtitle}</Text>}
    </View>
  );
}

export function Loading({ label = 'Loading…' }) {
  return (
    <View style={s.loading}>
      <ActivityIndicator color={colors.accent} />
      <Text style={[s.dim, { marginTop: spacing(1) }]}>{label}</Text>
    </View>
  );
}

export function Row({ children, style }) {
  return <View style={[s.row, style]}>{children}</View>;
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  screenContent: { padding: spacing(2), paddingBottom: spacing(6), gap: spacing(2) },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing(2),
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing(1),
  },
  btn: {
    borderRadius: radius.md,
    paddingVertical: spacing(1.75),
    paddingHorizontal: spacing(2.5),
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  btn_primary: { backgroundColor: colors.accent },
  btn_secondary: { backgroundColor: colors.surfaceAlt },
  btn_ghost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.border },
  btn_danger: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.danger },
  btnPressed: { opacity: 0.75 },
  btnDisabled: { opacity: 0.45 },
  btnText: { fontSize: 16, fontWeight: '700' },
  btnText_primary: { color: colors.accentText },
  btnText_secondary: { color: colors.text },
  btnText_ghost: { color: colors.text },
  btnText_danger: { color: colors.danger },
  field: { gap: spacing(0.75) },
  label: { color: colors.textDim, fontSize: 13, fontWeight: '600', letterSpacing: 0.3 },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing(1.75),
    paddingVertical: spacing(1.5),
    color: colors.text,
    fontSize: 16,
    minHeight: 50,
  },
  inputMultiline: { minHeight: 130, textAlignVertical: 'top', lineHeight: 22 },
  inputError: { borderColor: colors.danger },
  hint: { color: colors.textDim, fontSize: 12 },
  error: { color: colors.danger, fontSize: 13 },
  title: { color: colors.text, fontSize: 22, fontWeight: '800' },
  body: { color: colors.text, fontSize: 15, lineHeight: 21 },
  dim: { color: colors.textDim, fontSize: 13, lineHeight: 19 },
  badge: {
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: spacing(1.25),
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  badgeText: { fontSize: 12, fontWeight: '700' },
  empty: { padding: spacing(4), alignItems: 'center', gap: spacing(0.5) },
  emptyTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  loading: { padding: spacing(4), alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing(1.5) },
});
