import { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, FlatList, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../src/auth-context';
import {
  watchCustomers,
  watchRewards,
  watchSignupRequests,
  rewardStatus,
  activeRewards,
} from '../../src/data';
import { CustomerRow } from '../../src/components/customer-row';
import { Empty, Loading } from '../../src/components/ui';
import { useTheme, useThemedStyles } from '../../src/theme-context';
import { font, radius, shadow, spacing } from '../../src/theme';

const ACTIONS = [
  { label: 'Everyone', glyph: '👥', href: '/customers' },
  { label: 'Add', glyph: '➕', href: '/add-customer' },
  { label: 'Share', glyph: '📇', href: '/share' },
  { label: 'Rewards', glyph: '🎁', href: '/rewards' },
  { label: 'Emails', glyph: '✉️', href: '/templates' },
];

export default function Home() {
  const { user, business } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const s = useThemedStyles(makeStyles);

  const [customers, setCustomers] = useState(null);
  const [rewards, setRewards] = useState([]);
  const [pending, setPending] = useState([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!user) return;
    const stops = [
      watchCustomers(user.uid, setCustomers),
      watchRewards(user.uid, setRewards),
      watchSignupRequests(user.uid, setPending),
    ];
    return () => stops.forEach((stop) => stop());
  }, [user]);

  
  const active = activeRewards(rewards);

  // Closest to a reward first — that is the list the person at the till cares
  // about. Search filters the same list rather than switching to another view.
  const list = useMemo(() => {
    if (!customers) return [];
    const q = search.trim().toLowerCase();
    const filtered = q
      ? customers.filter(
          (c) => c.name?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q)
        )
      : customers;

    return [...filtered].sort((a, b) => {
      const pa = rewardStatus(a, rewards);
      const pb = rewardStatus(b, rewards);
      if (pa.ready !== pb.ready) return pa.ready ? -1 : 1;
      if (pa.next && pa.toGo !== pb.toGo) return pa.toGo - pb.toGo;
      if (pa.balance !== pb.balance) return pb.balance - pa.balance;
      return (a.name || '').localeCompare(b.name || '');
    });
  }, [customers, search, rewards]);

  const readyCount = useMemo(
    () => (customers || []).filter((c) => rewardStatus(c, rewards).ready).length,
    [customers, rewards]
  );

  const searching = search.trim().length > 0;

  return (
    <View style={[s.wrap, { paddingTop: insets.top + spacing(1) }]}>
      <View style={s.topBar}>
        <View style={{ flex: 1 }}>
          <Text style={s.greeting}>Hello 👋</Text>
          <Text style={s.shop} numberOfLines={1}>
            {business?.businessName || 'Your business'}
          </Text>
        </View>
        <Pressable onPress={() => router.push('/settings')} style={s.iconBtn} hitSlop={8}>
          <Text style={s.icon}>⚙️</Text>
        </Pressable>
      </View>

      <View style={s.searchWrap}>
        <Text style={s.searchIcon}>🔍</Text>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Find a customer…"
          placeholderTextColor={colors.textFaint}
          style={s.search}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
        {searching ? (
          <Pressable onPress={() => setSearch('')} hitSlop={10}>
            <Text style={s.clear}>✕</Text>
          </Pressable>
        ) : null}
      </View>

      <FlatList
        data={list}
        keyExtractor={(c) => c.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={s.list}
        ListHeaderComponent={
          searching ? null : (
            <View style={{ gap: spacing(1.25) }}>
              {pending.length > 0 && (
                <Pressable style={s.pendingBanner} onPress={() => router.push('/pending')}>
                  <View style={s.pendingCount}>
                    <Text style={s.pendingCountText}>{pending.length}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.bannerTitle}>
                      {pending.length === 1
                        ? '1 person wants to join'
                        : `${pending.length} people want to join`}
                    </Text>
                    <Text style={s.bannerSub} numberOfLines={1}>
                      {pending.slice(0, 3).map((p) => p.name).join(', ')}
                      {pending.length > 3 ? ` +${pending.length - 3} more` : ''}
                    </Text>
                  </View>
                  <Text style={s.chevron}>›</Text>
                </Pressable>
              )}

              <View style={s.quickRow}>
                {ACTIONS.map((a) => (
                  <Pressable key={a.href} style={s.quick} onPress={() => router.push(a.href)}>
                    <Text style={s.quickGlyph}>{a.glyph}</Text>
                    <Text style={s.quickLabel} numberOfLines={1}>
                      {a.label}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {readyCount > 0 && (
                <Pressable style={s.readyBanner} onPress={() => router.push('/customers')}>
                  <Text style={s.readyGlyph}>🎉</Text>
                  <Text style={s.readyText}>
                    {readyCount === 1
                      ? '1 customer has a reward waiting'
                      : `${readyCount} customers have rewards waiting`}
                  </Text>
                  <Text style={s.chevron}>›</Text>
                </Pressable>
              )}

              <View style={s.listHead}>
                <Text style={s.sectionLabel}>
                  {active.length ? 'CLOSEST TO A REWARD' : 'YOUR CUSTOMERS'}
                </Text>
                {active.length > 0 && (
                  <Text style={s.rewardChip} numberOfLines={1}>
                    {active.length === 1
                      ? active[0].pointsRequired + ' visits → ' + active[0].name
                      : active.length + ' rewards running'}
                  </Text>
                )}
              </View>
            </View>
          )
        }
        ListEmptyComponent={
          customers === null ? (
            <Loading />
          ) : searching ? (
            <Empty
              glyph="🔍"
              title="No match"
              subtitle={`Nobody called "${search.trim()}" yet.`}
            />
          ) : (
            <Empty
              glyph="🌱"
              title="No customers yet"
              subtitle="Add someone, or share your QR code so they can sign themselves up."
            />
          )
        }
        ListFooterComponent={
          searching ? (
            <Pressable
              style={s.addRow}
              onPress={() =>
                router.push({ pathname: '/add-customer', params: { name: search.trim() } })
              }
            >
              <Text style={s.addRowText}>➕ Add "{search.trim()}" as a new customer</Text>
            </Pressable>
          ) : null
        }
        renderItem={({ item }) => (
          <CustomerRow
            customer={item}
            rewards={rewards}
            onPress={() => router.push(`/customer/${item.id}`)}
          />
        )}
      />
    </View>
  );
}

const makeStyles = ({ colors }) => ({
  wrap: { flex: 1, backgroundColor: colors.bg },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing(2),
    paddingBottom: spacing(1.5),
    gap: spacing(1),
  },
  greeting: { ...font.small, color: colors.textDim, fontWeight: '700' },
  shop: { ...font.display, fontSize: 26, color: colors.text, marginTop: 1 },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: { fontSize: 18 },

  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(1),
    marginHorizontal: spacing(2),
    paddingHorizontal: spacing(1.75),
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    ...shadow(colors.shadow, 0.5),
  },
  searchIcon: { fontSize: 15 },
  clear: { fontSize: 15, color: colors.textDim, fontWeight: '800' },
  search: { flex: 1, color: colors.text, fontSize: 16, paddingVertical: spacing(1.75) },

  list: { padding: spacing(2), gap: spacing(1), paddingBottom: spacing(6) },

  listHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing(1),
    marginTop: spacing(1),
  },
  sectionLabel: { ...font.label, color: colors.textFaint },
  rewardChip: {
    ...font.small,
    fontSize: 11,
    fontWeight: '700',
    color: colors.accent,
    backgroundColor: colors.accentSoft,
    borderRadius: radius.pill,
    paddingHorizontal: spacing(1),
    paddingVertical: 3,
    flexShrink: 1,
  },

  quickRow: { flexDirection: 'row', gap: spacing(0.75) },
  quick: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing(1.25),
    paddingHorizontal: 2,
    alignItems: 'center',
    gap: 5,
    ...shadow(colors.shadow, 0.5),
  },
  quickGlyph: { fontSize: 19 },
  quickLabel: { fontSize: 10, fontWeight: '800', color: colors.textDim },

  pendingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(1.25),
    backgroundColor: colors.accentSoft,
    borderWidth: 1.5,
    borderColor: colors.accentEdge,
    borderRadius: radius.lg,
    padding: spacing(1.5),
  },
  pendingCount: {
    minWidth: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 9,
  },
  pendingCountText: { color: colors.accentText, fontWeight: '900', fontSize: 15 },
  bannerTitle: { ...font.heading, fontSize: 15, color: colors.text },
  bannerSub: { fontSize: 12, fontWeight: '600', color: colors.textDim, marginTop: 1 },

  readyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(1),
    backgroundColor: colors.successSoft,
    borderWidth: 1.5,
    borderColor: colors.success,
    borderRadius: radius.lg,
    padding: spacing(1.5),
  },
  readyGlyph: { fontSize: 18 },
  readyText: { ...font.heading, fontSize: 14, color: colors.success, flex: 1 },
  chevron: { color: colors.textDim, fontSize: 22, fontWeight: '800' },

  addRow: {
    padding: spacing(2),
    alignItems: 'center',
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.borderStrong,
  },
  addRowText: { ...font.body, color: colors.accent, fontWeight: '700' },
});
