'use client';
import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    await fetch('/api/init');
    const result = await signIn('credentials', { username, password, redirect: false });
    if (result?.error) {
      setError('שם משתמש או סיסמה שגויים');
      setLoading(false);
    } else {
      router.push('/dashboard');
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-base)', padding: '20px' }}>
      <div style={{ width: '100%', maxWidth: '380px' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--accent-light)', marginBottom: '8px' }}>🌿 FlowerStock</div>
          <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>מערכת ניהול מלאי והזמנות</div>
        </div>
        <div className="card" style={{ padding: '28px' }}>
          <div style={{ fontWeight: 700, fontSize: '16px', marginBottom: '20px' }}>כניסה למערכת</div>
          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">שם משתמש</label>
                <input className="input" value={username} onChange={e => setUsername(e.target.value)} placeholder="admin" required />
              </div>
              <div className="form-group">
                <label className="form-label">סיסמה</label>
                <input className="input" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required />
              </div>
              {error && (
                <div style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: '8px', padding: '10px', color: 'var(--red)', fontSize: '12px', textAlign: 'center' }}>{error}</div>
              )}
              <button className="btn-primary" type="submit" disabled={loading} style={{ width: '100%', padding: '10px' }}>
                {loading ? 'מתחבר...' : 'כניסה'}
              </button>
            </div>
          </form>
          <div style={{ marginTop: '20px', padding: '14px', background: 'var(--bg-panel)', borderRadius: '8px', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '8px' }}>משתמשי Demo:</div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: '1.8' }}>
              <div>👑 מנהל: <strong>admin</strong> / <strong>admin123</strong></div>
              <div>🧑‍💼 סוכן: <strong>agent1</strong> / <strong>agent123</strong></div>
              <div>🛍️ לקוח: <strong>customer1</strong> / <strong>customer123</strong></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
