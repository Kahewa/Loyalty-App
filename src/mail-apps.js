import { Linking, Platform } from 'react-native';
import * as MailComposer from 'expo-mail-composer';

/**
 * Which app a prepared email opens in.
 *
 * expo-mail-composer only ever opens Apple Mail on iOS — if the owner lives in
 * Gmail or Outlook, the composer is useless to them. Every one of these apps
 * registers its own URL scheme for composing, so we build the right link
 * instead of assuming.
 *
 * On Android a plain `mailto:` already raises the system chooser, which is the
 * behaviour people expect there, so "Ask me each time" is the sensible default.
 */

const enc = encodeURIComponent;

export const MAIL_APPS = [
  {
    id: 'default',
    name: Platform.OS === 'android' ? 'Ask me each time' : 'Apple Mail',
    detail:
      Platform.OS === 'android'
        ? "Android's own chooser, listing every mail app you have"
        : 'The built-in Mail app',
    scheme: null,
    build: ({ to, subject, body }) => `mailto:${enc(to)}?subject=${enc(subject)}&body=${enc(body)}`,
  },
  {
    id: 'gmail',
    name: 'Gmail',
    detail: 'Opens the Gmail app',
    scheme: 'googlegmail://',
    build: ({ to, subject, body }) =>
      `googlegmail:///co?to=${enc(to)}&subject=${enc(subject)}&body=${enc(body)}`,
  },
  {
    id: 'outlook',
    name: 'Outlook',
    detail: 'Opens Microsoft Outlook',
    scheme: 'ms-outlook://',
    build: ({ to, subject, body }) =>
      `ms-outlook://compose?to=${enc(to)}&subject=${enc(subject)}&body=${enc(body)}`,
  },
  {
    id: 'yahoo',
    name: 'Yahoo Mail',
    detail: 'Opens the Yahoo Mail app',
    scheme: 'ymail://',
    build: ({ to, subject, body }) =>
      `ymail://mail/compose?to=${enc(to)}&subject=${enc(subject)}&body=${enc(body)}`,
  },
  {
    id: 'spark',
    name: 'Spark',
    detail: 'Opens Readdle Spark',
    scheme: 'readdle-spark://',
    build: ({ to, subject, body }) =>
      `readdle-spark://compose?recipient=${enc(to)}&subject=${enc(subject)}&body=${enc(body)}`,
  },
];

export const getMailApp = (id) => MAIL_APPS.find((a) => a.id === id) || MAIL_APPS[0];

/**
 * Which of these are actually installed.
 *
 * Honest caveat: on iOS, canOpenURL only answers truthfully for schemes listed
 * in the app's LSApplicationQueriesSchemes. Inside Expo Go that list belongs to
 * Expo Go, not to us, so this under-reports — which is why the picker still
 * offers every app and simply reports a clear error if one will not open.
 * app.json declares the schemes for when you build standalone.
 */
export async function detectInstalled() {
  const results = await Promise.all(
    MAIL_APPS.map(async (app) => {
      if (!app.scheme) return [app.id, true];
      try {
        return [app.id, await Linking.canOpenURL(app.scheme)];
      } catch {
        return [app.id, false];
      }
    })
  );
  return Object.fromEntries(results);
}

/**
 * Open a prepared message in the chosen app.
 * Returns 'opened' | 'unavailable'.
 */
export async function openInMailApp(appId, message) {
  const app = getMailApp(appId);

  // Apple Mail on iOS gets the native composer — it keeps the owner inside the
  // app rather than bouncing them out, and it can pre-fill more reliably.
  if (app.id === 'default' && Platform.OS === 'ios') {
    if (await MailComposer.isAvailableAsync()) {
      const { status } = await MailComposer.composeAsync({
        recipients: [message.to],
        subject: message.subject,
        body: message.body,
      });
      return status || 'opened';
    }
  }

  const url = app.build(message);
  try {
    await Linking.openURL(url);
    return 'opened';
  } catch {
    return 'unavailable';
  }
}
