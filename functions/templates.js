// Kept deliberately in step with src/templates.js so the in-app preview and the
// email that actually goes out use identical substitution.

const DEFAULT_TEMPLATES = {
  welcomeEmailSubject: 'Welcome to {{business_name}}!',
  welcomeEmailBody:
    'Hi {{customer_name}},\n\n' +
    "You're now on the {{business_name}} loyalty list. Every time you visit, " +
    "just give us your name and we'll add a point to your card.\n\n" +
    'See you soon!\n{{business_name}}',
  rewardEmailSubject: "You've earned a reward at {{business_name}}",
  rewardEmailBody:
    'Hi {{customer_name}},\n\n' +
    "Great news — you've reached {{points_balance}} points, which means " +
    '{{reward_name}} is yours.\n\n' +
    "Just mention this email on your next visit and we'll sort you out.\n\n" +
    'Thanks for being a regular,\n{{business_name}}',
};

function render(template, vars) {
  if (!template) return '';
  return Object.entries(vars).reduce(
    (out, [key, val]) => out.replace(new RegExp(`{{\\s*${key}\\s*}}`, 'g'), val ?? ''),
    template
  );
}

const escapeHtml = (str = '') =>
  String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

// Wrap the owner's plain-text body in something that does not look like spam.
function toHtml(body, businessName) {
  const paragraphs = escapeHtml(body)
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 16px;line-height:1.6">${p.replace(/\n/g, '<br/>')}</p>`)
    .join('');

  return `<!doctype html><html><body style="margin:0;background:#f1f5f9;padding:24px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#334155">
<div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px">
<div style="font-size:13px;font-weight:600;color:#64748b;letter-spacing:.5px;text-transform:uppercase;margin-bottom:20px">${escapeHtml(
    businessName
  )}</div>
${paragraphs}
</div></body></html>`;
}

module.exports = { DEFAULT_TEMPLATES, render, toHtml, escapeHtml };
