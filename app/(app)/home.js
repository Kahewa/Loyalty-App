import { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, FlatList, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../src/auth-context';
import { watchCustomers, watchRecentActivity, watchRewards } from '../../src/data';
import { timeAgo, initials } from '../../src/format';
import { colors, radius, spacing } from '../../src/theme';
import { Empty, Loading } from '../../src/components/ui';

export default function Home() {
  const { user, business } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [customers, setCustomers] = useState(null);
  const [activity, setActivity] = useState([]);
  const [rewards, setRewards] = useState([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!user) return;
    const stops = [
      watchCustomers(user.uid, setCustomers),
      watchRecentActivity(user.uid, setActivity),
      watchRewards(user.uid, setRewards),
    ];
    return () => stops.forEach((stop) => stop());
  }, [user]);

  const activeReward = rewards.find((r) => r.active);

  const results = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q || !customers) return [];
    return customers
      .filter((c) => c.name?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q))
      .slice(0, 25);
  }, [search, customers]);

  const searching = search.trim().length > 0;

  return (
    <View style={[s.wrap, { paddingTop: insets.top + spacing(1) }]}>
      <View style={s.topBar}>
        <View style={{ flex: 1 }}>
          <Text style={s.hello} numberOfLines={1}>
            {business?.businessName || 'Your business'}
          </Text>
          <Text style={s.sub} numberOfLines={1}>
            {customers === null
              ? 'Loading...'
              : `${customers.length} customer${customers.length === 1 ? '' : 's'}`}
            {activeReward ? ` · ${activeReward.pointsRequired} pts = ${activeReward.name}` : ''}
          </Text>
        </View>
        <Pressable onPress={() => router.push('/settings')} style={s.iconBtn} hitSlop={8}>
          <Text style={s.icon}>{'⚙'}</Text>
        </Pressable>
      </View>

      {/* Search is the whole point of this screen: find the person at the till, fast. */}
      <View style={s.searchWrap}>
        <Text style={s.searchIcon}>{'⌕'}</Text>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search a customer by name or email"
          placeholderTextColor={colors.textDim}
          style={s.search}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
        {searching ? (
          <Pressable onPress={() => setSearch('')} hitSlop={10}>
            <Text style={s.searchIcon}>{'✕'}</Text>
          </Pressable>
        ) : null}
      </View>

      {searching ? (
        <FlatList
          data={results}
          keyExtractor={(c) => c.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={s.list}
          ListEmptyComponent={
            <Empty title="No match" subtitle="Nobody by that name yet -- add them below." />
          }
          ListFooterComponent={
            <Pressable
              style={s.addRow}
              onPress={() =>
                router.push({ pathname: '/add-customer', params: { name: search.trim() } })
              }
            >
              <Text style={s.addRowText}>
                {'＋'} Add "{search.trim()}" as a new customer
              </Text>
            </Pressable>
          }
          renderItem={({ item }) => (
            <CustomerRow customer={item} onPress={() => router.push(`/customer/${item.id}`)} />
          )}
        />
      ) : (
        <FlatList
          data={activity}
          keyExtractor={(e) => e.id}
          contentContainerStyle={s.list}
          ListHeaderComponent={
            <>
              <View style={s.quickRow}>
                <QuickAction
                  label="Add customer"
                  glyph={'＋'}
                  onPress={() => router.push('/add-customer')}
                />
                <QuickAction
                  label="Share QR"
                  glyph={'⧉'}
                  onPress={() => router.push('/share')}
                />
                <QuickAction
                  label="Rewards"
                  glyph={'★'}
                  onPress={() => router.push('/rewards')}
                />
                <QuickAction
                  label="Emails"
                  glyph={'✉'}
                  onPress={() => router.push('/templates')}
                />
              </View>
              <Text style={s.sectionTitle}>Recent activity</Text>
            </>
          }
          ListEmptyComponent={
            customers === null ? (
              <Loading />
            ) : (
              <Empty
                title="Nothing logged yet"
                subtitle="Add a customer, or share your QR code so they can sign themselves up."
              />
            )
          }
          renderItem={({ item }) => (
            <ActivityRow item={item} onPress={() => router.push(`/customer/${item.customerId}`)} />
          )}
        />
      )}
    </View>
  );
}

