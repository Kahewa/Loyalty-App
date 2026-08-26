import { useEffect, useState } from 'react';
import { View, Text, Alert, FlatList, Pressable, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter, useNavigation } from 'expo-router';
import { useAuth } from '../../../src/auth-context';
import {
  watchCustomer,
  watchEntries,
  watchRewards,
  logVisit,
  redeemReward,
  deleteCustomer,
} from '../../../src/data';
import { fullDate, initials } from '../../../src/format';
import { colors, radius, spacing } from '../../../src/theme';
import { Button, Card, Loading, Empty, Badge } from '../../../src/components/ui';

export default function CustomerDetail() {
  const { id } = useLocalSearchParams();
  const { user } = useAuth();
  const router = useRouter();
  const navigation = useNavigation();

  const [customer, setCustomer] = useState(undefined); // undefined = still loading
  const [entries, setEntries] = useState([]);
  const [rewards, setRewards] = useState([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user || !id) return;
    const stops = [
      watchCustomer(user.uid, id, setCustomer),
      watchEntries(user.uid, id, setEntries),
      watchRewards(user.uid, setRewards),
    ];
    return () => stops.forEach((stop) => stop());
  }, [user, id]);

  useEffect(() => {
    if (customer?.name) navigation.setOptions({ title: customer.name });
  }, [customer?.name, navigation]);

  if (customer === undefined) return <Loading label="Loading customer..." />;
  if (customer === null) {
    return <Empty title="Customer not found" subtitle="They may have been deleted." />;
  }

  const balance = customer.pointsBalance || 0;
  const reward = rewards.find((r) => r.active);
  const target = reward ? Number(reward.pointsRequired) : 0;
  const remaining = target ? Math.max(0, target - balance) : 0;
  const canRedeem = Boolean(reward) && balance >= target;
  const progress = target ? Math.min(1, balance / target) : 0;

  async function addVisit() {
    setBusy(true);
    try {
      // Optimistic by nature: the batch commits locally first, so the number
      // moves immediately even with no signal.
      await logVisit(user.uid, customer, { points: 1 });
    } catch (e) {
      Alert.alert('Could not log the visit', e.message);
    } finally {
      setBusy(false);
    }
  }

  function confirmRedeem() {
    if (!reward) return;
    Alert.alert(
      `Redeem ${reward.name}?`,
      `This takes ${target} points off ${customer.name}'s balance, leaving ${balance - target}.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Redeem',
          style: 'default',
          onPress: async () => {
            setBusy(true);
            try {
              await redeemReward(user.uid, customer.id, reward);
            } catch (e) {
              Alert.alert('Could not redeem', e.message);
            } finally {
              setBusy(false);
            }
          },
        },
      ]
    );
  }

  function confirmDelete() {
    Alert.alert(
      `Remove ${customer.name}?`,
      'Their points and full visit history are deleted. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteCustomer(user.uid, customer.id);
              router.back();
            } catch (e) {
              Alert.alert('Could not delete', e.message);
            }
          },
        },
      ]
    );
  }

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={s.list}
      data={entries}
      keyExtractor={(e) => e.id}
      ListHeaderComponent={
        <View style={{ gap: spacing(2) }}>
          <Card style={{ alignItems: 'center', gap: spacing(1.5) }}>
            <View style={s.avatar}>
              <Text style={s.avatarText}>{initials(customer.name)}</Text>
            </View>
            <Text style={s.name}>{customer.name}</Text>
            {!!customer.email && <Text style={s.email}>{customer.email}</Text>}
            {customer.source === 'signup' ? (
              <Badge tone="success">Signed up via QR</Badge>
            ) : (
              <Badge tone="textDim">Added manually</Badge>
            )}

            <View style={s.balanceBlock}>
              <Text style={s.balanceNum}>{balance}</Text>
              <Text style={s.balanceLabel}>points</Text>
            </View>

            {reward ? (
              <View style={{ width: '100%', gap: spacing(0.75) }}>
                <View style={s.track}>
                  <View style={[s.fill, { width: `${progress * 100}%` }]} />
                </View>
                <Text style={s.progressLabel}>
                  {canRedeem
                    ? `${reward.name} is ready to claim`
                    : `${remaining} more ${remaining === 1 ? 'visit' : 'visits'} until ${reward.name}`}
                </Text>
              </View>
            ) : (
              <Text style={s.progressLabel}>
                No active reward yet — set one up so customers have something to aim at.
              </Text>
            )}
          </Card>

          <Button
            title={busy ? 'Saving...' : '+1 visit'}
            onPress={addVisit}
            loading={busy}
            style={s.bigBtn}
          />

          <Button
            title={
              reward
                ? canRedeem
                  ? `Redeem ${reward.name}`
                  : `Needs ${remaining} more for ${reward.name}`
                : 'Set up a reward first'
            }
            variant="secondary"
            disabled={!canRedeem || busy}
            onPress={confirmRedeem}
          />

          <Text style={s.sectionTitle}>HISTORY</Text>
        </View>
      }
      ListEmptyComponent={
        <Empty title="No visits yet" subtitle="Tap +1 visit when they come in." />
      }
      renderItem={({ item }) => {
        const positive = item.points > 0;
        const tone = positive ? colors.success : colors.warning;
        return (
          <View style={s.entry}>
            <View style={[s.pill, { backgroundColor: tone + '22' }]}>
              <Text style={[s.pillText, { color: tone }]}>
                {positive ? `+${item.points}` : item.points}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.entryNote}>{item.note || 'Visit'}</Text>
              <Text style={s.entryMeta}>{fullDate(item.createdAt)}</Text>
            </View>
            {/* balanceAfter is the audit trail: what the card read at that moment. */}
            <Text style={s.entryBalance}>{item.balanceAfter} pts</Text>
          </View>
        );
      }}
      ListFooterComponent={
        <Pressable onPress={confirmDelete} style={s.deleteRow}>
          <Text style={s.deleteText}>Remove this customer</Text>
        </Pressable>
      }
    />
  );
}

const s = StyleSheet.create({
  list: { padding: spacing(2), gap: spacing(1), paddingBottom: spacing(6) },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.text, fontWeight: '800', fontSize: 24 },
  name: { color: colors.text, fontSize: 22, fontWeight: '800' },
  email: { color: colors.textDim, fontSize: 14 },
  balanceBlock: { alignItems: 'center', marginVertical: spacing(1) },
  balanceNum: { color: colors.accent, fontSize: 56, fontWeight: '900', lineHeight: 60 },
  balanceLabel: { color: colors.textDim, fontSize: 13, letterSpacing: 1 },
  track: {
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    overflow: 'hidden',
  },
  fill: { height: 8, borderRadius: radius.pill, backgroundColor: colors.accent },
  progressLabel: { color: colors.textDim, fontSize: 13, textAlign: 'center' },
  bigBtn: { minHeight: 64 },
  sectionTitle: {
    color: colors.textDim,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    marginTop: spacing(1),
  },
  entry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(1.5),
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing(1.5),
  },
  pill: { minWidth: 44, paddingVertical: spacing(0.75), borderRadius: radius.sm, alignItems: 'center' },
  pillText: { fontWeight: '800', fontSize: 15 },
  entryNote: { color: colors.text, fontSize: 15, fontWeight: '600' },
  entryMeta: { color: colors.textDim, fontSize: 12, marginTop: 2 },
  entryBalance: { color: colors.textDim, fontSize: 13, fontWeight: '600' },
  deleteRow: { padding: spacing(2.5), alignItems: 'center' },
  deleteText: { color: colors.danger, fontSize: 14, fontWeight: '600' },
});
