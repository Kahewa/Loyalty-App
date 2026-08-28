import { useEffect, useState } from 'react';
import { View, Text, FlatList, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter, useNavigation } from 'expo-router';
import { useAuth } from '../../../src/auth-context';
import {
  watchCustomer,
  watchEntries,
  watchRewards,
  logVisit,
  redeemReward,
  deleteCustomer,
  rewardsCrossed,
  rewardStatus,
} from '../../../src/data';
import { sendRewardEmail, sendVisitEmail } from '../../../src/email';
import { showAlert } from '../../../src/components/alert';
import { fullDate, initials } from '../../../src/format';
import { StampRow } from '../../../src/components/stamps';
import { Button, Card, Loading, Empty, Badge } from '../../../src/components/ui';
import { useTheme, useThemedStyles } from '../../../src/theme-context';
import { font, radius, shadow, spacing } from '../../../src/theme';

export default function CustomerDetail() {
  const { id } = useLocalSearchParams();
  const { user, business } = useAuth();
  const router = useRouter();
  const navigation = useNavigation();
  const { colors } = useTheme();
  const s = useThemedStyles(makeStyles);

  const [customer, setCustomer] = useState(undefined);
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

  if (customer === undefined) return <Loading label="Loading customer…" />;
  if (customer === null) {
    return <Empty glyph="🤷" title="Customer not found" subtitle="They may have been deleted." />;
  }

  const p = rewardStatus(customer, rewards);
  const target = p.target;
  const emailOnVisit = business?.emailOnVisit !== false;

  async function addVisit() {
    setBusy(true);
    const before = p.balance;
    try {
      const after = await logVisit(user.uid, customer, { points: 1 });
      if (!p.active.length) return;

      // A single visit can put more than one reward within reach if two share a
      // total, so this is a list rather than a yes/no.
      const crossed = rewardsCrossed(before, after, rewards);
      const justEarned = crossed.length > 0;

      // The toggle silences the every-visit progress note only. Earning
      // something is worth interrupting for either way.
      if (!justEarned && !emailOnVisit) return;

      const names = crossed.map((r) => r.name).join(' and ');

      if (!customer.email) {
        if (justEarned) {
          showAlert(
            `${customer.name} earned ${names} 🎉`,
            'There is no email address on file for them, so let them know in person.'
          );
        }
        return;
      }

      // Recompute against the new balance so the message names the right target.
      const nowNext = p.active.find((r) => after < Number(r.pointsRequired)) || null;
      const toGo = nowNext ? Math.max(0, Number(nowNext.pointsRequired) - after) : 0;

      showAlert(
        justEarned
          ? `${customer.name} earned ${names} 🎉`
          : `${after} visits${nowNext ? ` of ${nowNext.pointsRequired}` : ''}`,
        justEarned
          ? 'Send the reward email? It opens in your mail app with your wording already filled in.'
          : nowNext
            ? `Send ${customer.name} their progress update? ${toGo} ${
                toGo === 1 ? 'visit' : 'visits'
              } until ${nowNext.name}.`
            : `Send ${customer.name} a note about their visit?`,
        [
          { text: 'Not now', style: 'cancel' },
          {
            text: 'Open email',
            onPress: () =>
              (justEarned ? sendRewardEmail : sendVisitEmail)({
                customer,
                business,
                // The email names what this visit actually achieved: the reward
                // just earned, or the next one still to come.
                reward: justEarned
                  ? { ...crossed[0], name: names }
                  : nowNext,
                balance: after,
              }).catch((e) => showAlert('Could not open mail', e.message)),
          },
        ]
      );
    } catch (e) {
      showAlert('Could not log the visit', e.message);
    } finally {
      setBusy(false);
    }
  }

  function confirmRedeem(reward) {
    const cost = Number(reward.pointsRequired);
    showAlert(
      `Redeem ${reward.name}?`,
      `This takes ${cost} visits off ${customer.name}'s card, leaving ${p.balance - cost}.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Redeem',
          onPress: async () => {
            setBusy(true);
            try {
              await redeemReward(user.uid, customer.id, reward);
            } catch (e) {
              showAlert('Could not redeem', e.message);
            } finally {
              setBusy(false);
            }
          },
        },
      ]
    );
  }

  function confirmDelete() {
    showAlert(
      `Remove ${customer.name}?`,
      'Their visits and full history are deleted. This cannot be undone.',
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
              showAlert('Could not delete', e.message);
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
        <View style={{ gap: spacing(1.5) }}>
          <Card style={[s.hero, p.ready && s.heroReady]}>
            <View style={[s.avatar, p.ready && s.avatarReady]}>
              <Text style={[s.avatarText, p.ready && { color: colors.success }]}>
                {initials(customer.name)}
              </Text>
            </View>

            <Text style={s.name}>{customer.name}</Text>
            {!!customer.email && <Text style={s.email}>{customer.email}</Text>}
            <Badge tone={customer.source === 'signup' ? 'success' : 'accent'}>
              {customer.source === 'signup' ? 'Joined via QR' : 'Added by you'}
            </Badge>

            <View style={s.countBlock}>
              <Text style={[s.count, p.ready && { color: colors.success }]}>{p.balance}</Text>
              <Text style={s.countLabel}>{target ? `OF ${target} VISITS` : 'VISITS'}</Text>
            </View>

            {target > 0 ? (
              <View style={s.stampArea}>
                <StampRow balance={p.balance} target={target} ready={p.ready} />
                <Text style={[s.progressLabel, p.ready && s.progressReady]}>
                  {p.ready
                    ? `🎉 ${p.earned.length === 1 ? 'A reward is' : `${p.earned.length} rewards are`} ready to claim`
                    : p.next
                      ? `${p.toGo} more ${p.toGo === 1 ? 'visit' : 'visits'} until ${p.next.name}`
                      : 'Every reward claimed — nice.'}
                </Text>
                {p.ready && p.next && (
                  <Text style={s.nextUp}>
                    Next up: {p.next.name} at {p.next.pointsRequired}
                  </Text>
                )}
              </View>
            ) : (
              <Text style={s.progressLabel}>
                No active rewards yet — set one up so visits count toward something.
              </Text>
            )}
          </Card>

          <Button
            title={busy ? 'Saving…' : 'Add a visit'}
            glyph="➕"
            onPress={addVisit}
            loading={busy}
            style={s.bigBtn}
          />

          {/* Rewards are independent tiers, so a regular can have several
              waiting at once. Each is claimed on its own. */}
          {p.earned.length > 0 && (
            <Card tone="success" style={{ gap: spacing(1.25) }}>
              <Text style={s.claimTitle}>
                🎁 Ready to claim
              </Text>
              {p.earned.map((r) => (
                <View key={r.id} style={s.claimRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.claimName}>{r.name}</Text>
                    <Text style={s.claimMeta}>{r.pointsRequired} visits</Text>
                  </View>
                  <Pressable
                    style={s.claimBtn}
                    disabled={busy}
                    onPress={() => confirmRedeem(r)}
                  >
                    <Text style={s.claimBtnText}>Redeem</Text>
                  </Pressable>
                </View>
              ))}
            </Card>
          )}

          {p.active.length > 0 && p.earned.length === 0 && (
            <Card style={{ gap: spacing(1) }}>
              <Text style={s.sectionLabel}>WORKING TOWARD</Text>
              {p.active.map((r) => {
                const need = Math.max(0, Number(r.pointsRequired) - p.balance);
                return (
                  <View key={r.id} style={s.upcomingRow}>
                    <Text style={s.upcomingName} numberOfLines={1}>
                      {r.name}
                    </Text>
                    <Text style={s.upcomingNeed}>
                      {need} to go
                    </Text>
                  </View>
                );
              })}
            </Card>
          )}

          <Text style={s.sectionLabel}>HISTORY</Text>
        </View>
      }
      ListEmptyComponent={
        <Empty glyph="📋" title="No visits yet" subtitle="Tap Add a visit when they come in." />
      }
      renderItem={({ item }) => {
        const positive = item.points > 0;
        const tone = positive ? colors.success : colors.warning;
        const soft = positive ? colors.successSoft : colors.warningSoft;
        return (
          <View style={s.entry}>
            <View style={[s.pill, { backgroundColor: soft, borderColor: tone }]}>
              <Text style={[s.pillText, { color: tone }]}>
                {positive ? `+${item.points}` : item.points}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.entryNote}>{item.note || 'Visit'}</Text>
              <Text style={s.entryMeta}>{fullDate(item.createdAt)}</Text>
            </View>
            {/* balanceAfter is the audit trail: what the card read at that moment. */}
            <Text style={s.entryBalance}>{item.balanceAfter}</Text>
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

const makeStyles = ({ colors }) => ({
  list: { padding: spacing(2), gap: spacing(1), paddingBottom: spacing(6) },

  hero: {
    alignItems: 'center',
    gap: spacing(1),
    borderRadius: radius.xl,
    paddingVertical: spacing(2.5),
  },
  heroReady: { borderColor: colors.success, backgroundColor: colors.successSoft },

  avatar: {
    width: 78,
    height: 78,
    borderRadius: radius.pill,
    backgroundColor: colors.accentSoft,
    borderWidth: 2,
    borderColor: colors.accentEdge,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarReady: { backgroundColor: colors.surface, borderColor: colors.success },
  avatarText: { color: colors.accent, fontWeight: '900', fontSize: 26 },

  name: { ...font.title, fontSize: 23, color: colors.text },
  email: { ...font.small, color: colors.textDim },

  countBlock: { alignItems: 'center', marginTop: spacing(1) },
  count: {
    fontSize: 62,
    fontWeight: '900',
    color: colors.accent,
    lineHeight: 66,
    letterSpacing: -2,
  },
  countLabel: { ...font.label, color: colors.textFaint },

  stampArea: { alignItems: 'center', gap: spacing(1.25), marginTop: spacing(0.5), width: '100%' },
  progressLabel: { ...font.small, color: colors.textDim, textAlign: 'center', fontWeight: '600' },
  progressReady: { color: colors.success, fontWeight: '800' },

  bigBtn: { minHeight: 62 },

  nextUp: { fontSize: 12, fontWeight: '700', color: colors.textFaint },

  claimTitle: { ...font.heading, fontSize: 15, color: colors.success },
  claimRow: { flexDirection: 'row', alignItems: 'center', gap: spacing(1.25) },
  claimName: { ...font.body, fontWeight: '800', color: colors.text },
  claimMeta: { fontSize: 12, fontWeight: '600', color: colors.textDim, marginTop: 1 },
  claimBtn: {
    backgroundColor: colors.success,
    borderRadius: radius.pill,
    paddingHorizontal: spacing(2),
    paddingVertical: spacing(1.1),
  },
  claimBtnText: { color: colors.surface, fontWeight: '800', fontSize: 14 },

  upcomingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(1),
    paddingVertical: spacing(0.6),
  },
  upcomingName: { ...font.body, color: colors.text, flex: 1 },
  upcomingNeed: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.accentInk,
    backgroundColor: colors.accentSoft,
    borderRadius: radius.pill,
    paddingHorizontal: spacing(1),
    paddingVertical: 3,
  },

  sectionLabel: { ...font.label, color: colors.textFaint, marginTop: spacing(1) },

  entry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(1.5),
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing(1.5),
    ...shadow(colors.shadow, 0.5),
  },
  pill: {
    minWidth: 46,
    paddingVertical: spacing(0.7),
    borderRadius: radius.pill,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  pillText: { fontWeight: '900', fontSize: 14 },
  entryNote: { ...font.body, fontWeight: '700', color: colors.text },
  entryMeta: { fontSize: 11, fontWeight: '600', color: colors.textFaint, marginTop: 2 },
  entryBalance: { fontSize: 15, fontWeight: '800', color: colors.textDim },

  deleteRow: { padding: spacing(2.5), alignItems: 'center' },
  deleteText: { ...font.small, color: colors.danger, fontWeight: '700' },
});
