// Placeholders an owner may use in their email templates.
export const PLACEHOLDERS = [
  { token: '{{customer_name}}', label: "Customer's name" },
  { token: '{{business_name}}', label: 'Your business name' },
  { token: '{{points_balance}}', label: 'Their current points' },
  { token: '{{reward_name}}', label: 'The reward they earned' },
];

export const DEFAULT_TEMPLATES = {
  welcomeEmailSubject: 'Welcome to {{business_name}}!',
  welcomeEmailBody:
    'Hi {{customer_name}},\n\n' +
    "You're now on the {{business_name}} loyalty list. Every time you visit, " +
    'just give us your name and we\'ll add a point to your card.\n\n' +
    'See you soon!\n{{business_name}}',
  rewardEmailSubject: "You've earned a reward at {{business_name}}",
  rewardEmailBody:
    'Hi {{customer_name}},\n\n' +
    "Great news — you've reached {{points_balance}} points, which means " +
    '{{reward_name}} is yours.\n\n' +
    'Just mention this email on your next visit and we\'ll sort you out.\n\n' +
    'Thanks for being a regular,\n{{business_name}}',
};

// Same substitution logic the Cloud Functions use, so the in-app preview is honest.
export function render(template, vars) {
  if (!template) return '';
  return Object.entries(vars).reduce(
    (out, [key, val]) =>
      out.replace(new RegExp(`{{\s*${key}\s*}}`, 'g'), val ?? ''),
    template
  );
}

export const PREVIEW_VARS = {
  customer_name: 'Sam Taylor',
  business_name: 'Your Business',
  points_balance: '10',
  reward_name: 'a free coffee',
};
