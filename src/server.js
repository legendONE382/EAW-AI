require('dotenv').config();

const express = require('express');
const fs = require('fs/promises');
const path = require('path');
const {
  initDatabase,
  ensureStore,
  createConversation,
  addMessage,
} = require('./db');

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

const FALLBACK_REPLY = "Sorry, I couldn't process that right now.";
const STORES_DIR = path.join(__dirname, '..', 'stores');

function classifyIntent(message) {
  const normalized = String(message || '').toLowerCase();

  if (normalized.includes('where is my order')) {
    return 'order_status';
  }

  if (normalized.includes('refund')) {
    return 'refund_request';
  }

  if (normalized.includes('shipping')) {
    return 'shipping_info';
  }

  return 'general_support';
}

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
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

function formatStoreContext(storeConfig, faqEntries) {
  const faqContext = faqEntries.length
    ? faqEntries
        .map((item, index) => {
          const question = item?.q ?? '';
          const answer = item?.a ?? '';
          return `${index + 1}. Q: ${question}\n   A: ${answer}`;
        })
        .join('\n')
    : 'No FAQ entries provided.';

  const policyContext = typeof storeConfig.policy === 'string' && storeConfig.policy.trim()
    ? storeConfig.policy.trim()
    : 'No policy provided.';

  return `Store policy:\n${policyContext}\n\nStore FAQ:\n${faqContext}`;
}

async function loadStoreConfig(storeId) {
  const sanitizedStoreId = String(storeId).trim();

  if (!/^[a-zA-Z0-9_-]+$/.test(sanitizedStoreId)) {
    throw new Error('Invalid storeId format. Use only letters, numbers, underscores, or hyphens.');
  }

  const storePath = path.join(STORES_DIR, `${sanitizedStoreId}.json`);
  const fileContent = await fs.readFile(storePath, 'utf-8');
  const config = JSON.parse(fileContent);

  if (!config || typeof config.apiKey !== 'string' || !config.apiKey.trim()) {
    throw new Error('Store config missing apiKey.');
  }

  return config;
}

async function loadStoreFaq(storeId) {
  const sanitizedStoreId = String(storeId).trim();
  const faqPath = path.join(STORES_DIR, `${sanitizedStoreId}.faq.json`);
  const fileContent = await fs.readFile(faqPath, 'utf-8');
  const parsed = JSON.parse(fileContent);
  const faqEntries = Array.isArray(parsed.faq) ? parsed.faq : [];

  return faqEntries;
}

async function authenticateStoreRequest(req, res, next) {
  const { storeId } = req.body || {};
  const apiKey = req.header('x-api-key');

  if (typeof storeId !== 'string' || !storeId.trim()) {
    return res.status(400).json({
      error: 'Invalid input. Expected storeId: string with a non-empty value.',
    });
  }

  if (!apiKey) {
    return res.status(401).json({
      error: 'Missing x-api-key header.',
    });
  }

  try {
    const storeConfig = await loadStoreConfig(storeId);

    if (apiKey !== storeConfig.apiKey) {
      return res.status(403).json({
        error: 'Invalid API key for this store.',
      });
    }

    req.storeId = storeId.trim();
    req.storeConfig = storeConfig;
    return next();
  } catch (error) {
    return res.status(400).json({
      error: `Unable to load store config for storeId "${storeId}".`,
    });
  }
}

async function generateSupportReply(message, storeConfig, faqEntries) {
  const apiKey = process.env.MISTRAL_API_KEY;

  if (!apiKey) {
    throw new Error('MISTRAL_API_KEY is not set');
  }

  const intent = classifyIntent(message);
  const faqMatch = findFaqMatch(message, faqEntries);
  const storeContext = formatStoreContext(storeConfig, faqEntries);

  const structuredRules = [
    '1) Use store-specific FAQ and policy first.',
    '2) If a matching FAQ exists, prioritize that answer.',
    '3) If no FAQ match exists, reason from store policy and question intent.',
    '4) Keep response short (max 3-5 sentences), polite, and customer-friendly.',
  ].join('\n');

  const diagnosticContext = [
    `Intent: ${intent}`,
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
          content: diagnosticContext,
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

app.post('/chat', authenticateStoreRequest, async (req, res) => {
  const { message } = req.body || {};
  const storeId = req.storeId;
  const storeConfig = req.storeConfig;

  if (typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({
      error: 'Invalid input. Expected { message: string } with a non-empty message.',
    });
  }

  let faqEntries = [];
  try {
    faqEntries = await loadStoreFaq(storeId);
  } catch (error) {
    return res.status(400).json({
      error: `Unable to load FAQ file for storeId "${storeId}".`,
    });
  }

  let conversationId;
  const cleanMessage = message.trim();

  try {
    await ensureStore(storeId);
    conversationId = await createConversation(storeId);
    await addMessage(conversationId, 'user', cleanMessage);
  } catch (error) {
    console.error('Failed to persist user message:', error.message);
  }

  try {
    const reply = await generateSupportReply(cleanMessage, storeConfig, faqEntries);

    try {
      if (conversationId) {
        await addMessage(conversationId, 'ai', reply);
      }
    } catch (error) {
      console.error('Failed to persist ai message:', error.message);
    }

    return res.json({ reply });
  } catch (error) {
    console.error('Failed to generate response:', error.message);
    return res.json({ reply: FALLBACK_REPLY });
  }
});

initDatabase()
  .then(() => {
    app.listen(port, () => {
      console.log(`EAW AI support API listening on port ${port}`);
    });
  })
  .catch((error) => {
    console.error('Failed to initialize database:', error.message);
    process.exit(1);
  });
