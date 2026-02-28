import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'

export default function HomePage() {
  const navigate = useNavigate()
  const [mode, setMode]       = useState(null)
  const [joinCode, setJoinCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  const handleCreate = async () => {
    setLoading(true); setError('')
    try {
      const res = await axios.post('/api/rooms')
      const { code, playerId, characters, secretCharacter } = res.data
      sessionStorage.setItem('playerId', playerId)
      sessionStorage.setItem('playerNum', '1')
      sessionStorage.setItem('characters', JSON.stringify(characters))
      sessionStorage.setItem('secretCharacter', JSON.stringify(secretCharacter))
      navigate(`/room/${code}`)
    } catch (e) {
      setError(e.response?.data?.error || 'שגיאה ביצירת חדר')
    } finally { setLoading(false) }
  }

  const handleJoin = async () => {
    if (joinCode.length !== 4) { setError('הכנס קוד בן 4 ספרות'); return }
    setLoading(true); setError('')
    try {
      const res = await axios.post('/api/rooms/join', { code: joinCode })
      sessionStorage.setItem('playerId', res.data.playerId)
      sessionStorage.setItem('playerNum', '2')
      sessionStorage.setItem('characters', JSON.stringify(res.data.characters))
      sessionStorage.setItem('secretCharacter', JSON.stringify(res.data.secretCharacter))
      navigate(`/room/${joinCode}`)
    } catch (e) {
      setError(e.response?.data?.error || 'שגיאה בהצטרפות')
    } finally { setLoading(false) }
  }

  return (
    <div style={S.page}>
      <div style={S.blob1} /><div style={S.blob2} /><div style={S.blob3} />

      <div style={S.card} className="fade-in">
        <div className="float" style={{ fontSize: '3.5rem', lineHeight: 1, marginBottom: 8 }}>🃏</div>
        <h1 style={S.title} className="gold-text">נחש מי הלביא?</h1>
        <p style={S.subtitle}>משחק הדמויות המסתורית</p>
        <div style={S.divider} />

        {!mode && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <button className="btn-glow" style={S.btnPrimary} onClick={handleCreate} disabled={loading}>
              {loading ? '...' : '🎮  צור משחק חדש'}
            </button>
            <div style={S.orRow}>
              <span style={S.orLine}/><span style={S.orText}>או</span><span style={S.orLine}/>
            </div>
            <button style={S.btnSecondary} onClick={() => setMode('join')}>
              🔑  הצטרף עם קוד
            </button>
            {error && <div style={S.error}>{error}</div>}
          </div>
        )}

        {mode === 'join' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <p style={{ color: '#6b7280', fontSize: '0.9rem', textAlign: 'center' }}>הכנס את הקוד שקיבלת</p>
            <input
              style={S.codeInput}
              type="text" inputMode="numeric" maxLength={4}
              placeholder="0 0 0 0"
              value={joinCode}
              onChange={e => { setJoinCode(e.target.value.replace(/\D/g, '')); setError('') }}
              onKeyDown={e => e.key === 'Enter' && handleJoin()}
              autoFocus
            />
            {error && <div style={S.error}>{error}</div>}
            <button className="btn-glow" style={S.btnPrimary} onClick={handleJoin} disabled={loading}>
              {loading ? '...' : '🚀  הצטרף למשחק'}
            </button>
            <button style={S.btnGhost} onClick={() => { setMode(null); setError('') }}>← חזור</button>
          </div>
        )}

        <button style={S.adminLink} onClick={() => navigate('/admin')}>כניסת מנהל</button>
      </div>

      {/* Floating mini cards decoration */}
      <div style={S.decorRow}>
        {['👴','👵','🧑','👦','👧','🧔'].map((e, i) => (
          <div key={i} className="float" style={{ ...S.miniCard, animationDelay: `${i * 0.4}s` }}>{e}</div>
        ))}
      </div>
    </div>
  )
}

const S = {
  page: {
    minHeight: '100dvh', display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    background: 'linear-gradient(160deg, #1e1b4b 0%, #312e81 55%, #1e3a5f 100%)',
    padding: '20px 16px', position: 'relative', overflow: 'hidden',
  },
  blob1: { position:'absolute', top:'-80px', right:'-80px', width:300, height:300, borderRadius:'50%', background:'rgba(139,92,246,0.2)', filter:'blur(60px)', pointerEvents:'none' },
  blob2: { position:'absolute', bottom:'80px', left:'-60px', width:250, height:250, borderRadius:'50%', background:'rgba(59,130,246,0.15)', filter:'blur(50px)', pointerEvents:'none' },
  blob3: { position:'absolute', top:'40%', left:'40%', width:200, height:200, borderRadius:'50%', background:'rgba(245,158,11,0.08)', filter:'blur(40px)', pointerEvents:'none' },

  card: {
    background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(20px)',
    borderRadius: 28, padding: '36px 28px', maxWidth: 400, width: '100%',
    boxShadow: '0 24px 64px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.1)',
    textAlign: 'center', position: 'relative', zIndex: 1,
  },

  title:    { fontSize: '2.4rem', fontWeight: 900, letterSpacing: '-0.5px', fontFamily: 'Rubik, sans-serif', lineHeight: 1.1, marginBottom: 6 },
  subtitle: { color: '#6b7280', fontSize: '0.95rem', fontWeight: 500, marginBottom: 0 },
  divider:  { height: 2, background: 'linear-gradient(90deg, transparent, #e0e7ff, transparent)', margin: '20px 0', borderRadius: 2 },

  btnPrimary: {
    display: 'block', width: '100%', padding: '14px 20px',
    background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
    color: 'white', border: 'none', borderRadius: 50,
    fontSize: '1.05rem', fontWeight: 700, cursor: 'pointer',
    fontFamily: 'Rubik, sans-serif', letterSpacing: '0.3px',
  },
  btnSecondary: {
    display: 'block', width: '100%', padding: '13px 20px',
    background: 'white', color: '#7c3aed', border: '2px solid #7c3aed', borderRadius: 50,
    fontSize: '1rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'Rubik, sans-serif',
  },
  btnGhost: { display: 'block', width: '100%', padding: '10px', background: 'none', color: '#9ca3af', border: 'none', fontSize: '0.9rem', cursor: 'pointer', fontFamily: 'Rubik, sans-serif' },
  orRow:  { display: 'flex', alignItems: 'center', gap: 10 },
  orLine: { flex: 1, height: 1, background: '#e5e7eb' },
  orText: { color: '#9ca3af', fontSize: '0.85rem', fontWeight: 500 },

  codeInput: {
    display: 'block', width: '100%', padding: '14px',
    fontSize: '2rem', fontWeight: 700,
    border: '2px solid #e0e7ff', borderRadius: 16, textAlign: 'center',
    letterSpacing: '10px', outline: 'none', direction: 'ltr',
    color: '#312e81', fontFamily: 'Rubik, sans-serif',
  },
  error: { color: '#dc2626', background: '#fef2f2', borderRadius: 10, padding: '8px 12px', fontSize: '0.88rem', fontWeight: 500 },
  adminLink: { display: 'block', marginTop: 20, color: '#d1d5db', fontSize: '0.78rem', cursor: 'pointer', background: 'none', border: 'none', fontFamily: 'Rubik, sans-serif' },

  decorRow: { position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 10, zIndex: 0 },
  miniCard: { width: 40, height: 52, background: 'rgba(255,255,255,0.12)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', boxShadow: '0 4px 12px rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.2)' },
}
