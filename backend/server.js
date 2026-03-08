// server.js — tiny Express proxy for Pollinations text API
// Run with: node server.js  (or: nodemon server.js)
// Requires: npm install express cors node-fetch

import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: ['http://localhost:5173', 'http://localhost:3000'] }));
app.use(express.json());

// ── Pollinations text proxy ──────────────────────────────
app.get('/api/generate-text', async (req, res) => {
  const { prompt } = req.query;

  if (!prompt) {
    return res.status(400).json({ error: 'Missing prompt query param' });
  }

  try {
    const url = `https://text.pollinations.ai/${encodeURIComponent(prompt)}`;
    console.log('[Proxy] Fetching:', url);

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; NumeraAI/1.0)',
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      throw new Error(`Pollinations returned ${response.status}`);
    }

    const text = await response.text();

    if (
      text.includes('IMPORTANT NOTICE') ||
      text.includes('deprecated') ||
      text.trim().length < 20
    ) {
      throw new Error('Pollinations returned invalid/empty content');
    }

    res.json({ text: text.trim() });
  } catch (err) {
    console.error('[Proxy] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Pollinations image proxy ─────────────────────────────
app.get('/api/generate-image', async (req, res) => {
  const { prompt, width = '512', height = '512', seed } = req.query;

  if (!prompt) {
    return res.status(400).json({ error: 'Missing prompt query param' });
  }

  try {
    const params = new URLSearchParams({
      width, height, nologo: 'true', model: 'flux',
      ...(seed ? { seed } : { seed: String(Date.now()) }),
    });
    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?${params}`;
    console.log('[Proxy] Fetching image:', url);

    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NumeraAI/1.0)' },
      signal: AbortSignal.timeout(30000), // images take longer
    });

    if (!response.ok) {
      throw new Error(`Pollinations image returned ${response.status}`);
    }

    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const buffer = await response.arrayBuffer();

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(Buffer.from(buffer));
  } catch (err) {
    console.error('[Proxy] Image error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Health check ─────────────────────────────────────────
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => {
  console.log(`✅ Proxy server running at http://localhost:${PORT}`);
});