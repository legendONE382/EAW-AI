require('dotenv').config();

const express = require('express');
const fs = require('fs/promises');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

const FALLBACK_REPLY = "Sorry, I couldn't process that right now.";
const STORES_DIR = path.join(__dirname, '..', 'stores');

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function detectIntent(message) {
  const text = normalizeText(message);

  if (/\b(hi|hello|hey|good morning|good afternoon|good evening)\b/.test(text)) {
    return 'general greeting';
  }

  if (/\b(order|track|tracking|where is my order|order status|arrive)\b/.test(text)) {
    return 'order status';
  }

  if (/\b(shipping|ship|delivery|deliver|shipment)\b/.test(text)) {
    return 'shipping';
  }

  if (/\b(refund|return|money back|cancel|exchange)\b/.test(text)) {
    return 'refund';
  }

  if (/\b(size|material|color|stock|available|feature|warranty|spec)\b/.test(text)) {
    return 'product question';
  }

  return 'unclear';
}

function findFaqMatch(message, faqEntries) {
  const normalizedMessage = normalizeText(message);

  return faqEntries.find((item) => {
    const normalizedQuestion = normalizeText(item?.q || '');

    if (!normalizedQuestion) return false;

    return (
      normalizedMessage.includes(normalizedQuestion) ||
      normalizedQuestion.includes(normalizedMessage)
    );
  });
}

function formatStoreContext(storeData) {
  const faqEntries = Array.isArray(storeData.faq) ? storeData.faq : [];

  const faqContext = faqEntries.length
    ? faqEntries
        .map((item, index) => {
          const question = item?.q ?? '';
          const answer = item?.a ?? '';
          return `${index + 1}. Q: ${question}\n   A: ${answer}`;
        })
        .join('\n')
    : 'No FAQ entries provided.';

  const policyContext = typeof storeData.policy === 'string' && storeData.policy.trim()
    ? storeData.policy.trim()
    : 'No policy provided.';

  return `Store policy:\n${policyContext}\n\nStore FAQ:\n${faqContext}`;
}

async function loadStoreData(storeId) {
  const sanitizedStoreId = String(storeId).trim();

  if (!/^[a-zA-Z0-9_-]+$/.test(sanitizedStoreId)) {
    throw new Error('Invalid storeId format. Use only letters, numbers, underscores, or hyphens.');
  }

  const storePath = path.join(STORES_DIR, `${sanitizedStoreId}.json`);
  const fileContent = await fs.readFile(storePath, 'utf-8');
  return JSON.parse(fileContent);
}

async function generateSupportReply(message, storeData) {
  const apiKey = process.env.MISTRAL_API_KEY;

  if (!apiKey) {
    throw new Error('MISTRAL_API_KEY is not set');
  }

  const faqEntries = Array.isArray(storeData.faq) ? storeData.faq : [];
  const detectedIntent = detectIntent(message);
  const faqMatch = findFaqMatch(message, faqEntries);
  const storeContext = formatStoreContext(storeData);

  const structuredRules = [
    '1) Detect and follow intent: order status, shipping, refund, product question, or general greeting.',
    '2) If the user question matches an FAQ entry, prioritize that FAQ answer first.',
    '3) If no FAQ match exists, use AI reasoning grounded in store policy and context.',
    '4) If the request is unclear, ask a short clarification question.',
    '5) Keep response short (max 3-5 sentences), customer-friendly, and avoid unnecessary explanation.',
  ].join('\n');

  const diagnosticContext = [
    `Detected intent: ${detectedIntent}`,
    faqMatch
      ? `FAQ match found:\nQ: ${faqMatch.q}\nA: ${faqMatch.a}`
      : 'FAQ match found: none',
  ].join('\n\n');

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
            'You are a customer support agent for an ecommerce store. Always be polite, concise, and helpful.',
        },
        {
          role: 'system',
          content: `Behavior rules:\n${structuredRules}`,
        },
        {
          role: 'system',
          content: `Store knowledge:\n${storeContext}`,
        },
        {
          role: 'system',
          content: `Analysis context:\n${diagnosticContext}`,
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
  const { message, storeId } = req.body || {};

  if (typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({
      error: 'Invalid input. Expected { message: string } with a non-empty message.',
    });
  }

  if (typeof storeId !== 'string' || !storeId.trim()) {
    return res.status(400).json({
      error: 'Invalid input. Expected storeId: string with a non-empty value.',
    });
  }

  let storeData;
  try {
    storeData = await loadStoreData(storeId);
  } catch (error) {
    return res.status(400).json({
      error: `Unable to load store data for storeId "${storeId}".`,
    });
  }

  try {
    const reply = await generateSupportReply(message.trim(), storeData);
    return res.json({ reply });
  } catch (error) {
    console.error('Failed to generate response:', error.message);
    return res.json({ reply: FALLBACK_REPLY });
  }
});

app.listen(port, () => {
  console.log(`EAW AI support API listening on port ${port}`);
});
