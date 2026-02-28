import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import axios from 'axios'

export default function JoinRoom() {
  const { code }   = useParams()
  const navigate   = useNavigate()
  const [error, setError] = useState('')

  useEffect(() => {
    const join = async () => {
      try {
        const res = await axios.post('/api/rooms/join', { code })
        sessionStorage.setItem('playerId',        res.data.playerId)
        sessionStorage.setItem('playerNum',       '2')
        sessionStorage.setItem('characters',      JSON.stringify(res.data.characters))
        sessionStorage.setItem('secretCharacter', JSON.stringify(res.data.secretCharacter))
        navigate(`/room/${code}`, { replace: true })
      } catch (e) {
        setError(e.response?.data?.error || 'הקישור לא תקין או החדר מלא')
      }
    }
    join()
  }, [code])

  if (error) return (
    <div style={S.page}>
      <div style={S.card}>
        <div style={{ fontSize: '3rem', marginBottom: 12 }}>😕</div>
        <h2 style={{ color: '#dc2626', marginBottom: 12, fontFamily: 'Rubik, sans-serif' }}>שגיאה</h2>
        <p style={{ color: '#6b7280', marginBottom: 24, fontFamily: 'Rubik, sans-serif' }}>{error}</p>
        <button style={S.btn} onClick={() => navigate('/')}>🏠 חזור לדף הבית</button>
      </div>
    </div>
  )

  return (
    <div style={S.page}>
      <div style={S.card}>
        <div style={{ fontSize: '2.5rem', marginBottom: 16, animation: 'spin 1s linear infinite' }}>⚙️</div>
        <p style={{ color: '#6b7280', fontFamily: 'Rubik, sans-serif', fontWeight: 500 }}>מצטרף למשחק...</p>
      </div>
    </div>
  )
}

const S = {
  page: {
    minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'linear-gradient(160deg, #1e1b4b, #312e81, #1e3a5f)', padding: 20,
  },
  card: {
    background: 'white', borderRadius: 24, padding: '36px 28px',
    maxWidth: 360, width: '100%', textAlign: 'center',
    boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
  },
  btn: {
    background: 'linear-gradient(135deg, #7c3aed, #6d28d9)', color: 'white',
    border: 'none', borderRadius: 50, padding: '12px 28px',
    fontSize: '1rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'Rubik, sans-serif',
  },
}
