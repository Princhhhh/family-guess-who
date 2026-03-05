import React, { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import axios from 'axios'

const MEDALS = ['🥇', '🥈', '🥉']

export default function Leaderboard() {
  const { slug }  = useParams()
  const navigate  = useNavigate()
  const [users,   setUsers]   = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')

  useEffect(() => {
    axios.get(`/api/g/${slug}/leaderboard`)
      .then(res => setUsers(res.data))
      .catch(() => setError('שגיאה בטעינת הנתונים'))
      .finally(() => setLoading(false))
  }, [slug])

  const myName = sessionStorage.getItem('playerName') || ''

  return (
    <div style={S.page}>
      <div style={S.container}>

        <div style={S.header}>
          <button className="nb-btn" style={S.backBtn} onClick={() => navigate(`/${slug}`)}>← חזור</button>
          <h1 style={S.title}>🏅 לוח מנחשים</h1>
          <div style={{ width: 80 }} />
        </div>

        <div style={S.card}>
          {loading && (
            <div style={{ textAlign: 'center', padding: 48, color: '#888' }}>
              <div style={{ fontSize: '2rem', marginBottom: 8 }}>⚙️</div>
              <p style={{ fontFamily: 'Heebo, sans-serif', fontWeight: 600 }}>טוען...</p>
            </div>
          )}

          {error && (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>⚠️</div>
              <p style={{ color: '#c00', fontFamily: 'Heebo, sans-serif', fontWeight: 700 }}>{error}</p>
            </div>
          )}

          {!loading && !error && users.length === 0 && (
            <div style={{ textAlign: 'center', padding: 48 }}>
              <div style={{ fontSize: '3rem', marginBottom: 12 }}>🎭</div>
              <p style={{ fontFamily: 'Heebo, sans-serif', fontWeight: 800, color: '#111', marginBottom: 6 }}>
                עוד אין שחקנים בלוח המנחשים
              </p>
              <p style={{ fontFamily: 'Heebo, sans-serif', fontSize: '0.9rem', color: '#777', marginBottom: 20 }}>
                הכנס שם לפני המשחק כדי שניצחונות יירשמו!
              </p>
              <button className="nb-btn" style={S.playBtn} onClick={() => navigate(`/${slug}`)}>🎮 שחק עכשיו</button>
            </div>
          )}

          {!loading && !error && users.length > 0 && (
            <table style={S.table}>
              <thead>
                <tr style={{ background: '#ffd23f', borderBottom: '2.5px solid #111' }}>
                  <th style={S.th}>#</th>
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
                      background: isMe ? '#fffbeb' : i % 2 === 0 ? 'white' : '#fafaf7',
                      borderBottom: '1.5px solid #e5e5e5',
                      fontWeight: isMe ? 800 : 500,
                    }}>
                      <td style={S.td}>
                        {i < 3 ? MEDALS[i] : <span style={{ color: '#999', fontSize: '0.9rem' }}>{i + 1}</span>}
                      </td>
                      <td style={{ ...S.td, fontWeight: 800, color: '#111' }}>
                        {u.username}
                        {isMe && <span style={{ fontSize: '0.72rem', background: '#ffd23f', border: '1.5px solid #111', borderRadius: 4, padding: '1px 5px', marginRight: 5, fontWeight: 800 }}>אתה</span>}
                      </td>
                      <td style={{ ...S.td, color: '#2a9d2a', fontWeight: 800 }}>{u.wins}</td>
                      <td style={{ ...S.td, color: '#c00' }}>{u.losses}</td>
                      <td style={{ ...S.td, color: '#555', fontSize: '0.85rem' }}>
                        {u.games}
                        <span style={{ fontSize: '0.72rem', color: '#999', marginRight: 3 }}>({winRate}%)</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        <p style={{ textAlign: 'center', color: '#aaa', fontSize: '0.78rem', marginTop: 14, fontFamily: 'Heebo, sans-serif' }}>
          * רק שחקנים עם שם מופיעים בלוח המנחשים
        </p>
      </div>
    </div>
  )
}

const S = {
  page: {
    minHeight: '100dvh', background: '#fffdf5',
    padding: '20px 16px', direction: 'rtl',
  },
  container: { maxWidth: 600, margin: '0 auto' },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 20,
  },
  title: {
    fontSize: '1.6rem', fontWeight: 900, color: '#111',
    fontFamily: 'Heebo, sans-serif', textAlign: 'center', margin: 0,
  },
  backBtn: {
    background: 'white', borderRadius: 8, padding: '7px 14px',
    fontFamily: 'Heebo, sans-serif', fontSize: '0.88rem', fontWeight: 800, color: '#111',
  },
  card: {
    background: 'white', border: '2.5px solid #111',
    borderRadius: 16, overflow: 'hidden', boxShadow: '6px 6px 0 #111',
  },
  table: { width: '100%', borderCollapse: 'collapse', fontFamily: 'Heebo, sans-serif' },
  th: {
    padding: '12px 14px', textAlign: 'center',
    fontSize: '0.85rem', color: '#111', fontWeight: 900,
  },
  td: { padding: '11px 14px', textAlign: 'center', fontSize: '0.9rem' },
  playBtn: {
    background: '#ffd23f', borderRadius: 8, padding: '11px 24px',
    fontSize: '0.95rem', fontWeight: 800, color: '#111',
    fontFamily: 'Heebo, sans-serif',
  },
}
