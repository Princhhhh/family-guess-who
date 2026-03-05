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
        // If only one game exists, redirect straight to it
        if (r.data.length === 1) navigate(`/${r.data[0].slug}`, { replace: true })
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <div style={S.page}>
      <div style={S.blob1} /><div style={S.blob2} />

      <div style={S.inner}>
        <div className="float" style={{ fontSize: '4rem', marginBottom: 12 }}>🃏</div>
        <h1 style={S.title}>נחש מי!</h1>
        <p style={S.sub}>בחר את המשחק שלך</p>

        {loading ? (
          <div style={{ color: 'rgba(255,255,255,0.6)', fontFamily: 'Heebo, sans-serif', marginTop: 40 }}>טוען...</div>
        ) : games.length === 0 ? (
          <div style={{ color: 'rgba(255,255,255,0.5)', fontFamily: 'Heebo, sans-serif', marginTop: 40 }}>
            אין משחקים זמינים כרגע
          </div>
        ) : (
          <div style={S.grid}>
            {games.map(g => (
              <button key={g.slug} style={S.gameCard} onClick={() => navigate(`/${g.slug}`)}>
                <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>🎴</div>
                <div style={S.gameName}>{g.name}</div>
                <div style={S.enterBtn}>כנס →</div>
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
    background: 'linear-gradient(160deg, #1e1b4b 0%, #312e81 55%, #1e3a5f 100%)',
    padding: '20px 16px', position: 'relative', overflow: 'hidden', direction: 'rtl',
  },
  blob1: { position:'absolute', top:'-80px', right:'-80px', width:300, height:300, borderRadius:'50%', background:'rgba(139,92,246,0.2)', filter:'blur(60px)', pointerEvents:'none' },
  blob2: { position:'absolute', bottom:'60px', left:'-60px', width:250, height:250, borderRadius:'50%', background:'rgba(59,130,246,0.15)', filter:'blur(50px)', pointerEvents:'none' },
  inner: { position: 'relative', zIndex: 1, textAlign: 'center', width: '100%', maxWidth: 600 },
  title: { fontSize: '3rem', fontWeight: 900, color: 'white', fontFamily: 'Heebo, sans-serif', marginBottom: 6 },
  sub:   { color: 'rgba(255,255,255,0.6)', fontSize: '1rem', fontFamily: 'Heebo, sans-serif', marginBottom: 40 },
  grid: { display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 40 },
  gameCard: {
    background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(12px)',
    border: '1px solid rgba(255,255,255,0.2)',
    borderRadius: 20, padding: '24px 32px', cursor: 'pointer',
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    transition: 'transform 0.15s, background 0.15s', minWidth: 160,
  },
  gameName: { color: 'white', fontWeight: 800, fontSize: '1.15rem', fontFamily: 'Heebo, sans-serif', marginBottom: 8 },
  enterBtn: { color: '#F20D0D', fontWeight: 700, fontSize: '0.88rem', fontFamily: 'Heebo, sans-serif' },
  superBtn: {
    background: 'none', border: '1px solid rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.4)',
    borderRadius: 50, padding: '8px 20px', fontSize: '0.8rem', cursor: 'pointer', fontFamily: 'Heebo, sans-serif',
  },
}
