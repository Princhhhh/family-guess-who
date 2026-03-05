import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import axios from 'axios'

const API_BASE = import.meta.env.VITE_BACKEND_URL || ''

export default function AdminPanel() {
  const { slug }  = useParams()
  const navigate  = useNavigate()
  const password  = sessionStorage.getItem('adminPassword')
  const authHdr   = { 'x-admin-password': password }

  const [saved,        setSaved]        = useState([])
  const [pending,      setPending]      = useState([])
  const [loadingSaved, setLoadingSaved] = useState(true)
  const [saving,       setSaving]       = useState(false)
  const [message,      setMessage]      = useState(null)
  const [dragOver,     setDragOver]     = useState(false)
  const [gameName,     setGameName]     = useState('')

  const fileInputRef = useRef(null)

  useEffect(() => {
    if (!password) { navigate(`/${slug}/admin`); return }
    fetchSaved()
    axios.get(`/api/g/${slug}`)
      .then(r => setGameName(r.data.name))
      .catch(() => navigate('/'))
  }, [])

  const fetchSaved = async () => {
    setLoadingSaved(true)
    try {
      const res = await axios.get(`/api/g/${slug}/admin/characters`, { headers: authHdr })
      setSaved(res.data)
    } catch (e) {
      if (e.response?.status === 401) navigate(`/${slug}/admin`)
    } finally { setLoadingSaved(false) }
  }

  const addFiles = useCallback((files) => {
    const arr = Array.from(files).filter(f => f.type.startsWith('image/'))
    if (!arr.length) return
    setPending(prev => [...prev, ...arr.map(file => ({
      id:      Math.random().toString(36).slice(2),
      file,
      preview: URL.createObjectURL(file),
      name:    file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' '),
      status:  'pending',
    }))])
  }, [])

  const onDrop = (e) => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files) }

  const handleSaveAll = async () => {
    const toUpload = pending.filter(p => p.status === 'pending' && p.name.trim())
    if (!toUpload.length) { setMessage({ type: 'err', text: 'מלא שמות לכל התמונות תחילה' }); return }
    setSaving(true); setMessage(null)
    let ok = 0, fail = 0
    for (const item of toUpload) {
      setPending(prev => prev.map(p => p.id === item.id ? { ...p, status: 'uploading' } : p))
      try {
        const fd = new FormData()
        fd.append('name', item.name.trim()); fd.append('image', item.file)
        await axios.post(`/api/g/${slug}/admin/characters`, fd, {
          headers: { ...authHdr, 'Content-Type': 'multipart/form-data' }
        })
        setPending(prev => prev.map(p => p.id === item.id ? { ...p, status: 'done' } : p)); ok++
      } catch { setPending(prev => prev.map(p => p.id === item.id ? { ...p, status: 'error' } : p)); fail++ }
    }
    setSaving(false)
    setMessage({ type: ok > 0 ? 'ok' : 'err', text: `${ok} דמויות נשמרו${fail ? `, ${fail} נכשלו` : ''}` })
    fetchSaved()
    setTimeout(() => setPending(prev => prev.filter(p => p.status !== 'done')), 1500)
  }

  const handleDelete = async (char) => {
    if (!window.confirm(`למחוק את "${char.name}"?`)) return
    try {
      await axios.delete(`/api/g/${slug}/admin/characters/${char.id}`, { headers: authHdr })
      fetchSaved()
    } catch { setMessage({ type: 'err', text: 'שגיאה במחיקה' }) }
  }

  const imgSrc = (char) => char.image_path?.startsWith('http') ? char.image_path : `${API_BASE}${char.image_path}`
  const pendingCount = pending.filter(p => p.status === 'pending').length
  const readyCount   = pending.filter(p => p.status === 'pending' && p.name.trim()).length

  return (
    <div style={S.page}>
      <div style={S.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: '1.3rem', fontWeight: 800, color: '#312e81', fontFamily: 'Heebo, sans-serif' }}>
            🔧 פאנל מנהל — {gameName || slug}
          </span>
          <span style={{ background: saved.length >= 24 ? '#e8f5e9' : '#fff3e0', color: saved.length >= 24 ? '#2e7d32' : '#e65100', padding: '3px 12px', borderRadius: 20, fontSize: '0.85rem', fontWeight: 'bold' }}>
            {saved.length} דמויות {saved.length < 24 ? `(חסרות ${24 - saved.length})` : '✓'}
          </span>
        </div>
        <button style={S.outlineBtn} onClick={() => navigate(`/${slug}`)}>← דף הבית</button>
      </div>

      <div style={S.content}>
        <div style={S.card}>
          <h2 style={S.sectionTitle}>העלה תמונות</h2>
          <div
            style={{ ...S.dropZone, ...(dragOver ? S.dropZoneActive : {}) }}
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>📁</div>
            <div style={{ fontWeight: 'bold', color: '#4a154b', marginBottom: 4 }}>גרור תמונות לכאן או לחץ לבחור</div>
            <div style={{ fontSize: '0.85rem', color: '#888' }}>JPG, PNG, WEBP</div>
            <input ref={fileInputRef} type="file" accept="image/*" multiple style={{ display: 'none' }}
              onChange={e => { addFiles(e.target.files); e.target.value = '' }} />
          </div>

          {pending.length > 0 && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '16px 0 10px' }}>
                <div style={{ fontWeight: 'bold', color: '#333' }}>{pendingCount} תמונות — מלא שמות ולחץ שמור</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button style={{ ...S.outlineBtn, fontSize: '0.85rem' }} onClick={() => setPending([])}>נקה הכל</button>
                  <button style={{ ...S.primaryBtn, opacity: (saving || readyCount === 0) ? 0.6 : 1 }} onClick={handleSaveAll} disabled={saving || readyCount === 0}>
                    {saving ? 'שומר...' : `✅ שמור ${readyCount}`}
                  </button>
                </div>
              </div>
              <div style={S.pendingGrid}>
                {pending.map(item => (
                  <div key={item.id} style={{ ...S.pendingCard, outline: item.status === 'done' ? '2px solid #2e7d32' : item.status === 'error' ? '2px solid #c62828' : item.status === 'uploading' ? '2px solid #1565c0' : '2px solid transparent' }}>
                    {item.status !== 'pending' && (
                      <div style={{ position: 'absolute', top: 4, left: 4, background: item.status === 'done' ? '#2e7d32' : item.status === 'error' ? '#c62828' : '#1565c0', color: 'white', borderRadius: 20, fontSize: '0.7rem', padding: '2px 8px', fontWeight: 'bold', zIndex: 2 }}>
                        {item.status === 'done' ? '✓ נשמר' : item.status === 'error' ? '✗ שגיאה' : '⏳'}
                      </div>
                    )}
                    {item.status === 'pending' && (
                      <button style={S.removeBtn} onClick={() => setPending(prev => prev.filter(p => p.id !== item.id))}>✕</button>
                    )}
                    <img src={item.preview} alt="" style={S.pendingImg} />
                    <input style={S.nameInput} type="text" placeholder="שם הדמות..."
                      value={item.name} onChange={e => setPending(prev => prev.map(p => p.id === item.id ? { ...p, name: e.target.value } : p))}
                      disabled={item.status !== 'pending'} onKeyDown={e => e.key === 'Enter' && handleSaveAll()} />
                  </div>
                ))}
              </div>
              {message && (
                <div style={{ ...S.msg, background: message.type === 'ok' ? '#e8f5e9' : '#ffebee', color: message.type === 'ok' ? '#2e7d32' : '#c62828', marginTop: 12 }}>
                  {message.text}
                </div>
              )}
            </>
          )}
        </div>

        <div style={S.card}>
          <h2 style={S.sectionTitle}>דמויות שמורות ({saved.length})</h2>
          {loadingSaved ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#888' }}>טוען...</div>
          ) : saved.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#aaa' }}>
              <div style={{ fontSize: '3rem', marginBottom: 8 }}>🎭</div>
              העלה לפחות 24 דמויות כדי להתחיל לשחק
            </div>
          ) : (
            <div style={S.savedGrid}>
              {saved.map(char => (
                <div key={char.id} style={S.savedCard}>
                  <img src={imgSrc(char)} alt={char.name} style={S.savedImg}
                    onError={e => { e.target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect fill="%23ddd" width="80" height="80"/></svg>' }} />
                  <div style={S.savedName}>{char.name}</div>
                  <button style={S.deleteBtn} onClick={() => handleDelete(char)}>🗑️ מחק</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const S = {
  page:    { minHeight: '100vh', background: '#f5f5f5', direction: 'rtl' },
  header:  { background: 'white', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, position: 'sticky', top: 0, zIndex: 10 },
  content: { maxWidth: 1000, margin: '0 auto', padding: '20px 16px' },
  card:    { background: 'white', borderRadius: 16, padding: 24, marginBottom: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' },
  sectionTitle: { fontSize: '1.1rem', fontWeight: 'bold', color: '#4a154b', marginBottom: 16 },
  dropZone: { border: '2px dashed #ce93d8', borderRadius: 14, padding: '32px 20px', textAlign: 'center', cursor: 'pointer', transition: 'all 0.2s', background: '#fafafa' },
  dropZoneActive: { borderColor: '#764ba2', background: '#f3e5f5', transform: 'scale(1.01)' },
  pendingGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 12 },
  pendingCard: { position: 'relative', borderRadius: 12, overflow: 'hidden', background: '#fafafa', border: '1px solid #eee', display: 'flex', flexDirection: 'column' },
  pendingImg:  { width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block' },
  nameInput: { display: 'block', width: '100%', padding: '7px 8px', fontSize: '0.85rem', border: 'none', borderTop: '1px solid #eee', outline: 'none', textAlign: 'center', direction: 'rtl', background: 'white', boxSizing: 'border-box' },
  removeBtn: { position: 'absolute', top: 4, right: 4, width: 22, height: 22, background: 'rgba(0,0,0,0.55)', color: 'white', border: 'none', borderRadius: '50%', cursor: 'pointer', fontSize: '0.7rem', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2, lineHeight: 1 },
  savedGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 12 },
  savedCard: { borderRadius: 12, overflow: 'hidden', border: '1px solid #eee', background: '#fafafa' },
  savedImg:  { width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block' },
  savedName: { textAlign: 'center', fontWeight: 'bold', padding: '6px 4px', fontSize: '0.82rem', color: '#333', borderTop: '1px solid #eee' },
  deleteBtn: { display: 'block', width: '100%', padding: '6px', background: '#ffebee', color: '#c62828', border: 'none', borderTop: '1px solid #ffcdd2', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 'bold' },
  primaryBtn: { background: 'linear-gradient(135deg, #667eea, #764ba2)', color: 'white', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: '0.95rem', fontWeight: 'bold', cursor: 'pointer' },
  outlineBtn: { padding: '7px 14px', background: 'white', color: '#4a154b', border: '2px solid #764ba2', borderRadius: 8, fontSize: '0.88rem', cursor: 'pointer', fontWeight: 'bold' },
  msg: { borderRadius: 8, padding: '10px 14px', fontSize: '0.9rem', fontWeight: 'bold' },
}
