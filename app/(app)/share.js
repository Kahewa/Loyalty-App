import { useRef, useState } from 'react';
import { View, Text, Share } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import * as Clipboard from 'expo-clipboard';
import { useAuth } from '../../src/auth-context';
import { firebaseConfig } from '../../src/firebase';
import { Screen, Card, Button, Dim, Title } from '../../src/components/ui';
import { font, radius, shadow, spacing } from '../../src/theme';
import { useTheme, useThemedStyles } from '../../src/theme-context';

// Hosting gives you <project-id>.web.app for free; override it if you point a
// custom domain at the site.
const BASE =
  process.env.EXPO_PUBLIC_JOIN_BASE_URL ||
  (firebaseConfig.projectId ? `https://${firebaseConfig.projectId}.web.app` : '');

export default function ShareScreen() {
  const s = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const { user, business } = useAuth();
  const [copied, setCopied] = useState(false);
  const qrRef = useRef(null);

  // The owner's uid IS the business id, so the join link needs nothing else.
  const url = `${BASE}/join/${user.uid}`;

  async function copy() {
    await Clipboard.setStringAsync(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Screen>
      <Card style={{ alignItems: 'center', gap: spacing(2) }}>
        <Title style={{ textAlign: 'center' }}>{business?.businessName || 'Your business'}</Title>
        <Dim style={{ textAlign: 'center' }}>Scan to join our loyalty card</Dim>

        <View style={s.qrFrame}>
          <QRCode
            value={url}
            size={220}
            backgroundColor="#FFFFFF"
            color="#0F172A"
            getRef={(c) => (qrRef.current = c)}
          />
        </View>

        <Text style={s.url} selectable numberOfLines={2}>
          {url}
        </Text>
      </Card>

      <Button
        title={copied ? 'Link copied ✓' : 'Copy link'}
        variant={copied ? 'secondary' : 'primary'}
        onPress={copy}
      />

      <Button
        title="Share link"
        variant="secondary"
        onPress={() =>
          Share.share({
            message: `Join the ${business?.businessName || ''} loyalty card: ${url}`,
            url,
          })
        }
      />

      <Card>
        <Text style={s.howTitle}>Putting this to work</Text>
        <Text style={s.step}>
          1. Screenshot this screen, print it, and stand it on the counter.
        </Text>
        <Text style={s.step}>
          2. A customer scans it and fills in their name and email on your signup page.
        </Text>
        <Text style={s.step}>
          3. They land in your customer list on zero points, and the welcome email goes out
          automatically.
        </Text>
        <Dim style={{ marginTop: spacing(1) }}>
          The page behind this code is public, but it cannot read or change anything -- it only
          hands a name and email to a Cloud Function, which does the writing.
        </Dim>
      </Card>

      {!BASE && (
        <Text style={s.warn}>
          No Firebase project id found, so this link is incomplete. Fill in .env and restart with
          npx expo start -c.
        </Text>
      )}
    </Screen>
  );
}

const makeStyles = ({ colors }) => ({
  qrFrame: { backgroundColor: '#FFFFFF', padding: spacing(2), borderRadius: radius.md },
  url: { color: colors.textDim, fontSize: 12, textAlign: 'center', fontFamily: 'monospace' },
  howTitle: { color: colors.text, fontSize: 16, fontWeight: '700', marginBottom: spacing(0.5) },
  step: { color: colors.textDim, fontSize: 14, lineHeight: 21 },
  warn: { color: colors.warning, fontSize: 13, textAlign: 'center' },
});
