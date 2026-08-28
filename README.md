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
  (app)/home.js           Search + every customer with their tally
  (app)/customer/[id].js  One customer: balance, history, +1 visit, redeem
  (app)/customers.js      Full customer list, sortable, with totals
  (app)/add-customer.js   Manual add
  (app)/rewards.js        What a full card is worth
  (app)/pending.js        Signup requests waiting to be accepted
  (app)/templates.js      Email editor with live preview
  (app)/share.js          The QR code to print
  (app)/settings.js       Business name, redemption log, sign out

src/
  firebase.js           SDK setup, emulator switch
  auth-context.js       Session state + registration
  data.js               Every Firestore read and write
  email.js              Builds the message from the owner's template
  mail-apps.js          Which app it opens in — Gmail, Outlook, Mail, Spark
  templates.js          Placeholder substitution (mirrored in functions/)
  format.js             Dates, initials, email validation
  theme.js              Colours and spacing
  components/
    ui.js               Buttons, fields, cards
    customer-row.js     One customer + their tally, shared by both lists
    alert.js            Confirms that work on phone AND in the browser

public/join.html        The public signup page behind the QR code
public/firebase-config.js  Generated from .env by scripts/gen-public-config.js
firestore.rules         Who can touch what — the whole security model
firestore.indexes.json  The two composite indexes the queries need

functions/index.js      NOT DEPLOYED — needs the Blaze plan. Written and tested;
                        see SETUP.md if you ever upgrade.
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

users/{uid}/rewards/{rewardId}          several may be active at once
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

**The running total lives on the customer document.** `pointsBalance` is what
every tally on the dashboard reads. Recomputing it by summing each customer's
entries would mean a read per entry per customer on every screen load; Firestore
charges per document read, so the total is kept on the cover of the notebook and
the entries are the pages behind it.

Entries also carry a denormalised `ownerUid` and `customerName`. Nothing queries
across them today, but it is what a cross-customer activity feed would need and
it costs nothing to write.

---

## Security

```
match /users/{uid}/{document=**} {          // everything the owner owns
  allow read, write: if signedInAs(uid);
}

match /users/{uid}/public/{doc} {           // the join page READS this
  allow read: if true;
  allow write: if signedInAs(uid);
}

match /users/{uid}/signupRequests/{id} {    // the join page WRITES this
  allow create: if isWellFormedSignup();    // create only; exact fields; capped
  allow read, update, delete: if signedInAs(uid);
}
```

An owner can reach their own business and nothing else. There is no rule that
grants cross-business access, so there is no way to grant it by accident.

Two things that surprise people:

**The Firebase keys in the app bundle are public by design.** They name the
project; they do not authorise anything. The rules are the security. Anyone can
extract them from an app binary and that changes nothing.

**There is exactly one unauthenticated write, and it is fenced in.** With no
Cloud Functions on the free plan, the signup page writes to Firestore directly —
so the rules have to do what the function used to. `signupRequests` allows
`create` only: no read, no update, no delete. The field set is exact, sizes are
capped, the email must be lowercase and well-formed, and `status` is pinned to
`pending` so nobody can self-approve. A stranger with your link can put a name in
a queue. That is the whole of what they can do — they cannot read your customers,
see other requests, or create a customer.

**The public profile is a separate document for a reason.** The join page needs
the shop's name, and a public read of `users/{uid}` would have exposed the
owner's email address and their message templates along with it. So the two
world-readable fields live at `users/{uid}/public/profile` and the rest of the
business document stays private. The app keeps the copy in sync on register and
on rename.

Collection-group queries are matched by their own rule (`/{path=**}/entries/…`),
not by the nested one above. Nothing queries that way at the moment, but the rule
and its index are kept for when something does — miss it and you get a permission
error that reads like the main rule is broken.

---

## The three flows

**Joining.** QR → `https://loyalty-bg.web.app/join/{uid}` → the page reads
`users/{uid}/public/profile` to learn the shop's name → the customer types a name
and email → the page creates one document in `users/{uid}/signupRequests`. The
owner sees a banner on Home, opens **Signup requests**, and taps Accept, which
creates the customer and deletes the request in a single batch.

There is no server in that path, because Cloud Functions need the paid plan. The
rules do the work the function used to do — see **Security** below.

Firestore has no unique constraint, so "one signup per email" is enforced at
Accept time by looking before we leap, not by the database. The failure mode is a
duplicate row, not lost data, which is the right trade at this scale.

**Logging a visit.** One atomic batched write: increment `pointsBalance` and
create the entry carrying `balanceAfter`. A Firestore trigger fires on the new
entry, compares before and after against the active reward's threshold, and
queues the reward email if the line was crossed.

The balance itself is incremented server-side (`increment(1)`), so it is always
right. `balanceAfter` is computed from the locally cached value, so it is right
whenever one device is logging visits — which is what makes the button work with
no signal. Two staff tapping for the same customer at the same second could write
a stale `balanceAfter` and, at worst, miss or repeat one reward prompt. Fixing that
means a transaction, which means giving up offline. For a shop, offline is worth
more; if you ever put three tills on this, revisit it.

On the free plan there is no trigger watching the balance, so the app decides
what each visit is worth saying. `crossedThreshold(before, after, target)` picks
between the two: the visit that crosses the line offers the **reward** email,
every other visit offers the **progress** email ("7 of 10, 3 to go"). Comparing
before against after — rather than `balance >= threshold` — is what makes the
reward email fire on the tenth visit and not on every visit after it.

Three templates, one substitution function. `emailVars()` in
[src/templates.js](src/templates.js) is the only place the numbers get worked
out, so the live preview in the editor and the mail your customer opens can
never disagree. [functions/templates.js](functions/templates.js) mirrors it for
the Blaze path.

**Redeeming.** Rewards are independent tiers, not one ladder — several can run
at once, and a regular on 12 visits has earned everything set at 12 or fewer. The
customer card lists each one waiting and claims them separately. One transaction
per claim: re-read the balance, refuse if it is short, deduct, and write both a
redemption document and an audit entry. A transaction rather than a batch because
the decision depends on a value another device could be changing at the same
moment.

Claiming spends the visits, so the counter drops and that tier can be earned
again — which is what makes a 5-visit reward a repeating punch card rather than a
one-off.

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
