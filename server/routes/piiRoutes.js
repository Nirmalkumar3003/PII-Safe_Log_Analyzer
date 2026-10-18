import express from 'express';
import { detectAndMaskPii, analyzeWithLLM } from '../services/piiDetector.js';

const router = express.Router();

/**
 * POST /analyze
 * Detects PII and returns masked + metadata
 */
router.post('/analyze', (req, res) => {
  const { message } = req.body;

  if (!message || !message.trim()) {
    return res.status(400).json({ error: 'Log text is required' });
  }

  const result = detectAndMaskPii(message);
  res.json(result);
});

/**
 * POST /chat
 * Streams LLM response back to client
 */
router.post('/chat', async (req, res) => {
  const { maskedMessage } = req.body;

  if (!maskedMessage || !maskedMessage.trim()) {
    return res.status(400).json({ error: 'Masked log text is required' });
  }

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');

  try {
    const stream = await analyzeWithLLM(maskedMessage);

    for await (const chunk of stream) {
      res.write(
        typeof chunk === 'string'
          ? chunk
          : chunk.message?.content || ''
      );
    }

    res.end();
  } catch (err) {
    console.error('LLM stream error:', err);
    res.status(500).send('LLM analysis failed');
  }
});

export default router;
