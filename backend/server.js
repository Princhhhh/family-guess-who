// Suppress experimental SQLite warning (node:sqlite is built-in to Node 22+)
process.removeAllListeners('warning');
process.on('warning', (w) => { if (w.name !== 'ExperimentalWarning') console.warn(w) });

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const db = require('./database');

const app = express();
const server = http.createServer(app);

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

app.use(cors());
app.use(express.json());

// Uploads directory
const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

app.use('/uploads', express.static(UPLOADS_DIR));

// Multer config
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  }
});
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype);
    if (ext && mime) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  },
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

// Admin auth middleware
const adminAuth = (req, res, next) => {
  const password = req.headers['x-admin-password'] || req.body?.password || req.query?.password;
  if (password === 'admin123') return next();
  res.status(401).json({ error: 'Unauthorized' });
};

// =====================
// ADMIN ROUTES
// =====================

// Admin login check
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  if (password === 'admin123') {
    res.json({ success: true });
  } else {
    res.status(401).json({ error: 'סיסמה שגויה' });
  }
});

// Get all characters
app.get('/api/admin/characters', adminAuth, (req, res) => {
  const chars = db.prepare('SELECT * FROM characters ORDER BY created_at DESC').all();
  res.json(chars);
});

// Upload character
app.post('/api/admin/characters', adminAuth, upload.single('image'), (req, res) => {
  const { name } = req.body;
  if (!name || !req.file) {
    return res.status(400).json({ error: 'שם ותמונה הם שדות חובה' });
  }

  const imagePath = `/uploads/${req.file.filename}`;
  const result = db.prepare('INSERT INTO characters (name, image_path) VALUES (?, ?)').run(name, imagePath);
  const char = db.prepare('SELECT * FROM characters WHERE id = ?').get(result.lastInsertRowid);
  res.json(char);
});

