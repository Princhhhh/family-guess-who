import React, { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import axios from 'axios'

export default function HomePage() {
  const { slug }  = useParams()
  const navigate  = useNavigate()
  const [gameName, setGameName] = useState('')
  const [mode, setMode]         = useState(null)
  const [joinCode, setJoinCode] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [username, setUsername] = useState(() => sessionStorage.getItem('playerName') || '')

  useEffect(() => {
    axios.get(`/api/g/${slug}`)
      .then(r => setGameName(r.data.name))
      .catch(() => navigate('/'))
  }, [slug])

  const saveName = (val) => { setUsername(val); sessionStorage.setItem('playerName', val.trim()) }

  const handleCreate = async () => {
    setLoading(true); setError('')
    try {
      const res = await axios.post(`/api/g/${slug}/rooms`, { username: username.trim() || undefined })
      const { code, playerId, characters, secretCharacter } = res.data
      sessionStorage.setItem('playerId',         playerId)
      sessionStorage.setItem('playerNum',        '1')
      sessionStorage.setItem('roomCode',         code)
      sessionStorage.setItem('characters',       JSON.stringify(characters))
      sessionStorage.setItem('secretCharacter',  JSON.stringify(secretCharacter))
      sessionStorage.removeItem('opponentName')
      navigate(`/${slug}/room/${code}`)
    } catch (e) { setError(e.response?.data?.error || 'שגיאה ביצירת חדר')
    } finally { setLoading(false) }
  }

  const handleJoin = async () => {
    if (joinCode.length !== 4) { setError('הכנס קוד בן 4 ספרות'); return }
    setLoading(true); setError('')
    try {
      const res = await axios.post(`/api/g/${slug}/rooms/join`, { code: joinCode, username: username.trim() || undefined })
      sessionStorage.setItem('playerId',        res.data.playerId)
      sessionStorage.setItem('playerNum',       '2')
      sessionStorage.setItem('roomCode',        joinCode)
      sessionStorage.setItem('characters',      JSON.stringify(res.data.characters))
      sessionStorage.setItem('secretCharacter', JSON.stringify(res.data.secretCharacter))
      if (res.data.opponentName) sessionStorage.setItem('opponentName', res.data.opponentName)
      navigate(`/${slug}/room/${joinCode}`)
    } catch (e) { setError(e.response?.data?.error || 'שגיאה בהצטרפות')
    } finally { setLoading(false) }
  }

  return (
    <div style={S.page}>
      <div style={S.card}>
        <div style={{ fontSize: '3rem', marginBottom: 4 }}>🃏</div>
        <h1 style={S.title}>{gameName || '...'}</h1>
        <p style={S.subtitle}>משחק הדמויות המסתורית</p>
        <div style={S.divider} />

        <input
          style={S.input} type="text" placeholder="השם שלך (אופציונלי)"
          value={username} onChange={e => saveName(e.target.value)} maxLength={20}
        />

        {!mode && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 4 }}>
            <button className="nb-btn" style={S.btnYellow} onClick={handleCreate} disabled={loading}>
              {loading ? '...' : '🎮 צור משחק חדש'}
            </button>
            <div style={S.orRow}>
              <span style={S.orLine}/><span style={S.orText}>או</span><span style={S.orLine}/>
            </div>
            <button className="nb-btn" style={S.btnWhite} onClick={() => setMode('join')}>🔑 הצטרף עם קוד</button>
            {error && <div style={S.error}>{error}</div>}
          </div>
        )}

        {mode === 'join' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
            <p style={{ color: '#555', fontSize: '0.9rem', textAlign: 'center', fontFamily: 'Heebo, sans-serif', fontWeight: 600 }}>הכנס את הקוד שקיבלת</p>
            <input
              style={S.codeInput} type="text" inputMode="numeric" maxLength={4}
              placeholder="0000" value={joinCode}
              onChange={e => { setJoinCode(e.target.value.replace(/\D/g, '')); setError('') }}
              onKeyDown={e => e.key === 'Enter' && handleJoin()} autoFocus
            />
            {error && <div style={S.error}>{error}</div>}
            <button className="nb-btn" style={S.btnYellow} onClick={handleJoin} disabled={loading}>
              {loading ? '...' : '🚀 הצטרף למשחק'}
            </button>
            <button style={S.btnGhost} onClick={() => { setMode(null); setError('') }}>← חזור</button>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginTop: 20 }}>
          <button style={S.bottomLink} onClick={() => navigate(`/${slug}/leaderboard`)}>🏅 לוח מנחשים</button>
          <span style={{ color: '#ccc', alignSelf: 'center' }}>|</span>
          <button style={S.adminLink} onClick={() => navigate(`/${slug}/admin`)}>כניסת מנהל</button>
        </div>
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
  card: {
    background: 'white', border: '2.5px solid #111', borderRadius: 20,
    boxShadow: '7px 7px 0 #111', padding: '36px 28px',
    maxWidth: 400, width: '100%', textAlign: 'center',
  },
  title:    { fontSize: '2.4rem', fontWeight: 900, color: '#111', fontFamily: 'Heebo, sans-serif', letterSpacing: '-0.5px', marginBottom: 4 },
  subtitle: { color: '#555', fontSize: '0.95rem', fontWeight: 600, fontFamily: 'Heebo, sans-serif' },
  divider:  { height: '2.5px', background: '#111', margin: '20px 0', borderRadius: 2 },
  input: {
    display: 'block', width: '100%', padding: '11px 16px',
    border: '2.5px solid #111', borderRadius: 10,
    fontSize: '0.95rem', fontFamily: 'Heebo, sans-serif',
    color: '#111', textAlign: 'center', outline: 'none',
    direction: 'rtl', boxSizing: 'border-box',
    boxShadow: '3px 3px 0 #111', marginBottom: 12,
  },
  btnYellow: {
    display: 'block', width: '100%', padding: '14px 20px',
    background: '#ffd23f', borderRadius: 10,
    fontSize: '1.05rem', fontWeight: 800, color: '#111',
    fontFamily: 'Heebo, sans-serif',
  },
  btnWhite: {
    display: 'block', width: '100%', padding: '13px 20px',
    background: 'white', borderRadius: 10,
    fontSize: '1rem', fontWeight: 800, color: '#111',
    fontFamily: 'Heebo, sans-serif',
  },
  btnGhost: {
    display: 'block', width: '100%', padding: '10px',
    background: 'none', color: '#888', border: 'none',
    fontSize: '0.9rem', cursor: 'pointer', fontFamily: 'Heebo, sans-serif', fontWeight: 600,
  },
  orRow:  { display: 'flex', alignItems: 'center', gap: 10 },
  orLine: { flex: 1, height: '2px', background: '#111' },
  orText: { color: '#111', fontSize: '0.85rem', fontWeight: 800 },
  codeInput: {
    display: 'block', width: '100%', padding: '14px',
    fontSize: '2.2rem', fontWeight: 900,
    border: '2.5px solid #111', borderRadius: 10,
    boxShadow: '3px 3px 0 #111',
    textAlign: 'center', letterSpacing: '12px',
    outline: 'none', direction: 'ltr', color: '#111',
    fontFamily: 'Heebo, sans-serif',
  },
  error: {
    color: '#c00', background: '#fff0f0',
    border: '2px solid #c00', borderRadius: 8,
    padding: '8px 12px', fontSize: '0.88rem', fontWeight: 700,
    fontFamily: 'Heebo, sans-serif',
  },
  bottomLink: { background: 'none', border: 'none', color: '#e63946', fontSize: '0.82rem', cursor: 'pointer', fontFamily: 'Heebo, sans-serif', fontWeight: 700 },
  adminLink:  { background: 'none', border: 'none', color: '#aaa', fontSize: '0.78rem', cursor: 'pointer', fontFamily: 'Heebo, sans-serif' },
}
