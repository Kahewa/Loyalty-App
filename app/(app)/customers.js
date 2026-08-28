import { useEffect, useMemo, useState } from 'react';
import { View, Text, FlatList, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/auth-context';
import { watchCustomers, watchRewards, rewardStatus, activeRewards } from '../../src/data';
import { CustomerRow } from '../../src/components/customer-row';
import { toDate } from '../../src/format';
import { Empty, Loading } from '../../src/components/ui';
import { useTheme, useThemedStyles } from '../../src/theme-context';
import { font, radius, shadow, spacing } from '../../src/theme';

const SORTS = [
  { key: 'progress', label: 'Closest' },
  { key: 'visits', label: 'Most' },
  { key: 'recent', label: 'Recent' },
  { key: 'name', label: 'A–Z' },
];

export default function Customers() {
  const { user } = useAuth();
  const router = useRouter();
  const { colors } = useTheme();
  const s = useThemedStyles(makeStyles);

  const [customers, setCustomers] = useState(null);
  const [rewards, setRewards] = useState([]);
  const [sort, setSort] = useState('progress');

  useEffect(() => {
    if (!user) return;
    const stops = [watchCustomers(user.uid, setCustomers), watchRewards(user.uid, setRewards)];
    return () => stops.forEach((stop) => stop());
  }, [user]);

  
  const active = activeRewards(rewards);

  const sorted = useMemo(() => {
    if (!customers) return [];
    const list = [...customers];

    if (sort === 'name') return list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    if (sort === 'visits') return list.sort((a, b) => (b.pointsBalance || 0) - (a.pointsBalance || 0));
    if (sort === 'recent') {
      return list.sort(
        (a, b) => (toDate(b.lastVisitAt)?.getTime() || 0) - (toDate(a.lastVisitAt)?.getTime() || 0)
      );
    }
    // Closest to a reward, with anyone already owed one at the top.
    return list.sort((a, b) => {
      const pa = rewardStatus(a, rewards);
      const pb = rewardStatus(b, rewards);
      if (pa.ready !== pb.ready) return pa.ready ? -1 : 1;
      if (pa.next && pa.toGo !== pb.toGo) return pa.toGo - pb.toGo;
      return pb.balance - pa.balance;
    });
  }, [customers, sort, rewards]);

  const stats = useMemo(() => {
    const all = customers || [];
    return {
      total: all.length,
      ready: all.filter((c) => rewardStatus(c, rewards).ready).length,
      visits: all.reduce((n, c) => n + (c.pointsBalance || 0), 0),
    };
  }, [customers, rewards]);

  if (customers === null) return <Loading label="Loading customers…" />;

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={s.list}
      data={sorted}
      keyExtractor={(c) => c.id}
      ListHeaderComponent={
        <View style={{ gap: spacing(1.5) }}>
          <View style={s.statRow}>
            <Stat value={stats.total} label={stats.total === 1 ? 'customer' : 'customers'} glyph="👥" />
            <Stat value={stats.visits} label="visits" glyph="✅" />
            <Stat value={stats.ready} label="rewards due" glyph="🎁" tone={stats.ready > 0} />
          </View>

          {active.length === 0 && (
            <Pressable style={s.notice} onPress={() => router.push('/rewards')}>
              <Text style={s.noticeText}>
                No active rewards, so there is nothing to count toward. Tap to set one up.
              </Text>
            </Pressable>
          )}

          <View style={s.sortRow}>
            {SORTS.map((o) => (
              <Pressable
                key={o.key}
                onPress={() => setSort(o.key)}
                style={[s.sortChip, sort === o.key && s.sortChipOn]}
              >
                <Text style={[s.sortText, sort === o.key && s.sortTextOn]} numberOfLines={1}>
                  {o.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      }
      ListEmptyComponent={
        <Empty
          glyph="🌱"
          title="No customers yet"
          subtitle="Add someone, or share your QR code so they can sign themselves up."
        />
      }
      renderItem={({ item }) => (
        <CustomerRow
          customer={item}
          rewards={rewards}
          onPress={() => router.push(`/customer/${item.id}`)}
        />
      )}
    />
  );
}

function Stat({ value, label, glyph, tone }) {
  const s = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  return (
    <View style={[s.stat, tone && s.statOn]}>
      <Text style={s.statGlyph}>{glyph}</Text>
      <Text style={[s.statValue, tone && { color: colors.success }]}>{value}</Text>
      <Text style={s.statLabel} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const makeStyles = ({ colors }) => ({
  list: { padding: spacing(2), gap: spacing(1), paddingBottom: spacing(6) },

  statRow: { flexDirection: 'row', gap: spacing(1) },
  stat: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing(1.5),
    alignItems: 'center',
    gap: 2,
    ...shadow(colors.shadow, 0.5),
  },
  statOn: { borderColor: colors.success, backgroundColor: colors.successSoft },
  statGlyph: { fontSize: 15, marginBottom: 2 },
  statValue: { fontSize: 24, fontWeight: '900', color: colors.accent, letterSpacing: -0.5 },
  statLabel: { fontSize: 10, fontWeight: '700', color: colors.textFaint },

  notice: {
    backgroundColor: colors.warningSoft,
    borderWidth: 1.5,
    borderColor: colors.warning,
    borderRadius: radius.md,
    padding: spacing(1.5),
  },
  noticeText: { ...font.small, color: colors.warning, fontWeight: '700', lineHeight: 19 },

  sortRow: { flexDirection: 'row', gap: spacing(0.75) },
  sortChip: {
    flex: 1,
    paddingVertical: spacing(1),
    paddingHorizontal: 4,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
  },
  sortChipOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  sortText: { fontSize: 12, fontWeight: '800', color: colors.textDim },
  sortTextOn: { color: colors.accentText },
});