// Delete character
app.delete('/api/admin/characters/:id', adminAuth, (req, res) => {
  const char = db.prepare('SELECT * FROM characters WHERE id = ?').get(req.params.id);
  if (!char) return res.status(404).json({ error: 'דמות לא נמצאה' });

  // Delete the image file
  const filePath = path.join(UPLOADS_DIR, path.basename(char.image_path));
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

  db.prepare('DELETE FROM characters WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// Get characters count (public, for game availability check)
app.get('/api/characters/count', (req, res) => {
  const count = db.prepare('SELECT COUNT(*) as count FROM characters').get();
  res.json(count);
});

// =====================
// LEADERBOARD
// =====================

app.get('/api/leaderboard', (req, res) => {
  const users = db.prepare(`
    SELECT username, wins, losses, games
    FROM users
    WHERE games > 0
    ORDER BY wins DESC, losses ASC, games ASC
    LIMIT 20
  `).all();
  res.json(users);
});

// =====================
// ROOM ROUTES
// =====================

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

// Upsert user helper
function upsertUser(username) {
  if (!username?.trim()) return;
  db.prepare(`
    INSERT INTO users (username, games) VALUES (?, 1)
    ON CONFLICT(username) DO UPDATE SET games = games + 1
  `).run(username.trim());
}

// Create room
app.post('/api/rooms', (req, res) => {
  const { username } = req.body;
  const charCount = db.prepare('SELECT COUNT(*) as count FROM characters').get().count;
  if (charCount < 24) {
    return res.status(400).json({ error: `נדרשות לפחות 24 דמויות. יש כרגע ${charCount}.` });
  }

  let code;
  let attempts = 0;
  do {
    code = generateCode();
    attempts++;
    if (attempts > 100) return res.status(500).json({ error: 'לא ניתן ליצור קוד ייחודי' });
  } while (db.prepare('SELECT id FROM rooms WHERE code = ? AND status != ?').get(code, 'finished'));

  const playerId = uuidv4();
  const playerName = username?.trim() || null;

  // Select 24 random characters
  const allChars = db.prepare('SELECT * FROM characters').all();
  const selected = shuffleArray(allChars).slice(0, 24);

  // Pick a secret for player1
  const secret1 = selected[Math.floor(Math.random() * 24)];

  db.prepare(`
    INSERT INTO rooms (code, player1_id, player1_name, characters, player1_secret_id, status)
    VALUES (?, ?, ?, ?, ?, 'waiting')
  `).run(code, playerId, playerName, JSON.stringify(selected), secret1.id);

  // Register user
  upsertUser(playerName);

  res.json({ code, playerId, characters: selected, secretCharacter: secret1, playerName });
});

// Join room
app.post('/api/rooms/join', (req, res) => {
  const { code, username } = req.body;
  const room = db.prepare('SELECT * FROM rooms WHERE code = ?').get(code);

  if (!room) return res.status(404).json({ error: 'חדר לא נמצא' });
  if (room.status !== 'waiting') return res.status(400).json({ error: 'החדר כבר מלא או הסתיים' });
  if (room.player2_id) return res.status(400).json({ error: 'החדר כבר מלא' });

  const playerId = uuidv4();
  const playerName = username?.trim() || null;
  const characters = JSON.parse(room.characters);

  // Pick a secret for player2 — DIFFERENT from player1's secret
  const availableForP2 = characters.filter(c => c.id !== room.player1_secret_id);
  const secret2 = availableForP2[Math.floor(Math.random() * availableForP2.length)];

  db.prepare(`
    UPDATE rooms SET player2_id = ?, player2_name = ?, player2_secret_id = ?, status = 'playing'
    WHERE id = ?
  `).run(playerId, playerName, secret2.id, room.id);

  // Register user
  upsertUser(playerName);

  res.json({
    code,
    playerId,
    characters,
    secretCharacter: secret2,
    opponentName: room.player1_name || null,
  });

  // Player1 always goes first — store in roomTurns
  roomTurns[code] = room.player1_id;

  // Notify both players that game started — include whose turn it is
  io.to(`room_${code}`).emit('game_started', {
    characters,
    opponentName: playerName,
    firstTurn: room.player1_id,
    message: 'השחקן השני הצטרף! המשחק מתחיל!'
  });
});

// Get room info
app.get('/api/rooms/:code', (req, res) => {
  const room = db.prepare('SELECT * FROM rooms WHERE code = ?').get(req.params.code);
  if (!room) return res.status(404).json({ error: 'חדר לא נמצא' });
  res.json({ ...room, characters: JSON.parse(room.characters || '[]') });
});

// =====================
// SOCKET.IO
// =====================

// Track socket -> room/player mapping
const socketToRoom = {};
const socketToPlayer = {};
// Track whose turn it is per room (playerId)
const roomTurns = {};

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('join_room', ({ code, playerId }) => {
    const roomKey = `room_${code}`;
    socket.join(roomKey);
    socketToRoom[socket.id] = code;
    socketToPlayer[socket.id] = playerId;
    console.log(`Socket ${socket.id} joined room ${code}`);

    // If the room is already playing (player missed the game_started event due to
    // page refresh / slow navigation), send game_started directly to this socket
    const room = db.prepare('SELECT * FROM rooms WHERE code = ?').get(code);
    if (room && room.status === 'playing') {
      const characters = JSON.parse(room.characters);
      const isPlayer1 = room.player1_id === playerId;
      const opponentName = isPlayer1 ? room.player2_name : room.player1_name;
      const currentTurn = roomTurns[code] || room.player1_id;
      socket.emit('game_started', {
        characters,
        opponentName: opponentName || null,
        firstTurn: room.player1_id,
        currentTurn,
      });
    }
  });

  // Player sends a yes/no question to opponent
  socket.on('send_question', ({ code, playerId, question }) => {
    // Only allow if it's this player's turn
    if (roomTurns[code] && roomTurns[code] !== playerId) return;
    socket.to(`room_${code}`).emit('receive_question', { question });
  });

  // Player answers yes/no — broadcast to both, then switch turn
  socket.on('answer_question', ({ code, question, answer }) => {
    io.to(`room_${code}`).emit('question_answered', { question, answer });

    // Switch turn to the player who asked (the one who is NOT the answerer)
    const room = db.prepare('SELECT * FROM rooms WHERE code = ?').get(code);
    if (room) {
      const answererSocket = socket.id;
      // The asker was whoever's turn it was before
      const askerTurn = roomTurns[code];
      // After answer, switch to the OTHER player (the asker's turn is done, now it's the answerer's turn)
      const nextTurn = askerTurn === room.player1_id ? room.player2_id : room.player1_id;
      roomTurns[code] = nextTurn;
      io.to(`room_${code}`).emit('turn_changed', { currentTurn: nextTurn });
    }
  });

  // Final guess: player clicks a character image (by ID, not name)
  socket.on('make_guess', ({ code, playerId, characterId }) => {
    const room = db.prepare('SELECT * FROM rooms WHERE code = ?').get(code);
    if (!room || room.status === 'finished') return;

    const characters = JSON.parse(room.characters);
    const isPlayer1 = room.player1_id === playerId;

    // Each player guesses the OPPONENT's secret
    const opponentSecretId = isPlayer1 ? room.player2_secret_id : room.player1_secret_id;

    const correct = Number(opponentSecretId) === Number(characterId);
    const winner = correct ? playerId : (isPlayer1 ? room.player2_id : room.player1_id);

    db.prepare('UPDATE rooms SET status = ?, winner = ? WHERE code = ?')
      .run('finished', winner, code);

    // Update win/loss stats
    const winnerName = winner === room.player1_id ? room.player1_name : room.player2_name;
    const loserName  = winner === room.player1_id ? room.player2_name : room.player1_name;
    if (winnerName) db.prepare('UPDATE users SET wins = wins + 1 WHERE username = ?').run(winnerName);
    if (loserName)  db.prepare('UPDATE users SET losses = losses + 1 WHERE username = ?').run(loserName);

    const guessedChar = characters.find(c => c.id === Number(characterId));
    const correctChar  = characters.find(c => c.id === Number(opponentSecretId));

    io.to(`room_${code}`).emit('game_over', {
      winner,
      correct,
      guesser: playerId,
      guessedCharacter: guessedChar,
      correctCharacter: correctChar,
      winnerName,
    });
  });

  socket.on('disconnect', () => {
    const code = socketToRoom[socket.id];
    if (code) {
      socket.to(`room_${code}`).emit('opponent_disconnected');
    }
    delete socketToRoom[socket.id];
    delete socketToPlayer[socket.id];
    console.log('Client disconnected:', socket.id);
  });
});

// =====================
// SERVE FRONTEND (production)
// =====================

const PUBLIC_DIR = path.join(__dirname, 'public');
if (fs.existsSync(PUBLIC_DIR)) {
  app.use(express.static(PUBLIC_DIR));
  app.get('*', (req, res) => {
    // Don't catch API or uploads routes
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) return;
    res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
  });
}

// =====================
// START SERVER
// =====================

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
