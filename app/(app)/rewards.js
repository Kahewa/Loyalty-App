import { useEffect, useState } from 'react';
import { View, Text, Alert, Switch, Pressable, StyleSheet } from 'react-native';
import { useAuth } from '../../src/auth-context';
import { watchRewards, saveReward, deleteReward } from '../../src/data';
import { Screen, Card, Field, Button, Dim, Empty, Badge } from '../../src/components/ui';
import { colors, radius, spacing } from '../../src/theme';

export default function Rewards() {
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
      // Only one reward drives the counter, so switching one on switches the rest off.
      if (active) {
        const others = (rewards || []).filter((r) => r.active && r.id !== editing.id);
        await Promise.all(
          others.map((r) => saveReward(user.uid, { ...r, active: false }))
        );
      }
      await saveReward(user.uid, { id: editing.id, name, pointsRequired: n, active });
      setEditing(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  function confirmDelete(reward) {
    Alert.alert(`Delete "${reward.name}"?`, 'Past redemptions keep their record.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => deleteReward(user.uid, reward.id).catch((e) => Alert.alert('Error', e.message)),
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
            hint="One visit = one point, so 10 means every 10th visit is free."
          />
          <View style={s.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.switchLabel}>Active</Text>
              <Dim>The active reward is the one the counter aims at and emails announce.</Dim>
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
        Only one reward can be active at a time. Turning a new one on turns the others off, so a
        customer's balance always has exactly one target.
      </Dim>
    </Screen>
  );
}

const s = StyleSheet.create({
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
