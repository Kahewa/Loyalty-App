// Every Firestore read/write the owner app performs.
// Everything is scoped under users/{uid} — the owner's auth uid IS the business id.
import {
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  writeBatch,
  runTransaction,
  increment,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';

const businessDoc = (uid) => doc(db, 'users', uid);
const customersCol = (uid) => collection(db, 'users', uid, 'customers');
const customerDoc = (uid, id) => doc(db, 'users', uid, 'customers', id);
const entriesCol = (uid, id) => collection(db, 'users', uid, 'customers', id, 'entries');
const rewardsCol = (uid) => collection(db, 'users', uid, 'rewards');
const redemptionsCol = (uid) => collection(db, 'users', uid, 'redemptions');

/* ---------------------------------------------------------------- business */

const publicProfileDoc = (uid) => doc(db, 'users', uid, 'public', 'profile');
const signupRequestsCol = (uid) => collection(db, 'users', uid, 'signupRequests');

/**
 * The join page is a plain web page with no server behind it, so it reads the
 * business name straight out of Firestore. Only these two fields are world-
 * readable — the templates and the owner's email stay on the private doc.
 */
export const updatePublicProfile = (uid, fields) =>
  setDoc(publicProfileDoc(uid), fields, { merge: true });

// Fields the join page is allowed to see. The templates and the owner's own
// email address are deliberately not among them.
const PUBLIC_FIELDS = ['businessName', 'logoUrl', 'theme'];

export async function updateBusiness(uid, patch) {
  await updateDoc(businessDoc(uid), patch);

  // Mirror only the public-facing fields, so the signup page shows the right
  // name and wears the shop's colours.
  const publicPatch = Object.fromEntries(
    Object.entries(patch).filter(([k, v]) => PUBLIC_FIELDS.includes(k) && v !== undefined)
  );
  if (Object.keys(publicPatch).length) {
    await updatePublicProfile(uid, publicPatch);
  }
}

/* ---------------------------------------------------------- signup requests */

export function watchSignupRequests(uid, cb) {
  return onSnapshot(
    query(signupRequestsCol(uid), orderBy('createdAt', 'desc')),
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => {
      console.warn('[signup requests]', err.message);
      cb([]);
    }
  );
}

/**
 * Turn a pending request into a real customer. Done in one batch so a request
 * can never be consumed twice or vanish without a customer appearing.
 */
export async function acceptSignupRequest(uid, request) {
  const existing = request.email ? await findCustomerByEmail(uid, request.email) : null;
  if (existing) {
    // Already a customer — drop the request rather than creating a duplicate.
    await deleteDoc(doc(signupRequestsCol(uid), request.id));
    return { customerId: existing.id, alreadyExisted: true };
  }

  const batch = writeBatch(db);
  const customerRef = doc(customersCol(uid));
  batch.set(customerRef, {
    name: request.name,
    email: request.email,
    pointsBalance: 0,
    joinedAt: serverTimestamp(),
    source: 'signup',
  });
  batch.delete(doc(signupRequestsCol(uid), request.id));
  await batch.commit();

  return { customerId: customerRef.id, alreadyExisted: false };
}

export const rejectSignupRequest = (uid, requestId) =>
  deleteDoc(doc(signupRequestsCol(uid), requestId));

/* --------------------------------------------------------------- customers */

export function watchCustomers(uid, cb) {
  return onSnapshot(query(customersCol(uid), orderBy('name')), (snap) =>
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  );
}

export function watchCustomer(uid, customerId, cb) {
  return onSnapshot(customerDoc(uid, customerId), (snap) =>
    cb(snap.exists() ? { id: snap.id, ...snap.data() } : null)
  );
}

export function watchEntries(uid, customerId, cb, max = 50) {
  return onSnapshot(
    query(entriesCol(uid, customerId), orderBy('createdAt', 'desc'), limit(max)),
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  );
}

// The dashboard used to show a per-visit activity feed here, via a
// collectionGroup query over every `entries` subcollection. It now shows a
// per-customer tally instead, so that query is gone. Its Firestore index and
// its security rule are deliberately left in place — they cost nothing and are
// what a future activity feed would need.

export async function findCustomerByEmail(uid, email) {
  const snap = await getDocs(
    query(customersCol(uid), where('email', '==', email.trim().toLowerCase()), limit(1))
  );
  return snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() };
}

export async function addCustomer(uid, { name, email }) {
  const clean = email.trim().toLowerCase();
  // Firestore has no unique constraint, so we check first. Good enough for a
  // single owner typing on one phone; the signup function does the same server-side.
  if (clean && (await findCustomerByEmail(uid, clean))) {
    throw new Error('A customer with that email is already on your list.');
  }
  const ref = await addDoc(customersCol(uid), {
    name: name.trim(),
    email: clean,
    pointsBalance: 0,
    joinedAt: serverTimestamp(),
    source: 'manual',
  });
  return ref.id;
}

export const updateCustomer = (uid, customerId, patch) =>
  updateDoc(customerDoc(uid, customerId), patch);

export async function deleteCustomer(uid, customerId) {
  // Subcollections are not deleted by deleting the parent — clear entries first.
  const entries = await getDocs(entriesCol(uid, customerId));
  const batch = writeBatch(db);
  entries.docs.forEach((d) => batch.delete(d.ref));
  batch.delete(customerDoc(uid, customerId));
  await batch.commit();
}

/* ------------------------------------------------------------ logging visits */

