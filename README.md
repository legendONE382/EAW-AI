# EAW AI Customer Support Agent API

A Node.js + Express backend API for handling ecommerce customer support chat requests using Mistral.

## File structure

```
.
├── .env.example
├── package.json
├── README.md
├── stores
│   ├── demo-store.faq.json
│   └── demo-store.json
├── src
│   ├── db.js
│   └── server.js
└── your-widget.js
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

## Multi-store files

Each store has two files:

### `stores/{storeId}.json`

```json
{
  "name": "Demo Store",
  "apiKey": "demo-store-secret-key",
  "policy": "Returns accepted within 14 days"
}
```

### `stores/{storeId}.faq.json`

```json
{
  "faq": [
    { "q": "shipping time", "a": "We deliver in 3-5 days" }
  ]
}
```

## Run

```bash
npm start
```

Server starts on `http://localhost:3000` by default.

## Endpoint

### `POST /chat`

Headers:

- `x-api-key: <store api key>`

Body:

```json
{ "storeId": "demo-store", "message": "How long does shipping take?" }
```

Output:

```json
{ "reply": "..." }
```

## SQLite persistence

The backend creates `data/app.db` automatically and stores:

- `stores(id, name)`
- `conversations(id, storeId)`
- `messages(id, conversationId, sender, text, timestamp)`
