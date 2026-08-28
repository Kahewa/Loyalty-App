import { useEffect, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { showAlert } from '../../src/components/alert';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/auth-context';
import { watchSignupRequests, acceptSignupRequest, rejectSignupRequest } from '../../src/data';
import { sendWelcomeEmail } from '../../src/email';
import { timeAgo, initials } from '../../src/format';
import { Screen, Card, Button, Dim, Empty, Loading } from '../../src/components/ui';
import { font, radius, shadow, spacing } from '../../src/theme';
import { useTheme, useThemedStyles } from '../../src/theme-context';

export default function Pending() {
  const s = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const { user, business } = useAuth();
  const router = useRouter();
  const [requests, setRequests] = useState(null);
  const [busyId, setBusyId] = useState(null);

  useEffect(() => (user ? watchSignupRequests(user.uid, setRequests) : undefined), [user]);

  async function accept(request) {
    setBusyId(request.id);
    try {
      const { customerId, alreadyExisted } = await acceptSignupRequest(user.uid, request);

      if (alreadyExisted) {
        showAlert('Already on your list', `${request.name} was already a customer.`);
        return;
      }

      showAlert(
        `${request.name} added`,
        'Send them the welcome email? It opens in your mail app with your template already filled in.',
        [
          { text: 'Not now', style: 'cancel' },
          {
            text: 'Open email',
            onPress: () =>
              sendWelcomeEmail({
                customer: { name: request.name, email: request.email },
                business,
              }).catch((e) => showAlert('Could not open mail', e.message)),
          },
          { text: 'Open card', onPress: () => router.push(`/customer/${customerId}`) },
        ]
      );
    } catch (e) {
      showAlert('Could not accept', e.message);
    } finally {
      setBusyId(null);
    }
  }

  function reject(request) {
    showAlert(
      `Discard ${request.name}?`,
      'They will not be added, and the request disappears. They can always sign up again.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () =>
            rejectSignupRequest(user.uid, request.id).catch((e) =>
              showAlert('Error', e.message)
            ),
        },
      ]
    );
  }

  if (requests === null) return <Loading label="Loading requests..." />;

  return (
    <Screen>
      {requests.length === 0 ? (
        <Empty
          title="Nothing waiting"
          subtitle="People who scan your QR code and fill in the form will appear here for you to accept."
        />
      ) : (
        requests.map((r) => (
          <Card key={r.id}>
            <View style={s.row}>
              <View style={s.avatar}>
                <Text style={s.avatarText}>{initials(r.name)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.name}>{r.name}</Text>
                <Text style={s.email} numberOfLines={1}>
                  {r.email}
                </Text>
                <Text style={s.time}>Requested {timeAgo(r.createdAt)}</Text>
              </View>
            </View>
            <View style={s.actions}>
              <Button
                title="Accept"
                onPress={() => accept(r)}
                loading={busyId === r.id}
                style={{ flex: 1 }}
              />
              <Pressable onPress={() => reject(r)} style={s.discard} hitSlop={6}>
                <Text style={s.discardText}>Discard</Text>
              </Pressable>
            </View>
          </Card>
        ))
      )}

      <Dim>
        Signups wait for you on purpose. The join page can only create a request — it cannot read
        your customer list or add anyone directly, so a stranger with your link can never do more
        than put a name in this queue.
      </Dim>
    </Screen>
  );
}

const makeStyles = ({ colors }) => ({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing(1.5) },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.text, fontWeight: '800', fontSize: 16 },
  name: { color: colors.text, fontSize: 17, fontWeight: '700' },
  email: { color: colors.textDim, fontSize: 14, marginTop: 1 },
  time: { color: colors.textDim, fontSize: 12, marginTop: 3 },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(1.5),
    marginTop: spacing(1),
  },
  discard: { paddingHorizontal: spacing(1.5), paddingVertical: spacing(1.5) },
  discardText: { color: colors.danger, fontSize: 14, fontWeight: '600' },
});
