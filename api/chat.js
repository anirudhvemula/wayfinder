// Vercel serverless function: /api/chat
// Holds the Groq API key server-side (set as GROQ_API_KEY env var in Vercel).
// Receives { systemPrompt, messages } from the browser, calls Groq, returns the reply.
// Stateless: no logging of content, no storage, no database. Each request stands alone.

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

  const { systemPrompt, messages } = req.body || {};

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages array is required' });
  }

  // Groq uses the OpenAI-style chat format: an array of {role, content},
  // with "system" as a normal message at the front instead of a separate field.
  const chatMessages = [
    ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
    ...messages.map((m) => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content
    }))
  ];

  const MODEL = 'llama-3.3-70b-versatile';

  const groqUrl = 'https://api.groq.com/openai/v1/chat/completions';

  try {
    const groqResponse = await fetch(groqUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: MODEL,
        messages: chatMessages,
        max_tokens: 400,
        temperature: 0.9
      })
    });

    if (!groqResponse.ok) {
      const errText = await groqResponse.text();

      console.error('Groq API error:', groqResponse.status, errText);

      return res.status(502).json({
        status: groqResponse.status,
        error: errText
      });
    }

    const data = await groqResponse.json();
    const text = data?.choices?.[0]?.message?.content || '';

    return res.status(200).json({ text });
  } catch (err) {
    console.error('Proxy error:', err);
    return res.status(500).json({ error: 'Something went wrong contacting the model.' });
  }
}
