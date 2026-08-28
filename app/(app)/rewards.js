import { useEffect, useState } from 'react';
import { View, Text, Switch, Pressable } from 'react-native';
import { showAlert } from '../../src/components/alert';
import { useAuth } from '../../src/auth-context';
import { watchRewards, saveReward, deleteReward } from '../../src/data';
import { Screen, Card, Field, Button, Dim, Empty, Badge } from '../../src/components/ui';
import { font, radius, shadow, spacing } from '../../src/theme';
import { useTheme, useThemedStyles } from '../../src/theme-context';

export default function Rewards() {
  const s = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const { user } = useAuth();
  const [rewards, setRewards] = useState(null);
  const [editing, setEditing] = useState(null); // null = closed, {} = new
  const [name, setName] = useState('');
  const [points, setPoints] = useState('');
  const [active, setActive] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => (user ? watchRewards(user.uid, setRewards) : undefined), [user]);

  function open(reward) {
    setEditing(reward || {});
    setName(reward?.name || '');
    setPoints(reward ? String(reward.pointsRequired) : '');
    setActive(reward ? Boolean(reward.active) : true);
    setError('');
  }

  async function submit() {
    setError('');
    const n = Number(points);
    if (!name.trim()) return setError('Give the reward a name customers will recognise.');
    if (!Number.isInteger(n) || n < 1) return setError('Points must be a whole number of 1 or more.');

    setBusy(true);
    try {
      // Rewards run alongside each other — turning one on leaves the rest alone.
      await saveReward(user.uid, { id: editing.id, name, pointsRequired: n, active });
      setEditing(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  function confirmDelete(reward) {
    showAlert(`Delete "${reward.name}"?`, 'Past redemptions keep their record.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => deleteReward(user.uid, reward.id).catch((e) => showAlert('Error', e.message)),
      },
    ]);
  }

  if (editing) {
    return (
      <Screen>
        <Card>
          <Field
            label="REWARD"
            placeholder="A free coffee"
            value={name}
            onChangeText={setName}
            autoFocus
          />
          <Field
            label="POINTS NEEDED"
            placeholder="10"
            value={points}
            onChangeText={(t) => setPoints(t.replace(/[^0-9]/g, ''))}
            keyboardType="number-pad"
            hint="One visit = one point. Set several rewards at different totals and customers unlock each as they reach it."
          />
          <View style={s.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.switchLabel}>Active</Text>
              <Dim>Active rewards are the ones customers can work toward. Several can run at once.</Dim>
            </View>
            <Switch
              value={active}
              onValueChange={setActive}
              trackColor={{ true: colors.accent, false: colors.surfaceAlt }}
              thumbColor={colors.text}
            />
          </View>

          {!!error && <Text style={s.error}>{error}</Text>}

          <Button title="Save reward" onPress={submit} loading={busy} style={{ marginTop: spacing(1) }} />
          <Button title="Cancel" variant="ghost" onPress={() => setEditing(null)} disabled={busy} />
        </Card>
      </Screen>
    );
  }

  return (
    <Screen>
      <Button title="＋ New reward" onPress={() => open(null)} />

      {rewards === null ? null : rewards.length === 0 ? (
        <Empty
          title="No rewards yet"
          subtitle="Create one so the points on each card are counting toward something."
        />
      ) : (
        rewards.map((r) => (
          <Pressable key={r.id} onPress={() => open(r)}>
            <Card>
              <View style={s.rewardRow}>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={s.rewardName}>{r.name}</Text>
                  <Text style={s.rewardMeta}>{r.pointsRequired} points</Text>
                </View>
                {r.active ? <Badge tone="success">Active</Badge> : <Badge tone="textDim">Off</Badge>}
              </View>
              <View style={s.actions}>
                <Text style={s.edit}>Tap to edit</Text>
                <Text style={s.delete} onPress={() => confirmDelete(r)}>
                  Delete
                </Text>
              </View>
            </Card>
          </Pressable>
        ))
      )}

      <Dim>
        Rewards run side by side. A customer on 12 visits has earned everything set at 12 or fewer
        — the app shows each one waiting for them, and the stamps count toward whichever comes
        next.
      </Dim>
    </Screen>
  );
}

const makeStyles = ({ colors }) => ({
  rewardRow: { flexDirection: 'row', alignItems: 'center', gap: spacing(1.5) },
  rewardName: { color: colors.text, fontSize: 17, fontWeight: '700' },
  rewardMeta: { color: colors.textDim, fontSize: 13 },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing(1),
    paddingTop: spacing(1),
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  edit: { color: colors.textDim, fontSize: 13 },
  delete: { color: colors.danger, fontSize: 13, fontWeight: '600' },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(1.5),
    paddingVertical: spacing(1),
    borderRadius: radius.sm,
  },
  switchLabel: { color: colors.text, fontSize: 15, fontWeight: '700' },
  error: { color: colors.danger, fontSize: 14 },
});
