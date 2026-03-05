import React, { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import socket from '../socket'

const API_BASE = import.meta.env.VITE_BACKEND_URL || ''

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
  const { slug, code } = useParams()
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

  const chatEndRef   = useRef(null)
  const secretRef    = useRef(null)
  const firstJoinRef = useRef(false)

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [chatLog, pendingQuestion])

  useEffect(() => {
    if (!playerId) { navigate('/'); return }

    const doJoinRoom = () => socket.emit('join_room', { code, playerId })
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        if (!socket.connected) socket.connect()
        else doJoinRoom()
      }
    }

    socket.on('connect', doJoinRoom)
    document.addEventListener('visibilitychange', handleVisibility)
    socket.connect()

    socket.on('game_started', ({ characters: chars, opponentName: oName, firstTurn, currentTurn }) => {
      const isFirst = !firstJoinRef.current
      firstJoinRef.current = true
      setCharacters(chars)
      sessionStorage.setItem('characters', JSON.stringify(chars))
      setOpponentConnected(true)
      setPhase(prev => prev === 'waiting' || prev === 'ready' ? 'ready' : prev)
      if (oName) { setOpponentName(oName); sessionStorage.setItem('opponentName', oName) }
      const turnId = currentTurn || firstTurn
      if (turnId) setMyTurn(turnId === playerId)
      if (isFirst) {
        playChime()
        flashTabTitle(`🔔 ${oName || 'היריב'} הצטרף!`)
        addChat({ kind: 'system', text: `${oName ? oName + ' הצטרף' : 'היריב הצטרף'}! המשחק מתחיל 🎮` })
      }
    })
    socket.on('receive_question', ({ question }) => {
      setPendingQuestion(question)
      addChat({ kind: 'their_question', text: question })
    })
    socket.on('question_answered', ({ question, answer }) => {
      setPendingQuestion(null)
      addChat({ kind: 'answer', question, answer })
    })
    socket.on('turn_changed', ({ currentTurn }) => setMyTurn(currentTurn === playerId))
    socket.on('game_over', (r) => {
      setGameResult(r); setPhase('gameOver')
      setGuessMode(false); setGuessConfirm(null)
    })
    socket.on('opponent_disconnected', () => setDisconnected(true))
    socket.on('opponent_reconnected',  () => setDisconnected(false))

    return () => {
      socket.off('connect', doJoinRoom)
      document.removeEventListener('visibilitychange', handleVisibility)
      ;['game_started','receive_question','question_answered','turn_changed','game_over','opponent_disconnected','opponent_reconnected']
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

  const handleAnswer = (answer) => socket.emit('answer_question', { code, question: pendingQuestion, answer })

  const handleCardClick = useCallback((char) => {
    if (phase !== 'playing') return
    if (secretCharacter && char.id === secretCharacter.id) return
    if (guessMode) { setGuessConfirm(char); return }
    if (flipping.has(char.id)) return
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

  // ── GAME OVER ──
  if (phase === 'gameOver' && gameResult) {
    const isWinner = gameResult.winner === playerId
    return (
      <div style={S.overlay}>
        <div style={{ ...S.modal, maxHeight: '90dvh', overflowY: 'auto' }}>
          <div style={{ fontSize: '3.5rem' }}>{isWinner ? '🏆' : '😢'}</div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 900, color: isWinner ? '#2a9d2a' : '#c00', margin: '10px 0', fontFamily: 'Heebo, sans-serif' }}>
            {isWinner ? 'ניצחת!' : 'הפסדת!'}
          </h1>
          <p style={{ color: '#555', marginBottom: 12, fontFamily: 'Heebo, sans-serif', fontWeight: 600 }}>
            {gameResult.correct ? 'ניחשת נכון! 🎉' : gameResult.guesser === playerId ? 'ניחשת לא נכון!' : 'היריב ניחש לא נכון!'}
          </p>
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap', margin: '12px 0' }}>
            {gameResult.guessedCharacter && (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '0.78rem', color: '#888', marginBottom: 4, fontFamily: 'Heebo, sans-serif' }}>ניחשו:</div>
                <img src={imgSrc(gameResult.guessedCharacter)} alt="" style={S.resultImg} />
                <div style={{ fontWeight: 800, fontSize: '0.85rem', marginTop: 4, fontFamily: 'Heebo, sans-serif' }}>{gameResult.guessedCharacter.name}</div>
              </div>
            )}
            {gameResult.correctCharacter && (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '0.78rem', color: '#888', marginBottom: 4, fontFamily: 'Heebo, sans-serif' }}>הדמות האמיתית:</div>
                <img src={imgSrc(gameResult.correctCharacter)} alt="" style={S.resultImg} />
                <div style={{ fontWeight: 800, fontSize: '0.85rem', marginTop: 4, fontFamily: 'Heebo, sans-serif' }}>{gameResult.correctCharacter.name}</div>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="nb-btn" style={S.btnYellow} onClick={() => navigate(`/${slug}`)}>🏠 דף הבית</button>
            <button className="nb-btn" style={S.btnWhite} onClick={() => navigate(`/${slug}/leaderboard`)}>🏅 לוח מנחשים</button>
          </div>
        </div>
      </div>
    )
  }

  // ── WAITING ──
  if (phase === 'waiting') return <WaitingScreen slug={slug} code={code} myName={myName} />

  // ── REVEAL SECRET ──
  if (phase === 'ready') return (
    <div style={S.overlay}>
      {showSecret && secretCharacter ? (
        <div style={S.modal}>
          <div style={{ fontSize: '0.9rem', color: '#888', marginBottom: 8, fontFamily: 'Heebo, sans-serif' }}>נעלמת בעוד {secretTimer}...</div>
          <img src={imgSrc(secretCharacter)} alt={secretCharacter.name}
            style={{ width: 180, height: 180, objectFit: 'cover', borderRadius: 12, border: '3px solid #ffd23f', display: 'block', margin: '0 auto 12px' }} />
          <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#111', fontFamily: 'Heebo, sans-serif', marginBottom: 4 }}>{secretCharacter.name}</div>
          <div style={{ fontSize: '0.8rem', color: '#888', fontFamily: 'Heebo, sans-serif' }}>זכור! לא תראה אותה שוב</div>
        </div>
      ) : (
        <div style={S.modal}>
          <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>🎴</div>
          <h2 style={{ color: '#111', marginBottom: 8, fontFamily: 'Heebo, sans-serif', fontWeight: 900 }}>
            {opponentConnected ? (opponentName ? `משחקים נגד ${opponentName}!` : 'שני השחקנים מחוברים!') : 'מחכים...'}
          </h2>
          <p style={{ color: '#555', marginBottom: 24, fontSize: '0.9rem', fontFamily: 'Heebo, sans-serif', fontWeight: 600 }}>
            לחץ לראות את הדמות הסודית שלך — 3 שניות בלבד!
          </p>
          <button className="nb-btn" style={{ ...S.btnYellow, fontSize: '1.05rem', padding: '13px 26px', width: '100%' }} onClick={handleRevealSecret}>
            🔍 הצג לי את הדמות שלי
          </button>
        </div>
      )}
    </div>
  )

  // ── MAIN GAME ──
  return (
    <div style={S.page}>

      {/* Header */}
      <div style={S.header}>
        <span style={{ fontWeight: 900, color: 'white', fontSize: isMobile ? '0.9rem' : '1rem', fontFamily: 'Heebo, sans-serif' }}>
          🃏 נחש מי
          {opponentName && <span style={{ fontSize: '0.75rem', opacity: 0.6, fontWeight: 400, marginRight: 8 }}>נגד {opponentName}</span>}
        </span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={S.codeBadge}>{code}</span>
          {phase === 'playing' && (
            guessMode
              ? <button className="nb-btn" style={{ ...S.btnSmall, background: '#888', color: 'white' }}
                  onClick={() => { setGuessMode(false); setGuessConfirm(null) }}>✕ בטל</button>
              : <button className="nb-btn" style={{ ...S.btnSmall, background: '#ffd23f', color: '#111' }}
                  onClick={() => setGuessMode(true)}>🎯 ניחוש!</button>
          )}
        </div>
      </div>

      {disconnected && (
        <div style={{ background: '#fff0f0', color: '#c00', padding: '5px 14px', textAlign: 'center', fontSize: '0.82rem', borderBottom: '2px solid #c00', fontFamily: 'Heebo, sans-serif', fontWeight: 700 }}>
          ⚠️ היריב התנתק
        </div>
      )}

      {guessMode && (
        <div style={{ background: '#ffd23f', color: '#111', padding: '7px 14px', textAlign: 'center', fontWeight: 900, fontSize: '0.85rem', borderBottom: '2.5px solid #111', fontFamily: 'Heebo, sans-serif' }}>
          👆 בחר את הדמות שאתה חושב שהיא הסוד של היריב
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', flex: 1, overflow: 'hidden', minHeight: 0 }}>

        {/* Board */}
        <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '8px' : '12px', minHeight: 0, maxHeight: isMobile ? 'calc(100dvh - 260px)' : undefined }}>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(3, 1fr)' : 'repeat(6, 1fr)', gap: isMobile ? 6 : 8 }}>
            {characters.map((char, idx) => {
              const isFlipped  = !!flipped[char.id]
              const isFlipping = flipping.has(char.id)
              const isMySecret = !!(secretCharacter && char.id === secretCharacter.id)
              return (
                <div
                  key={char.id}
                  onClick={() => handleCardClick(char)}
                  className={['char-card', isFlipped || isMySecret ? 'char-card--disabled' : '', isFlipping ? 'char-card--flipping' : ''].join(' ')}
                  style={{
                    position: 'relative', borderRadius: 10, overflow: 'hidden',
                    cursor: phase === 'playing' && !isMySecret && !isFlipped ? 'pointer' : 'default',
                    background: isMySecret ? '#ffd23f' : isFlipped ? '#e8e8e8' : 'white',
                    border: isMySecret ? '2.5px solid #111'
                          : isFlipped  ? '2px solid #bbb'
                          : guessMode  ? '2.5px solid #e63946'
                          : '2px solid #111',
                    boxShadow: isMySecret ? '3px 3px 0 #111'
                             : isFlipped  ? 'none'
                             : guessMode  ? '3px 3px 0 #e63946'
                             : '2px 2px 0 #111',
                    filter: isFlipped ? 'grayscale(1) brightness(0.85)' : 'none',
                    transform: guessMode && !isFlipped && !isMySecret ? 'scale(1.03)' : 'scale(1)',
                    animation: `cardEnter 0.35s ease ${idx * 0.025}s both`,
                    transition: 'transform 0.1s ease, box-shadow 0.1s ease',
                  }}
                >
                  <img
                    src={imgSrc(char)} alt={char.name}
                    style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block' }}
                    onError={e => { e.target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect fill="%23ddd" width="80" height="80"/></svg>' }}
                  />

                  {isMySecret && (
                    <div style={{
                      position: 'absolute', top: 0, left: 0, right: 0,
                      background: '#111', color: '#ffd23f',
                      fontSize: isMobile ? '0.48rem' : '0.52rem',
                      fontWeight: 900, textAlign: 'center', padding: '3px 2px',
                      fontFamily: 'Heebo, sans-serif', zIndex: 3,
                    }}>🎴 הדמות שלי</div>
                  )}

                  <div style={{
                    position: 'absolute', bottom: 0, left: 0, right: 0,
                    background: isMySecret ? 'rgba(0,0,0,0.7)' : isFlipped ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0.72)',
                    color: isMySecret ? '#ffd23f' : 'white',
                    fontSize: isMobile ? '0.55rem' : '0.62rem',
                    fontWeight: 900, padding: '4px 3px',
                    textAlign: 'center', fontFamily: 'Heebo, sans-serif', zIndex: 2,
                  }}>
                    {char.name}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Chat Panel */}
        <div style={{
          display: 'flex', flexDirection: 'column', background: 'white',
          ...(isMobile
            ? { flexShrink: 0, height: 220, borderTop: '2.5px solid #111' }
            : { width: 300, minWidth: 260, borderRight: '2.5px solid #111' }
          ),
          minHeight: 0,
        }}>
          {/* Turn indicator */}
          {phase === 'playing' && (
            <div style={{
              padding: '7px 12px',
              background: pendingQuestion ? '#fff3cd' : myTurn ? '#ffd23f' : '#e8f4ff',
              borderBottom: `2.5px solid #111`,
              display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
            }}>
              <span style={{ fontSize: isMobile ? '0.7rem' : '0.75rem' }}>
                {pendingQuestion ? '❓' : myTurn ? '🔴' : '🔵'}
              </span>
              <span style={{ fontWeight: 900, fontSize: isMobile ? '0.72rem' : '0.78rem', color: '#111', fontFamily: 'Heebo, sans-serif' }}>
                {pendingQuestion ? 'ענה כן או לא 👆'
                  : myTurn ? 'התור שלך — שאל שאלה!'
                  : `התור של ${opponentName || 'היריב'}...`}
              </span>
            </div>
          )}

          {!isMobile && phase !== 'playing' && (
            <div style={{ padding: '10px 14px', fontWeight: 900, color: '#111', borderBottom: '2px solid #eee', fontSize: '0.88rem', fontFamily: 'Heebo, sans-serif' }}>
              💬 שאלות ותשובות
            </div>
          )}

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '6px 10px' : '10px 12px', minHeight: 0 }}>
            {chatLog.length === 0 && (
              <div style={{ color: '#bbb', textAlign: 'center', marginTop: 12, fontSize: '0.8rem', fontFamily: 'Heebo, sans-serif' }}>
                {myTurn ? 'שאל שאלת כן/לא 👇' : `ממתין לשאלה של ${opponentName || 'היריב'}...`}
              </div>
            )}
            {chatLog.map(msg => <ChatMsg key={msg.id} msg={msg} isMobile={isMobile} />)}

            {pendingQuestion && (
              <div style={{ margin: '6px 0' }}>
                <div style={{ background: '#fffbeb', border: '2px solid #111', borderRadius: 8, padding: '6px 10px', fontSize: '0.83rem', color: '#111', marginBottom: 5, fontFamily: 'Heebo, sans-serif', fontWeight: 700 }}>
                  ❓ {pendingQuestion}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="nb-btn" style={{ ...S.ansBtn, background: '#2dc653', color: 'white', flex: 1 }} onClick={() => handleAnswer('כן')}>✅ כן</button>
                  <button className="nb-btn" style={{ ...S.ansBtn, background: '#e63946', color: 'white', flex: 1 }} onClick={() => handleAnswer('לא')}>❌ לא</button>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          <div style={{ padding: isMobile ? '7px 10px' : '9px 12px', borderTop: '2px solid #111', display: 'flex', gap: 7, flexShrink: 0 }}>
            <input
              style={{
                flex: 1, padding: '8px 10px', fontSize: '0.88rem',
                border: `2px solid ${myTurn && !pendingQuestion ? '#111' : '#ccc'}`,
                borderRadius: 8, outline: 'none', direction: 'rtl',
                background: (!myTurn || pendingQuestion) ? '#f5f5f5' : 'white',
                fontFamily: 'Heebo, sans-serif', fontWeight: 600,
                boxShadow: myTurn && !pendingQuestion ? '2px 2px 0 #111' : 'none',
              }}
              value={questionInput}
              onChange={e => setQuestionInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSendQuestion()}
              placeholder={pendingQuestion ? 'ממתין לתשובה...' : !myTurn ? `התור של ${opponentName || 'היריב'}...` : 'שאל שאלה...'}
              disabled={!!pendingQuestion || !myTurn}
              maxLength={100}
            />
            <button className="nb-btn" style={{
              ...S.btnSmall, background: (pendingQuestion || !myTurn || !questionInput.trim()) ? '#ddd' : '#ffd23f',
              color: '#111', padding: '8px 12px',
              opacity: 1,
            }}
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
            <h2 style={{ color: '#111', marginBottom: 14, fontFamily: 'Heebo, sans-serif', fontWeight: 900 }}>ניחוש סופי?</h2>
            <img src={imgSrc(guessConfirm)} alt={guessConfirm.name}
              style={{ width: 120, height: 120, objectFit: 'cover', borderRadius: 10, border: '3px solid #111', display: 'block', margin: '0 auto 10px', boxShadow: '4px 4px 0 #111' }} />
            <div style={{ fontWeight: 900, fontSize: '1.15rem', color: '#111', marginBottom: 8, fontFamily: 'Heebo, sans-serif' }}>{guessConfirm.name}</div>
            <p style={{ color: '#666', marginBottom: 18, fontSize: '0.85rem', fontFamily: 'Heebo, sans-serif', fontWeight: 600 }}>לא ניתן לחזור אחרי אישור!</p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button className="nb-btn" style={S.btnYellow} onClick={handleConfirmGuess}>✅ זה הניחוש שלי!</button>
              <button className="nb-btn" style={S.btnWhite} onClick={() => setGuessConfirm(null)}>← בטל</button>
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
    return <div style={{ textAlign: 'center', color: '#aaa', fontSize: '0.72rem', margin: '4px 0', fontStyle: 'italic', fontFamily: 'Heebo, sans-serif' }}>{msg.text}</div>
  if (msg.kind === 'my_question')
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-start', margin: '4px 0' }}>
        <div style={{ background: '#111', color: 'white', borderRadius: '10px 10px 0 10px', padding: '6px 10px', maxWidth: '85%', fontSize: fs, fontFamily: 'Heebo, sans-serif', fontWeight: 600 }}>
          ❓ {msg.text}
        </div>
      </div>
    )
  if (msg.kind === 'their_question')
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-end', margin: '4px 0' }}>
        <div style={{ background: '#f0f0eb', color: '#111', borderRadius: '10px 10px 10px 0', padding: '6px 10px', maxWidth: '85%', fontSize: fs, fontFamily: 'Heebo, sans-serif', fontWeight: 600 }}>
          ❓ {msg.text}
        </div>
      </div>
    )
  if (msg.kind === 'answer') {
    const q = msg.question?.length > 22 ? msg.question.slice(0, 22) + '…' : msg.question
    return (
      <div style={{ textAlign: 'center', margin: '4px 0' }}>
        <div style={{ display: 'inline-block', background: msg.answer === 'כן' ? '#e8f9ed' : '#fef0f0', border: `2px solid ${msg.answer === 'כן' ? '#2dc653' : '#e63946'}`, borderRadius: 8, padding: '3px 10px', fontSize: '0.77rem', fontFamily: 'Heebo, sans-serif' }}>
          <span style={{ color: '#888' }}>"{q}" ← </span>
          <strong style={{ color: msg.answer === 'כן' ? '#2a9d2a' : '#c00' }}>
            {msg.answer === 'כן' ? '✅ כן' : '❌ לא'}
          </strong>
        </div>
      </div>
    )
  }
  return null
}

// ── WAITING SCREEN ──
function WaitingScreen({ slug, code, myName }) {
  const [copied, setCopied] = useState(false)
  const shareUrl = `${window.location.origin}/${slug}/join/${code}`

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      document.getElementById('share-url-input')?.select()
    }
  }

  const inviteText = myName
    ? `${myName} מזמין אותך לשחק נחש מי! לחץ כאן להצטרף: ${shareUrl}`
    : `בוא נשחק נחש מי! לחץ כאן להצטרף: ${shareUrl}`
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(inviteText)}`

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fffdf5', padding: 20, direction: 'rtl' }}>
      <div style={{ background: 'white', border: '2.5px solid #111', borderRadius: 20, boxShadow: '7px 7px 0 #111', padding: '36px 28px', maxWidth: 420, width: '100%', textAlign: 'center' }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#ffd23f', border: '2.5px solid #111', boxShadow: '3px 3px 0 #111', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.9rem', margin: '0 auto 16px' }}>🃏</div>
        <h2 style={{ color: '#111', fontFamily: 'Heebo, sans-serif', fontWeight: 900, marginBottom: 6, fontSize: '1.5rem' }}>ממתין ליריב...</h2>
        {myName && <p style={{ color: '#555', fontWeight: 700, fontSize: '0.9rem', marginBottom: 4, fontFamily: 'Heebo, sans-serif' }}>שלום, {myName}!</p>}
        <p style={{ color: '#555', fontSize: '0.9rem', marginBottom: 4, fontFamily: 'Heebo, sans-serif', fontWeight: 600 }}>שלח את הקישור לחבר שישחק נגדך</p>
        <p style={{ color: '#999', fontSize: '0.78rem', marginBottom: 20, fontFamily: 'Heebo, sans-serif' }}>🔔 כשהחבר יצטרף תשמע צליל — שמור על המסך דלוק</p>

        <div style={{ background: '#f5f5f0', border: '2px solid #111', borderRadius: 10, padding: '10px 12px', marginBottom: 14 }}>
          <input
            id="share-url-input" readOnly value={shareUrl}
            style={{ width: '100%', background: 'none', border: 'none', outline: 'none', fontSize: '0.8rem', color: '#555', fontFamily: 'Heebo, sans-serif', textAlign: 'center', direction: 'ltr', cursor: 'text' }}
            onFocus={e => e.target.select()}
          />
        </div>

        <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
          <button className="nb-btn" onClick={copyLink}
            style={{ flex: 1, padding: '11px', borderRadius: 10, background: copied ? '#2dc653' : '#ffd23f', color: '#111', fontWeight: 800, fontSize: '0.9rem', fontFamily: 'Heebo, sans-serif' }}>
            {copied ? '✅ הועתק!' : '📋 העתק קישור'}
          </button>
          <a href={whatsappUrl} target="_blank" rel="noopener noreferrer"
            style={{ flex: 1, padding: '11px', borderRadius: 10, textDecoration: 'none', background: '#25D366', color: 'white', fontWeight: 800, fontSize: '0.9rem', fontFamily: 'Heebo, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, border: '2.5px solid #111', boxShadow: '4px 4px 0 #111' }}>
            💬 WhatsApp
          </a>
        </div>

        <p style={{ color: '#aaa', fontSize: '0.8rem', fontFamily: 'Heebo, sans-serif' }}>המשחק יתחיל אוטומטית כשהיריב יצטרף</p>
      </div>
    </div>
  )
}

const S = {
  page:      { height: '100dvh', background: '#fffdf5', direction: 'rtl', display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  header:    { background: '#111', padding: '9px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexShrink: 0, zIndex: 20 },
  codeBadge: { background: '#ffd23f', color: '#111', padding: '4px 10px', borderRadius: 6, fontWeight: 900, fontSize: '0.88rem', letterSpacing: 2, fontFamily: 'Heebo, sans-serif', border: '1.5px solid #111' },
  ansBtn:    { padding: '8px', border: '2px solid #111', borderRadius: 8, fontSize: '0.88rem', fontWeight: 800, cursor: 'pointer', fontFamily: 'Heebo, sans-serif' },
  btnYellow: { background: '#ffd23f', borderRadius: 10, padding: '11px 20px', fontSize: '0.95rem', fontWeight: 800, color: '#111', fontFamily: 'Heebo, sans-serif' },
  btnWhite:  { background: 'white', borderRadius: 10, padding: '11px 20px', fontSize: '0.95rem', fontWeight: 800, color: '#111', fontFamily: 'Heebo, sans-serif' },
  btnSmall:  { borderRadius: 8, padding: '6px 12px', fontSize: '0.82rem', fontWeight: 800, fontFamily: 'Heebo, sans-serif', border: '2px solid rgba(255,255,255,0.4)', boxShadow: 'none' },
  overlay:   { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 },
  modal:     { background: 'white', border: '2.5px solid #111', borderRadius: 20, boxShadow: '7px 7px 0 #111', padding: '28px 22px', maxWidth: 370, width: '100%', textAlign: 'center', fontFamily: 'Heebo, sans-serif' },
  resultImg: { width: 95, height: 95, objectFit: 'cover', borderRadius: 10, border: '2.5px solid #111', boxShadow: '3px 3px 0 #111' },
}
