// Maestro helper: reads the newest sign-in code mailed to EMAIL from the local Mailpit.
//
//   - runScript:
//       file: ../scripts/latest-sign-in-code.js
//       env:
//         EMAIL: member@e2e.churchflow.test
//   - inputText: ${output.signInCode}
//
// Seeded accounts live in apps/api/scripts/e2e-seed.mjs.
var mailpit = typeof MAILPIT_URL !== 'undefined' ? MAILPIT_URL : 'http://127.0.0.1:8025';
var search = http.get(
  mailpit + '/api/v1/search?limit=1&query=' + encodeURIComponent('to:' + EMAIL),
);
var found = json(search.body);
if (!found.messages || found.messages.length === 0) {
  throw new Error('No email for ' + EMAIL + ' in Mailpit');
}
var message = json(http.get(mailpit + '/api/v1/message/' + found.messages[0].ID).body);
var match = /\b(\d{6})\b/.exec(message.Text || '');
if (!match) {
  throw new Error('No six-digit code in the latest email for ' + EMAIL);
}
output.signInCode = match[1];
