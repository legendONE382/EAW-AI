require('dotenv').config();

const express = require('express');

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

const FALLBACK_REPLY = "Sorry, I couldn't process that right now.";

async function generateSupportReply(message) {
  const apiKey = process.env.MISTRAL_API_KEY;

  if (!apiKey) {
    throw new Error('MISTRAL_API_KEY is not set');
  }

  const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'mistral-tiny',
      temperature: 0.3,
      messages: [
        {
          role: 'system',
          content:
            'You are a customer support agent for an ecommerce store. Be polite, short, and helpful. Focus on resolving common support issues clearly.',
        },
        {
          role: 'user',
          content: message,
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Mistral API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const reply = data?.choices?.[0]?.message?.content?.trim();

  if (!reply) {
    throw new Error('No reply returned from Mistral API');
  }

  return reply;
}

app.post('/chat', async (req, res) => {
  const { message } = req.body || {};

  if (typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({
      error: 'Invalid input. Expected { message: string } with a non-empty message.',
    });
  }

  try {
    const reply = await generateSupportReply(message.trim());
    return res.json({ reply });
  } catch (error) {
    console.error('Failed to generate response:', error.message);
    return res.json({ reply: FALLBACK_REPLY });
  }
});

app.listen(port, () => {
  console.log(`EAW AI support API listening on port ${port}`);
});
