// node:sqlite is built-in to Node 22+, no external deps needed
process.removeAllListeners('warning');
const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs   = require('fs');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'game.db');
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL');

// ── Games ──────────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS games (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    slug            TEXT UNIQUE NOT NULL,
    name            TEXT NOT NULL,
    admin_password  TEXT NOT NULL,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Seed the default Levi game (id=1) — all existing data belongs to it
db.exec(`
  INSERT OR IGNORE INTO games (id, slug, name, admin_password)
  VALUES (1, 'levi', 'נחש לביא', 'admin123');
`);

// ── Characters ─────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS characters (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id     INTEGER NOT NULL DEFAULT 1,
    name        TEXT NOT NULL,
    image_path  TEXT NOT NULL,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);
// Migration: add game_id column to existing table (no-op if already present)
try { db.exec('ALTER TABLE characters ADD COLUMN game_id INTEGER NOT NULL DEFAULT 1;'); } catch (_) {}

// ── Rooms ──────────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS rooms (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id             INTEGER NOT NULL DEFAULT 1,
    code                TEXT UNIQUE NOT NULL,
    player1_id          TEXT,
    player2_id          TEXT,
    player1_name        TEXT,
    player2_name        TEXT,
    characters          TEXT,
    player1_secret_id   INTEGER,
    player2_secret_id   INTEGER,
    status              TEXT DEFAULT 'waiting',
    winner              TEXT,
    created_at          DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);
try { db.exec('ALTER TABLE rooms ADD COLUMN game_id INTEGER NOT NULL DEFAULT 1;'); } catch (_) {}

// ── Per-game player stats ──────────────────────────────────────────────
// Replaces the old global `users` table.
// (game_id, username) is the natural key — same name in different games = separate records.
db.exec(`
  CREATE TABLE IF NOT EXISTS game_players (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id     INTEGER NOT NULL DEFAULT 1,
    username    TEXT NOT NULL,
    wins        INTEGER DEFAULT 0,
    losses      INTEGER DEFAULT 0,
    games       INTEGER DEFAULT 0,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(game_id, username)
  );
`);

// One-time migration: copy old `users` table → game_players (game_id=1)
try {
  const oldUsers = db.prepare('SELECT * FROM users').all();
  const ins = db.prepare(`
    INSERT OR IGNORE INTO game_players (game_id, username, wins, losses, games, created_at)
    VALUES (1, ?, ?, ?, ?, ?)
  `);
  for (const u of oldUsers) ins.run(u.username, u.wins || 0, u.losses || 0, u.games || 0, u.created_at);
} catch (_) {}

module.exports = db;
