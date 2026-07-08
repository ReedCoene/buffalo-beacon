require('dotenv').config();

// ponytail: no email queue/retry — single fetch call, org count is tiny.
// Add retry/queueing if this ever needs to fan out to hundreds of subscribers at once.
async function sendEmail(to, subject, text) {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.log(
      `\n--- EMAIL (dev mode: no RESEND_API_KEY set, printing instead of sending) ---\n` +
      `To: ${to}\nSubject: ${subject}\n\n${text}\n` +
      `-----------------------------------------------------------------------------\n`
    );
    return;
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM || 'Buffalo Beacon <onboarding@resend.dev>',
      to,
      subject,
      text,
    }),
  });

  if (!res.ok) {
    console.error('Email send failed:', res.status, await res.text());
  }
}

module.exports = { sendEmail };
