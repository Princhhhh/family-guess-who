import React, { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import socket from '../socket'

const API_BASE = import.meta.env.VITE_BACKEND_URL || ''

// Play a short two-tone chime using Web Audio API (no external deps)
function playChime() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const notes = [660, 880]
    notes.forEach((freq, i) => {
      const osc  = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain); gain.connect(ctx.destination)
      osc.type = 'sine'
      osc.frequency.value = freq
      const t = ctx.currentTime + i * 0.18
      gain.gain.setValueAtTime(0, t)
      gain.gain.linearRampToValueAtTime(0.28, t + 0.04)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.32)
      osc.start(t); osc.stop(t + 0.35)
    })
  } catch (_) {}
}

// Flash the browser tab title until the user focuses the window
function flashTabTitle(msg) {
  if (document.visibilityState === 'visible') return
  const orig = document.title
  let on = true
  const iv = setInterval(() => { document.title = on ? msg : orig; on = !on }, 700)
  const stop = () => { clearInterval(iv); document.title = orig; window.removeEventListener('focus', stop) }
  window.addEventListener('focus', stop)
  setTimeout(stop, 8000)
}

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

  const playerId   = sessionStorage.getItem('playerId')
  const playerNum  = sessionStorage.getItem('playerNum')
  const myName     = sessionStorage.getItem('playerName') || ''

  const [characters, setCharacters] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('characters') || '[]') } catch { return [] }
  })
  const [secretCharacter] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('secretCharacter') || 'null') } catch { return null }
  })

  const [opponentName, setOpponentName] = useState(() => sessionStorage.getItem('opponentName') || '')

  const [phase,          setPhase]          = useState(playerNum === '1' ? 'waiting' : 'ready')
  const [flipped,        setFlipped]        = useState({})
  const [flipping,       setFlipping]       = useState(new Set())
  // Turn system: player1 always goes first
  const [myTurn,         setMyTurn]         = useState(playerNum === '1')
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

    socket.on('game_started', ({ characters: chars, opponentName: oName, firstTurn, currentTurn }) => {
      setCharacters(chars)
      sessionStorage.setItem('characters', JSON.stringify(chars))
      setOpponentConnected(true)
      // Only move to 'ready' if we're still in 'waiting' (don't regress from 'playing')
      setPhase(prev => prev === 'waiting' || prev === 'ready' ? 'ready' : prev)
      if (oName) { setOpponentName(oName); sessionStorage.setItem('opponentName', oName) }
      // Restore turn — use currentTurn if available (catch-up after reconnect), else firstTurn
      const turnId = currentTurn || firstTurn
      if (turnId) setMyTurn(turnId === playerId)
      // Notify player1 that opponent joined (play sound + flash tab)
      playChime()
      flashTabTitle(`🔔 ${oName || 'היריב'} הצטרף!`)
      addChat({ kind: 'system', text: `${oName ? oName + ' הצטרף' : 'היריב הצטרף'}! המשחק מתחיל 🎮` })
    })
    socket.on('receive_question', ({ question }) => {
      setPendingQuestion(question)
      addChat({ kind: 'their_question', text: question })
    })
    socket.on('question_answered', ({ question, answer }) => {
      setPendingQuestion(null)
      addChat({ kind: 'answer', question, answer })
    })
    socket.on('turn_changed', ({ currentTurn }) => {
      setMyTurn(currentTurn === playerId)
    })
    socket.on('game_over', (r) => {
      setGameResult(r); setPhase('gameOver')
      setGuessMode(false); setGuessConfirm(null)
    })
    socket.on('opponent_disconnected', () => setDisconnected(true))

    return () => {
      ['game_started','receive_question','question_answered','turn_changed','game_over','opponent_disconnected']
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
    const q = questionInput.trim(); if (!q || !myTurn) return
    socket.emit('send_question', { code, playerId, question: q })
    addChat({ kind: 'my_question', text: q })
    setQuestionInput('')
  }

  const handleAnswer = (answer) => {
    socket.emit('answer_question', { code, question: pendingQuestion, answer })
  }

  const handleCardClick = useCallback((char) => {
    if (phase !== 'playing') return
    if (secretCharacter && char.id === secretCharacter.id) return
    if (guessMode) { setGuessConfirm(char); return }
    if (flipping.has(char.id)) return // prevent double-click during flip animation
    // Play flip animation, toggle blurred state at the halfway point
    setFlipping(prev => new Set([...prev, char.id]))
    setTimeout(() => setFlipped(prev => ({ ...prev, [char.id]: !prev[char.id] })), 160)
    setTimeout(() => setFlipping(prev => { const n = new Set(prev); n.delete(char.id); return n }), 320)
  }, [phase, guessMode, secretCharacter, flipping])

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
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button style={S.btn} onClick={() => navigate('/')}>🏠 דף הבית</button>
            <button style={{ ...S.btn, background: 'linear-gradient(135deg, #f59e0b, #d97706)' }} onClick={() => navigate('/leaderboard')}>🏅 לידרבורד</button>
          </div>
        </div>
      </div>
    )
  }

  // ══════════════════ WAITING ══════════════════
  if (phase === 'waiting') return (
    <WaitingScreen code={code} myName={myName} />
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
            {opponentConnected ? (opponentName ? `משחקים נגד ${opponentName}!` : 'שני השחקנים מחוברים!') : 'מחכים...'}
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
        <span style={{ fontWeight: 800, color: 'white', fontSize: isMobile ? '0.9rem' : '1rem', fontFamily: 'Heebo, sans-serif' }}>
          🃏 נחש לביא
          {opponentName ? <span style={{ fontSize: '0.75rem', opacity: 0.7, fontWeight: 400, marginRight: 8 }}>נגד {opponentName}</span> : null}
        </span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={S.codeBadge}>{code}</span>
          {phase === 'playing' && (
            guessMode
              ? <button className="btn-3d" style={{ ...S.btn, background: '#64748b', padding: '7px 14px', fontSize: '0.82rem' }}
                  onClick={() => { setGuessMode(false); setGuessConfirm(null) }}>✕ בטל</button>
              : <button className="btn-3d" style={{ ...S.btn, background: '#F20D0D', padding: '7px 14px', fontSize: '0.82rem' }}
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
        <div style={{ background: '#fff1f1', color: '#C00A0A', padding: '7px 14px', textAlign: 'center', fontWeight: 700, fontSize: '0.85rem', borderBottom: '2px solid #fca5a5', fontFamily: 'Heebo, sans-serif' }}>
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
          maxHeight: isMobile ? 'calc(100dvh - 260px)' : undefined,
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? 'repeat(3, 1fr)' : 'repeat(6, 1fr)',
            gap: isMobile ? 8 : 10,
          }}>
            {characters.map((char, idx) => {
              const isFlipped  = !!flipped[char.id]
              const isFlipping = flipping.has(char.id)
              const isMySecret = !!(secretCharacter && char.id === secretCharacter.id)
              return (
                <div
                  key={char.id}
                  onClick={() => handleCardClick(char)}
                  className={[
                    'char-card',
                    isFlipped || isMySecret ? 'char-card--disabled' : '',
                    isFlipping ? 'char-card--flipping' : '',
                  ].join(' ')}
                  style={{
                    position: 'relative',
                    borderRadius: 16,
                    overflow: 'hidden',
                    cursor: phase === 'playing' && !isMySecret && !isFlipped ? 'pointer' : 'default',
                    background: 'white',
                    // Red border normally; purple for own secret; orange outline in guess mode
                    border: isMySecret
                      ? '4px solid #7c3aed'
                      : isFlipped ? '4px solid #E2E8F0'
                      : '4px solid #F20D0D',
                    boxShadow: isMySecret
                      ? '0 0 0 1px #a78bfa, 0 0 16px rgba(124,58,237,0.45)'
                      : isFlipped ? '0 2px 6px rgba(0,0,0,0.07)'
                      : guessMode ? '0 0 0 3px #ff9800, 0 4px 16px rgba(255,152,0,0.3)'
                      : '0 4px 14px rgba(0,0,0,0.12)',
                    // grayscale + blur for eliminated; blur-only for own secret
                    filter: isFlipped && !isMySecret
                      ? 'blur(3px) grayscale(1) brightness(0.8)'
                      : 'none',
                    transform: guessMode && !isFlipped && !isMySecret ? 'scale(1.04)' : 'scale(1)',
                    // staggered card entrance
                    animation: `cardEnter 0.35s ease ${idx * 0.025}s both`,
                  }}
                >
                  <img
                    src={imgSrc(char)}
                    alt={char.name}
                    style={{
                      width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block',
                      filter: isMySecret ? 'blur(5px) brightness(0.65) saturate(0.4)' : 'none',
                      transform: isMySecret ? 'scale(1.12)' : 'scale(1)',
                      transition: 'filter 0.3s, transform 0.3s',
                    }}
                    onError={e => { e.target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect fill="%23ddd" width="80" height="80"/></svg>' }}
                  />

                  {/* "הדמות שלי" bar for own secret */}
                  {isMySecret && (
                    <div style={{
                      position: 'absolute', top: 0, left: 0, right: 0,
                      background: 'rgba(88,28,220,0.88)',
                      color: 'white',
                      fontSize: isMobile ? '0.5rem' : '0.55rem',
                      fontWeight: 800,
                      textAlign: 'center',
                      padding: '3px 2px',
                      fontFamily: 'Heebo, sans-serif',
                      zIndex: 3,
                    }}>
                      🎴 הדמות שלי
                    </div>
                  )}

                  {/* Name at bottom */}
                  <div style={{
                    position: 'absolute', bottom: 0, left: 0, right: 0,
                    background: isMySecret
                      ? 'linear-gradient(transparent, rgba(60,10,180,0.88))'
                      : isFlipped
                        ? 'linear-gradient(transparent, rgba(0,0,0,0.5))'
                        : 'linear-gradient(transparent, rgba(0,0,0,0.78))',
                    color: 'white',
                    fontSize: isMobile ? '0.58rem' : '0.65rem',
                    fontWeight: 700,
                    padding: isMySecret ? '10px 3px 4px' : '4px 3px',
                    textAlign: 'center',
                    fontFamily: 'Heebo, sans-serif',
                    zIndex: 2,
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
          ...(isMobile
            ? { flexShrink: 0, height: 220, borderTop: '2px solid #eee' }
            : { width: 300, minWidth: 260, borderRight: '1px solid #eee' }
          ),
          minHeight: 0,
        }}>
          {/* Turn indicator */}
          {phase === 'playing' && (
            <div style={{
              padding: '7px 12px',
              background: pendingQuestion
                ? '#fff7ed'
                : myTurn ? '#fff1f1' : '#f0f6ff',
              borderBottom: `3px solid ${pendingQuestion ? '#fb923c' : myTurn ? '#F20D0D' : '#0056B3'}`,
              display: 'flex', alignItems: 'center', gap: 6,
              flexShrink: 0,
            }}>
              <span style={{ fontSize: isMobile ? '0.7rem' : '0.75rem' }}>
                {pendingQuestion ? '❓' : myTurn ? '🔴' : '🔵'}
              </span>
              <span style={{
                fontWeight: 800,
                fontSize: isMobile ? '0.72rem' : '0.78rem',
                color: pendingQuestion ? '#9a3412' : myTurn ? '#C00A0A' : '#0056B3',
                fontFamily: 'Heebo, sans-serif',
              }}>
                {pendingQuestion
                  ? 'ענה כן או לא 👆'
                  : myTurn
                    ? 'התור שלך — שאל שאלה!'
                    : `התור של ${opponentName || 'היריב'}...`}
              </span>
            </div>
          )}

          {!isMobile && phase !== 'playing' && (
            <div style={{ padding: '10px 14px', fontWeight: 'bold', color: '#4a154b', borderBottom: '1px solid #eee', fontSize: '0.88rem' }}>
              💬 שאלות ותשובות
            </div>
          )}

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '6px 10px' : '10px 12px', minHeight: 0 }}>
            {chatLog.length === 0 && (
              <div style={{ color: '#ccc', textAlign: 'center', marginTop: 12, fontSize: '0.8rem' }}>
                {myTurn ? 'שאל שאלת כן/לא 👇' : `ממתין לשאלה של ${opponentName || 'היריב'}...`}
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
              style={{
                flex: 1, padding: '8px 10px', fontSize: '0.88rem',
                border: `2px solid ${myTurn && !pendingQuestion ? '#F20D0D' : '#E2E8F0'}`,
                borderRadius: 10, outline: 'none', direction: 'rtl',
                background: (!myTurn || pendingQuestion) ? '#F8FAFC' : 'white',
                fontFamily: 'Heebo, sans-serif',
                transition: 'border-color 0.2s, background 0.2s',
              }}
              value={questionInput}
              onChange={e => setQuestionInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSendQuestion()}
              placeholder={
                pendingQuestion ? 'ממתין לתשובה...'
                : !myTurn ? `התור של ${opponentName || 'היריב'}...`
                : 'שאל שאלה...'
              }
              disabled={!!pendingQuestion || !myTurn}
              maxLength={100}
            />
            <button
              className="btn-3d"
              style={{ ...S.btn, padding: '8px 14px', fontSize: '0.85rem', opacity: (pendingQuestion || !myTurn || !questionInput.trim()) ? 0.35 : 1 }}
              onClick={handleSendQuestion}
              disabled={!!pendingQuestion || !myTurn || !questionInput.trim()}
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

// ══════════════════ WAITING SCREEN ══════════════════
function WaitingScreen({ code, myName }) {
  const [copied, setCopied] = useState(false)
  const shareUrl = `${window.location.origin}/join/${code}`

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      const el = document.getElementById('share-url-input')
      el?.select()
    }
  }

  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(`בוא נשחק נחש לביא! לחץ כאן להצטרף: ${shareUrl}`)}`

  return (
    <div style={{
      minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(160deg, #1e1b4b, #312e81, #1e3a5f)', padding: 20,
    }}>
      <div className="btn-glow" style={{ background: 'white', borderRadius: 28, padding: '36px 28px', maxWidth: 420, width: '100%', textAlign: 'center', boxShadow: '0 24px 64px rgba(0,0,0,0.4)' }}>
        {/* Animated radar/pulse waiting icon */}
        <div style={{ position: 'relative', display: 'inline-block', marginBottom: 16 }}>
          <div className="pulse-glow" style={{
            width: 64, height: 64, borderRadius: '50%',
            background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.9rem', margin: '0 auto',
          }}>🃏</div>
        </div>
        <h2 style={{ color: '#312e81', fontFamily: 'Rubik, sans-serif', fontWeight: 800, marginBottom: 6 }}>
          ממתין ליריב...
        </h2>
        {myName && <p style={{ color: '#7c3aed', fontWeight: 700, fontSize: '0.9rem', marginBottom: 4, fontFamily: 'Rubik, sans-serif' }}>שלום, {myName}!</p>}
        <p style={{ color: '#6b7280', fontSize: '0.9rem', marginBottom: 4, fontFamily: 'Rubik, sans-serif' }}>
          שלח את הקישור לחבר שישחק נגדך
        </p>
        <p style={{ color: '#d1d5db', fontSize: '0.78rem', marginBottom: 20, fontFamily: 'Rubik, sans-serif' }}>
          🔔 כשהחבר יצטרף תשמע צליל — שמור על המסך דלוק
        </p>

        {/* Shareable URL box */}
        <div style={{ background: '#f5f3ff', borderRadius: 14, padding: '12px 14px', marginBottom: 14, border: '2px solid #e0e7ff' }}>
          <input
            id="share-url-input"
            readOnly
            value={shareUrl}
            style={{
              width: '100%', background: 'none', border: 'none', outline: 'none',
              fontSize: '0.82rem', color: '#4338ca', fontFamily: 'Rubik, sans-serif',
              textAlign: 'center', direction: 'ltr', cursor: 'text',
            }}
            onFocus={e => e.target.select()}
          />
        </div>

        {/* Copy + WhatsApp buttons */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
          <button
            onClick={copyLink}
            style={{
              flex: 1, padding: '11px', borderRadius: 50, border: 'none', cursor: 'pointer',
              background: copied ? '#16a34a' : 'linear-gradient(135deg, #F20D0D, #C00A0A)',
              color: 'white', fontWeight: 800, fontSize: '0.9rem',
              fontFamily: 'Heebo, sans-serif', transition: 'background 0.3s',
            }}
            className={copied ? '' : 'btn-glow'}
          >
            {copied ? '✅ הועתק!' : '📋 העתק קישור'}
          </button>
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              flex: 1, padding: '11px', borderRadius: 50, textDecoration: 'none',
              background: '#25D366', color: 'white', fontWeight: 700, fontSize: '0.9rem',
              fontFamily: 'Rubik, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}
          >
            💬 WhatsApp
          </a>
        </div>

        <p style={{ color: '#9ca3af', fontSize: '0.8rem', fontFamily: 'Rubik, sans-serif' }}>
          המשחק יתחיל אוטומטית כשהיריב יצטרף
        </p>
      </div>
    </div>
  )
}

const S = {
  page:      { height: '100dvh', background: '#F8FAFC', direction: 'rtl', display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  header:    {
    background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
    boxShadow: '0 2px 12px rgba(0,0,0,0.5)',
    padding: '9px 14px', display: 'flex', alignItems: 'center',
    justifyContent: 'space-between', gap: 8, flexShrink: 0, zIndex: 20,
  },
  codeBadge: { background: 'rgba(242,13,13,0.25)', color: 'white', padding: '4px 10px', borderRadius: 20, fontWeight: 700, fontSize: '0.88rem', letterSpacing: 2, fontFamily: 'Heebo, sans-serif', border: '1px solid rgba(242,13,13,0.4)' },
  ansBtn:    { padding: '8px', border: 'none', borderRadius: 10, fontSize: '0.88rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'Heebo, sans-serif' },
  btn:       { background: 'linear-gradient(135deg, #F20D0D, #C00A0A)', color: 'white', border: 'none', borderRadius: 50, padding: '10px 18px', fontSize: '0.9rem', fontWeight: 800, cursor: 'pointer', fontFamily: 'Heebo, sans-serif' },
  overlay:   { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 },
  modal:     { background: 'white', borderRadius: 24, padding: '28px 22px', maxWidth: 370, width: '100%', textAlign: 'center', boxShadow: '0 24px 60px rgba(0,0,0,0.4)', fontFamily: 'Heebo, sans-serif' },
  secretCard:{ background: 'white', borderRadius: 24, padding: 28, textAlign: 'center', fontFamily: 'Heebo, sans-serif' },
  codeBox:   { fontSize: '2.8rem', fontWeight: 900, letterSpacing: 8, color: '#F20D0D', background: '#fff1f1', borderRadius: 16, padding: '14px 20px', display: 'inline-block', fontFamily: 'Heebo, sans-serif' },
  resultImg: { width: 95, height: 95, objectFit: 'cover', borderRadius: 12, border: '3px solid #F20D0D' },
}
