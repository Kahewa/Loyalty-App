// Placeholders an owner may use in their email templates.
export const PLACEHOLDERS = [
  { token: '{{customer_name}}', label: "Customer's name" },
  { token: '{{business_name}}', label: 'Your business name' },
  { token: '{{points_balance}}', label: 'Visits they have now' },
  { token: '{{points_needed}}', label: 'Visits a reward takes' },
  { token: '{{points_to_go}}', label: 'Visits still to go' },
  { token: '{{reward_name}}', label: 'What they get' },
];

export const DEFAULT_TEMPLATES = {
  welcomeEmailSubject: 'Welcome to {{business_name}}!',
  welcomeEmailBody:
    'Hi {{customer_name}},\n\n' +
    "You're now on the loyalty list at {{business_name}}. Every time you visit, " +
    "just give us your name and we'll add a visit to your card.\n\n" +
    'After {{points_needed}} visits, {{reward_name}} is yours.\n\n' +
    'See you soon!\n{{business_name}}',

  // Sent after every logged visit — the running "how far to go" note.
  visitEmailSubject: 'That\'s {{points_balance}} visits at {{business_name}}',
  visitEmailBody:
    'Hi {{customer_name}},\n\n' +
    'Thanks for coming in. That puts you on {{points_balance}} of ' +
    '{{points_needed}} visits.\n\n' +
    'Just {{points_to_go}} more and {{reward_name}} is yours.\n\n' +
    'See you next time,\n{{business_name}}',

  rewardEmailSubject: "You've earned {{reward_name}} at {{business_name}}",
  rewardEmailBody:
    'Hi {{customer_name}},\n\n' +
    "Great news — you've reached {{points_balance}} visits, which means " +
    '{{reward_name}} is yours.\n\n' +
    "Just mention this email on your next visit and we'll sort you out.\n\n" +
    'Thanks for being a regular,\n{{business_name}}',
};

// Same substitution the Cloud Functions use, so the in-app preview is honest.
export function render(template, vars) {
  if (!template) return '';
  return Object.entries(vars).reduce(
    (out, [key, val]) => out.replace(new RegExp(`{{\\s*${key}\\s*}}`, 'g'), val ?? ''),
    template
  );
}

/**
 * The one place the numbers in an email are worked out, so the live preview and
 * the message that actually goes out can never disagree.
 */
export function emailVars({ customer, business, reward, balance }) {
  const points = Number(balance ?? customer?.pointsBalance ?? 0);
  const needed = Number(reward?.pointsRequired ?? 0);
  const toGo = needed > 0 ? Math.max(0, needed - points) : 0;

  return {
    customer_name: customer?.name || 'there',
    business_name: business?.businessName || 'us',
    points_balance: String(points),
    points_needed: needed > 0 ? String(needed) : '',
    points_to_go: needed > 0 ? String(toGo) : '',
    reward_name: reward?.name || 'your reward',
  };
}

export const PREVIEW_VARS = {
  customer_name: 'Sam Taylor',
  business_name: 'Your Business',
  points_balance: '7',
  points_needed: '10',
  points_to_go: '3',
  reward_name: 'a free coffee',
};
