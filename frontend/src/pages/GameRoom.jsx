import React, { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import socket from '../socket'

const API_BASE = import.meta.env.VITE_BACKEND_URL || ''

function useIsMobile() {
  const [m, setM] = useState(() => window.innerWidth < 700)
  useEffect(() => {
    const h = () => setM(window.innerWidth < 700)
    window.addEventListener('resize', h)
    return () => window.removeEventListener('resize', h)
  }, [])
  return m
}

export default function GameRoom() {
  const { code } = useParams()
  const navigate  = useNavigate()
  const isMobile  = useIsMobile()

  const playerId  = sessionStorage.getItem('playerId')
  const playerNum = sessionStorage.getItem('playerNum')

  const [characters, setCharacters] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('characters') || '[]') } catch { return [] }
  })
  const [secretCharacter] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('secretCharacter') || 'null') } catch { return null }
  })

  const [phase,          setPhase]          = useState(playerNum === '1' ? 'waiting' : 'ready')
  const [flipped,        setFlipped]        = useState({})
  const [showSecret,     setShowSecret]     = useState(false)
  const [secretTimer,    setSecretTimer]    = useState(3)
  const [gameResult,     setGameResult]     = useState(null)
  const [opponentConnected, setOpponentConnected] = useState(playerNum === '2')
  const [disconnected,   setDisconnected]   = useState(false)

  const [chatLog,        setChatLog]        = useState([])
  const [pendingQuestion,setPendingQuestion]= useState(null)
  const [questionInput,  setQuestionInput]  = useState('')

  const [guessMode,      setGuessMode]      = useState(false)
  const [guessConfirm,   setGuessConfirm]   = useState(null)

  const chatEndRef = useRef(null)
  const secretRef  = useRef(null)

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [chatLog, pendingQuestion])

  useEffect(() => {
    if (!playerId) { navigate('/'); return }
    socket.connect()
    socket.emit('join_room', { code, playerId })

    socket.on('game_started', ({ characters: chars }) => {
      setCharacters(chars)
      sessionStorage.setItem('characters', JSON.stringify(chars))
      setOpponentConnected(true)
      setPhase('ready')
      addChat({ kind: 'system', text: 'היריב הצטרף! המשחק מתחיל 🎮' })
    })
    socket.on('receive_question', ({ question }) => {
      setPendingQuestion(question)
      addChat({ kind: 'their_question', text: question })
    })
    socket.on('question_answered', ({ question, answer }) => {
      setPendingQuestion(null)
      addChat({ kind: 'answer', question, answer })
    })
    socket.on('game_over', (r) => {
      setGameResult(r); setPhase('gameOver')
      setGuessMode(false); setGuessConfirm(null)
    })
    socket.on('opponent_disconnected', () => setDisconnected(true))

    return () => {
      ['game_started','receive_question','question_answered','game_over','opponent_disconnected']
        .forEach(e => socket.off(e))
      socket.disconnect()
    }
  }, [code, playerId])

  const addChat = (msg) => setChatLog(prev => [...prev, { id: Date.now() + Math.random(), ...msg }])

  const handleRevealSecret = () => {
    setShowSecret(true); setSecretTimer(3)
    let t = 3
    secretRef.current = setInterval(() => {
      t--; setSecretTimer(t)
      if (t <= 0) {
        clearInterval(secretRef.current)
        setShowSecret(false); setPhase('playing')
        setChatLog([{ id: 1, kind: 'system', text: 'שאלו שאלות כן/לא כדי לנחש מי הדמות הסודית של היריב!' }])
      }
    }, 1000)
  }

  const handleSendQuestion = () => {
    const q = questionInput.trim(); if (!q) return
    socket.emit('send_question', { code, question: q })
    addChat({ kind: 'my_question', text: q })
    setQuestionInput('')
  }

  const handleAnswer = (answer) => {
    socket.emit('answer_question', { code, question: pendingQuestion, answer })
  }

  const handleCardClick = useCallback((char) => {
    if (phase !== 'playing') return
    if (guessMode) { setGuessConfirm(char); return }
    setFlipped(prev => ({ ...prev, [char.id]: !prev[char.id] }))
  }, [phase, guessMode])

  const handleConfirmGuess = () => {
    if (!guessConfirm) return
    socket.emit('make_guess', { code, playerId, characterId: guessConfirm.id })
    setGuessConfirm(null); setGuessMode(false)
  }

  const imgSrc = (c) => c?.image_path?.startsWith('http') ? c.image_path : `${API_BASE}${c?.image_path}`

  // ══════════════════ GAME OVER ══════════════════
  if (phase === 'gameOver' && gameResult) {
    const isWinner = gameResult.winner === playerId
    const iGussed  = gameResult.guesser === playerId
    return (
      <div style={S.overlay}>
        <div style={{ ...S.modal, maxHeight: '90dvh', overflowY: 'auto' }}>
          <div style={{ fontSize: '3.5rem' }}>{isWinner ? '🏆' : '😢'}</div>
          <h1 style={{ fontSize: '1.8rem', color: isWinner ? '#2e7d32' : '#c62828', margin: '10px 0' }}>
            {isWinner ? 'ניצחת!' : 'הפסדת!'}
          </h1>
          <p style={{ color: '#555', marginBottom: 12 }}>
            {gameResult.correct ? 'ניחשת נכון! 🎉' : iGussed ? 'ניחשת לא נכון!' : 'היריב ניחש לא נכון!'}
          </p>
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap', margin: '12px 0' }}>
            {gameResult.guessedCharacter && (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '0.78rem', color: '#888', marginBottom: 4 }}>ניחשו:</div>
                <img src={imgSrc(gameResult.guessedCharacter)} alt="" style={S.resultImg} />
                <div style={{ fontWeight: 'bold', fontSize: '0.85rem', marginTop: 4 }}>{gameResult.guessedCharacter.name}</div>
              </div>
            )}
            {gameResult.correctCharacter && (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '0.78rem', color: '#888', marginBottom: 4 }}>הדמות האמיתית:</div>
                <img src={imgSrc(gameResult.correctCharacter)} alt="" style={S.resultImg} />
                <div style={{ fontWeight: 'bold', fontSize: '0.85rem', marginTop: 4 }}>{gameResult.correctCharacter.name}</div>
              </div>
            )}
          </div>
          <button style={S.btn} onClick={() => navigate('/')}>🏠 דף הבית</button>
        </div>
      </div>
    )
  }

  // ══════════════════ WAITING ══════════════════
  if (phase === 'waiting') return (
    <div style={S.overlay}>
      <div style={S.modal}>
        <div style={{ fontSize: '3rem', marginBottom: 12 }}>⏳</div>
        <h2 style={{ color: '#4a154b', marginBottom: 16 }}>ממתין לשחקן שני...</h2>
        <div style={S.codeBox}>{code}</div>
        <p style={{ color: '#666', marginTop: 12, fontSize: '0.9rem' }}>שלח את הקוד ליריב שלך</p>
      </div>
    </div>
  )

  // ══════════════════ REVEAL SECRET ══════════════════
  if (phase === 'ready') return (
    <div style={S.overlay}>
      {showSecret && secretCharacter ? (
        <div style={S.secretCard}>
          <div style={{ fontSize: '0.9rem', color: '#888', marginBottom: 8 }}>נעלמת בעוד {secretTimer}...</div>
          <img src={imgSrc(secretCharacter)} alt={secretCharacter.name}
            style={{ width: 180, height: 180, objectFit: 'cover', borderRadius: 16, border: '4px solid #764ba2' }} />
          <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#4a154b', marginTop: 12 }}>{secretCharacter.name}</div>
          <div style={{ fontSize: '0.8rem', color: '#999', marginTop: 4 }}>זכור! לא תראה אותה שוב</div>
        </div>
      ) : (
        <div style={S.modal}>
          <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>🎴</div>
          <h2 style={{ color: '#4a154b', marginBottom: 8 }}>
            {opponentConnected ? 'שני השחקנים מחוברים!' : 'מחכים...'}
          </h2>
          <p style={{ color: '#666', marginBottom: 24, fontSize: '0.9rem' }}>
            לחץ לראות את הדמות הסודית שלך — 3 שניות בלבד!
          </p>
          <button style={{ ...S.btn, fontSize: '1.05rem', padding: '13px 26px' }} onClick={handleRevealSecret}>
            🔍 הצג לי את הדמות שלי
          </button>
        </div>
      )}
    </div>
  )

  // ══════════════════ MAIN GAME ══════════════════
  return (
    <div style={S.page}>

      {/* Header */}
      <div style={S.header}>
        <span style={{ fontWeight: 'bold', color: '#4a154b', fontSize: isMobile ? '0.9rem' : '1rem' }}>
          👨‍👩‍👧‍👦 Family Guess Who
        </span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={S.codeBadge}>{code}</span>
          {phase === 'playing' && (
            guessMode
              ? <button style={{ ...S.btn, background: '#757575', padding: '7px 12px', fontSize: '0.82rem' }}
                  onClick={() => { setGuessMode(false); setGuessConfirm(null) }}>✕ בטל</button>
              : <button style={{ ...S.btn, background: '#e53935', padding: '7px 12px', fontSize: '0.82rem' }}
                  onClick={() => setGuessMode(true)}>🎯 ניחוש!</button>
          )}
        </div>
      </div>

      {disconnected && (
        <div style={{ background: '#ffebee', color: '#c62828', padding: '5px 14px', textAlign: 'center', fontSize: '0.82rem' }}>
          ⚠️ היריב התנתק
        </div>
      )}

      {guessMode && (
        <div style={{ background: '#fff3e0', color: '#e65100', padding: '7px 14px', textAlign: 'center', fontWeight: 'bold', fontSize: '0.85rem', borderBottom: '2px solid #ffcc80' }}>
          👆 בחר את הדמות שאתה חושב שהיא הסוד של היריב
        </div>
      )}

      {/* ── Main: board + chat ── */}
      <div style={{
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        flex: 1,
        overflow: 'hidden',
        minHeight: 0,
      }}>

        {/* ── Board ── */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: isMobile ? '8px' : '12px',
          minHeight: 0,
          // On mobile, don't let board grow infinitely — cap it so chat stays visible
          maxHeight: isMobile ? 'calc(100dvh - 260px)' : undefined,
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? 'repeat(4, 1fr)' : 'repeat(6, 1fr)',
            gap: isMobile ? 5 : 8,
          }}>
            {characters.map(char => {
              const isFlipped = !!flipped[char.id]
              return (
                <div
                  key={char.id}
                  onClick={() => handleCardClick(char)}
                  style={{
                    position: 'relative',
                    borderRadius: 8,
                    overflow: 'hidden',
                    cursor: phase === 'playing' ? 'pointer' : 'default',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.13)',
                    outline: guessMode ? '2px dashed #ff9800' : '2px solid transparent',
                    transition: 'filter 0.35s, transform 0.15s, outline 0.15s',
                    // Blur entire card when eliminated
                    filter: isFlipped ? 'blur(4px) brightness(0.75) saturate(0.4)' : 'none',
                    transform: guessMode && !isFlipped ? 'scale(1.03)' : 'scale(1)',
                  }}
                >
                  <img
                    src={imgSrc(char)}
                    alt={char.name}
                    style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block' }}
                    onError={e => { e.target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect fill="%23ddd" width="80" height="80"/></svg>' }}
                  />
                  <div style={{
                    position: 'absolute', bottom: 0, left: 0, right: 0,
                    background: 'linear-gradient(transparent, rgba(0,0,0,0.72))',
                    color: 'white',
                    fontSize: isMobile ? '0.56rem' : '0.63rem',
                    fontWeight: 'bold',
                    padding: '2px 2px 3px',
                    textAlign: 'center',
                  }}>
                    {char.name}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Chat Panel ── */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          background: 'white',
          // Mobile: fixed height at bottom | Desktop: sidebar
          ...(isMobile
            ? { flexShrink: 0, height: 220, borderTop: '2px solid #eee' }
            : { width: 300, minWidth: 260, borderRight: '1px solid #eee' }
          ),
          minHeight: 0,
        }}>
          {/* Chat title — desktop only */}
          {!isMobile && (
            <div style={{ padding: '10px 14px', fontWeight: 'bold', color: '#4a154b', borderBottom: '1px solid #eee', fontSize: '0.88rem' }}>
              💬 שאלות ותשובות
            </div>
          )}

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '6px 10px' : '10px 12px', minHeight: 0 }}>
            {chatLog.length === 0 && (
              <div style={{ color: '#ccc', textAlign: 'center', marginTop: 12, fontSize: '0.8rem' }}>
                שאל שאלת כן/לא 👇
              </div>
            )}
            {chatLog.map(msg => <ChatMsg key={msg.id} msg={msg} isMobile={isMobile} />)}

            {/* Pending question → answer buttons */}
            {pendingQuestion && (
              <div style={{ margin: '6px 0' }}>
                <div style={{ background: '#fff8e1', border: '1px solid #ffe082', borderRadius: 8, padding: '6px 10px', fontSize: '0.83rem', color: '#333', marginBottom: 5 }}>
                  ❓ {pendingQuestion}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button style={{ ...S.ansBtn, background: '#2e7d32', color: 'white', flex: 1 }} onClick={() => handleAnswer('כן')}>✅ כן</button>
                  <button style={{ ...S.ansBtn, background: '#c62828', color: 'white', flex: 1 }} onClick={() => handleAnswer('לא')}>❌ לא</button>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          <div style={{ padding: isMobile ? '7px 10px' : '9px 12px', borderTop: '1px solid #eee', display: 'flex', gap: 7, flexShrink: 0 }}>
            <input
              style={{ flex: 1, padding: '8px 10px', fontSize: '0.88rem', border: '2px solid #e0e0e0', borderRadius: 8, outline: 'none', direction: 'rtl' }}
              value={questionInput}
              onChange={e => setQuestionInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSendQuestion()}
              placeholder={pendingQuestion ? 'ממתין לתשובה...' : 'שאל שאלה...'}
              disabled={!!pendingQuestion}
              maxLength={100}
            />
            <button
              style={{ ...S.btn, padding: '8px 12px', fontSize: '0.85rem', opacity: (pendingQuestion || !questionInput.trim()) ? 0.5 : 1 }}
              onClick={handleSendQuestion}
              disabled={!!pendingQuestion || !questionInput.trim()}
            >שלח</button>
          </div>
        </div>
      </div>

      {/* Guess confirm modal */}
      {guessConfirm && (
        <div style={S.overlay}>
          <div style={S.modal}>
            <div style={{ fontSize: '2rem', marginBottom: 8 }}>🎯</div>
            <h2 style={{ color: '#4a154b', marginBottom: 14 }}>ניחוש סופי?</h2>
            <img src={imgSrc(guessConfirm)} alt={guessConfirm.name}
              style={{ width: 120, height: 120, objectFit: 'cover', borderRadius: 12, border: '3px solid #764ba2', display: 'block', margin: '0 auto 10px' }} />
            <div style={{ fontWeight: 'bold', fontSize: '1.15rem', color: '#333', marginBottom: 8 }}>{guessConfirm.name}</div>
            <p style={{ color: '#666', marginBottom: 18, fontSize: '0.85rem' }}>לא ניתן לחזור אחרי אישור!</p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button style={S.btn} onClick={handleConfirmGuess}>✅ זה הניחוש שלי!</button>
              <button style={{ ...S.btn, background: '#9e9e9e' }} onClick={() => setGuessConfirm(null)}>← בטל</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ChatMsg({ msg, isMobile }) {
  const fs = isMobile ? '0.8rem' : '0.86rem'
  if (msg.kind === 'system')
    return <div style={{ textAlign: 'center', color: '#aaa', fontSize: '0.74rem', margin: '4px 0', fontStyle: 'italic' }}>{msg.text}</div>
  if (msg.kind === 'my_question')
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-start', margin: '3px 0' }}>
        <div style={{ background: '#764ba2', color: 'white', borderRadius: '10px 10px 0 10px', padding: '6px 10px', maxWidth: '85%', fontSize: fs }}>
          ❓ {msg.text}
        </div>
      </div>
    )
  if (msg.kind === 'their_question')
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-end', margin: '3px 0' }}>
        <div style={{ background: '#f0f0f0', color: '#333', borderRadius: '10px 10px 10px 0', padding: '6px 10px', maxWidth: '85%', fontSize: fs }}>
          ❓ {msg.text}
        </div>
      </div>
    )
  if (msg.kind === 'answer') {
    const q = msg.question?.length > 22 ? msg.question.slice(0, 22) + '…' : msg.question
    return (
      <div style={{ textAlign: 'center', margin: '4px 0' }}>
        <div style={{ display: 'inline-block', background: '#e8f5e9', border: '1px solid #a5d6a7', borderRadius: 8, padding: '3px 10px', fontSize: '0.77rem' }}>
          <span style={{ color: '#888' }}>"{q}" ← </span>
          <strong style={{ color: msg.answer === 'כן' ? '#2e7d32' : '#c62828' }}>
            {msg.answer === 'כן' ? '✅ כן' : '❌ לא'}
          </strong>
        </div>
      </div>
    )
  }
  return null
}

const S = {
  page:      { height: '100dvh', background: '#f5f5f5', direction: 'rtl', display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  header:    { background: 'white', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', padding: '9px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexShrink: 0, zIndex: 20 },
  codeBadge: { background: '#f3e5f5', color: '#4a154b', padding: '4px 10px', borderRadius: 20, fontWeight: 'bold', fontSize: '0.88rem', letterSpacing: 2 },
  ansBtn:    { padding: '8px', border: 'none', borderRadius: 8, fontSize: '0.88rem', fontWeight: 'bold', cursor: 'pointer' },
  btn:       { background: 'linear-gradient(135deg, #667eea, #764ba2)', color: 'white', border: 'none', borderRadius: 10, padding: '10px 18px', fontSize: '0.9rem', fontWeight: 'bold', cursor: 'pointer' },
  overlay:   { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 },
  modal:     { background: 'white', borderRadius: 20, padding: '26px 22px', maxWidth: 370, width: '100%', textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' },
  secretCard:{ background: 'white', borderRadius: 20, padding: 24, textAlign: 'center' },
  codeBox:   { fontSize: '2.8rem', fontWeight: 'bold', letterSpacing: 8, color: '#764ba2', background: '#f3e5f5', borderRadius: 12, padding: '14px 20px', display: 'inline-block' },
  resultImg: { width: 95, height: 95, objectFit: 'cover', borderRadius: 10, border: '2px solid #ddd' },
}