function ActivityRow({ item, onPress }) {
  const positive = item.points > 0;
  const tone = positive ? colors.success : colors.warning;
  return (
    <Pressable style={s.row} onPress={onPress}>
      <View style={[s.pointsPill, { backgroundColor: tone + '22' }]}>
        <Text style={[s.pointsPillText, { color: tone }]}>
          {positive ? `+${item.points}` : item.points}
        </Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.rowName} numberOfLines={1}>
          {item.customerName || 'Customer'}
        </Text>
        <Text style={s.rowMeta} numberOfLines={1}>
          {item.note || 'Visit logged'} {'·'} now on {item.balanceAfter} pts
        </Text>
      </View>
      <Text style={s.rowTime}>{timeAgo(item.createdAt)}</Text>
    </Pressable>
  );
}

function CustomerRow({ customer, onPress }) {
  return (
    <Pressable style={s.row} onPress={onPress}>
      <View style={s.avatar}>
        <Text style={s.avatarText}>{initials(customer.name)}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.rowName} numberOfLines={1}>
          {customer.name}
        </Text>
        <Text style={s.rowMeta} numberOfLines={1}>
          {customer.email || 'No email on file'}
        </Text>
      </View>
      <View style={s.balance}>
        <Text style={s.balanceNum}>{customer.pointsBalance || 0}</Text>
        <Text style={s.balanceLabel}>pts</Text>
      </View>
    </Pressable>
  );
}

function QuickAction({ label, glyph, onPress }) {
  return (
    <Pressable style={s.quick} onPress={onPress}>
      <Text style={s.quickGlyph}>{glyph}</Text>
      <Text style={s.quickLabel}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing(2),
    paddingBottom: spacing(1.5),
    gap: spacing(1),
  },
  hello: { color: colors.text, fontSize: 22, fontWeight: '800' },
  sub: { color: colors.textDim, fontSize: 13, marginTop: 2 },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: { color: colors.textDim, fontSize: 18 },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(1),
    marginHorizontal: spacing(2),
    paddingHorizontal: spacing(1.75),
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchIcon: { color: colors.textDim, fontSize: 18 },
  search: { flex: 1, color: colors.text, fontSize: 17, paddingVertical: spacing(1.75) },
  list: { padding: spacing(2), gap: spacing(1), paddingBottom: spacing(6) },
  sectionTitle: {
    color: colors.textDim,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    marginTop: spacing(2),
    marginBottom: spacing(0.5),
  },
  quickRow: { flexDirection: 'row', gap: spacing(1) },
  quick: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing(1.5),
    alignItems: 'center',
    gap: 4,
  },
  quickGlyph: { color: colors.accent, fontSize: 20 },
  quickLabel: { color: colors.textDim, fontSize: 11, fontWeight: '600' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(1.5),
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing(1.5),
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.text, fontWeight: '800', fontSize: 15 },
  pointsPill: {
    minWidth: 44,
    paddingVertical: spacing(0.75),
    borderRadius: radius.sm,
    alignItems: 'center',
  },
  pointsPillText: { fontWeight: '800', fontSize: 15 },
  rowName: { color: colors.text, fontSize: 16, fontWeight: '700' },
  rowMeta: { color: colors.textDim, fontSize: 13, marginTop: 1 },
  rowTime: { color: colors.textDim, fontSize: 12 },
  balance: { alignItems: 'center' },
  balanceNum: { color: colors.accent, fontSize: 20, fontWeight: '800' },
  balanceLabel: { color: colors.textDim, fontSize: 11 },
  addRow: {
    padding: spacing(2),
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
  },
  addRowText: { color: colors.accent, fontSize: 15, fontWeight: '600' },
});
