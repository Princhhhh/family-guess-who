import React, { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import axios from 'axios'

export default function AdminLogin() {
  const { slug }   = useParams()
  const navigate   = useNavigate()
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)

  const handleLogin = async () => {
    setLoading(true); setError('')
    try {
      await axios.post(`/api/g/${slug}/admin/login`, { password })
      sessionStorage.setItem('adminPassword', password)
      navigate(`/${slug}/admin/panel`)
    } catch {
      setError('סיסמה שגויה')
    } finally { setLoading(false) }
  }

  return (
    <div style={S.page}>
      <div style={S.card}>
        <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>🔐</div>
        <h2 style={S.title}>פאנל מנהל</h2>
        <p style={S.sub}>{slug}</p>
        <div style={S.divider} />
        <input
          style={S.input} type="password" placeholder="סיסמה"
          value={password} onChange={e => { setPassword(e.target.value); setError('') }}
          onKeyDown={e => e.key === 'Enter' && handleLogin()} autoFocus
        />
        {error && <div style={S.error}>{error}</div>}
        <button className="nb-btn" style={S.btn} onClick={handleLogin} disabled={loading}>
          {loading ? '...' : 'כניסה →'}
        </button>
        <button style={S.ghost} onClick={() => navigate(`/${slug}`)}>← חזור לדף הבית</button>
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
  title: { fontSize: '1.6rem', fontWeight: 900, color: '#111', fontFamily: 'Heebo, sans-serif', marginBottom: 4 },
  sub:   { color: '#777', fontSize: '0.88rem', fontFamily: 'Heebo, sans-serif', direction: 'ltr', fontWeight: 600 },
  divider: { height: '2.5px', background: '#111', margin: '20px 0' },
  input: {
    display: 'block', width: '100%', padding: '12px 16px',
    border: '2.5px solid #111', borderRadius: 10,
    boxShadow: '3px 3px 0 #111',
    marginBottom: 12, textAlign: 'center', outline: 'none',
    fontFamily: 'Heebo, sans-serif', color: '#111',
    fontWeight: 700, boxSizing: 'border-box', fontSize: '1rem',
  },
  btn: {
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
  error: {
    color: '#c00', background: '#fff0f0', border: '2px solid #c00',
    borderRadius: 8, padding: '8px 12px', fontSize: '0.88rem',
    marginBottom: 12, fontWeight: 700, fontFamily: 'Heebo, sans-serif',
  },
}
