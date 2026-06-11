'use client';
import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function UsersPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const role = (session?.user as any)?.role;
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ username: '', password: '', name: '', role: 'customer' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (role && role !== 'admin') router.push('/dashboard');
    else load();
  }, [role]);

  async function load() {
    const res = await fetch('/api/users');
    if (res.ok) setUsers(await res.json());
    setLoading(false);
  }

  async function addUser() {
    setSaving(true);
    setError('');
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    });
    if (res.ok) {
      setShowAdd(false);
      setForm({ username: '', password: '', name: '', role: 'customer' });
      load();
    } else {
      const d = await res.json();
      setError(d.error || 'שגיאה');
    }
    setSaving(false);
  }

  async function deleteUser(id: string) {
    if (!confirm('למחוק משתמש זה?')) return;
    await fetch('/api/users', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    load();
  }

  if (loading) return <div style={{ color: 'var(--text-muted)', padding: '40px' }}>טוען...</div>;

  const roleLabel: Record<string, string> = { admin: 'מנהל', agent: 'סוכן', customer: 'לקוח' };
  const roleBadge: Record<string, string> = { admin: 'badge-amber', agent: 'badge-blue', customer: 'badge-green' };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 800 }}>ניהול משתמשים</h1>
        <button className="btn-primary" onClick={() => setShowAdd(true)}>+ הוסף משתמש</button>
      </div>

      <div className="card">
        <table className="data-table">
          <thead>
            <tr>
              <th>שם</th>
              <th>שם משתמש</th>
              <th>תפקיד</th>
              <th>תאריך הצטרפות</th>
              <th>פעולות</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id}>
                <td style={{ fontWeight: 700 }}>{u.name}</td>
                <td style={{ color: 'var(--text-muted)', fontFamily: 'monospace' }}>{u.username}</td>
                <td><span className={`badge ${roleBadge[u.role]}`}>{roleLabel[u.role]}</span></td>
                <td style={{ color: 'var(--text-muted)' }}>
                  {new Date(u.created_at).toLocaleDateString('he-IL')}
                </td>
                <td>
                  {u.username !== 'admin' && (
                    <button className="btn-danger" onClick={() => deleteUser(u.id)}>מחק</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showAdd && (
        <div className="modal-overlay" onClick={() => setShowAdd(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div style={{ fontWeight: 800, fontSize: '16px', marginBottom: '20px' }}>הוספת משתמש חדש</div>
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">שם מלא</label>
                <input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="ישראל ישראלי" />
              </div>
              <div className="form-group">
                <label className="form-label">שם משתמש</label>
                <input className="input" value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} placeholder="israel123" />
              </div>
              <div className="form-group">
                <label className="form-label">סיסמה</label>
                <input className="input" type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="••••••••" />
              </div>
              <div className="form-group">
                <label className="form-label">תפקיד</label>
                <select className="input" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
                  <option value="customer">לקוח</option>
                  <option value="agent">סוכן</option>
                  <option value="admin">מנהל</option>
                </select>
              </div>
              {error && (
                <div style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: '8px', padding: '10px', color: 'var(--red)', fontSize: '12px' }}>
                  {error}
                </div>
              )}
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button className="btn-secondary" onClick={() => setShowAdd(false)}>ביטול</button>
                <button className="btn-primary" onClick={addUser} disabled={saving || !form.username || !form.password || !form.name}>
                  {saving ? 'שומר...' : 'הוסף משתמש'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
