# Loyalty

A digital punch card for a small business. The owner runs a phone app; customers
join by scanning a QR code on the counter and get emailed when they have earned
something.

Built on Expo (React Native) with Firebase behind it. Everything is plain
JavaScript.

**New here? Go straight to [SETUP.md](SETUP.md)** — the code is written and the
dependencies are installed, but it does nothing until you create a Firebase
project and paste six keys into `.env`.

---

## What is in the box

```
app/                    Screens. Expo Router turns each file into a route.
  _layout.js              Root: auth provider + navigation shell
  index.js                Decides: signed in → home, otherwise → login
  (auth)/login.js         Sign in / create a business account
  (app)/_layout.js        The route guard — no session, no screens
  (app)/home.js           Search bar + recent activity
  (app)/customer/[id].js  One customer: balance, history, +1 visit, redeem
  (app)/add-customer.js   Manual add
  (app)/rewards.js        What a full card is worth
  (app)/templates.js      Email editor with live preview
  (app)/share.js          The QR code to print
  (app)/settings.js       Business name, redemption log, sign out

src/
  firebase.js           SDK setup, emulator switch
  auth-context.js       Session state + registration
  data.js               Every Firestore read and write
  templates.js          Placeholder substitution (mirrored in functions/)
  format.js             Dates, initials, email validation
  theme.js              Colours and spacing
  components/ui.js      Buttons, fields, cards

functions/index.js      submitSignup, getBusinessPublic, onEntryCreated
public/join.html        The public signup page behind the QR code
firestore.rules         Who can touch what
firestore.indexes.json  The two composite indexes the queries need
```

---

## The data model

Firestore is not SQL. There are no tables and no joins — data nests, and you keep
a running total on the cover of the notebook rather than re-adding every page.

```
users/{uid}                                  one document per business owner
  businessName, logoUrl,
  welcomeEmailSubject, welcomeEmailBody,
  rewardEmailSubject, rewardEmailBody

users/{uid}/customers/{customerId}
  name, email (lowercase), pointsBalance, joinedAt, source

users/{uid}/customers/{customerId}/entries/{entryId}
  points, balanceAfter, note, createdAt, ownerUid, customerId, customerName

users/{uid}/rewards/{rewardId}
  name, pointsRequired, active

users/{uid}/redemptions/{redemptionId}
  customerId, rewardName, pointsSpent, redeemedAt

mail/{docId}                                 Trigger Email queue, functions only
```

Three decisions worth understanding, because everything else follows from them:

**The owner's auth uid is the business id.** That is why the security rule is one
line rather than a permissions system, and why the join link needs nothing but a
uid in the URL.

**Every entry stores `balanceAfter`.** It is a bank statement: you can read what
the card said at any moment in the past. It is also how a function knows someone
*just crossed* a threshold rather than merely being above it — compare
`balanceAfter - points` against `balanceAfter`, and only the crossing visit
matches. Without it you would email someone on every visit after their tenth.

**Entries carry a denormalised `ownerUid` and `customerName`.** Firestore charges
per document read, so the Home feed copies the two fields it needs rather than
fetching each customer again.

---

## Security

```
match /users/{uid}/{document=**} {
  allow read, write: if request.auth != null && request.auth.uid == uid;
}
```

An owner can reach their own business and nothing else. There is no rule that
grants cross-business access, so there is no way to grant it by accident.

Two things that surprise people:

**The Firebase keys in the app bundle are public by design.** They name the
project; they do not authorise anything. The rules are the security. Anyone can
extract them from an app binary and that changes nothing.

**The public never writes to Firestore.** The signup page holds no credentials
and cannot touch the database. It posts a name and an email to a Cloud Function,
which validates them and writes using the Admin SDK — which bypasses rules on
purpose, in a place you control, rather than opening a hole a customer's browser
could walk through.

Collection-group queries are matched by their own rule (`/{path=**}/entries/…`),
not by the nested one above. The Home activity feed needs it; miss it and you get
a permission error that reads like the main rule is broken.

---

## The three flows

**Joining.** QR → `https://<project>.web.app/join/{uid}` → the page asks
`getBusinessPublic` whose card this is → the customer types a name and email →
`submitSignup` validates the address, checks the honeypot field, rejects an email
already on the list, creates the customer, fills `{{customer_name}}` and
`{{business_name}}` into the owner's template, and drops the result in `mail`.
Brevo delivers it.

Firestore has no unique constraint, so "one signup per email" is enforced by the
function looking before it leaps — not by the database. Two simultaneous
submissions of the same address could both get through. The failure mode is a
duplicate row, not lost data, which is the right trade at this scale.

**Logging a visit.** One atomic batched write: increment `pointsBalance` and
create the entry carrying `balanceAfter`. A Firestore trigger fires on the new
entry, compares before and after against the active reward's threshold, and
queues the reward email if the line was crossed.

The balance itself is incremented server-side (`increment(1)`), so it is always
right. `balanceAfter` is computed from the locally cached value, so it is right
whenever one device is logging visits — which is what makes the button work with
no signal. Two staff tapping for the same customer at the same second could write
a stale `balanceAfter` and, at worst, miss or repeat one reward email. Fixing that
means a transaction, which means giving up offline. For a shop, offline is worth
more; if you ever put three tills on this, revisit it.

**Redeeming.** One transaction: re-read the balance, refuse if it is short,
deduct, and write both a redemption document and an audit entry. A transaction
rather than a batch because the decision depends on a value that another device
could be changing at the same moment.

---

## Offline, honestly

The `+1 visit` button uses a batched write, which commits to the local cache
first — so the number moves instantly and syncs when signal returns. The reward
trigger fires whenever the entry reaches the server, so an email sent from a dead
spot simply arrives late.

The caveat: **the Firebase JS SDK does not persist the Firestore cache to disk on
React Native** — it needs IndexedDB, which React Native does not have. Queued
writes survive losing signal, but not force-quitting the app. Auth sessions *do*
persist, via AsyncStorage.

If offline-across-restarts becomes a real requirement, the move is
`@react-native-firebase` (the native SDKs, which have proper disk persistence).
That means leaving Expo Go for a development build — worth doing deliberately,
not by accident.

---

## Day-to-day

```bash
npx expo start            # the app — scan the QR with Expo Go
firebase emulators:start  # a fake local Firebase (needs Java)
firebase deploy           # rules, indexes, functions, hosting
```

**Ctrl+Shift+B** in VS Code starts both dev servers at once.

Environment values are baked into the bundle when Metro builds it. After editing
`.env`, restart with `npx expo start -c` or the old values stick around.

---

## Cost

Cloud Functions require the Blaze plan, so a card is on file. The free monthly
allowance (2M invocations, 50k Firestore reads/day, 10GB hosting) is far above
what a single shop generates. Expect roughly $0, and set a budget alert anyway —
[SETUP.md](SETUP.md#3-upgrade-to-the-blaze-plan) shows where.
