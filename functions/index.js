/**
 * Cloud Functions for the loyalty app.
 *
 *   submitSignup       HTTPS  — the public join form posts here
 *   getBusinessPublic  HTTPS  — join page asks "whose card is this?"
 *   onEntryCreated     Trigger — watches every visit, queues the reward email
 *
 * Nothing here trusts the caller. The two HTTPS endpoints are reachable by
 * anyone on the internet, so they validate hard; the Admin SDK bypasses
 * security rules on purpose, which is exactly why the public never writes
 * to Firestore directly.
 */
const { onRequest } = require('firebase-functions/v2/https');
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { setGlobalOptions } = require('firebase-functions/v2');
const logger = require('firebase-functions/logger');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

const { DEFAULT_TEMPLATES, render, toHtml } = require('./templates');

// Modular imports rather than the `admin.firestore.FieldValue` namespace: that
// namespace still exists in production but the Functions emulator swaps in its
// own firebase-admin shim, which does not carry the static across. Same code,
// works in both.
initializeApp();
const db = getFirestore();

setGlobalOptions({ region: 'us-central1', maxInstances: 10 });

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MAX_NAME = 80;

/** Drop a message into the collection the Trigger Email extension watches. */
function queueEmail({ to, subject, body, businessName }) {
  return db.collection('mail').add({
    to: [to],
    message: {
      subject,
      text: body,
      html: toHtml(body, businessName),
    },
    createdAt: FieldValue.serverTimestamp(),
  });
}

/* ------------------------------------------------------------------ signup */

// No CORS headers on purpose. Hosting rewrites /api/signup onto this function,
// so the join page calls it same-origin; a browser on any other site is blocked
// by the preflight it will never get an answer to.
exports.submitSignup = onRequest(async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Use POST.' });
  }

  const { uid, name, email, website } = req.body || {};

  // Honeypot: a real person never sees this field, so anything in it is a bot.
  // Answer 200 so the bot believes it worked and does not retry.
  if (website) {
    logger.info('honeypot triggered', { uid });
    return res.json({ ok: true });
  }

  const cleanName = String(name || '').trim().slice(0, MAX_NAME);
  const cleanEmail = String(email || '').trim().toLowerCase();

  if (!uid || typeof uid !== 'string') {
    return res.status(400).json({ ok: false, error: 'This signup link is not valid.' });
  }
  if (!cleanName) {
    return res.status(400).json({ ok: false, error: 'Please enter your name.' });
  }
  if (!EMAIL_RE.test(cleanEmail)) {
    return res.status(400).json({ ok: false, error: 'That email address does not look right.' });
  }

  try {
    const businessSnap = await db.doc(`users/${uid}`).get();
    if (!businessSnap.exists) {
      return res.status(404).json({ ok: false, error: 'This signup link is not valid.' });
    }
    const business = businessSnap.data();

    // Firestore has no unique constraint, so "one signup per email" is enforced
    // here, by looking before we leap. Not bulletproof against two simultaneous
    // submissions, but the failure mode is a duplicate row, not lost data.
    const existing = await db
      .collection(`users/${uid}/customers`)
      .where('email', '==', cleanEmail)
      .limit(1)
      .get();

    if (!existing.empty) {
      // Deliberately not an error: telling a customer "you're already in" is
      // friendlier than a failure, and it does not leak anything they
      // did not already know about themselves.
      return res.json({ ok: true, alreadyMember: true, businessName: business.businessName });
    }

    await db.collection(`users/${uid}/customers`).add({
      name: cleanName,
      email: cleanEmail,
      pointsBalance: 0,
      joinedAt: FieldValue.serverTimestamp(),
      source: 'signup',
    });

    const vars = {
      customer_name: cleanName,
      business_name: business.businessName || 'us',
      points_balance: '0',
      reward_name: '',
    };

    await queueEmail({
      to: cleanEmail,
      subject: render(
        business.welcomeEmailSubject || DEFAULT_TEMPLATES.welcomeEmailSubject,
        vars
      ),
      body: render(business.welcomeEmailBody || DEFAULT_TEMPLATES.welcomeEmailBody, vars),
      businessName: vars.business_name,
    });

    logger.info('signup accepted', { uid, email: cleanEmail });
    return res.json({ ok: true, businessName: business.businessName });
  } catch (err) {
    logger.error('signup failed', err);
    return res.status(500).json({ ok: false, error: 'Something went wrong. Please try again.' });
  }
});

/* ----------------------------------------------- public business lookup */

exports.getBusinessPublic = onRequest(async (req, res) => {
  const uid = String(req.query.uid || '');
  if (!uid) return res.status(400).json({ ok: false });

  try {
    const snap = await db.doc(`users/${uid}`).get();
    if (!snap.exists) return res.status(404).json({ ok: false });

    // Only the two fields the join page needs — never the whole document.
    const { businessName, logoUrl } = snap.data();
    res.set('Cache-Control', 'public, max-age=300');
    return res.json({ ok: true, businessName: businessName || '', logoUrl: logoUrl || '' });
  } catch (err) {
    logger.error('business lookup failed', err);
    return res.status(500).json({ ok: false });
  }
});

/* --------------------------------------------- reward threshold detection */

exports.onEntryCreated = onDocumentCreated(
  'users/{uid}/customers/{customerId}/entries/{entryId}',
  async (event) => {
    const entry = event.data?.data();
    if (!entry) return;

    const { uid, customerId } = event.params;
    const points = Number(entry.points || 0);

    // Redemptions and corrections move the balance down; only an upward move
    // can cross a threshold.
    if (points <= 0) return;

    const balanceAfter = Number(entry.balanceAfter || 0);
    const balanceBefore = balanceAfter - points;

    try {
      const rewardSnap = await db
        .collection(`users/${uid}/rewards`)
        .where('active', '==', true)
        .orderBy('pointsRequired')
        .limit(1)
        .get();

      if (rewardSnap.empty) return;
      const reward = rewardSnap.docs[0].data();
      const threshold = Number(reward.pointsRequired);

      // The crossing test. Using before/after rather than "balance >= threshold"
      // is what stops a second email on every visit past the line.
      if (!(balanceBefore < threshold && balanceAfter >= threshold)) return;

      const [customerSnap, businessSnap] = await Promise.all([
        db.doc(`users/${uid}/customers/${customerId}`).get(),
        db.doc(`users/${uid}`).get(),
      ]);

      if (!customerSnap.exists || !businessSnap.exists) return;

      const customer = customerSnap.data();
      const business = businessSnap.data();

      if (!customer.email) {
        logger.info('threshold crossed but no email on file', { uid, customerId });
        return;
      }

      const vars = {
        customer_name: customer.name || 'there',
        business_name: business.businessName || 'us',
        points_balance: String(balanceAfter),
        reward_name: reward.name || 'your reward',
      };

      await queueEmail({
        to: customer.email,
        subject: render(
          business.rewardEmailSubject || DEFAULT_TEMPLATES.rewardEmailSubject,
          vars
        ),
        body: render(business.rewardEmailBody || DEFAULT_TEMPLATES.rewardEmailBody, vars),
        businessName: vars.business_name,
      });

      logger.info('reward email queued', { uid, customerId, threshold, balanceAfter });
    } catch (err) {
      logger.error('reward check failed', err);
    }
  }
);
