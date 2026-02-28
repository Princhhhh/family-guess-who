import React from 'react'
import { Routes, Route } from 'react-router-dom'
import HomePage   from './pages/HomePage'
import GameRoom   from './pages/GameRoom'
import JoinRoom   from './pages/JoinRoom'
import AdminLogin from './pages/AdminLogin'
import AdminPanel from './pages/AdminPanel'

export default function App() {
  return (
    <Routes>
      <Route path="/"              element={<HomePage />} />
      <Route path="/room/:code"    element={<GameRoom />} />
      <Route path="/join/:code"    element={<JoinRoom />} />
      <Route path="/admin"         element={<AdminLogin />} />
      <Route path="/admin/panel"   element={<AdminPanel />} />
    </Routes>
  )
}
