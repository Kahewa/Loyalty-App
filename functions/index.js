/**
 * Cloud Functions for the loyalty app.
 *
 *   submitSignup       HTTPS  — the public join form posts here
 *   getBusinessPublic  HTTPS  — join page asks "whose card is this?"
 *   onEntryCreated     Trigger — every visit: queues the progress email, or
 *                              the reward email on the visit that crosses the line
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

const { DEFAULT_TEMPLATES, render, emailVars, toHtml } = require('./templates');

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

    // The welcome template can mention what a full card is worth, so it needs
    // the active reward the same way the visit emails do.
    const rewardSnap = await db
      .collection(`users/${uid}/rewards`)
      .where('active', '==', true)
      .orderBy('pointsRequired')
      .limit(1)
      .get();

    const vars = emailVars({
      customer: { name: cleanName },
      business,
      reward: rewardSnap.empty ? null : rewardSnap.docs[0].data(),
      balance: 0,
    });

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
      // Rewards run alongside each other, so this is every one still going —
      // cheapest first — not just the nearest.
      const rewardSnap = await db
        .collection(`users/${uid}/rewards`)
        .where('active', '==', true)
        .orderBy('pointsRequired')
        .get();

      if (rewardSnap.empty) return;
      const active = rewardSnap.docs.map((d) => d.data());

      // The crossing test. Using before/after rather than "balance >= threshold"
      // is what announces a reward exactly once instead of on every visit past
      // the line. One visit can cross more than one if two share a total.
      const crossed = active.filter((r) => {
        const t = Number(r.pointsRequired);
        return balanceBefore < t && balanceAfter >= t;
      });

      const earned = crossed.length > 0;
      const kind = earned ? 'reward' : 'visit';

      // What the email talks about: what was just won, or what is next up.
      const next = active.find((r) => balanceAfter < Number(r.pointsRequired)) || null;
      const subject = earned
        ? { ...crossed[0], name: crossed.map((r) => r.name).join(' and ') }
        : next;

      // Nothing left to aim at and nothing just earned — say nothing.
      if (!earned && !next) return;

      // The owner can silence the every-visit progress note; earning the reward
      // is always announced.
      const [customerSnap, businessSnap] = await Promise.all([
        db.doc(`users/${uid}/customers/${customerId}`).get(),
        db.doc(`users/${uid}`).get(),
      ]);

      if (!customerSnap.exists || !businessSnap.exists) return;

      const customer = customerSnap.data();
      const business = businessSnap.data();

      if (!earned && business.emailOnVisit === false) return;

      if (!customer.email) {
        logger.info('nothing to send — no email on file', { uid, customerId, kind });
        return;
      }

      const vars = emailVars({
        customer,
        business,
        reward: subject,
        balance: balanceAfter,
      });

      const subjectKey = `${kind}EmailSubject`;
      const bodyKey = `${kind}EmailBody`;

      await queueEmail({
        to: customer.email,
        subject: render(business[subjectKey] || DEFAULT_TEMPLATES[subjectKey], vars),
        body: render(business[bodyKey] || DEFAULT_TEMPLATES[bodyKey], vars),
        businessName: vars.business_name,
      });

      logger.info(`${kind} email queued`, {
        uid,
        customerId,
        balanceAfter,
        crossed: crossed.map((r) => r.name),
      });
    } catch (err) {
      logger.error('visit email check failed', err);
    }
  }
);
