# 🌿 FlowerStock — מערכת ניהול מלאי והזמנות

## התקנה והפעלה

### דרישות
- Node.js 18+
- npm

### התקנה
```bash
npm install
```

### הגדרת סביבה
קובץ `.env.local` כבר מוגדר. לייצור, שנה:
```
NEXTAUTH_URL=https://your-domain.com
NEXTAUTH_SECRET=your-very-secret-key-here
```

### הפעלה בפיתוח
```bash
npm run dev
```

### בנייה לייצור
```bash
npm run build
npm start
```

---

## משתמשי Demo
| תפקיד | שם משתמש | סיסמה |
|--------|-----------|-------|
| מנהל | `admin` | `admin123` |
| סוכן | `agent1` | `agent123` |
| לקוח | `customer1` | `customer123` |

---

## מבנה הפרויקט

```
app/
  login/          — עמוד כניסה
  dashboard/
    page.tsx      — סקירה כללית
    inventory/    — תצוגת מלאי
    new-order/    — יצירת הזמנה
    orders/       — רשימת הזמנות
    upload/       — העלאת Excel
    users/        — ניהול משתמשים (מנהל בלבד)
lib/
  db.ts           — חיבור SQLite
  auth.ts         — הגדרות NextAuth
  seed.ts         — נתוני ברירת מחדל
```

---

## פורמט Excel למלאי
| עמודה | תוכן |
|-------|------|
| B | יתרה בפקע (כמות) |
| H | % פריחה |
| I | איכות |
| O | שם דגם |
| P | קוד דגם |
| T | שם פריט |
| U | קוד פריט |

---

## טכנולוגיות
- **Next.js 15** (App Router)
- **NextAuth.js** — אימות משתמשים
- **libsql/SQLite** — בסיס נתונים
- **XLSX** — קריאה וייצוא של Excel
- **bcryptjs** — הצפנת סיסמאות
