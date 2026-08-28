#!/usr/bin/env node
/**
 * Refuses a commit that would put credentials into the repo.
 *
 * Installed as a pre-commit hook by `npm run hooks`. Checks only what is
 * staged, so it is fast and cannot be fooled by an untracked working copy.
 */
const { execSync } = require('child_process');

// Things that are genuinely secret. Firebase web API keys are deliberately not
// on this list — they are public by design — but .env is blocked outright so a
// stray `git add -f` cannot slip one through.
const BLOCKED_PATHS = [
  { re: /(^|\/)\.env$/, why: '.env holds your project keys' },
  { re: /(^|\/)\.env\.(?!example)/, why: 'env files hold project keys' },
  { re: /serviceAccount.*\.json$/i, why: 'a service account key grants full admin access' },
  { re: /(^|\/)firebase-adminsdk.*\.json$/i, why: 'admin SDK credentials' },
  { re: /\.(pem|p12|pfx|jks|keystore)$/i, why: 'private key material' },
  { re: /(^|\/)google-services\.json$/, why: 'contains project credentials' },
  { re: /(^|\/)GoogleService-Info\.plist$/, why: 'contains project credentials' },
];

const BLOCKED_CONTENT = [
  { re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/, why: 'a private key' },
  { re: /"type"\s*:\s*"service_account"/, why: 'a service account JSON' },
  { re: /\bAKIA[0-9A-Z]{16}\b/, why: 'an AWS access key id' },
  { re: /\bxkeysib-[0-9a-f]{64}/i, why: 'a Brevo SMTP key' },
  { re: /\bSG\.[\w-]{20,}\.[\w-]{20,}/, why: 'a SendGrid key' },
  { re: /\bgh[pousr]_[A-Za-z0-9]{30,}/, why: 'a GitHub token' },
  { re: /\bsk_(live|test)_[A-Za-z0-9]{20,}/, why: 'a Stripe secret key' },
];

let staged;
try {
  staged = execSync('git diff --cached --name-only --diff-filter=ACM', { encoding: 'utf8' })
    .split('\n')
    .filter(Boolean);
} catch {
  process.exit(0); // not a git repo / nothing staged
}

const problems = [];

for (const path of staged) {
  for (const { re, why } of BLOCKED_PATHS) {
    if (re.test(path)) problems.push(`${path} — ${why}`);
  }

  let content = '';
  try {
    content = execSync(`git show :"${path}"`, { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
  } catch {
    continue; // binary or unreadable
  }

  for (const { re, why } of BLOCKED_CONTENT) {
    if (re.test(content)) problems.push(`${path} — looks like ${why}`);
  }
}

if (problems.length) {
  console.error('\n  COMMIT BLOCKED — credentials in staged files:\n');
  [...new Set(problems)].forEach((p) => console.error('    ' + p));
  console.error('\n  Unstage them (git restore --staged <file>) and check .gitignore.');
  console.error('  If this is a false positive: git commit --no-verify\n');
  process.exit(1);
}
