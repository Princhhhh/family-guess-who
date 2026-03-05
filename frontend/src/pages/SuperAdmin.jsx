import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'

const SUPER_HDR = (pw) => ({ 'x-super-password': pw })

export default function SuperAdmin() {
  const navigate  = useNavigate()
  const [pw,      setPw]      = useState(() => sessionStorage.getItem('superAdminPw') || '')
  const [authed,  setAuthed]  = useState(false)
  const [loginErr, setLoginErr] = useState('')
  const [games,   setGames]   = useState([])
  const [newGame, setNewGame] = useState({ slug: '', name: '', adminPassword: '' })
  const [creating, setCreating] = useState(false)
  const [msg,     setMsg]     = useState(null)
  const [editPw,  setEditPw]  = useState({}) // slug → new password string

  const login = async () => {
    try {
      await axios.post('/api/super/login', { superPassword: pw })
      sessionStorage.setItem('superAdminPw', pw)
      setAuthed(true)
      fetchGames(pw)
    } catch { setLoginErr('סיסמה שגויה') }
  }

  const fetchGames = async (password = pw) => {
    const res = await axios.get('/api/super/games', { headers: SUPER_HDR(password) })
    setGames(res.data)
  }

  const deleteGame = async (g) => {
    if (!window.confirm(`למחוק את "${g.name}" וכל הנתונים שלו?`)) return
    try {
      await axios.delete(`/api/super/games/${g.slug}`, { headers: SUPER_HDR(pw) })
      setMsg({ type: 'ok', text: `"${g.name}" נמחק` })
      fetchGames()
    } catch (e) {
      setMsg({ type: 'err', text: e.response?.data?.error || 'שגיאה במחיקה' })
    }
  }

  const changePassword = async (slug) => {
    const newPw = editPw[slug]?.trim()
    if (!newPw) return
    try {
      await axios.patch(`/api/super/games/${slug}/password`, { password: newPw }, { headers: SUPER_HDR(pw) })
      setMsg({ type: 'ok', text: 'סיסמה עודכנה' })
      setEditPw(p => ({ ...p, [slug]: '' }))
    } catch (e) {
      setMsg({ type: 'err', text: e.response?.data?.error || 'שגיאה בעדכון סיסמה' })
    }
  }

  const createGame = async () => {
    if (!newGame.slug || !newGame.name || !newGame.adminPassword)
      return setMsg({ type: 'err', text: 'מלא את כל השדות' })
    setCreating(true)
    try {
      await axios.post('/api/super/games', newGame, { headers: SUPER_HDR(pw) })
      setMsg({ type: 'ok', text: `משחק "${newGame.name}" נוצר בהצלחה!` })
      setNewGame({ slug: '', name: '', adminPassword: '' })
      fetchGames()
    } catch (e) {
      setMsg({ type: 'err', text: e.response?.data?.error || 'שגיאה ביצירת משחק' })
    } finally { setCreating(false) }
  }

  if (!authed) return (
    <div style={S.page}>
      <div style={S.card}>
        <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>🔑</div>
        <h2 style={{ fontFamily: 'Heebo, sans-serif', color: '#1A202C', marginBottom: 16 }}>ניהול מערכת</h2>
        <input
          style={S.input} type="password" placeholder="סיסמת super-admin"
          value={pw} onChange={e => { setPw(e.target.value); setLoginErr('') }}
          onKeyDown={e => e.key === 'Enter' && login()} autoFocus
        />
        {loginErr && <div style={S.err}>{loginErr}</div>}
        <button style={S.btn} onClick={login}>כניסה</button>
        <button style={S.ghost} onClick={() => navigate('/')}>← חזור</button>
      </div>
    </div>
  )

  return (
    <div style={{ ...S.page, alignItems: 'flex-start', padding: '20px 16px' }}>
      <div style={{ maxWidth: 700, width: '100%', margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h1 style={{ color: 'white', fontFamily: 'Heebo, sans-serif', fontWeight: 900, fontSize: '1.6rem' }}>
            🔧 ניהול מערכת
          </h1>
          <button style={S.ghost} onClick={() => navigate('/')}>← חזור</button>
        </div>

        {/* Games list */}
        <div style={S.section}>
          <h2 style={S.sTitle}>משחקים קיימים</h2>
          {games.length === 0 ? (
            <p style={{ color: '#888', fontFamily: 'Heebo, sans-serif' }}>טוען...</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {games.map(g => (
                <div key={g.slug} style={{ ...S.gameRow, flexDirection: 'column', alignItems: 'stretch', gap: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 800, fontFamily: 'Heebo, sans-serif', color: '#1f2937' }}>{g.name}</div>
                      <div style={{ fontSize: '0.8rem', color: '#6b7280', fontFamily: 'Heebo, sans-serif' }}>
                        /{g.slug} · {g.charCount} דמויות · {g.playerCount} שחקנים · {g.roomCount} משחקים שהסתיימו
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      <button style={{ ...S.smallBtn, background: '#F20D0D' }} onClick={() => navigate(`/${g.slug}`)}>משחק</button>
                      <button style={{ ...S.smallBtn, background: '#4338ca' }} onClick={() => navigate(`/${g.slug}/admin`)}>ניהול</button>
                      <button style={{ ...S.smallBtn, background: '#0056B3' }} onClick={() => navigate(`/${g.slug}/leaderboard`)}>לוח</button>
                      <button style={{ ...S.smallBtn, background: '#6b7280' }} onClick={() => setEditPw(p => ({ ...p, [g.slug]: p[g.slug] === undefined ? '' : undefined }))}>
                        🔑 סיסמה
                      </button>
                      <button style={{ ...S.smallBtn, background: '#991b1b' }} onClick={() => deleteGame(g)}>🗑️ מחק</button>
                    </div>
                  </div>
                  {editPw[g.slug] !== undefined && (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input
                        style={{ ...S.input, flex: 1, padding: '7px 12px', fontSize: '0.88rem' }}
                        placeholder="סיסמה חדשה"
                        value={editPw[g.slug]}
                        onChange={e => setEditPw(p => ({ ...p, [g.slug]: e.target.value }))}
                        onKeyDown={e => e.key === 'Enter' && changePassword(g.slug)}
                      />
                      <button style={{ ...S.smallBtn, background: '#16a34a', padding: '7px 14px' }} onClick={() => changePassword(g.slug)}>שמור</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Create new game */}
        <div style={S.section}>
          <h2 style={S.sTitle}>צור משחק חדש</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <input style={S.input} placeholder="שם המשחק (עברית) — למשל: נחש כהן"
              value={newGame.name} onChange={e => setNewGame(p => ({ ...p, name: e.target.value }))} />
            <input style={{ ...S.input, direction: 'ltr' }} placeholder="slug (אותיות לועזיות) — למשל: cohen"
              value={newGame.slug} onChange={e => setNewGame(p => ({ ...p, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))} />
            <input style={S.input} placeholder="סיסמת מנהל המשחק"
              value={newGame.adminPassword} onChange={e => setNewGame(p => ({ ...p, adminPassword: e.target.value }))} />
            {msg && (
              <div style={{ ...S.err, background: msg.type === 'ok' ? '#e8f5e9' : '#fef2f2', color: msg.type === 'ok' ? '#2e7d32' : '#c62828' }}>
                {msg.text}
              </div>
            )}
            <button style={S.btn} onClick={createGame} disabled={creating}>
              {creating ? 'יוצר...' : '✅ צור משחק'}
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}

const S = {
  page: { minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(160deg, #1e1b4b, #312e81, #1e3a5f)', direction: 'rtl' },
  card: { background: 'white', borderRadius: 24, padding: '36px 28px', maxWidth: 360, width: '100%', textAlign: 'center', boxShadow: '0 24px 64px rgba(0,0,0,0.4)' },
  section: { background: 'rgba(255,255,255,0.95)', borderRadius: 20, padding: 24, marginBottom: 20, boxShadow: '0 8px 30px rgba(0,0,0,0.2)' },
  sTitle: { fontSize: '1.05rem', fontWeight: 800, color: '#312e81', fontFamily: 'Heebo, sans-serif', marginBottom: 16 },
  gameRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', borderRadius: 12, padding: '12px 16px', border: '1px solid #e2e8f0' },
  input: { display: 'block', width: '100%', padding: '11px 14px', border: '2px solid #e0e7ff', borderRadius: 12, fontSize: '0.95rem', fontFamily: 'Heebo, sans-serif', color: '#1A202C', outline: 'none', direction: 'rtl', boxSizing: 'border-box' },
  btn: { display: 'block', width: '100%', padding: '12px', background: 'linear-gradient(135deg, #F20D0D, #C00A0A)', color: 'white', border: 'none', borderRadius: 50, fontSize: '1rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'Heebo, sans-serif', marginTop: 4 },
  smallBtn: { color: 'white', border: 'none', borderRadius: 20, padding: '5px 12px', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'Heebo, sans-serif' },
  ghost: { background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', fontSize: '0.88rem', cursor: 'pointer', fontFamily: 'Heebo, sans-serif' },
  err: { borderRadius: 10, padding: '8px 12px', fontSize: '0.88rem', fontWeight: 600, background: '#fef2f2', color: '#c62828' },
}
