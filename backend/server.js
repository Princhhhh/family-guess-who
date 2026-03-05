// Suppress experimental SQLite warning (node:sqlite is built-in to Node 22+)
process.removeAllListeners('warning');
process.on('warning', (w) => { if (w.name !== 'ExperimentalWarning') console.warn(w) });

const express = require('express');
const http    = require('http');
const { Server } = require('socket.io');
const cors    = require('cors');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const { v4: uuidv4 } = require('uuid');
const db      = require('./database');

const app    = express();
const server = http.createServer(app);

const FRONTEND_URL         = process.env.FRONTEND_URL || 'http://localhost:5173';
const SUPER_ADMIN_PASSWORD = process.env.SUPER_ADMIN_PASSWORD || 'super123';

const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

app.use(cors());
app.use(express.json());

// Uploads directory
const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
app.use('/uploads', express.static(UPLOADS_DIR));

// Multer config
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename:    (req, file, cb) => { const ext = path.extname(file.originalname); cb(null, `${uuidv4()}${ext}`); }
});
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp/;
    if (allowed.test(path.extname(file.originalname).toLowerCase()) && allowed.test(file.mimetype)) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  },
  limits: { fileSize: 10 * 1024 * 1024 }
});

// ─────────────────────────────────────────────────────────────────────────
// AUTH MIDDLEWARES
// ─────────────────────────────────────────────────────────────────────────

// Legacy admin auth (game_id=1 / levi) — kept for backward compat
const adminAuth = (req, res, next) => {
  const pw = req.headers['x-admin-password'] || req.body?.password || req.query?.password;
  if (pw === 'admin123') return next();
  res.status(401).json({ error: 'Unauthorized' });
};

// Super-admin auth
const superAdminAuth = (req, res, next) => {
  const pw = req.headers['x-super-password'] || req.body?.superPassword;
  if (pw === SUPER_ADMIN_PASSWORD) return next();
  res.status(401).json({ error: 'Unauthorized' });
};

// Resolve game from :slug param and attach to req.game
const resolveGame = (req, res, next) => {
  const game = db.prepare('SELECT * FROM games WHERE slug = ?').get(req.params.slug);
  if (!game) return res.status(404).json({ error: 'משחק לא נמצא' });
  req.game = game;
  next();
};

// Game-specific admin auth (checks against the game's stored password)
const gameAdminAuth = (req, res, next) => {
  const pw = req.headers['x-admin-password'] || req.body?.password || req.query?.password;
  if (pw === req.game.admin_password) return next();
  res.status(401).json({ error: 'Unauthorized' });
};

// ─────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────

function generateCode() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function upsertPlayer(gameId, username) {
  if (!username?.trim()) return;
  db.prepare(`
    INSERT INTO game_players (game_id, username, games) VALUES (?, ?, 1)
    ON CONFLICT(game_id, username) DO UPDATE SET games = games + 1
  `).run(gameId, username.trim());
}

// Backward compat wrapper (levi game = id 1)
function upsertUser(username) { upsertPlayer(1, username); }

// ─────────────────────────────────────────────────────────────────────────
// SUPER-ADMIN ROUTES
// ─────────────────────────────────────────────────────────────────────────

app.post('/api/super/login', (req, res) => {
  const { superPassword } = req.body;
  if (superPassword === SUPER_ADMIN_PASSWORD) return res.json({ success: true });
  res.status(401).json({ error: 'סיסמה שגויה' });
});

// List all games with player/room stats
app.get('/api/super/games', superAdminAuth, (req, res) => {
  const games = db.prepare('SELECT * FROM games ORDER BY created_at DESC').all();
  const result = games.map(g => {
    const charCount  = db.prepare('SELECT COUNT(*) as c FROM characters WHERE game_id = ?').get(g.id).c;
    const roomCount  = db.prepare("SELECT COUNT(*) as c FROM rooms WHERE game_id = ? AND status = 'finished'").get(g.id).c;
    const playerCount= db.prepare('SELECT COUNT(*) as c FROM game_players WHERE game_id = ?').get(g.id).c;
    return { ...g, admin_password: undefined, charCount, roomCount, playerCount };
  });
  res.json(result);
});

