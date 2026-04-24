# EAW AI Customer Support Agent API

A Node.js + Express backend API for handling ecommerce customer support chat requests using Mistral.

## File structure

```
.
├── .env.example
├── package.json
├── README.md
├── stores
│   └── demo-store.json
└── src
    └── server.js
```

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Create your env file:
   ```bash
   cp .env.example .env
   ```
3. Add your Mistral API key to `.env`:
   ```env
   MISTRAL_API_KEY=your_real_key
   ```
4. Add store knowledge files to `stores/{storeId}.json`.

## Store knowledge format

Each store file must follow this structure:

```json
{
  "faq": [
    { "q": "shipping time", "a": "We deliver in 3-5 days" }
  ],
  "policy": "Returns accepted within 14 days"
}
```

## Run

```bash
npm start
```

Server starts on `http://localhost:3000` by default.

## Endpoint

### `POST /chat`

**Input**

```json
{ "storeId": "demo-store", "message": "How long does shipping take?" }
```

**Output**

```json
{ "reply": "..." }
```

### Behavior

- The API loads store knowledge from `stores/{storeId}.json`.
- FAQ + policy are injected into the Mistral prompt.
- The model is instructed to prioritize store-specific info before general knowledge.
- If Mistral fails, the API returns:

```json
{ "reply": "Sorry, I couldn't process that right now." }
```
