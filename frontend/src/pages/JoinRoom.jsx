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
    // Already in session for this room → go straight to game
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
        <h2 style={{ color: '#dc2626', marginBottom: 12, fontFamily: 'Heebo, sans-serif' }}>שגיאה</h2>
        <p style={{ color: '#6b7280', marginBottom: 24, fontFamily: 'Heebo, sans-serif' }}>{error}</p>
        <button style={S.btn} onClick={() => navigate(`/${slug}`)}>🏠 חזור לדף הבית</button>
      </div>
    </div>
  )

  if (namePrompt) return (
    <div style={S.page}>
      <div style={S.card}>
        <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>🃏</div>
        <h2 style={{ color: '#312e81', fontFamily: 'Heebo, sans-serif', fontWeight: 800, marginBottom: 6 }}>
          הצטרפות למשחק
        </h2>
        <p style={{ color: '#6b7280', fontFamily: 'Heebo, sans-serif', marginBottom: 20, fontSize: '0.9rem' }}>
          מה השם שלך?
        </p>
        <input
          style={S.nameInput} type="text" placeholder="השם שלך (אופציונלי)"
          value={nameInput} onChange={e => setNameInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && doJoin(nameInput)}
          autoFocus maxLength={20}
        />
        <button
          style={{ ...S.btn, width: '100%', marginTop: 12 }}
          onClick={() => doJoin(nameInput)} disabled={joining}
        >
          {joining ? '⏳ מצטרף...' : '🚀 הצטרף למשחק'}
        </button>
        <button style={S.ghost} onClick={() => navigate(`/${slug}`)}>← דף הבית</button>
      </div>
    </div>
  )

  return (
    <div style={S.page}>
      <div style={S.card}>
        <div style={{ fontSize: '2.5rem', marginBottom: 16, animation: 'spin 1s linear infinite' }}>⚙️</div>
        <p style={{ color: '#6b7280', fontFamily: 'Heebo, sans-serif', fontWeight: 500 }}>מצטרף למשחק...</p>
      </div>
    </div>
  )
}

const S = {
  page: { minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(160deg, #1e1b4b, #312e81, #1e3a5f)', padding: 20 },
  card: { background: 'white', borderRadius: 24, padding: '36px 28px', maxWidth: 360, width: '100%', textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.4)' },
  nameInput: { display: 'block', width: '100%', padding: '12px 16px', border: '2px solid #e0e7ff', borderRadius: 14, marginBottom: 4, textAlign: 'center', outline: 'none', fontFamily: 'Heebo, sans-serif', color: '#312e81', fontWeight: 600, fontSize: '1rem', direction: 'rtl', boxSizing: 'border-box' },
  btn: { background: 'linear-gradient(135deg, #F20D0D, #C00A0A)', color: 'white', border: 'none', borderRadius: 50, padding: '12px 28px', fontSize: '1rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'Heebo, sans-serif' },
  ghost: { display: 'block', marginTop: 14, color: '#9ca3af', fontSize: '0.88rem', cursor: 'pointer', background: 'none', border: 'none', fontFamily: 'Heebo, sans-serif' },
}
