// Shared "here's your Avva app link" send — used by both the Remedora
// checkout webhook (routes/checkout.js) and a staff-triggered manual invite
// (routes/admin.js) so the message and link format stay in sync.

const { sendEmail, sendSms } = require('./notify');

function buildWelcomeLink(req, signupToken) {
  const baseUrl = process.env.APP_BASE_URL || `${req.protocol}://${req.get('host')}`;
  return `${baseUrl}/app/welcome.html?t=${signupToken}`;
}

async function sendWelcomeLink({ req, name, email, phone, signupToken }) {
  const link = buildWelcomeLink(req, signupToken);
  const results = {};
  if (email) {
    results.email = await sendEmail({
      to: email,
      subject: 'Your Avva app is ready',
      text: `Hi ${name}, welcome to Avva by MedFit! Get your app here: ${link}`,
      html: `<p>Hi ${name},</p><p>Welcome to Avva — your MedFit lifestyle coach. It's where you'll get weekly grocery lists, recipes, and log your progress alongside your program.</p><p><a href="${link}">Open your app</a></p>`,
    });
  }
  if (phone) {
    results.sms = await sendSms({
      to: phone,
      body: `Welcome to Avva by MedFit! Your app: ${link}`,
    });
  }
  return { link, results };
}

module.exports = { buildWelcomeLink, sendWelcomeLink };
