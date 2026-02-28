import React, { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import socket from '../socket'

const API_BASE = import.meta.env.VITE_BACKEND_URL || ''

export default function GameRoom() {
  const { code } = useParams()
  const navigate = useNavigate()

  const playerId = sessionStorage.getItem('playerId')
  const playerNum = sessionStorage.getItem('playerNum')
  const [characters, setCharacters] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('characters') || '[]') } catch { return [] }
  })
  const [secretCharacter, setSecretCharacter] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('secretCharacter') || 'null') } catch { return null }
  })

  const [phase, setPhase] = useState(playerNum === '1' ? 'waiting' : 'ready') // waiting | ready | showSecret | playing | gameOver
  const [flipped, setFlipped] = useState({}) // characterId -> true (darkened)
  const [showSecret, setShowSecret] = useState(false)
  const [secretTimer, setSecretTimer] = useState(0)
  const [guessInput, setGuessInput] = useState('')
  const [gameResult, setGameResult] = useState(null)
  const [opponentConnected, setOpponentConnected] = useState(playerNum === '2')
  const [gameMessage, setGameMessage] = useState('')
  const [opponentFlipped, setOpponentFlipped] = useState({})
  const [showGuessModal, setShowGuessModal] = useState(false)
  const [disconnected, setDisconnected] = useState(false)

  const secretTimerRef = useRef(null)

  // Socket setup
  useEffect(() => {
    if (!playerId) {
      navigate('/')
      return
    }

    socket.connect()
    socket.emit('join_room', { code, playerId })

    socket.on('game_started', ({ characters: chars, message }) => {
      setCharacters(chars)
      sessionStorage.setItem('characters', JSON.stringify(chars))
      setOpponentConnected(true)
      setGameMessage(message)
      setPhase('ready')
    })

    socket.on('opponent_card_flipped', ({ characterId, flipped: f }) => {
      setOpponentFlipped(prev => ({ ...prev, [characterId]: f }))
    })

    socket.on('game_over', (result) => {
      setGameResult(result)
      setPhase('gameOver')
      setShowGuessModal(false)
    })

    socket.on('opponent_disconnected', () => {
      setDisconnected(true)
    })

    return () => {
      socket.off('game_started')
      socket.off('opponent_card_flipped')
      socket.off('game_over')
      socket.off('opponent_disconnected')
      socket.disconnect()
    }
  }, [code, playerId])

  const handleRevealSecret = () => {
    setShowSecret(true)
    setSecretTimer(3)
    let t = 3
    secretTimerRef.current = setInterval(() => {
      t--
      setSecretTimer(t)
      if (t <= 0) {
        clearInterval(secretTimerRef.current)
        setShowSecret(false)
        setPhase('playing')
      }
    }, 1000)
  }

  const handleCardClick = useCallback((char) => {
    if (phase !== 'playing') return
    const newFlipped = !flipped[char.id]
    setFlipped(prev => ({ ...prev, [char.id]: newFlipped }))
    socket.emit('card_flipped', { code, characterId: char.id, flipped: newFlipped })
  }, [phase, flipped, code])

  const handleGuess = () => {
    if (!guessInput.trim()) return
    socket.emit('make_guess', { code, playerId, guessName: guessInput.trim() })
    setShowGuessModal(false)
  }

  const imgSrc = (char) => {
    if (char.image_path.startsWith('http')) return char.image_path
    return `${API_BASE}${char.image_path}`
  }

  // ============ RENDER ============

  if (!playerId) return null

  if (phase === 'gameOver' && gameResult) {
    const isWinner = gameResult.winner === playerId
    return (
      <div style={overlayStyle}>
        <div style={modalStyle}>
          <div style={{ fontSize: '4rem' }}>{isWinner ? '🏆' : '😢'}</div>
          <h1 style={{ fontSize: '2rem', color: isWinner ? '#2e7d32' : '#c62828', margin: '12px 0' }}>
            {isWinner ? 'ניצחת!' : 'הפסדת!'}
          </h1>
          {gameResult.correct ? (
            <p style={{ color: '#555' }}>
              ניחשת נכון! הדמות הסודית הייתה <strong>{gameResult.correctName}</strong>
            </p>
          ) : (
            <div>
              <p style={{ color: '#555' }}>
                {gameResult.guesser === playerId
                  ? `ניחשת "${gameResult.guessName}" — זה לא נכון!`
                  : `היריב ניחש "${gameResult.guessName}" — לא נכון!`}
              </p>
              <p style={{ color: '#555', marginTop: '8px' }}>
                הדמות הסודית הייתה: <strong>{gameResult.correctName}</strong>
              </p>
            </div>
          )}
          {gameResult.secretCharacter && (
            <img
              src={imgSrc(gameResult.secretCharacter)}
              alt={gameResult.secretCharacter.name}
              style={{ width: '120px', height: '120px', objectFit: 'cover', borderRadius: '12px', margin: '16px auto', display: 'block' }}
            />
          )}
          <button style={btnStyle} onClick={() => navigate('/')}>
            🏠 חזור לדף הבית
          </button>
        </div>
      </div>
    )
  }

  if (phase === 'waiting') {
    return (
      <div style={overlayStyle}>
        <div style={modalStyle}>
          <div style={{ fontSize: '3rem', marginBottom: '12px' }}>⏳</div>
          <h2 style={{ color: '#4a154b', marginBottom: '16px' }}>ממתין לשחקן שני...</h2>
          <div style={codeBoxStyle}>{code}</div>
          <p style={{ color: '#666', marginTop: '12px' }}>שתף את הקוד הזה עם היריב שלך</p>
          {disconnected && (
            <p style={{ color: '#e53935', marginTop: '12px' }}>השחקן השני התנתק</p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div style={pageStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', justifyContent: 'space-between', width: '100%' }}>
          <div>
            <span style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#4a154b' }}>👨‍👩‍👧‍👦 Family Guess Who</span>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={codeBadgeStyle}>קוד: {code}</span>
            {phase === 'playing' && (
              <button
                style={{ ...btnStyle, background: '#e53935', fontSize: '0.9rem', padding: '8px 16px' }}
                onClick={() => setShowGuessModal(true)}
              >
                🎯 ניחוש סופי!
              </button>
            )}
          </div>
        </div>
        {gameMessage && (
          <div style={{ background: '#e8f5e9', color: '#2e7d32', padding: '8px 16px', borderRadius: '8px', marginTop: '8px', width: '100%', textAlign: 'center' }}>
            {gameMessage}
          </div>
        )}
        {disconnected && (
          <div style={{ background: '#ffebee', color: '#c62828', padding: '8px 16px', borderRadius: '8px', marginTop: '8px', width: '100%', textAlign: 'center' }}>
            ⚠️ היריב התנתק מהמשחק
          </div>
        )}
      </div>

      {/* Secret reveal phase */}
      {phase === 'ready' && (
        <div style={{ textAlign: 'center', padding: '40px 20px' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '16px' }}>🎴</div>
          <h2 style={{ color: '#4a154b', marginBottom: '8px' }}>המשחק מוכן!</h2>
          <p style={{ color: '#666', marginBottom: '24px' }}>לחץ לראות את הדמות הסודית שלך - תראה אותה שנייה אחת בלבד!</p>
          <button style={{ ...btnStyle, fontSize: '1.2rem', padding: '16px 32px' }} onClick={handleRevealSecret}>
            🔍 הצג לי את הדמות שלי
          </button>
        </div>
      )}

      {/* Secret overlay */}
      {showSecret && secretCharacter && (
        <div style={secretOverlayStyle}>
          <div style={secretCardStyle}>
            <div style={{ fontSize: '1.1rem', color: '#666', marginBottom: '8px' }}>
              ⏱ {secretTimer}
            </div>
            <img
              src={imgSrc(secretCharacter)}
              alt={secretCharacter.name}
              style={{ width: '200px', height: '200px', objectFit: 'cover', borderRadius: '16px', border: '4px solid #764ba2' }}
            />
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#4a154b', marginTop: '12px' }}>
              {secretCharacter.name}
            </div>
            <div style={{ fontSize: '0.85rem', color: '#888', marginTop: '4px' }}>זוהי הדמות הסודית שלך!</div>
          </div>
        </div>
      )}

      {/* Game board */}
      {phase === 'playing' && (
        <div style={boardContainerStyle}>
          <p style={{ textAlign: 'center', color: '#666', marginBottom: '16px', fontSize: '0.95rem' }}>
            לחץ על דמות כדי להאפיל/להחזיר אותה
          </p>
          <div style={gridStyle}>
            {characters.map(char => (
              <CharacterCard
                key={char.id}
                char={char}
                flipped={!!flipped[char.id]}
                opponentFlipped={!!opponentFlipped[char.id]}
                onClick={() => handleCardClick(char)}
                imgSrc={imgSrc(char)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Guess Modal */}
      {showGuessModal && (
        <div style={overlayStyle}>
          <div style={modalStyle}>
            <h2 style={{ color: '#4a154b', marginBottom: '16px' }}>🎯 ניחוש סופי</h2>
            <p style={{ color: '#666', marginBottom: '16px' }}>מה שם הדמות הסודית של היריב?</p>
            <input
              style={inputStyle}
              type="text"
              placeholder="הכנס שם..."
              value={guessInput}
              onChange={e => setGuessInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleGuess()}
              autoFocus
            />
            <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
              <button style={btnStyle} onClick={handleGuess} disabled={!guessInput.trim()}>
                ✅ שלח ניחוש
              </button>
              <button
                style={{ ...btnStyle, background: '#9e9e9e' }}
                onClick={() => setShowGuessModal(false)}
              >
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function CharacterCard({ char, flipped, opponentFlipped, onClick, imgSrc }) {
  return (
    <div
      onClick={onClick}
      title={char.name}
      style={{
        position: 'relative',
        borderRadius: '10px',
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'transform 0.2s, box-shadow 0.2s',
        boxShadow: flipped ? '0 2px 8px rgba(0,0,0,0.15)' : '0 4px 12px rgba(0,0,0,0.2)',
        transform: flipped ? 'scale(0.97)' : 'scale(1)',
        border: opponentFlipped ? '3px solid #ff9800' : '3px solid transparent',
      }}
    >
      <img
        src={imgSrc}
        alt={char.name}
        style={{
          width: '100%',
          aspectRatio: '1',
          objectFit: 'cover',
          display: 'block',
          filter: flipped ? 'brightness(0.2) grayscale(1)' : 'none',
          transition: 'filter 0.3s',
        }}
        onError={e => { e.target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect fill="%23ddd" width="100" height="100"/><text x="50%" y="50%" text-anchor="middle" dy=".3em" fill="%23999">👤</text></svg>' }}
      />
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        background: 'linear-gradient(transparent, rgba(0,0,0,0.75))',
        color: 'white',
        fontSize: '0.7rem',
        fontWeight: 'bold',
        padding: '4px 4px 5px',
        textAlign: 'center',
        filter: flipped ? 'brightness(0.3)' : 'none',
        transition: 'filter 0.3s',
      }}>
        {char.name}
      </div>
      {flipped && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          fontSize: '1.8rem',
          opacity: 0.9,
        }}>
          ❌
        </div>
      )}
    </div>
  )
}

// Styles
const pageStyle = {
  minHeight: '100vh',
  background: '#f5f5f5',
  direction: 'rtl',
}

const headerStyle = {
  background: 'white',
  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
  padding: '12px 20px',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  position: 'sticky',
  top: 0,
  zIndex: 10,
}

const codeBadgeStyle = {
  background: '#f3e5f5',
  color: '#4a154b',
  padding: '6px 14px',
  borderRadius: '20px',
  fontWeight: 'bold',
  fontSize: '1rem',
  letterSpacing: '2px',
}

const boardContainerStyle = {
  padding: '16px',
  maxWidth: '900px',
  margin: '0 auto',
}

const gridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(6, 1fr)',
  gap: '8px',
}

const overlayStyle = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.6)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 100,
  padding: '20px',
}

const modalStyle = {
  background: 'white',
  borderRadius: '20px',
  padding: '32px',
  maxWidth: '400px',
  width: '100%',
  textAlign: 'center',
  boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
}

const codeBoxStyle = {
  fontSize: '3rem',
  fontWeight: 'bold',
  letterSpacing: '8px',
  color: '#764ba2',
  background: '#f3e5f5',
  borderRadius: '12px',
  padding: '16px 24px',
  display: 'inline-block',
  margin: '8px auto',
}

const secretOverlayStyle = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.85)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 200,
}

const secretCardStyle = {
  background: 'white',
  borderRadius: '20px',
  padding: '24px',
  textAlign: 'center',
  animation: 'fadeIn 0.3s ease',
}

const btnStyle = {
  background: 'linear-gradient(135deg, #667eea, #764ba2)',
  color: 'white',
  border: 'none',
  borderRadius: '12px',
  padding: '12px 24px',
  fontSize: '1rem',
  fontWeight: 'bold',
  cursor: 'pointer',
  transition: 'opacity 0.2s',
}

const inputStyle = {
  width: '100%',
  padding: '12px 16px',
  fontSize: '1rem',
  border: '2px solid #e0e0e0',
  borderRadius: '10px',
  textAlign: 'right',
  outline: 'none',
  direction: 'rtl',
}
