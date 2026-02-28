import React, { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import socket from '../socket'

const API_BASE = import.meta.env.VITE_BACKEND_URL || ''

export default function GameRoom() {
  const { code } = useParams()
  const navigate = useNavigate()

  const playerId  = sessionStorage.getItem('playerId')
  const playerNum = sessionStorage.getItem('playerNum')

  const [characters, setCharacters] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('characters') || '[]') } catch { return [] }
  })
  const [secretCharacter, setSecretCharacter] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('secretCharacter') || 'null') } catch { return null }
  })

  const [phase, setPhase]                 = useState(playerNum === '1' ? 'waiting' : 'ready')
  const [flipped, setFlipped]             = useState({})          // private — never sent to opponent
  const [showSecret, setShowSecret]       = useState(false)
  const [secretTimer, setSecretTimer]     = useState(3)
  const [gameResult, setGameResult]       = useState(null)
  const [opponentConnected, setOpponentConnected] = useState(playerNum === '2')
  const [disconnected, setDisconnected]   = useState(false)

  // Chat / Q&A
  const [chatLog, setChatLog]             = useState([])   // array of message objects
  const [pendingQuestion, setPendingQuestion] = useState(null) // question waiting for MY answer
  const [questionInput, setQuestionInput] = useState('')

  // Final guess flow
  const [guessMode, setGuessMode]         = useState(false)
  const [guessConfirm, setGuessConfirm]   = useState(null) // char selected, waiting for confirm

  const chatEndRef  = useRef(null)
  const secretRef   = useRef(null)

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatLog, pendingQuestion])

  // Socket setup
  useEffect(() => {
    if (!playerId) { navigate('/'); return }

    socket.connect()
    socket.emit('join_room', { code, playerId })

    socket.on('game_started', ({ characters: chars }) => {
      setCharacters(chars)
      sessionStorage.setItem('characters', JSON.stringify(chars))
      setOpponentConnected(true)
      setPhase('ready')
      setChatLog(prev => [...prev, { id: Date.now(), kind: 'system', text: 'היריב הצטרף! המשחק מתחיל 🎮' }])
    })

    // Opponent sent a question → I need to answer
    socket.on('receive_question', ({ question }) => {
      setPendingQuestion(question)
      setChatLog(prev => [...prev, { id: Date.now(), kind: 'their_question', text: question }])
    })

    // A question was answered (broadcast to both)
    socket.on('question_answered', ({ question, answer }) => {
      setPendingQuestion(null)
      setChatLog(prev => [...prev, { id: Date.now(), kind: 'answer', question, answer }])
    })

    socket.on('game_over', (result) => {
      setGameResult(result)
      setPhase('gameOver')
      setGuessMode(false)
      setGuessConfirm(null)
    })

    socket.on('opponent_disconnected', () => setDisconnected(true))

    return () => {
      socket.off('game_started')
      socket.off('receive_question')
      socket.off('question_answered')
      socket.off('game_over')
      socket.off('opponent_disconnected')
      socket.disconnect()
    }
  }, [code, playerId])

  // ── Reveal secret character for 3 seconds ──
  const handleRevealSecret = () => {
    setShowSecret(true)
    setSecretTimer(3)
    let t = 3
    secretRef.current = setInterval(() => {
      t--
      setSecretTimer(t)
      if (t <= 0) {
        clearInterval(secretRef.current)
        setShowSecret(false)
        setPhase('playing')
        setChatLog([{ id: Date.now(), kind: 'system', text: 'תשאלו שאלות כן/לא כדי לנחש מי הדמות הסודית של היריב!' }])
      }
    }, 1000)
  }

  // ── Send a question ──
  const handleSendQuestion = () => {
    const q = questionInput.trim()
    if (!q) return
    socket.emit('send_question', { code, question: q })
    setChatLog(prev => [...prev, { id: Date.now(), kind: 'my_question', text: q }])
    setQuestionInput('')
  }

  // ── Answer yes/no ──
  const handleAnswer = (answer) => {
    socket.emit('answer_question', { code, question: pendingQuestion, answer })
    // question_answered event will update chatLog for both players
  }

  // ── Card click: toggle elimination OR enter guess ──
  const handleCardClick = useCallback((char) => {
    if (phase !== 'playing') return

    if (guessMode) {
      // Select for final guess
      setGuessConfirm(char)
      return
    }

    // Normal: toggle dark/light privately
    setFlipped(prev => ({ ...prev, [char.id]: !prev[char.id] }))
  }, [phase, guessMode])

  // ── Confirm final guess ──
  const handleConfirmGuess = () => {
    if (!guessConfirm) return
    socket.emit('make_guess', { code, playerId, characterId: guessConfirm.id })
    setGuessConfirm(null)
    setGuessMode(false)
  }

  const imgSrc = (char) =>
    char.image_path?.startsWith('http') ? char.image_path : `${API_BASE}${char.image_path}`

  // ════════════════════════════════════════════
  // GAME OVER SCREEN
  // ════════════════════════════════════════════
  if (phase === 'gameOver' && gameResult) {
    const isWinner = gameResult.winner === playerId
    const iGussed  = gameResult.guesser === playerId
    return (
      <div style={S.overlay}>
        <div style={S.modal}>
          <div style={{ fontSize: '4rem' }}>{isWinner ? '🏆' : '😢'}</div>
          <h1 style={{ fontSize: '2rem', color: isWinner ? '#2e7d32' : '#c62828', margin: '12px 0' }}>
            {isWinner ? 'ניצחת!' : 'הפסדת!'}
          </h1>

          {gameResult.correct ? (
            <p style={{ color: '#555' }}>ניחשת נכון! 🎉</p>
          ) : (
            <p style={{ color: '#555' }}>
              {iGussed ? 'ניחשת לא נכון!' : 'היריב ניחש לא נכון!'}
            </p>
          )}

          <div style={{ display: 'flex', gap: '24px', justifyContent: 'center', margin: '20px 0', flexWrap: 'wrap' }}>
            {gameResult.guessedCharacter && (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '0.85rem', color: '#888', marginBottom: '4px' }}>ניחשו:</div>
                <img src={imgSrc(gameResult.guessedCharacter)} alt="" style={S.resultImg} />
                <div style={{ fontWeight: 'bold', marginTop: '4px' }}>{gameResult.guessedCharacter.name}</div>
              </div>
            )}
            {gameResult.correctCharacter && (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '0.85rem', color: '#888', marginBottom: '4px' }}>הדמות האמיתית:</div>
                <img src={imgSrc(gameResult.correctCharacter)} alt="" style={S.resultImg} />
                <div style={{ fontWeight: 'bold', marginTop: '4px' }}>{gameResult.correctCharacter.name}</div>
              </div>
            )}
          </div>

          <button style={S.btn} onClick={() => navigate('/')}>🏠 חזור לדף הבית</button>
        </div>
      </div>
    )
  }

  // ════════════════════════════════════════════
  // WAITING SCREEN (player 1 waiting for player 2)
  // ════════════════════════════════════════════
  if (phase === 'waiting') {
    return (
      <div style={S.overlay}>
        <div style={S.modal}>
          <div style={{ fontSize: '3rem', marginBottom: '12px' }}>⏳</div>
          <h2 style={{ color: '#4a154b', marginBottom: '16px' }}>ממתין לשחקן שני...</h2>
          <div style={S.codeBox}>{code}</div>
          <p style={{ color: '#666', marginTop: '12px' }}>שלח את הקוד הזה ליריב שלך</p>
        </div>
      </div>
    )
  }

  // ════════════════════════════════════════════
  // SECRET REVEAL SCREEN
  // ════════════════════════════════════════════
  if (phase === 'ready') {
    return (
      <div style={S.overlay}>
        {showSecret && secretCharacter ? (
          <div style={S.secretCard}>
            <div style={{ fontSize: '1rem', color: '#888', marginBottom: '8px' }}>הדמות הסודית שלך — נעלמת בעוד {secretTimer}...</div>
            <img src={imgSrc(secretCharacter)} alt={secretCharacter.name}
              style={{ width: 200, height: 200, objectFit: 'cover', borderRadius: 16, border: '4px solid #764ba2' }} />
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#4a154b', marginTop: 12 }}>{secretCharacter.name}</div>
            <div style={{ fontSize: '0.8rem', color: '#999', marginTop: 4 }}>זכור אותה! לא תראה אותה שוב</div>
          </div>
        ) : (
          <div style={S.modal}>
            <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>🎴</div>
            <h2 style={{ color: '#4a154b', marginBottom: '8px' }}>
              {opponentConnected ? 'שני השחקנים מחוברים!' : 'מחכים...'}
            </h2>
            <p style={{ color: '#666', marginBottom: '24px' }}>
              לחץ לראות את הדמות הסודית שלך — תראה אותה 3 שניות בלבד!
            </p>
            <button style={{ ...S.btn, fontSize: '1.1rem', padding: '14px 28px' }} onClick={handleRevealSecret}>
              🔍 הצג לי את הדמות שלי
            </button>
          </div>
        )}
      </div>
    )
  }

  // ════════════════════════════════════════════
  // MAIN GAME SCREEN
  // ════════════════════════════════════════════
  return (
    <div style={S.page}>

      {/* ── Header ── */}
      <div style={S.header}>
        <span style={{ fontWeight: 'bold', color: '#4a154b', fontSize: '1.1rem' }}>👨‍👩‍👧‍👦 Family Guess Who</span>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={S.codeBadge}>קוד: {code}</span>
          {!guessMode
            ? <button style={{ ...S.btn, background: '#e53935', padding: '8px 16px', fontSize: '0.95rem' }}
                onClick={() => setGuessMode(true)}>
                🎯 ניחוש סופי!
              </button>
            : <button style={{ ...S.btn, background: '#757575', padding: '8px 16px', fontSize: '0.95rem' }}
                onClick={() => { setGuessMode(false); setGuessConfirm(null) }}>
                ✕ בטל ניחוש
              </button>
          }
        </div>
      </div>

      {disconnected && (
        <div style={{ background: '#ffebee', color: '#c62828', padding: '8px 20px', textAlign: 'center', fontSize: '0.9rem' }}>
          ⚠️ היריב התנתק מהמשחק
        </div>
      )}

      {/* ── Guess-mode banner ── */}
      {guessMode && (
        <div style={{ background: '#fff3e0', color: '#e65100', padding: '10px 20px', textAlign: 'center', fontWeight: 'bold', borderBottom: '2px solid #ffcc80' }}>
          👆 לחץ על הדמות שאתה חושב שהיא הסוד של היריב
        </div>
      )}

      {/* ── Main layout: board + chat ── */}
      <div style={S.main}>

        {/* ── Game Board ── */}
        <div style={S.boardArea}>
          <div style={S.grid}>
            {characters.map(char => (
              <div
                key={char.id}
                onClick={() => handleCardClick(char)}
                title={guessMode ? `בחר: ${char.name}` : char.name}
                style={{
                  position: 'relative',
                  borderRadius: 10,
                  overflow: 'hidden',
                  cursor: phase === 'playing' ? 'pointer' : 'default',
                  transition: 'transform 0.15s, box-shadow 0.15s, outline 0.15s',
                  outline: guessMode ? '2px dashed #ff9800' : '2px solid transparent',
                  transform: guessMode ? 'scale(1.03)' : 'scale(1)',
                  boxShadow: '0 3px 10px rgba(0,0,0,0.15)',
                }}
              >
                <img
                  src={imgSrc(char)}
                  alt={char.name}
                  style={{
                    width: '100%',
                    aspectRatio: '1',
                    objectFit: 'cover',
                    display: 'block',
                    filter: flipped[char.id] ? 'brightness(0.15) grayscale(1)' : 'none',
                    transition: 'filter 0.3s',
                  }}
                  onError={e => { e.target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect fill="%23ddd" width="80" height="80"/></svg>' }}
                />
                {/* Name label */}
                <div style={{
                  position: 'absolute', bottom: 0, left: 0, right: 0,
                  background: 'linear-gradient(transparent, rgba(0,0,0,0.75))',
                  color: 'white', fontSize: '0.65rem', fontWeight: 'bold',
                  padding: '3px 3px 4px', textAlign: 'center',
                  filter: flipped[char.id] ? 'brightness(0.2)' : 'none',
                  transition: 'filter 0.3s',
                }}>
                  {char.name}
                </div>
                {/* Eliminated X */}
                {flipped[char.id] && !guessMode && (
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.8rem' }}>❌</div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ── Chat Panel ── */}
        <div style={S.chatPanel}>
          <div style={S.chatTitle}>💬 שאלות ותשובות</div>

          {/* Messages */}
          <div style={S.chatMessages}>
            {chatLog.length === 0 && (
              <div style={{ color: '#bbb', textAlign: 'center', marginTop: 24, fontSize: '0.85rem' }}>
                שאל שאלת כן/לא כדי להתחיל לצמצם!
              </div>
            )}
            {chatLog.map(msg => <ChatMsg key={msg.id} msg={msg} />)}

            {/* Pending question — show answer buttons */}
            {pendingQuestion && (
              <div style={{ margin: '8px 0' }}>
                <div style={S.theirQuestion}>❓ {pendingQuestion}</div>
                <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                  <button style={{ ...S.ansBtn, background: '#2e7d32', color: 'white', flex: 1 }} onClick={() => handleAnswer('כן')}>✅ כן</button>
                  <button style={{ ...S.ansBtn, background: '#c62828', color: 'white', flex: 1 }} onClick={() => handleAnswer('לא')}>❌ לא</button>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Question input */}
          <div style={S.chatInput}>
            <input
              style={S.input}
              value={questionInput}
              onChange={e => setQuestionInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSendQuestion()}
              placeholder={pendingQuestion ? 'ממתין לתשובה...' : 'שאל שאלת כן/לא...'}
              disabled={!!pendingQuestion}
              maxLength={120}
            />
            <button
              style={{ ...S.btn, padding: '10px 14px', fontSize: '0.9rem', opacity: (pendingQuestion || !questionInput.trim()) ? 0.5 : 1 }}
              onClick={handleSendQuestion}
              disabled={!!pendingQuestion || !questionInput.trim()}
            >
              שלח
            </button>
          </div>
        </div>
      </div>

      {/* ── Guess Confirm Modal ── */}
      {guessConfirm && (
        <div style={S.overlay}>
          <div style={S.modal}>
            <div style={{ fontSize: '2rem', marginBottom: '8px' }}>🎯</div>
            <h2 style={{ color: '#4a154b', marginBottom: '16px' }}>ניחוש סופי?</h2>
            <img src={imgSrc(guessConfirm)} alt={guessConfirm.name}
              style={{ width: 140, height: 140, objectFit: 'cover', borderRadius: 12, border: '3px solid #764ba2', display: 'block', margin: '0 auto 12px' }} />
            <div style={{ fontWeight: 'bold', fontSize: '1.3rem', color: '#333', marginBottom: '8px' }}>{guessConfirm.name}</div>
            <p style={{ color: '#666', marginBottom: '20px', fontSize: '0.9rem' }}>
              זהו הניחוש הסופי שלך — לא ניתן לחזור אחרי אישור!
            </p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button style={S.btn} onClick={handleConfirmGuess}>✅ זה הניחוש שלי!</button>
              <button style={{ ...S.btn, background: '#9e9e9e' }} onClick={() => setGuessConfirm(null)}>← בטל</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Chat message component ──
function ChatMsg({ msg }) {
  if (msg.kind === 'system') {
    return <div style={{ textAlign: 'center', color: '#888', fontSize: '0.8rem', margin: '6px 0', fontStyle: 'italic' }}>{msg.text}</div>
  }
  if (msg.kind === 'my_question') {
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-start', margin: '4px 0' }}>
        <div style={{ background: '#764ba2', color: 'white', borderRadius: '12px 12px 0 12px', padding: '8px 12px', maxWidth: '85%', fontSize: '0.88rem' }}>
          ❓ {msg.text}
        </div>
      </div>
    )
  }
  if (msg.kind === 'their_question') {
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-end', margin: '4px 0' }}>
        <div style={{ background: '#f0f0f0', color: '#333', borderRadius: '12px 12px 12px 0', padding: '8px 12px', maxWidth: '85%', fontSize: '0.88rem' }}>
          ❓ {msg.text}
        </div>
      </div>
    )
  }
  if (msg.kind === 'answer') {
    return (
      <div style={{ textAlign: 'center', margin: '6px 0' }}>
        <div style={{ display: 'inline-block', background: '#e8f5e9', border: '1px solid #a5d6a7', borderRadius: 8, padding: '5px 12px', fontSize: '0.82rem', color: '#333' }}>
          <span style={{ color: '#888' }}>"{msg.question}" ← </span>
          <strong style={{ color: msg.answer === 'כן' ? '#2e7d32' : '#c62828', fontSize: '1rem' }}>
            {msg.answer === 'כן' ? '✅ כן' : '❌ לא'}
          </strong>
        </div>
      </div>
    )
  }
  return null
}

// ── Styles ──
const S = {
  page: { minHeight: '100vh', background: '#f5f5f5', direction: 'rtl', display: 'flex', flexDirection: 'column' },

  header: {
    background: 'white', boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    padding: '10px 16px', display: 'flex', alignItems: 'center',
    justifyContent: 'space-between', flexWrap: 'wrap', gap: 8,
    position: 'sticky', top: 0, zIndex: 10,
  },

  codeBadge: {
    background: '#f3e5f5', color: '#4a154b',
    padding: '5px 12px', borderRadius: 20, fontWeight: 'bold', fontSize: '0.95rem', letterSpacing: 2,
  },

  main: { display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 },

  boardArea: { flex: 1, overflowY: 'auto', padding: '12px', minWidth: 0 },

  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
    gap: 8,
  },

  chatPanel: {
    width: 300, minWidth: 260, maxWidth: 340,
    background: 'white', borderRight: '1px solid #eee',
    display: 'flex', flexDirection: 'column',
    '@media (max-width: 600px)': { width: '100%' },
  },

  chatTitle: {
    padding: '12px 16px', fontWeight: 'bold', color: '#4a154b',
    borderBottom: '1px solid #eee', fontSize: '0.95rem',
  },

  chatMessages: { flex: 1, overflowY: 'auto', padding: '10px 12px' },

  chatInput: {
    padding: '10px 12px', borderTop: '1px solid #eee',
    display: 'flex', gap: 8,
  },

  input: {
    flex: 1, padding: '9px 12px', fontSize: '0.9rem',
    border: '2px solid #e0e0e0', borderRadius: 8, outline: 'none',
    direction: 'rtl',
  },

  theirQuestion: {
    background: '#fff8e1', border: '1px solid #ffe082',
    borderRadius: 8, padding: '8px 12px', fontSize: '0.88rem', color: '#333',
  },

  ansBtn: {
    padding: '8px', border: 'none', borderRadius: 8,
    fontSize: '0.9rem', fontWeight: 'bold', cursor: 'pointer',
  },

  btn: {
    background: 'linear-gradient(135deg, #667eea, #764ba2)',
    color: 'white', border: 'none', borderRadius: 10,
    padding: '10px 20px', fontSize: '0.95rem', fontWeight: 'bold',
    cursor: 'pointer',
  },

  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 100, padding: 20,
  },

  modal: {
    background: 'white', borderRadius: 20, padding: 32,
    maxWidth: 400, width: '100%', textAlign: 'center',
    boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
  },

  secretCard: {
    background: 'white', borderRadius: 20, padding: 28, textAlign: 'center',
    animation: 'fadeIn 0.3s ease',
  },

  codeBox: {
    fontSize: '3rem', fontWeight: 'bold', letterSpacing: 8, color: '#764ba2',
    background: '#f3e5f5', borderRadius: 12, padding: '16px 24px',
    display: 'inline-block',
  },

  resultImg: { width: 110, height: 110, objectFit: 'cover', borderRadius: 12, border: '2px solid #ddd' },
}
