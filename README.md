# Wayfinder — Setup Guide

A minimal, memory-free conversational companion, with Merlin (via Clippy.js) as an
animated on-screen character. Front end on GitHub Pages, a one-file serverless proxy on
Vercel keeps your Gemini API key hidden.

## What's inside
- **Chat**: powered by Gemini 2.5 Flash, called through your own Vercel proxy so the key
  never reaches the browser.
- **Merlin**: loaded via Clippy.js from a public CDN. The app asks Merlin for his full
  list of built-in animations at runtime and gives that exact list to Gemini, so the
  model picks animation cues (`[[AnimationName]]`) that fit the tone of its own reply.
- **Speech**: replies are also spoken aloud using the browser's built-in Web Speech API
  (`agent.speak(text, { tts: true })`). Voice quality depends entirely on the visitor's
  browser/OS — some sound natural, some robotic, and a few browsers may not support it
  at all, in which case Merlin just shows the text bubble.
- **Wandering**: every 9–18 seconds, if no reply is in progress, Merlin repositions
  himself to a random spot on screen (avoiding the input box) with a smooth CSS
  transition. Wandering automatically pauses while he's thinking/speaking and resumes
  right after, so it never interrupts the conversation.

## 1. Get a free Gemini API key
1. Go to https://aistudio.google.com/apikey
2. Create a free API key (no billing required for the free tier).
3. Copy it — you'll paste it into Vercel, never into the HTML.

## 2. Deploy the proxy on Vercel
1. Push this whole folder to a GitHub repo (or just the repo root — Vercel only needs
   `api/chat.js` and `vercel.json`).
2. Go to https://vercel.com → New Project → import that repo.
3. In the project's Settings → Environment Variables, add:
   - Key: `GEMINI_API_KEY`
   - Value: (the key from step 1)
4. Deploy. Vercel will give you a URL like `https://your-project.vercel.app`.
5. Your live endpoint is `https://your-project.vercel.app/api/chat`.

## 3. Point the front end at your proxy
In `index.html`, find this line near the top of the `<script>` block:

```js
const API_ENDPOINT = "https://YOUR-VERCEL-PROJECT.vercel.app/api/chat";
```

Replace it with your real Vercel URL from step 2.

## 4. Deploy the front end on GitHub Pages
1. Push `index.html` to a GitHub repo (can be the same repo or a different one — GitHub
   Pages only looks at this file, not the `api/` folder).
2. Repo Settings → Pages → Source → deploy from the `main` branch, root folder.
3. GitHub will give you a URL like `https://yourusername.github.io/wayfinder/`.

## Notes on privacy & scope
- No accounts, no database, no cookies, no localStorage.
- Conversation history lives only in the browser tab's JavaScript memory and is gone on
  refresh or close.
- The Vercel function does not log message content — only generic errors if something
  fails.
- Your Gemini key lives only in Vercel's environment variables; it is never sent to the
  browser.
- Merlin's character assets and animation engine load from a public CDN
  (`cdn.jsdelivr.net/npm/clippyjs`) at page load — this is a read-only asset fetch, not
  a service that receives your conversation data.
- The free Gemini tier has rate limits shared across everyone using this deployed page.
  If it's shared widely and gets heavy use, you may hit those limits — Google's docs
  describe current quotas at https://ai.google.dev/gemini-api/docs/rate-limits.

## If Merlin doesn't appear
- Open the browser console (F12) — Clippy.js occasionally has CDN hiccups; a failed
  import will show there.
- TTS speech requires the page to be interacted with first in some browsers (autoplay
  policies) — clicking into the input box before sending your first message helps.