// Create new game
app.post('/api/super/games', superAdminAuth, (req, res) => {
  const { slug, name, adminPassword } = req.body;
  if (!slug || !name || !adminPassword)
    return res.status(400).json({ error: 'slug, name, adminPassword הם שדות חובה' });
  if (!/^[a-z0-9-]+$/.test(slug))
    return res.status(400).json({ error: 'slug חייב להכיל רק אותיות לועזיות, ספרות ומקפים' });
  try {
    const r = db.prepare('INSERT INTO games (slug, name, admin_password) VALUES (?, ?, ?)').run(slug, name, adminPassword);
    const game = db.prepare('SELECT * FROM games WHERE id = ?').get(r.lastInsertRowid);
    res.json({ ...game, admin_password: undefined });
  } catch (e) {
    if (e.message?.includes('UNIQUE')) return res.status(400).json({ error: 'Slug כבר קיים' });
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

// Change admin password for a game
app.patch('/api/super/games/:slug/password', superAdminAuth, (req, res) => {
  const { password } = req.body;
  if (!password || password.length < 3)
    return res.status(400).json({ error: 'סיסמה חייבת להיות לפחות 3 תווים' });
  const r = db.prepare('UPDATE games SET admin_password = ? WHERE slug = ?').run(password, req.params.slug);
  if (r.changes === 0) return res.status(404).json({ error: 'משחק לא נמצא' });
  res.json({ success: true });
});

// Delete a game and all its data
app.delete('/api/super/games/:slug', superAdminAuth, (req, res) => {
  const game = db.prepare('SELECT * FROM games WHERE slug = ?').get(req.params.slug);
  if (!game) return res.status(404).json({ error: 'משחק לא נמצא' });
  db.prepare('DELETE FROM characters  WHERE game_id = ?').run(game.id);
  db.prepare('DELETE FROM rooms       WHERE game_id = ?').run(game.id);
  db.prepare('DELETE FROM game_players WHERE game_id = ?').run(game.id);
  db.prepare('DELETE FROM games       WHERE id = ?').run(game.id);
  res.json({ success: true });
});

// Public: list games (for landing page — no passwords)
app.get('/api/games', (req, res) => {
  const games = db.prepare('SELECT id, slug, name, created_at FROM games ORDER BY created_at ASC').all();
  res.json(games);
});

// ─────────────────────────────────────────────────────────────────────────
// LEGACY ADMIN ROUTES  (game_id=1 / levi — backward compat)
// ─────────────────────────────────────────────────────────────────────────

app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  if (password === 'admin123') return res.json({ success: true });
  res.status(401).json({ error: 'סיסמה שגויה' });
});
app.get('/api/admin/characters',           adminAuth, (req, res) => {
  res.json(db.prepare('SELECT * FROM characters WHERE game_id = 1 ORDER BY created_at DESC').all());
});
app.post('/api/admin/characters',          adminAuth, upload.single('image'), (req, res) => {
  const { name } = req.body;
  if (!name || !req.file) return res.status(400).json({ error: 'שם ותמונה הם שדות חובה' });
  const imagePath = `/uploads/${req.file.filename}`;
  const result = db.prepare('INSERT INTO characters (game_id, name, image_path) VALUES (1, ?, ?)').run(name, imagePath);
  res.json(db.prepare('SELECT * FROM characters WHERE id = ?').get(result.lastInsertRowid));
});
app.delete('/api/admin/characters/:id',    adminAuth, (req, res) => {
  const char = db.prepare('SELECT * FROM characters WHERE id = ? AND game_id = 1').get(req.params.id);
  if (!char) return res.status(404).json({ error: 'דמות לא נמצאה' });
  const filePath = path.join(UPLOADS_DIR, path.basename(char.image_path));
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  db.prepare('DELETE FROM characters WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});
app.get('/api/characters/count', (req, res) => {
  res.json(db.prepare('SELECT COUNT(*) as count FROM characters WHERE game_id = 1').get());
});
app.get('/api/leaderboard', (req, res) => {
  res.json(db.prepare(`
    SELECT username, wins, losses, games FROM game_players
    WHERE games > 0 AND game_id = 1
    ORDER BY wins DESC, losses ASC, games ASC LIMIT 20
  `).all());
});

// ─────────────────────────────────────────────────────────────────────────
// GAME-SCOPED ROUTES  /api/g/:slug/…
// ─────────────────────────────────────────────────────────────────────────

// Game info (public)
app.get('/api/g/:slug', resolveGame, (req, res) => {
  const { id, slug, name } = req.game;
  const charCount = db.prepare('SELECT COUNT(*) as c FROM characters WHERE game_id = ?').get(id).c;
  res.json({ id, slug, name, charCount });
});

// Game admin login
app.post('/api/g/:slug/admin/login', resolveGame, (req, res) => {
  const { password } = req.body;
  if (password === req.game.admin_password) return res.json({ success: true });
  res.status(401).json({ error: 'סיסמה שגויה' });
});

// Characters
app.get('/api/g/:slug/admin/characters', resolveGame, gameAdminAuth, (req, res) => {
  res.json(db.prepare('SELECT * FROM characters WHERE game_id = ? ORDER BY created_at DESC').all(req.game.id));
});
app.post('/api/g/:slug/admin/characters', resolveGame, gameAdminAuth, upload.single('image'), (req, res) => {
  const { name } = req.body;
  if (!name || !req.file) return res.status(400).json({ error: 'שם ותמונה הם שדות חובה' });
  const imagePath = `/uploads/${req.file.filename}`;
  const result = db.prepare('INSERT INTO characters (game_id, name, image_path) VALUES (?, ?, ?)').run(req.game.id, name, imagePath);
  res.json(db.prepare('SELECT * FROM characters WHERE id = ?').get(result.lastInsertRowid));
});
app.delete('/api/g/:slug/admin/characters/:id', resolveGame, gameAdminAuth, (req, res) => {
  const char = db.prepare('SELECT * FROM characters WHERE id = ? AND game_id = ?').get(req.params.id, req.game.id);
  if (!char) return res.status(404).json({ error: 'דמות לא נמצאה' });
  const filePath = path.join(UPLOADS_DIR, path.basename(char.image_path));
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  db.prepare('DELETE FROM characters WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});
app.get('/api/g/:slug/characters/count', resolveGame, (req, res) => {
  res.json(db.prepare('SELECT COUNT(*) as count FROM characters WHERE game_id = ?').get(req.game.id));
});

// Leaderboard
app.get('/api/g/:slug/leaderboard', resolveGame, (req, res) => {
  res.json(db.prepare(`
    SELECT username, wins, losses, games FROM game_players
    WHERE games > 0 AND game_id = ?
    ORDER BY wins DESC, losses ASC, games ASC LIMIT 20
  `).all(req.game.id));
});

// Create room
app.post('/api/g/:slug/rooms', resolveGame, (req, res) => {
  const { username } = req.body;
  const gameId = req.game.id;
  const charCount = db.prepare('SELECT COUNT(*) as count FROM characters WHERE game_id = ?').get(gameId).count;
  if (charCount < 24)
    return res.status(400).json({ error: `נדרשות לפחות 24 דמויות. יש כרגע ${charCount}.` });

  let code, attempts = 0;
  do {
    code = generateCode(); attempts++;
    if (attempts > 100) return res.status(500).json({ error: 'לא ניתן ליצור קוד ייחודי' });
  } while (db.prepare("SELECT id FROM rooms WHERE code = ? AND status != 'finished'").get(code));

  const playerId  = uuidv4();
  const playerName = username?.trim() || null;
  const allChars   = db.prepare('SELECT * FROM characters WHERE game_id = ?').all(gameId);
  const selected   = shuffleArray(allChars).slice(0, 24);
  const secret1    = selected[Math.floor(Math.random() * 24)];

  db.prepare(`
    INSERT INTO rooms (game_id, code, player1_id, player1_name, characters, player1_secret_id, status)
    VALUES (?, ?, ?, ?, ?, ?, 'waiting')
  `).run(gameId, code, playerId, playerName, JSON.stringify(selected), secret1.id);

  upsertPlayer(gameId, playerName);
  res.json({ code, playerId, characters: selected, secretCharacter: secret1, playerName });
});

// Join room
app.post('/api/g/:slug/rooms/join', resolveGame, (req, res) => {
  const { code, username } = req.body;
  const gameId = req.game.id;
  const room = db.prepare('SELECT * FROM rooms WHERE code = ? AND game_id = ?').get(code, gameId);
  if (!room)            return res.status(404).json({ error: 'חדר לא נמצא' });
  if (room.status !== 'waiting') return res.status(400).json({ error: 'החדר כבר מלא או הסתיים' });
  if (room.player2_id)  return res.status(400).json({ error: 'החדר כבר מלא' });

  const playerId   = uuidv4();
  const playerName = username?.trim() || null;
  const characters = JSON.parse(room.characters);
  const availableForP2 = characters.filter(c => c.id !== room.player1_secret_id);
  const secret2 = availableForP2[Math.floor(Math.random() * availableForP2.length)];

  db.prepare(`
    UPDATE rooms SET player2_id = ?, player2_name = ?, player2_secret_id = ?, status = 'playing'
    WHERE id = ?
  `).run(playerId, playerName, secret2.id, room.id);

  upsertPlayer(gameId, playerName);

  res.json({ code, playerId, characters, secretCharacter: secret2, opponentName: room.player1_name || null });

  roomTurns[code] = room.player1_id;
  io.to(`room_${code}`).emit('game_started', {
    characters,
    opponentName: playerName,
    firstTurn: room.player1_id,
    message: 'השחקן השני הצטרף! המשחק מתחיל!'
  });
});

// Get room info
app.get('/api/g/:slug/rooms/:code', resolveGame, (req, res) => {
  const room = db.prepare('SELECT * FROM rooms WHERE code = ? AND game_id = ?').get(req.params.code, req.game.id);
  if (!room) return res.status(404).json({ error: 'חדר לא נמצא' });
  res.json({ ...room, characters: JSON.parse(room.characters || '[]') });
});

// ─────────────────────────────────────────────────────────────────────────
// LEGACY ROOM ROUTES  (game_id=1 — backward compat)
// ─────────────────────────────────────────────────────────────────────────

app.post('/api/rooms', (req, res) => {
  const { username } = req.body;
  const charCount = db.prepare('SELECT COUNT(*) as count FROM characters WHERE game_id = 1').get().count;
  if (charCount < 24)
    return res.status(400).json({ error: `נדרשות לפחות 24 דמויות. יש כרגע ${charCount}.` });

  let code, attempts = 0;
  do {
    code = generateCode(); attempts++;
    if (attempts > 100) return res.status(500).json({ error: 'לא ניתן ליצור קוד ייחודי' });
  } while (db.prepare("SELECT id FROM rooms WHERE code = ? AND status != 'finished'").get(code));

  const playerId   = uuidv4();
  const playerName = username?.trim() || null;
  const allChars   = db.prepare('SELECT * FROM characters WHERE game_id = 1').all();
  const selected   = shuffleArray(allChars).slice(0, 24);
  const secret1    = selected[Math.floor(Math.random() * 24)];

  db.prepare(`
    INSERT INTO rooms (game_id, code, player1_id, player1_name, characters, player1_secret_id, status)
    VALUES (1, ?, ?, ?, ?, ?, 'waiting')
  `).run(code, playerId, playerName, JSON.stringify(selected), secret1.id);

  upsertUser(playerName);
  res.json({ code, playerId, characters: selected, secretCharacter: secret1, playerName });
});

app.post('/api/rooms/join', (req, res) => {
  const { code, username } = req.body;
  const room = db.prepare('SELECT * FROM rooms WHERE code = ?').get(code);
  if (!room)            return res.status(404).json({ error: 'חדר לא נמצא' });
  if (room.status !== 'waiting') return res.status(400).json({ error: 'החדר כבר מלא או הסתיים' });
  if (room.player2_id)  return res.status(400).json({ error: 'החדר כבר מלא' });

  const playerId   = uuidv4();
  const playerName = username?.trim() || null;
  const characters = JSON.parse(room.characters);
  const availableForP2 = characters.filter(c => c.id !== room.player1_secret_id);
  const secret2 = availableForP2[Math.floor(Math.random() * availableForP2.length)];

  db.prepare(`
    UPDATE rooms SET player2_id = ?, player2_name = ?, player2_secret_id = ?, status = 'playing' WHERE id = ?
  `).run(playerId, playerName, secret2.id, room.id);

  upsertUser(playerName);
  res.json({ code, playerId, characters, secretCharacter: secret2, opponentName: room.player1_name || null });

  roomTurns[code] = room.player1_id;
  io.to(`room_${code}`).emit('game_started', {
    characters, opponentName: playerName, firstTurn: room.player1_id, message: 'השחקן השני הצטרף! המשחק מתחיל!'
  });
});

app.get('/api/rooms/:code', (req, res) => {
  const room = db.prepare('SELECT * FROM rooms WHERE code = ?').get(req.params.code);
  if (!room) return res.status(404).json({ error: 'חדר לא נמצא' });
  res.json({ ...room, characters: JSON.parse(room.characters || '[]') });
});

// ─────────────────────────────────────────────────────────────────────────
// SOCKET.IO
// ─────────────────────────────────────────────────────────────────────────

const socketToRoom   = {};
const socketToPlayer = {};
const roomTurns      = {};

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('join_room', ({ code, playerId }) => {
    const roomKey = `room_${code}`;
    socket.join(roomKey);
    socketToRoom[socket.id]   = code;
    socketToPlayer[socket.id] = playerId;
    console.log(`Socket ${socket.id} joined room ${code}`);

    // Catch-up: if room is already playing, send game_started to this socket
    const room = db.prepare('SELECT * FROM rooms WHERE code = ?').get(code);
    if (room && room.status === 'playing') {
      const characters   = JSON.parse(room.characters);
      const isPlayer1    = room.player1_id === playerId;
      const opponentName = isPlayer1 ? room.player2_name : room.player1_name;
      const currentTurn  = roomTurns[code] || room.player1_id;
      socket.emit('game_started', { characters, opponentName: opponentName || null, firstTurn: room.player1_id, currentTurn });
      // Tell the other player their opponent reconnected
      socket.to(roomKey).emit('opponent_reconnected');
    }
  });

  socket.on('send_question', ({ code, playerId, question }) => {
    if (roomTurns[code] && roomTurns[code] !== playerId) return;
    socket.to(`room_${code}`).emit('receive_question', { question });
  });

  socket.on('answer_question', ({ code, question, answer }) => {
    io.to(`room_${code}`).emit('question_answered', { question, answer });
    const room = db.prepare('SELECT * FROM rooms WHERE code = ?').get(code);
    if (room) {
      const nextTurn = roomTurns[code] === room.player1_id ? room.player2_id : room.player1_id;
      roomTurns[code] = nextTurn;
      io.to(`room_${code}`).emit('turn_changed', { currentTurn: nextTurn });
    }
  });

  socket.on('make_guess', ({ code, playerId, characterId }) => {
    const room = db.prepare('SELECT * FROM rooms WHERE code = ?').get(code);
    if (!room || room.status === 'finished') return;

    const characters     = JSON.parse(room.characters);
    const isPlayer1      = room.player1_id === playerId;
    const opponentSecretId = isPlayer1 ? room.player2_secret_id : room.player1_secret_id;
    const correct        = Number(opponentSecretId) === Number(characterId);
    const winner         = correct ? playerId : (isPlayer1 ? room.player2_id : room.player1_id);

    db.prepare('UPDATE rooms SET status = ?, winner = ? WHERE code = ?').run('finished', winner, code);

    const gameId     = room.game_id || 1;
    const winnerName = winner === room.player1_id ? room.player1_name : room.player2_name;
    const loserName  = winner === room.player1_id ? room.player2_name : room.player1_name;
    if (winnerName) db.prepare('UPDATE game_players SET wins = wins + 1 WHERE game_id = ? AND username = ?').run(gameId, winnerName);
    if (loserName)  db.prepare('UPDATE game_players SET losses = losses + 1 WHERE game_id = ? AND username = ?').run(gameId, loserName);

    io.to(`room_${code}`).emit('game_over', {
      winner, correct, guesser: playerId,
      guessedCharacter:  characters.find(c => c.id === Number(characterId)),
      correctCharacter:  characters.find(c => c.id === Number(opponentSecretId)),
      winnerName,
    });
  });

  socket.on('disconnect', () => {
    const code = socketToRoom[socket.id];
    if (code) socket.to(`room_${code}`).emit('opponent_disconnected');
    delete socketToRoom[socket.id];
    delete socketToPlayer[socket.id];
    console.log('Client disconnected:', socket.id);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// SERVE FRONTEND (production)
// ─────────────────────────────────────────────────────────────────────────

const PUBLIC_DIR = path.join(__dirname, 'public');
if (fs.existsSync(PUBLIC_DIR)) {
  app.use(express.static(PUBLIC_DIR));
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) return;
    res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
  });
}

// ─────────────────────────────────────────────────────────────────────────
// START SERVER
// ─────────────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
