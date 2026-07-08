require('dotenv').config();

async function improveDescription(raw) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const trimmed = (raw || '').trim();
  if (!trimmed) return '';

  if (!apiKey) {
    console.warn('ANTHROPIC_API_KEY not set — "Improve with AI" returned the original text unchanged.');
    return trimmed;
  }

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 300,
      messages: [{
        role: 'user',
        content:
          'You write short, warm, clear public listings for Buffalo Beacon, a directory of open shelters ' +
          'and food pantries during emergencies. Turn this rough staff note into a friendly 2-4 sentence ' +
          "public description. Keep every concrete fact (times, what's offered, entrance instructions). " +
          "Don't invent details that weren't given. Return only the description text, nothing else.\n\n" +
          `Staff note: "${trimmed}"`,
      }],
    }),
  });

  if (!res.ok) {
    console.error('Claude API error:', res.status, await res.text());
    return trimmed;
  }

  const data = await res.json();
  return data.content?.[0]?.text?.trim() || trimmed;
}

module.exports = { improveDescription };
