import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'

const MEDALS = ['🥇', '🥈', '🥉']

export default function Leaderboard() {
  const navigate = useNavigate()
  const [users,   setUsers]   = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')

  useEffect(() => {
    axios.get('/api/leaderboard')
      .then(res => setUsers(res.data))
      .catch(() => setError('שגיאה בטעינת הנתונים'))
      .finally(() => setLoading(false))
  }, [])

  const myName = sessionStorage.getItem('playerName') || ''

  return (
    <div style={S.page}>
      <div style={S.blob1} /><div style={S.blob2} />

      <div style={S.container} className="fade-in">
        {/* Header */}
        <div style={S.header}>
          <button style={S.backBtn} onClick={() => navigate('/')}>← חזור</button>
          <h1 style={S.title}>🏅 לוח מנחשים</h1>
          <div style={{ width: 60 }} />
        </div>

        <div style={S.card}>
          {loading && (
            <div style={{ textAlign: 'center', padding: 48, color: '#888' }}>
              <div style={{ fontSize: '2rem', marginBottom: 8, animation: 'spin 1s linear infinite', display: 'inline-block' }}>⚙️</div>
              <p style={{ fontFamily: 'Heebo, sans-serif' }}>טוען...</p>
            </div>
          )}

          {error && (
            <div style={{ textAlign: 'center', padding: 40, color: '#c62828', fontFamily: 'Heebo, sans-serif' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>⚠️</div>
              <p>{error}</p>
            </div>
          )}

          {!loading && !error && users.length === 0 && (
            <div style={{ textAlign: 'center', padding: 48, color: '#aaa' }}>
              <div style={{ fontSize: '3rem', marginBottom: 12 }}>🎭</div>
              <p style={{ fontFamily: 'Heebo, sans-serif', fontWeight: 600, color: '#666' }}>
                עוד אין שחקנים בלוח המנחשים
              </p>
              <p style={{ fontFamily: 'Heebo, sans-serif', fontSize: '0.9rem', color: '#999', marginTop: 6 }}>
                הכנס שם לפני המשחק כדי שניצחונות יירשמו!
              </p>
              <button style={S.btn} onClick={() => navigate('/')}>🎮 שחק עכשיו</button>
            </div>
          )}

          {!loading && !error && users.length > 0 && (
            <table style={S.table}>
              <thead>
                <tr>
                  <th style={{ ...S.th, width: 40 }}>#</th>
                  <th style={S.th}>שם</th>
                  <th style={S.th}>ניצחונות</th>
                  <th style={S.th}>הפסדים</th>
                  <th style={S.th}>משחקים</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u, i) => {
                  const isMe = myName && u.username === myName
                  const winRate = u.games > 0 ? Math.round((u.wins / u.games) * 100) : 0
                  return (
                    <tr key={u.username} style={{
                      background: isMe ? '#f5f3ff' : i % 2 === 0 ? 'white' : '#fafafa',
                      fontWeight: isMe ? 700 : 400,
                    }}>
                      <td style={S.td}>
                        {i < 3 ? MEDALS[i] : <span style={{ color: '#9ca3af', fontSize: '0.9rem' }}>{i + 1}</span>}
                      </td>
                      <td style={{ ...S.td, fontWeight: 700, color: isMe ? '#7c3aed' : '#1f2937' }}>
                        {u.username}
                        {isMe && <span style={{ fontSize: '0.7rem', color: '#F20D0D', marginRight: 4 }}>(אתה)</span>}
                      </td>
                      <td style={{ ...S.td, color: '#16a34a', fontWeight: 700 }}>
                        {u.wins}
                      </td>
                      <td style={{ ...S.td, color: '#dc2626' }}>
                        {u.losses}
                      </td>
                      <td style={{ ...S.td, color: '#6b7280', fontSize: '0.85rem' }}>
                        {u.games}
                        <span style={{ fontSize: '0.72rem', color: '#9ca3af', marginRight: 3 }}>
                          ({winRate}%)
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: '0.78rem', marginTop: 12, fontFamily: 'Heebo, sans-serif' }}>
          * רק שחקנים עם שם מופיעים בלוח המנחשים
        </p>
      </div>
    </div>
  )
}

const S = {
  page: {
    minHeight: '100dvh',
    background: 'linear-gradient(160deg, #1e1b4b 0%, #312e81 55%, #1e3a5f 100%)',
    padding: '20px 16px', position: 'relative', overflow: 'hidden',
    direction: 'rtl',
  },
  blob1: { position:'absolute', top:'-80px', right:'-80px', width:300, height:300, borderRadius:'50%', background:'rgba(139,92,246,0.15)', filter:'blur(60px)', pointerEvents:'none' },
  blob2: { position:'absolute', bottom:'60px', left:'-60px', width:250, height:250, borderRadius:'50%', background:'rgba(59,130,246,0.1)', filter:'blur(50px)', pointerEvents:'none' },

  container: { maxWidth: 600, margin: '0 auto', position: 'relative', zIndex: 1 },

  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 20,
  },
  title: {
    fontSize: '1.6rem', fontWeight: 900, color: 'white',
    fontFamily: 'Heebo, sans-serif', textAlign: 'center', margin: 0,
  },
  backBtn: {
    background: 'rgba(255,255,255,0.15)', color: 'white', border: '1px solid rgba(255,255,255,0.25)',
    borderRadius: 50, padding: '7px 16px', fontFamily: 'Heebo, sans-serif',
    fontSize: '0.88rem', cursor: 'pointer', fontWeight: 600,
  },

  card: {
    background: 'white', borderRadius: 20, overflow: 'hidden',
    boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
  },

  table: { width: '100%', borderCollapse: 'collapse', fontFamily: 'Heebo, sans-serif' },
  th: {
    padding: '12px 14px', textAlign: 'center', fontSize: '0.82rem',
    color: '#6b7280', fontWeight: 600, borderBottom: '2px solid #f3f4f6',
    background: '#fafafa',
  },
  td: { padding: '11px 14px', textAlign: 'center', fontSize: '0.9rem', borderBottom: '1px solid #f3f4f6' },

  btn: {
    marginTop: 20, background: 'linear-gradient(135deg, #F20D0D, #C00A0A)',
    color: 'white', border: 'none', borderRadius: 50, padding: '12px 28px',
    fontSize: '1rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'Heebo, sans-serif',
  },
}
