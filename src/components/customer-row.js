import { View, Text, Pressable } from 'react-native';
import { rewardStatus } from '../data';
import { initials } from '../format';
import { useTheme, useThemedStyles } from '../theme-context';
import { font, radius, shadow, spacing } from '../theme';
import { StampRow } from './stamps';

/**
 * One customer and how close they are to their reward.
 * Shared by the dashboard and the full customer list so the two can never
 * disagree about someone's standing.
 */
export function CustomerRow({ customer, rewards, onPress }) {
  const s = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const p = rewardStatus(customer, rewards);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [s.row, p.ready && s.rowReady, pressed && s.pressed]}
    >
      <View style={[s.avatar, p.ready && s.avatarReady]}>
        <Text style={[s.avatarText, p.ready && { color: colors.success }]}>
          {initials(customer.name)}
        </Text>
      </View>

      <View style={{ flex: 1, gap: 6 }}>
        <View style={s.nameLine}>
          <Text style={s.name} numberOfLines={1}>
            {customer.name}
          </Text>
          {p.ready && <Text style={s.readyTag}>🎉</Text>}
        </View>

        {p.target > 0 ? (
          <>
            <StampRow balance={p.balance} target={p.target} size="sm" ready={p.ready} />
            <Text style={[s.meta, p.ready && s.metaReady]} numberOfLines={1}>
              {p.ready
                ? p.earned.length === 1
                  ? `${p.earned[0].name} — ready to claim`
                  : `${p.earned.length} rewards ready to claim`
                : `${p.toGo} more ${p.toGo === 1 ? 'visit' : 'visits'} to go`}
            </Text>
          </>
        ) : (
          <Text style={s.meta} numberOfLines={1}>
            {customer.email || 'No email on file'}
          </Text>
        )}
      </View>

      <View style={s.tally}>
        <Text style={[s.tallyNum, p.ready && { color: colors.success }]}>{p.balance}</Text>
        {p.target > 0 && <Text style={s.tallyOf}>of {p.target}</Text>}
      </View>
    </Pressable>
  );
}

const makeStyles = ({ colors }) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(1.5),
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing(1.5),
    ...shadow(colors.shadow, 1),
  },
  rowReady: { borderColor: colors.success, backgroundColor: colors.successSoft },
  pressed: { opacity: 0.85, transform: [{ scale: 0.99 }] },

  avatar: {
    width: 46,
    height: 46,
    borderRadius: radius.pill,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.accentEdge,
  },
  avatarReady: { backgroundColor: colors.successSoft, borderColor: colors.success },
  avatarText: { fontWeight: '800', fontSize: 15, color: colors.accent },

  nameLine: { flexDirection: 'row', alignItems: 'center', gap: spacing(0.75) },
  name: { ...font.heading, fontSize: 16, color: colors.text, flexShrink: 1 },
  readyTag: { fontSize: 14 },

  meta: { fontSize: 12, fontWeight: '600', color: colors.textDim },
  metaReady: { color: colors.success },

  tally: { alignItems: 'center', minWidth: 48 },
  tallyNum: { fontSize: 22, fontWeight: '900', color: colors.accent, letterSpacing: -0.5 },
  tallyOf: { fontSize: 10, fontWeight: '700', color: colors.textFaint },
});
