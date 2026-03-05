import React from 'react'
import { Routes, Route } from 'react-router-dom'
import GamesIndex from './pages/GamesIndex'
import SuperAdmin  from './pages/SuperAdmin'
import HomePage   from './pages/HomePage'
import GameRoom   from './pages/GameRoom'
import JoinRoom   from './pages/JoinRoom'
import AdminLogin from './pages/AdminLogin'
import AdminPanel from './pages/AdminPanel'
import Leaderboard from './pages/Leaderboard'

export default function App() {
  return (
    <Routes>
      <Route path="/"                      element={<GamesIndex />} />
      <Route path="/super-admin"           element={<SuperAdmin />} />
      <Route path="/:slug"                 element={<HomePage />} />
      <Route path="/:slug/room/:code"      element={<GameRoom />} />
      <Route path="/:slug/join/:code"      element={<JoinRoom />} />
      <Route path="/:slug/admin"           element={<AdminLogin />} />
      <Route path="/:slug/admin/panel"     element={<AdminPanel />} />
      <Route path="/:slug/leaderboard"     element={<Leaderboard />} />
    </Routes>
  )
}
