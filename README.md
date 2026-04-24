# EAW AI Customer Support Agent API

A Node.js + Express backend API for handling ecommerce customer support chat requests using Mistral.

## File structure

```
.
├── .env.example
├── package.json
├── README.md
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

## Run

```bash
npm start
```

Server starts on `http://localhost:3000` by default.

## Endpoint

### `POST /chat`

**Input**

```json
{ "message": "Where is my order?" }
```

**Output**

```json
{ "reply": "..." }
```

If the Mistral API call fails for any reason, the API returns:

```json
{ "reply": "Sorry, I couldn't process that right now." }
```
