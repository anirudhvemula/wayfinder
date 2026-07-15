// Vercel serverless function: /api/chat
// Holds the Gemini API key server-side (set as GEMINI_API_KEY env var in Vercel).
// Receives { systemPrompt, messages } from the browser, calls Gemini, returns the reply.
// Stateless: no logging, no storage, no database. Each request stands alone.

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

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Server is missing GEMINI_API_KEY.' });
  }

  const { systemPrompt, messages } = req.body || {};

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages array is required' });
  }

  // Gemini uses "user"/"model" roles and a top-level systemInstruction.
  const contents = messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }]
  }));

  const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  try {
    const geminiResponse = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        systemInstruction: systemPrompt
          ? { parts: [{ text: systemPrompt }] }
          : undefined,
        generationConfig: {
          maxOutputTokens: 400,
          temperature: 0.9
        }
      })
    });

    if (!geminiResponse.ok) {
      const errText = await geminiResponse.text();
      console.error('Gemini API error:', geminiResponse.status, errText);
      return res.status(502).json({ error: 'Upstream model error' });
    }

    const data = await geminiResponse.json();
    const text =
      data?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';

    return res.status(200).json({ text });
  } catch (err) {
    console.error('Proxy error:', err);
    return res.status(500).json({ error: 'Something went wrong contacting the model.' });
  }
}
