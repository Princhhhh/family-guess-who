#!/bin/bash
# Start both backend and frontend for local development

echo "Starting Family Guess Who..."
echo ""

# Start backend
cd backend && node server.js &
BACKEND_PID=$!
echo "Backend started (PID: $BACKEND_PID) on http://localhost:3001"

# Start frontend
cd ../frontend && npm run dev &
FRONTEND_PID=$!
echo "Frontend started (PID: $FRONTEND_PID) on http://localhost:5173"

echo ""
echo "Open: http://localhost:5173"
echo "Admin: http://localhost:5173/admin (password: admin123)"
echo ""
echo "Press Ctrl+C to stop both servers"

# Wait and clean up
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM
wait
