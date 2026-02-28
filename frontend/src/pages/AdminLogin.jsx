import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'

export default function AdminLogin() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  const handleLogin = async () => {
    setLoading(true); setError('')
    try {
      await axios.post('/api/admin/login', { password })
      sessionStorage.setItem('adminPassword', password)
      navigate('/admin/panel')
    } catch {
      setError('סיסמה שגויה')
    } finally { setLoading(false) }
  }

  return (
    <div style={S.page}>
      <div style={S.blob1} /><div style={S.blob2} />
      <div style={S.card} className="fade-in">
        <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>🔐</div>
        <h2 style={S.title}>פאנל מנהל</h2>
        <p style={S.sub}>נחש מי הלביא</p>
        <div style={S.divider} />
        <input
          style={S.input}
          type="password"
          placeholder="סיסמה"
          value={password}
          onChange={e => { setPassword(e.target.value); setError('') }}
          onKeyDown={e => e.key === 'Enter' && handleLogin()}
          autoFocus
        />
        {error && <div style={S.error}>{error}</div>}
        <button className="btn-glow" style={S.btn} onClick={handleLogin} disabled={loading}>
          {loading ? '...' : 'כניסה'}
        </button>
        <button style={S.ghost} onClick={() => navigate('/')}>← חזור לדף הבית</button>
      </div>
    </div>
  )
}

const S = {
  page: { minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(160deg, #1e1b4b, #312e81, #1e3a5f)', padding: 20, position: 'relative', overflow: 'hidden' },
  blob1: { position:'absolute', top:'-60px', right:'-60px', width:250, height:250, borderRadius:'50%', background:'rgba(139,92,246,0.2)', filter:'blur(50px)', pointerEvents:'none' },
  blob2: { position:'absolute', bottom:'60px', left:'-40px', width:200, height:200, borderRadius:'50%', background:'rgba(59,130,246,0.15)', filter:'blur(40px)', pointerEvents:'none' },
  card: { background: 'rgba(255,255,255,0.97)', borderRadius: 28, padding: '36px 28px', maxWidth: 360, width: '100%', textAlign: 'center', boxShadow: '0 24px 64px rgba(0,0,0,0.4)', position: 'relative', zIndex: 1 },
  title: { fontSize: '1.6rem', fontWeight: 800, color: '#312e81', fontFamily: 'Rubik, sans-serif', marginBottom: 4 },
  sub:   { color: '#6b7280', fontSize: '0.88rem', fontFamily: 'Rubik, sans-serif' },
  divider: { height: 2, background: 'linear-gradient(90deg, transparent, #e0e7ff, transparent)', margin: '20px 0' },
  input: { display: 'block', width: '100%', padding: '12px 16px', border: '2px solid #e0e7ff', borderRadius: 14, marginBottom: 12, textAlign: 'center', outline: 'none', fontFamily: 'Rubik, sans-serif', color: '#312e81', fontWeight: 600 },
  btn:   { display: 'block', width: '100%', padding: '13px', background: 'linear-gradient(135deg, #7c3aed, #6d28d9)', color: 'white', border: 'none', borderRadius: 50, fontSize: '1rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'Rubik, sans-serif' },
  ghost: { display: 'block', marginTop: 14, color: '#9ca3af', fontSize: '0.88rem', cursor: 'pointer', background: 'none', border: 'none', fontFamily: 'Rubik, sans-serif' },
  error: { color: '#dc2626', background: '#fef2f2', borderRadius: 10, padding: '8px 12px', fontSize: '0.88rem', marginBottom: 12 },
}
