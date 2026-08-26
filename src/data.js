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
  collectionGroup,
} from 'firebase/firestore';
import { db } from './firebase';

const businessDoc = (uid) => doc(db, 'users', uid);
const customersCol = (uid) => collection(db, 'users', uid, 'customers');
const customerDoc = (uid, id) => doc(db, 'users', uid, 'customers', id);
const entriesCol = (uid, id) => collection(db, 'users', uid, 'customers', id, 'entries');
const rewardsCol = (uid) => collection(db, 'users', uid, 'rewards');
const redemptionsCol = (uid) => collection(db, 'users', uid, 'redemptions');

/* ---------------------------------------------------------------- business */

export const updateBusiness = (uid, patch) => updateDoc(businessDoc(uid), patch);

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

// Recent activity across every customer — needs the collectionGroup index.
export function watchRecentActivity(uid, cb, max = 25) {
  return onSnapshot(
    query(
      collectionGroup(db, 'entries'),
      where('ownerUid', '==', uid),
      orderBy('createdAt', 'desc'),
      limit(max)
    ),
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => {
      // Missing index or offline — degrade quietly rather than blank the Home screen.
      console.warn('[recent activity]', err.message);
      cb([]);
    }
  );
}

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

export async function getActiveReward(uid) {
  const snap = await getDocs(
    query(rewardsCol(uid), where('active', '==', true), orderBy('pointsRequired'), limit(1))
  );
  return snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() };
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
