import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    padding: '20px',
  },
  card: {
    background: 'white',
    borderRadius: '20px',
    padding: '40px',
    maxWidth: '380px',
    width: '100%',
    textAlign: 'center',
    boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
  },
  title: {
    fontSize: '1.8rem',
    fontWeight: 'bold',
    color: '#4a154b',
    marginBottom: '8px',
  },
  subtitle: {
    color: '#888',
    marginBottom: '28px',
  },
  input: {
    display: 'block',
    width: '100%',
    padding: '12px 16px',
    fontSize: '1rem',
    border: '2px solid #e0e0e0',
    borderRadius: '10px',
    marginBottom: '16px',
    textAlign: 'center',
    outline: 'none',
    direction: 'ltr',
  },
  btn: {
    display: 'block',
    width: '100%',
    padding: '12px',
    background: 'linear-gradient(135deg, #667eea, #764ba2)',
    color: 'white',
    border: 'none',
    borderRadius: '10px',
    fontSize: '1rem',
    fontWeight: 'bold',
    cursor: 'pointer',
  },
  error: {
    color: '#e53935',
    marginBottom: '12px',
  },
  back: {
    marginTop: '20px',
    color: '#aaa',
    cursor: 'pointer',
    fontSize: '0.9rem',
  }
}

export default function AdminLogin() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async () => {
    setLoading(true)
    setError('')
    try {
      await axios.post('/api/admin/login', { password })
      sessionStorage.setItem('adminPassword', password)
      navigate('/admin/panel')
    } catch {
      setError('סיסמה שגויה')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>🔐</div>
        <div style={styles.title}>פאנל מנהל</div>
        <div style={styles.subtitle}>הכנס סיסמת מנהל</div>
        <input
          style={styles.input}
          type="password"
          placeholder="סיסמה"
          value={password}
          onChange={e => { setPassword(e.target.value); setError('') }}
          onKeyDown={e => e.key === 'Enter' && handleLogin()}
          autoFocus
        />
        {error && <div style={styles.error}>{error}</div>}
        <button style={styles.btn} onClick={handleLogin} disabled={loading}>
          {loading ? 'מתחבר...' : 'כניסה'}
        </button>
        <div style={styles.back} onClick={() => navigate('/')}>← חזור לדף הבית</div>
      </div>
    </div>
  )
}
