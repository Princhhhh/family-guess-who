import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import axios from 'axios'

export default function JoinRoom() {
  const { slug, code } = useParams()
  const navigate        = useNavigate()
  const [error,       setError]       = useState('')
  const [namePrompt,  setNamePrompt]  = useState(false)
  const [nameInput,   setNameInput]   = useState(() => sessionStorage.getItem('playerName') || '')
  const [joining,     setJoining]     = useState(false)

  const doJoin = async (username) => {
    setJoining(true)
    try {
      const res = await axios.post(`/api/g/${slug}/rooms/join`, {
        code,
        username: username?.trim() || undefined,
      })
      sessionStorage.setItem('playerId',        res.data.playerId)
      sessionStorage.setItem('playerNum',       '2')
      sessionStorage.setItem('roomCode',        code)
      sessionStorage.setItem('characters',      JSON.stringify(res.data.characters))
      sessionStorage.setItem('secretCharacter', JSON.stringify(res.data.secretCharacter))
      if (username?.trim()) sessionStorage.setItem('playerName', username.trim())
      if (res.data.opponentName) sessionStorage.setItem('opponentName', res.data.opponentName)
      navigate(`/${slug}/room/${code}`, { replace: true })
    } catch (e) {
      setJoining(false)
      setError(e.response?.data?.error || 'הקישור לא תקין או החדר מלא')
    }
  }

  useEffect(() => {
    const savedRoomCode = sessionStorage.getItem('roomCode')
    const savedPlayerId = sessionStorage.getItem('playerId')
    if (savedRoomCode === code && savedPlayerId) {
      navigate(`/${slug}/room/${code}`, { replace: true })
      return
    }
    const savedName = sessionStorage.getItem('playerName')
    if (savedName) doJoin(savedName)
    else setNamePrompt(true)
  }, [code, slug])

  if (error) return (
    <div style={S.page}>
      <div style={S.card}>
        <div style={{ fontSize: '3rem', marginBottom: 12 }}>😕</div>
        <h2 style={{ color: '#c00', marginBottom: 12, fontFamily: 'Heebo, sans-serif', fontWeight: 900 }}>שגיאה</h2>
        <p style={{ color: '#555', marginBottom: 24, fontFamily: 'Heebo, sans-serif', fontWeight: 600 }}>{error}</p>
        <button className="nb-btn" style={S.btnYellow} onClick={() => navigate(`/${slug}`)}>🏠 חזור לדף הבית</button>
      </div>
    </div>
  )

  if (namePrompt) return (
    <div style={S.page}>
      <div style={S.card}>
        <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>🃏</div>
        <h2 style={S.cardTitle}>הצטרפות למשחק</h2>
        <p style={S.cardSub}>מה השם שלך?</p>
        <input
          style={S.input} type="text" placeholder="השם שלך (אופציונלי)"
          value={nameInput} onChange={e => setNameInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && doJoin(nameInput)}
          autoFocus maxLength={20}
        />
        <button className="nb-btn" style={S.btnYellow} onClick={() => doJoin(nameInput)} disabled={joining}>
          {joining ? '⏳ מצטרף...' : '🚀 הצטרף למשחק'}
        </button>
        <button style={S.ghost} onClick={() => navigate(`/${slug}`)}>← דף הבית</button>
      </div>
    </div>
  )

  return (
    <div style={S.page}>
      <div style={S.card}>
        <div style={{ fontSize: '2.5rem', marginBottom: 16 }}>⚙️</div>
        <p style={{ color: '#555', fontFamily: 'Heebo, sans-serif', fontWeight: 700 }}>מצטרף למשחק...</p>
      </div>
    </div>
  )
}

const S = {
  page: {
    minHeight: '100dvh', display: 'flex', alignItems: 'center',
    justifyContent: 'center', background: '#fffdf5',
    padding: 20, direction: 'rtl',
  },
  card: {
    background: 'white', border: '2.5px solid #111', borderRadius: 20,
    boxShadow: '7px 7px 0 #111', padding: '36px 28px',
    maxWidth: 360, width: '100%', textAlign: 'center',
  },
  cardTitle: { fontSize: '1.5rem', fontWeight: 900, color: '#111', fontFamily: 'Heebo, sans-serif', marginBottom: 6 },
  cardSub: { color: '#555', fontFamily: 'Heebo, sans-serif', fontWeight: 600, marginBottom: 20, fontSize: '0.95rem' },
  input: {
    display: 'block', width: '100%', padding: '12px 16px',
    border: '2.5px solid #111', borderRadius: 10,
    boxShadow: '3px 3px 0 #111',
    marginBottom: 12, textAlign: 'center', outline: 'none',
    fontFamily: 'Heebo, sans-serif', color: '#111',
    fontWeight: 700, fontSize: '1rem', direction: 'rtl', boxSizing: 'border-box',
  },
  btnYellow: {
    display: 'block', width: '100%', padding: '13px',
    background: '#ffd23f', borderRadius: 10,
    fontSize: '1rem', fontWeight: 800, color: '#111',
    fontFamily: 'Heebo, sans-serif',
  },
  ghost: {
    display: 'block', marginTop: 14, color: '#888',
    fontSize: '0.88rem', cursor: 'pointer',
    background: 'none', border: 'none', fontFamily: 'Heebo, sans-serif', fontWeight: 600,
  },
}
