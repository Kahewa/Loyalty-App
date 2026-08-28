# Setup

Your Firebase project is **already created and configured**: `loyalty-bg`, on the
free Spark plan.

| | |
| --- | --- |
| Project ID | `loyalty-bg` |
| Console | <https://console.firebase.google.com/project/loyalty-bg> |
| Firestore region | `africa-south1` (Johannesburg) — permanent |
| Signup page | <https://loyalty-bg.web.app> |

Already done: project created, Firestore database in Johannesburg, security
rules and indexes deployed, web app registered, `.env` written, hosting live.

---

## The one thing left for you

**Email/Password sign-in has to be switched on in the console.** There is no CLI
command for it, so this is the single manual step.

1. Open <https://console.firebase.google.com/project/loyalty-bg/authentication>
2. Click **Get started**
3. Choose **Email/Password**, toggle **Enable** (leave "Email link" off), **Save**

That's it. Then:

```bash
npx expo start
```

Scan the QR with **Expo Go** on your phone, create your business account, and
you're running.

---

## What the free plan changes

Cloud Functions need the paid Blaze plan, so on Spark there is **no server**.
Two things work differently because of that:

**Signups wait for you.** A customer scans your QR code and fills in the form.
That form can do exactly one thing: create a *request*. It cannot read your
customer list, cannot see other requests, and cannot add anyone. The request
lands in **Signup requests** in your app, and you tap Accept. Home shows a
banner when anyone is waiting.

**You tap send on emails.** There are three templates, editable under **Email
templates**:

| Template | When it's offered |
| --- | --- |
| **Welcome** | Once, when you accept someone from Signup requests |
| **Every visit** | Each time you log a visit — "you're on 7 of 10, 3 to go" |
| **Reward earned** | On the visit that crosses the line, and only that visit |

Each one fills in your wording and opens the mail app you chose, with the message
ready. You press send. Placeholders available: `{{customer_name}}`,
`{{business_name}}`, `{{points_balance}}`, `{{points_needed}}`,
`{{points_to_go}}`, `{{reward_name}}`.

**Pick your mail app** under **Settings → Send email with**: Apple Mail, Gmail,
Outlook, Yahoo Mail or Spark. This matters on iPhone — left to itself, iOS only
ever opens Apple Mail, so if you live in Gmail nothing useful happens. On Android
the default raises the system chooser instead.

If the mail app opening at every till tap gets in the way, **Settings → Email on
every visit** turns off the progress note. The reward email is still offered
either way.

The alternative would be putting an email provider's API key inside the app,
where anyone could extract it and send mail as you. Not worth it.

Everything else — points, history, rewards, redemptions, the audit trail, offline
logging — is unchanged.

---

## A note on the Expo SDK version

This project is pinned to **Expo SDK 54** (React Native 0.81.5, React 19.1.0) on
purpose, not by accident.

Expo Go on iOS only speaks one SDK at a time, and which build the App Store gives
you depends on your iOS version. On this iPhone that's the SDK 54 client, so the
project has to match. Running `npx expo upgrade` or bumping to a newer SDK will
make Expo Go refuse to open the app with a version-mismatch screen.

If you later update iOS and the App Store offers a newer Expo Go, you can move the
project up with `npx expo install expo@latest && npx expo install --fix`.

## Day-to-day

```bash
npx expo start        # the app — scan the QR with Expo Go (SDK 54)
npm run emulators     # a fake local Firebase (needs Java — already installed)
npm run deploy        # rules, indexes and the signup page
npm run config        # regenerate public/firebase-config.js after editing .env
```

**Ctrl+Shift+B** in VS Code starts the app and the emulators together.

Use `npm run emulators`, not `firebase emulators:start` directly — the npm
script sets `FUNCTIONS_DISCOVERY_TIMEOUT=120`. Without it, a cold
`require('firebase-admin')` on Windows overruns the emulator's 10-second budget
and your functions silently fail to register.

`npm run deploy` deploys **firestore and hosting only**. Functions are excluded
on purpose — on Spark they cannot deploy, and a plain `firebase deploy` would
fail on them.

Environment values are baked in when Metro builds. After editing `.env`, restart
with `npx expo start -c` or the old values stick around.

---

## Testing the whole loop

1. Enable Email/Password (above), then create your account in the app.
2. **Rewards** → add two, e.g. *a free coffee* at 5 and *a free pastry* at 10,
   both Active. Rewards run side by side rather than one at a time, so customers
   unlock each as they reach it.
3. **Share QR** → open <https://loyalty-bg.web.app/join/YOUR_UID> in a browser.
   Your Settings screen shows the UID; the Share screen builds the link for you.
   You should see your business name on the page.
4. Fill it in with your own email. Your app should show **1 person wants to join**.
5. Accept them. Offer to send the welcome email — it should open your mail app
   with your template filled in.
6. Open their card, tap **Add a visit**. Each tap offers the progress email
   ("1 of 5, 4 to go"). On the fifth — and only the fifth — it offers the
   **reward** email instead, and the coffee appears under **Ready to claim**.
   Keep tapping to 10 and the pastry joins it: both sit there claimable at once,
   while the stamps carry on counting toward whatever comes next.
7. Tap **Redeem** on one of them. The balance drops by that reward's cost, the
   other stays claimable, and the redemption is listed in Settings. Because
   claiming spends the visits, that tier can be earned again — which is what
   makes a 5-visit reward a repeating punch card rather than a one-off.

---

## Local development with the emulators

The Emulator Suite is a fake Firebase on your PC — no live data, nothing to
clean up. Java is already installed (Microsoft OpenJDK 21).

Two terminals:

```bash
npm run emulators     # terminal 1 — UI at http://localhost:4000
npx expo start        # terminal 2
```

Point the app at them with `EXPO_PUBLIC_USE_EMULATORS=1` in `.env`, then restart
Expo with `npx expo start -c`.

Testing on a **physical phone** against the emulators also needs your PC's LAN IP
in `EXPO_PUBLIC_EMULATOR_HOST` — run `ipconfig` and use the IPv4 address.

---

## If you ever upgrade to Blaze

The server-side code is already written and tested — it is sitting in
[functions/](functions/), unused. Turning it on would make signups instant and
emails automatic, with no app changes.

1. **⚙ → Usage and billing → Modify plan → Blaze.** Set a budget alert at R20
   while you are there.
2. Install the **Trigger Email** extension with a Brevo SMTP account
   (free tier: 300 emails/day), pointed at the `mail` collection.
3. Restore the function rewrites in `firebase.json`:
   ```json
   { "source": "/api/signup", "function": { "functionId": "submitSignup", "region": "us-central1" } },
   { "source": "/api/business", "function": { "functionId": "getBusinessPublic", "region": "us-central1" } }
   ```
4. `firebase deploy` (without the `--only` flag).
5. Point `public/join.html` back at `/api/signup` instead of the Firestore REST
   API, and tighten the `signupRequests` create rule back to `if false`.

Realistically a shop this size would sit at about R0/month on Blaze — the free
allowance is 2M function calls and 50k Firestore reads a day. The reason to stay
on Spark is not cost, it's not having a card on file.
