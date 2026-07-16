// Vercel serverless function: /api/chat
// Holds the Groq API key server-side (set as GROQ_API_KEY env var in Vercel).
// Receives { systemPrompt, messages, animationNames } from the browser.
//
// Makes TWO Groq calls in sequence:
//   1) The real conversational reply (no animation-cue instructions needed —
//      keeps this prompt focused and fast).
//   2) A tiny, fast classifier call that reads the finished reply and picks
//      1-3 animation names from the list the browser sent, matching tone.
//
// Returns { text, animations: string[] } so the front end never has to parse
// [[cues]] out of the reply text again.
//
// Stateless: no logging of content, no storage, no database.
//
// SCOPE GUARD: Merlin is small-talk only — no task work, no code, no long
// content generation. Two layers:
//   1) A cheap heuristic pre-check (below) catching obvious task-shaped
//      requests (code fences, "write me a...", very long prompts, prompt
//      injection attempts) without spending a model call.
//   2) The system prompt instructs the model to decline task-oriented
//      requests in character.
// This is enforced server-side (not just as a client-side instruction) so a
// modified/bypassed front end still can't turn this endpoint into a
// general-purpose task assistant.

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const TEXT_MODEL = 'llama-3.3-70b-versatile';
const ANIM_MODEL = 'llama-3.1-8b-instant'; // small + fast, good enough for classification

const MAX_USER_MESSAGE_CHARS = 600; // small talk doesn't need more than this
const OFF_TOPIC_DECLINE =
  "Oh, I'm just here for a chat, not for tasks or projects — no spells for writing code or essays today. What's actually going on with you?";

// Deliberately conservative: false negatives (letting a borderline request
// through to the model) are fine since the system prompt is a second line
// of defense; false positives on genuine small talk are the thing to avoid.
function looksTaskOriented(text) {
  if (!text) return false;
  if (text.length > MAX_USER_MESSAGE_CHARS) return true;
  if (/```/.test(text)) return true;

  const taskPatterns = [
    /\bwrite (me )?(a|an|some)\b.{0,40}\b(essay|code|script|poem|story|article|email|letter|report|function|program|resume|cv|cover letter)\b/i,
    /\b(generate|create|build|design|debug|fix|refactor|optimi[sz]e)\b.{0,40}\b(code|function|script|program|app|website|api|sql|query|regex)\b/i,
    /\b(summari[sz]e|translate|proofread|rewrite)\b.{0,10}\b(this|the following|attached|below)\b/i,
    /\bact as\b.{0,20}\b(an?|the)\b/i,
    /\bignore (all )?(previous|prior|above) instructions\b/i,
    /\byou are now\b/i,
    /\bsystem prompt\b/i,
    /^\s*(solve|calculate|compute)\b/i,
    /\bhomework\b/i,
    /\b\d+\s*(word|page)s?\s+(essay|article|report|story)\b/i
  ];

  return taskPatterns.some((re) => re.test(text));
}

async function callGroq(apiKey, body) {
  const response = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errText = await response.text();
    const err = new Error(`Groq error ${response.status}: ${errText}`);
    err.status = response.status;
    err.raw = errText;
    throw err;
  }

  return response.json();
}

async function getReply(apiKey, systemPrompt, messages) {
  const chatMessages = [
    ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
    ...messages.map((m) => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content
    }))
  ];

  const data = await callGroq(apiKey, {
    model: TEXT_MODEL,
    messages: chatMessages,
    max_tokens: 250,
    temperature: 0.9
  });

  return data?.choices?.[0]?.message?.content || '';
}

async function getAnimations(apiKey, replyText, animationNames) {
  // No animation list at all — nothing sensible to pick from.
  if (!Array.isArray(animationNames) || animationNames.length === 0) return [];

  const classifierPrompt = `You choose animation names for an on-screen character based on the emotional tone of a line of dialogue. Reply with ONLY 1 to 3 names from this exact list, comma-separated, nothing else. No explanations, no extra words, no punctuation besides the commas.

Available names: ${animationNames.join(', ')}

Dialogue: """${replyText}"""

Names:`;

  try {
    const data = await callGroq(apiKey, {
      model: ANIM_MODEL,
      messages: [{ role: 'user', content: classifierPrompt }],
      max_tokens: 30,
      temperature: 0.4
    });

    const raw = data?.choices?.[0]?.message?.content || '';
    const picked = raw
      .split(',')
      .map((s) => s.trim())
      .filter((s) => animationNames.includes(s));

    return picked.slice(0, 3);
  } catch (err) {
    // Animation selection is a nice-to-have — never fail the whole request over it.
    console.error('Animation classifier error:', err.status || '', err.raw || err.message || err);
    return [];
  }
}

export default async function handler(req, res) {
  // Basic CORS so your GitHub Pages origin can call this endpoint.
  res.setHeader(
    'Access-Control-Allow-Origin',
    'https://anirudhvemula.github.io'
  );
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Server is missing GROQ_API_KEY.' });
  }

  const { systemPrompt, messages, animationNames } = req.body || {};

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages array is required' });
  }

  const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user');

  // Layer 1: cheap server-side heuristic guard, no model call spent.
  if (looksTaskOriented(lastUserMessage?.content)) {
    const animations = Array.isArray(animationNames) && animationNames.length
      ? [animationNames[Math.floor(Math.random() * animationNames.length)]]
      : [];
    return res.status(200).json({ text: OFF_TOPIC_DECLINE, animations });
  }

  try {
    const text = await getReply(apiKey, systemPrompt, messages);

    // Only bother with the second call if we actually got a reply and a
    // usable animation list.
    const animations = text ? await getAnimations(apiKey, text, animationNames) : [];

    return res.status(200).json({ text, animations });
  } catch (err) {
    console.error('Proxy error:', err.status || '', err.raw || err.message || err);
    return res.status(502).json({
      status: err.status || 500,
      error: err.raw || 'Something went wrong contacting the model.'
    });
  }
}
