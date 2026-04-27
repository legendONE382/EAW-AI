const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'app.db');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const db = new sqlite3.Database(DB_PATH);

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(err) {
      if (err) return reject(err);
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

async function initDatabase() {
  await run(`
    CREATE TABLE IF NOT EXISTS stores (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      storeId TEXT NOT NULL,
      FOREIGN KEY (storeId) REFERENCES stores(id)
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversationId INTEGER NOT NULL,
      sender TEXT NOT NULL,
      text TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      FOREIGN KEY (conversationId) REFERENCES conversations(id)
    )
  `);
}

async function ensureStore(storeId) {
  const existing = await get('SELECT id FROM stores WHERE id = ?', [storeId]);
  if (existing) return;

  await run('INSERT INTO stores (id, name) VALUES (?, ?)', [storeId, storeId]);
}

async function createConversation(storeId) {
  const result = await run('INSERT INTO conversations (storeId) VALUES (?)', [storeId]);
  return result.lastID;
}

async function addMessage(conversationId, sender, text) {
  const timestamp = new Date().toISOString();
  await run(
    'INSERT INTO messages (conversationId, sender, text, timestamp) VALUES (?, ?, ?, ?)',
    [conversationId, sender, text, timestamp]
  );
}

module.exports = {
  initDatabase,
  ensureStore,
  createConversation,
  addMessage,
};