/** Active rewards, cheapest first. The order everything else assumes. */
export function activeRewards(rewards) {
  return (rewards || [])
    .filter((r) => r.active && Number(r.pointsRequired) > 0)
    .sort((a, b) => Number(a.pointsRequired) - Number(b.pointsRequired));
}

/**
 * Which rewards a visit just put within reach.
 *
 * Comparing before against after — rather than "balance >= threshold" — is what
 * makes a reward announce itself on the visit that earns it and stay quiet on
 * every visit after. With several rewards running at once, one visit can cross
 * more than one line, so this returns a list.
 */
export function rewardsCrossed(before, after, rewards) {
  return activeRewards(rewards).filter((r) => {
    const t = Number(r.pointsRequired);
    return before < t && after >= t;
  });
}

/**
 * One customer's standing across every active reward. Home, the customer list
 * and the customer card all read this, so it is worked out once here rather
 * than three times slightly differently.
 *
 * `earned` is everything they can claim right now — rewards are independent
 * tiers, not a single ladder, so a regular on 12 visits may have several
 * waiting. `next` is the cheapest one still out of reach, which is what the
 * stamps count toward.
 */
export function rewardStatus(customer, rewards) {
  const balance = customer?.pointsBalance || 0;
  const active = activeRewards(rewards);

  const earned = active.filter((r) => balance >= Number(r.pointsRequired));
  const next = active.find((r) => balance < Number(r.pointsRequired)) || null;

  if (!active.length) {
    return { balance, active, earned: [], next: null, target: 0, toGo: 0, ratio: 0, ready: false };
  }

  // With nothing left to aim at, the stamps show the top tier, full.
  const target = Number((next || active[active.length - 1]).pointsRequired);
  const toGo = next ? Math.max(0, Number(next.pointsRequired) - balance) : 0;

  return {
    balance,
    active,
    earned,
    next,
    target,
    toGo,
    // Someone on 12 of 10 has an unclaimed reward, so clamp the bar but not the count.
    ratio: Math.min(1, balance / target),
    ready: earned.length > 0,
  };
}

/**
 * One atomic batched write: bump the running total AND write the audit line.
 * Batched writes are queued locally when offline and flush on reconnect, so the
 * "+1 visit" button keeps working with no signal.
 */
export async function logVisit(uid, customer, { points = 1, note = '' } = {}) {
  const batch = writeBatch(db);
  const balanceAfter = (customer.pointsBalance || 0) + points;

  batch.update(customerDoc(uid, customer.id), {
    pointsBalance: increment(points),
    lastVisitAt: serverTimestamp(),
  });

  batch.set(doc(entriesCol(uid, customer.id)), {
    points,
    balanceAfter,
    note: note.trim(),
    createdAt: serverTimestamp(),
    // Denormalised so Home's cross-customer feed and the reward trigger
    // don't need an extra read.
    ownerUid: uid,
    customerId: customer.id,
    customerName: customer.name,
  });

  await batch.commit();
  return balanceAfter;
}

/* ------------------------------------------------------------------ rewards */

export function watchRewards(uid, cb) {
  return onSnapshot(query(rewardsCol(uid), orderBy('pointsRequired')), (snap) =>
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  );
}

export async function saveReward(uid, { id, name, pointsRequired, active }) {
  const payload = {
    name: name.trim(),
    pointsRequired: Number(pointsRequired),
    active: Boolean(active),
    updatedAt: serverTimestamp(),
  };
  if (id) {
    await updateDoc(doc(rewardsCol(uid), id), payload);
    return id;
  }
  const ref = await addDoc(rewardsCol(uid), { ...payload, createdAt: serverTimestamp() });
  return ref.id;
}

export const deleteReward = (uid, rewardId) => deleteDoc(doc(rewardsCol(uid), rewardId));

/** Every reward currently running, cheapest first. */
export async function getActiveRewards(uid) {
  const snap = await getDocs(
    query(rewardsCol(uid), where('active', '==', true), orderBy('pointsRequired'))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/* -------------------------------------------------------------- redemptions */

/**
 * Deduct points and record the redemption in one transaction, so two taps
 * can never spend the same points twice.
 */
export async function redeemReward(uid, customerId, reward) {
  const cost = Number(reward.pointsRequired);
  return runTransaction(db, async (tx) => {
    const ref = customerDoc(uid, customerId);
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('Customer no longer exists.');

    const balance = snap.data().pointsBalance || 0;
    if (balance < cost) {
      throw new Error(`Not enough points — they have ${balance}, need ${cost}.`);
    }

    tx.update(ref, { pointsBalance: balance - cost });
    tx.set(doc(redemptionsCol(uid)), {
      customerId,
      customerName: snap.data().name,
      rewardName: reward.name,
      pointsSpent: cost,
      redeemedAt: serverTimestamp(),
    });
    // An audit line, so the history reads as a complete statement.
    tx.set(doc(entriesCol(uid, customerId)), {
      points: -cost,
      balanceAfter: balance - cost,
      note: `Redeemed: ${reward.name}`,
      kind: 'redemption',
      createdAt: serverTimestamp(),
      ownerUid: uid,
      customerId,
      customerName: snap.data().name,
    });
    return balance - cost;
  });
}

export function watchRedemptions(uid, cb, max = 50) {
  return onSnapshot(
    query(redemptionsCol(uid), orderBy('redeemedAt', 'desc'), limit(max)),
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  );
}

export { getDoc, setDoc };
