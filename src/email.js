import { showAlert } from './components/alert';
import { render, emailVars, DEFAULT_TEMPLATES } from './templates';
import { openInMailApp, getMailApp } from './mail-apps';

/**
 * Sending email needs a server, and Cloud Functions need the Blaze plan. On the
 * free plan we do the next most honest thing: fill in the owner's own template
 * and hand the finished message to the mail app they picked in Settings. They
 * tap send.
 *
 * The alternative — calling an email provider's API straight from the app —
 * would mean shipping a real API key inside the bundle where anyone can pull it
 * out and send mail as you. That is not a trade worth making.
 */

function build(kind, { customer, business, reward, balance }) {
  const vars = emailVars({ customer, business, reward, balance });
  const subjectKey = `${kind}EmailSubject`;
  const bodyKey = `${kind}EmailBody`;

  return {
    to: customer.email,
    subject: render(business?.[subjectKey] || DEFAULT_TEMPLATES[subjectKey], vars),
    body: render(business?.[bodyKey] || DEFAULT_TEMPLATES[bodyKey], vars),
  };
}

async function send(kind, ctx) {
  const message = build(kind, ctx);
  const appId = ctx.business?.mailApp || 'default';

  const status = await openInMailApp(appId, message);

  if (status === 'unavailable') {
    const app = getMailApp(appId);
    showAlert(
      `Could not open ${app.name}`,
      app.id === 'default'
        ? 'No mail app is set up on this phone yet.'
        : `${app.name} does not seem to be installed. Pick a different app under Settings → Send email with.`
    );
  }
  return status;
}

/** Sent once, when the owner accepts a signup request. */
export const sendWelcomeEmail = (ctx) => send('welcome', { ...ctx, balance: 0 });

/** Sent after a logged visit — the running "how far to go" note. */
export const sendVisitEmail = (ctx) => send('visit', ctx);

/** Sent on the visit that crosses the threshold. */
export const sendRewardEmail = (ctx) => send('reward', ctx);

/** Used by Settings to show the owner what a test message looks like. */
export const buildPreview = build;
