import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme-context';
import { radius, spacing } from '../theme';

/**
 * The punch card, drawn as punches.
 *
 * A progress bar tells you a fraction; a row of stamps tells you a story you can
 * count at a glance — which is the whole appeal of the paper card this replaces.
 * Past about 14 stamps they stop being countable and start being noise, so
 * bigger targets fall back to a bar.
 */
export function StampRow({ balance, target, size = 'md', ready }) {
  const { colors } = useTheme();

  if (!target) return null;

  const dot = size === 'sm' ? 12 : 20;
  const gap = size === 'sm' ? 5 : 7;

  if (target > 14) return <ProgressBar balance={balance} target={target} ready={ready} />;

  return (
    <View style={[s.row, { gap }]}>
      {Array.from({ length: target }, (_, i) => {
        const filled = i < balance;
        return (
          <View
            key={i}
            style={[
              s.stamp,
              {
                width: dot,
                height: dot,
                borderRadius: dot / 2,
                backgroundColor: filled ? (ready ? colors.success : colors.accent) : 'transparent',
                borderColor: filled
                  ? ready
                    ? colors.success
                    : colors.accent
                  : colors.stampEmpty,
              },
            ]}
          >
            {filled && size !== 'sm' && (
              <Text style={[s.tick, { color: ready ? colors.accentText : colors.accentText }]}>
                ✓
              </Text>
            )}
          </View>
        );
      })}
    </View>
  );
}

function ProgressBar({ balance, target, ready }) {
  const { colors } = useTheme();
  const ratio = Math.min(1, balance / target);
  return (
    <View style={[s.track, { backgroundColor: colors.stampEmpty }]}>
      <View
        style={[
          s.fill,
          {
            width: `${ratio * 100}%`,
            backgroundColor: ready ? colors.success : colors.accent,
          },
        ]}
      />
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
  stamp: {
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tick: { fontSize: 11, fontWeight: '900', lineHeight: 14 },
  track: { height: 8, borderRadius: radius.pill, overflow: 'hidden', width: '100%' },
  fill: { height: 8, borderRadius: radius.pill },
});
