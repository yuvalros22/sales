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
          <div style={{ marginBottom: '16px' }}>
            <img src="/logo.png" alt="ינאי בתי צמיחה" style={{ height: '60px', objectFit: 'contain' }} />
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>מערכת ניהול מלאי והזמנות</div>
        </div>
        <div className="card" style={{ padding: '28px' }}>
          <div style={{ fontWeight: 700, fontSize: '16px', marginBottom: '20px' }}>כניסה למערכת</div>
          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">שם משתמש</label>
                <input className="input" value={username} onChange={e => setUsername(e.target.value)} required />
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
        </div>
      </div>
    </div>
  );
}
