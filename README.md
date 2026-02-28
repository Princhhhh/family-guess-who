# Family Guess Who - משחק נחש מי משפחתי

## הרצה מקומית

### דרישות
- Node.js 22+

### התקנה והרצה

```bash
# Backend
cd backend
npm install
npm start        # פורט 3001

# Frontend (טרמינל נפרד)
cd frontend
npm install
npm run dev      # פורט 5173
```

פתח את הדפדפן בכתובת: http://localhost:5173

### פאנל מנהל
http://localhost:5173/admin
סיסמה: `admin123`

יש להוסיף לפחות 24 דמויות לפני שניתן להתחיל משחק.

---

## פריסה ב-Render (Docker)

### שלבים:
1. דחוף את הקוד ל-GitHub
2. ב-Render: New → Web Service → Connect GitHub repo
3. בחר **Docker** כ-Environment
4. הגדר Environment Variables:
   - `NODE_ENV=production`
   - `PORT=10000` (Render מגדיר אוטומטית)
5. הגדר Disk (לשמירת תמונות ו-DB):
   - Mount Path: `/app/data` (לבסיס הנתונים)
   - הוסף Volume נוסף ל: `/app/uploads`

**חשוב:** בסביבת ייצור ב-Render, ה-frontend מוגש ישירות מה-backend (נבנה לתוך `/app/public`).

---

## מבנה הפרויקט

```
family-guess-who/
├── backend/
│   ├── server.js          # Express + Socket.io server
│   ├── database.js        # SQLite (node:sqlite built-in)
│   ├── package.json
│   └── uploads/           # תמונות שהועלו
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── socket.js
│   │   └── pages/
│   │       ├── HomePage.jsx
│   │       ├── GameRoom.jsx
│   │       ├── AdminLogin.jsx
│   │       └── AdminPanel.jsx
│   ├── index.html
│   └── vite.config.js
├── Dockerfile
├── docker-compose.yml
└── README.md
```
