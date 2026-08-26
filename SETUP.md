# Setup

Everything is written and installed. What is left is the part only you can do:
creating the Firebase project and pasting six keys into a file.

Work through this once, top to bottom. It takes about twenty minutes.

---

## 1. Create the Firebase project

1. Go to <https://console.firebase.google.com> and click **Add project**.
2. Name it something like `loyalty-app`. Google Analytics is optional — skip it.
3. Once it is created, note the **Project ID** (it looks like `loyalty-app-4f2c1`).
   This is not the display name; it is the id shown under the name.

Put that id into [.firebaserc](.firebaserc), replacing `REPLACE_WITH_YOUR_PROJECT_ID`.

---

## 2. Turn on the three services

In the Firebase console sidebar:

- **Build → Authentication → Get started → Email/Password → Enable → Save.**
  Leave "Email link (passwordless)" off.
- **Build → Firestore Database → Create database.** Pick a region near you
  (`europe-west2` for the UK, `us-central1` for the US). Choose **production mode** —
  the rules in this repo replace whatever it starts with.
- **Build → Hosting → Get started.** Click through the CLI steps; you already have
  the CLI, so just finish the wizard.

---

## 3. Upgrade to the Blaze plan

Cloud Functions will not deploy on the free Spark plan.

**⚙ → Usage and billing → Details & settings → Modify plan → Blaze.**

A card is required. The free monthly allowance is 2 million function invocations
and 50k Firestore reads per day; a shop logging a few hundred visits a month sits
inside it, so expect a bill of roughly $0. Set a budget alert at £1 while you are
in there — **Usage and billing → Details & settings → Budgets & alerts**.

---

## 4. Register the web app and copy your keys

1. **⚙ Project settings → General → Your apps → Web (`</>`).**
2. Nickname it `loyalty-owner-app`. Do **not** tick "Firebase Hosting" here.
3. Firebase shows a `firebaseConfig` object. Keep that tab open.

Now, in the project folder:

```bash
cp .env.example .env
```

Open [.env](.env.example) and paste each value across:

| Firebase shows | Goes into |
| --- | --- |
| `apiKey` | `EXPO_PUBLIC_FIREBASE_API_KEY` |
| `authDomain` | `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN` |
| `projectId` | `EXPO_PUBLIC_FIREBASE_PROJECT_ID` |
| `storageBucket` | `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET` |
| `messagingSenderId` | `EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` |
| `appId` | `EXPO_PUBLIC_FIREBASE_APP_ID` |

**These keys are public on purpose.** They identify your project; they authorise
nothing. Anyone can read them out of the app bundle, and that is fine —
[firestore.rules](firestore.rules) is what keeps one business out of another's
data. Do not waste effort hiding them, and do not relax the rules because you
think the keys are secret.

`.env` is gitignored. `.env.example` is the template that stays in the repo.

---

## 5. Deploy the backend

```bash
firebase login
firebase deploy
```

That pushes four things: the security rules, the two Firestore indexes, the three
Cloud Functions, and the signup web page.

The **first deploy takes several minutes** and may ask permission to enable the
Cloud Build and Artifact Registry APIs. Say yes.

If it complains that an index is still building, wait a minute and re-run
`firebase deploy --only firestore:indexes`.

---

## 6. Wire up email (Brevo + Trigger Email)

Firebase does not send email. The **Trigger Email** extension watches the `mail`
collection and hands anything dropped in it to an SMTP provider. Brevo's free tier
gives you 300 emails a day, which is plenty.

**Get Brevo credentials:**

1. Sign up at <https://www.brevo.com>.
2. **SMTP & API → SMTP tab.** Note the login (an email address) and generate an
   SMTP key — that is your password. Copy it now; it is shown once.
3. **Senders, Domains & Dedicated IPs → Senders → Add a sender.** Use a real
   address you control. Verify it via the email Brevo sends.

**Install the extension:**

1. Firebase console → **Extensions → Explore → "Trigger Email from Firestore" → Install**.
2. Fill in:

   | Field | Value |
   | --- | --- |
   | SMTP connection URI | `smtps://YOUR_BREVO_LOGIN@smtp-relay.brevo.com:465` |
   | SMTP password | your Brevo SMTP key |
   | Email documents collection | `mail` |
   | Default FROM address | the sender address you verified |
   | Default REPLY-TO address | your business email |

   If your Brevo login contains an `@`, URL-encode it as `%40` inside the URI.

3. Install. It takes a few minutes.

**Test it:** Firestore → `mail` collection → add a document with
`to: ["you@example.com"]` and `message: { subject: "test", text: "hello" }`.
Within a minute the extension writes a `delivery` field onto that document saying
`SUCCESS` or exactly what went wrong.

---

## 7. Run the app

```bash
npx expo start
```

Install **Expo Go** on your phone, scan the QR code in the terminal, and the app
loads. Phone and PC must be on the same Wi-Fi. If the connection hangs, run
`npx expo start --tunnel`.

Then, in the app: create your account, set up a reward, and open **Share QR**.

---

## 8. First real run-through

1. **Share QR** → open the link on your phone's browser. You should see your
   business name on the signup page.
2. Sign up with a real email address of your own. Check that a welcome email
   arrives and that the person appears on your Home screen.
3. Open them, tap **+1 visit** repeatedly up to your reward threshold. The email
   should arrive the moment the counter crosses the line — and *only* on the
   crossing visit, not on every visit after it.
4. Tap **Redeem**. The balance drops and the redemption is listed in Settings.

---

## Local development with the emulators

The Emulator Suite is a fake Firebase running on your PC — no billing, no live
data, and you can wipe it and start over.

**It needs Java.** If `java -version` fails, install a JDK first:

```powershell
winget install Microsoft.OpenJDK.21
```

Then close and reopen your terminal.

Run two terminals in VS Code:

```bash
firebase emulators:start     # terminal 1 — fake Firebase, UI at http://localhost:4000
npx expo start               # terminal 2 — the app
```

Point the app at them by setting `EXPO_PUBLIC_USE_EMULATORS=1` in `.env` and
restarting Expo with `npx expo start -c` (the `-c` clears the cache — env values
are baked in at bundle time, so without it you will keep hitting live Firebase).

Testing on a **physical phone** against the emulators also needs your PC's LAN IP
in `EXPO_PUBLIC_EMULATOR_HOST` — run `ipconfig` and use the IPv4 address.

The Trigger Email extension does not run in the emulator. Emails you "send"
locally just appear as documents in the emulated `mail` collection, which is
usually what you want when testing.

VS Code shortcut: **Ctrl+Shift+B** runs both terminals at once (see
[.vscode/tasks.json](.vscode/tasks.json)).

---

## Deploying changes later

```bash
firebase deploy --only functions          # changed functions/
firebase deploy --only firestore:rules    # changed firestore.rules
firebase deploy --only hosting            # changed public/
```

The app itself needs no deploy while you are using Expo Go — save a file and it
hot-reloads on your phone. Building a real installable app comes later, with
`eas build`.
