import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'

export default function GamesIndex() {
  const navigate = useNavigate()
  const [games,   setGames]   = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    axios.get('/api/games')
      .then(r => {
        setGames(r.data)
        if (r.data.length === 1) navigate(`/${r.data[0].slug}`, { replace: true })
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <div style={S.page}>
      <div style={S.inner}>
        <div style={{ fontSize: '4rem', marginBottom: 8 }}>🃏</div>
        <h1 style={S.title}>נחש מי!</h1>
        <p style={S.sub}>בחר את המשחק שלך</p>

        {loading ? (
          <p style={{ color: '#666', fontFamily: 'Heebo, sans-serif', marginTop: 32 }}>טוען...</p>
        ) : games.length === 0 ? (
          <p style={{ color: '#888', fontFamily: 'Heebo, sans-serif', marginTop: 32 }}>אין משחקים זמינים כרגע</p>
        ) : (
          <div style={S.grid}>
            {games.map(g => (
              <button key={g.slug} className="nb-btn" style={S.gameCard} onClick={() => navigate(`/${g.slug}`)}>
                <div style={{ fontSize: '2.5rem', marginBottom: 10 }}>🎴</div>
                <div style={S.gameName}>{g.name}</div>
                <div style={S.enterBtn}>כנס ←</div>
              </button>
            ))}
          </div>
        )}

        <button style={S.superBtn} onClick={() => navigate('/super-admin')}>
          🔧 ניהול מערכת
        </button>
      </div>
    </div>
  )
}

const S = {
  page: {
    minHeight: '100dvh', display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    background: '#fffdf5', padding: '20px 16px', direction: 'rtl',
  },
  inner: { textAlign: 'center', width: '100%', maxWidth: 600 },
  title: { fontSize: '3.2rem', fontWeight: 900, color: '#111', fontFamily: 'Heebo, sans-serif', marginBottom: 6, letterSpacing: '-1px' },
  sub:   { color: '#555', fontSize: '1rem', fontFamily: 'Heebo, sans-serif', marginBottom: 40, fontWeight: 600 },
  grid:  { display: 'flex', gap: 20, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 48 },
  gameCard: {
    background: '#ffd23f', border: '2.5px solid #111', borderRadius: 16,
    padding: '28px 36px', cursor: 'pointer',
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    minWidth: 160,
  },
  gameName: { color: '#111', fontWeight: 900, fontSize: '1.2rem', fontFamily: 'Heebo, sans-serif', marginBottom: 10 },
  enterBtn: { color: '#111', fontWeight: 800, fontSize: '0.9rem', fontFamily: 'Heebo, sans-serif' },
  superBtn: {
    background: 'none', border: '1.5px solid #bbb', color: '#888',
    borderRadius: 8, padding: '7px 18px', fontSize: '0.8rem',
    cursor: 'pointer', fontFamily: 'Heebo, sans-serif', fontWeight: 600,
  },
}
