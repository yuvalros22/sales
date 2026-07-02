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
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [form, setForm] = useState({ username: '', password: '', name: '', role: 'customer' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);

  useEffect(() => {
    if (role && role !== 'admin') router.push('/dashboard');
    else load();
  }, [role]);

  async function load() {
    const res = await fetch('/api/users');
    if (res.ok) setUsers(await res.json());
    setLoading(false);
  }

  async function saveUser() {
    setSaving(true);
    setError('');
    
    const method = editingUserId ? 'PUT' : 'POST';
    const body = editingUserId ? { ...form, id: editingUserId } : form;
    
    const res = await fetch('/api/users', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    
    if (res.ok) {
      setShowAdd(false);
      setEditingUserId(null);
      setForm({ username: '', password: '', name: '', role: 'customer' });
      load();
    } else {
      const d = await res.json();
      setError(d.error || 'שגיאה');
    }
    setSaving(false);
  }

  function openEdit(u: any) {
    setEditingUserId(u.id);
    setForm({ username: u.username, password: '', name: u.name, role: u.role });
    setShowAdd(true);
  }

  function openAdd() {
    setEditingUserId(null);
    setForm({ username: '', password: '', name: '', role: 'customer' });
    setShowAdd(true);
  }

  async function deleteUser(id: string) {
    if (!confirm('למחוק משתמש זה?')) return;
    await fetch('/api/users', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    load();
  }

  if (loading) return <div style={{ color: 'var(--text-muted)', padding: '40px' }}>טוען...</div>;

  const roleLabel: Record<string, string> = { admin: 'מנהל', agent: 'סוכן', customer: 'לקוח' };
  const roleBadge: Record<string, string> = { admin: 'badge-amber', agent: 'badge-blue', customer: 'badge-green' };

  function handleSort(key: string) {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  }

  const processedUsers = [...users]
    .filter(u => {
      const q = search.toLowerCase();
      return u.name.toLowerCase().includes(q) || 
             u.username.toLowerCase().includes(q) || 
             roleLabel[u.role].toLowerCase().includes(q);
    })
    .sort((a, b) => {
      if (!sortConfig) return 0;
      const { key, direction } = sortConfig;
      let valA = a[key] || '';
      let valB = b[key] || '';
      
      if (key === 'role') {
        valA = roleLabel[valA] || valA;
        valB = roleLabel[valB] || valB;
      }

      if (valA < valB) return direction === 'asc' ? -1 : 1;
      if (valA > valB) return direction === 'asc' ? 1 : -1;
      return 0;
    });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 800 }}>ניהול משתמשים</h1>
        <div style={{ display: 'flex', gap: '10px' }}>
          <input className="input" placeholder="חיפוש..." value={search} onChange={e => setSearch(e.target.value)} />
          <button className="btn-primary" onClick={openAdd}>+ הוסף משתמש</button>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th onClick={() => handleSort('name')} style={{ cursor: 'pointer' }}>
                  שם {sortConfig?.key === 'name' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                </th>
                <th onClick={() => handleSort('username')} style={{ cursor: 'pointer' }}>
                  שם משתמש {sortConfig?.key === 'username' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                </th>
                <th onClick={() => handleSort('role')} style={{ cursor: 'pointer' }}>
                  תפקיד {sortConfig?.key === 'role' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                </th>
                <th>פעולות</th>
              </tr>
            </thead>
            <tbody>
              {processedUsers.map(u => (
                <tr key={u.id}>
                  <td style={{ fontWeight: 700 }}>{u.name}</td>
                  <td style={{ color: 'var(--text-muted)', fontFamily: 'monospace' }}>{u.username}</td>
                  <td><span className={`badge ${roleBadge[u.role]}`}>{roleLabel[u.role]}</span></td>
                  <td>
                    <button style={{ background: 'none', border: 'none', cursor: 'pointer', marginRight: '10px', fontSize: '16px' }} onClick={() => openEdit(u)}>✏️</button>
                    {u.username !== 'admin' && (
                      <button style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px' }} onClick={() => deleteUser(u.id)}>🗑️</button>
                    )}
                  </td>
                </tr>
              ))}
              {processedUsers.length === 0 && (
                <tr><td colSpan={4} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>לא נמצאו משתמשים</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showAdd && (
        <div className="modal-overlay" onClick={() => setShowAdd(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div style={{ fontWeight: 800, fontSize: '16px', marginBottom: '20px' }}>
              {editingUserId ? 'עריכת משתמש' : 'הוספת משתמש חדש'}
            </div>
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
                <label className="form-label">סיסמה {editingUserId && <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>(השאר ריק כדי לא לשנות)</span>}</label>
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
                <button className="btn-primary" onClick={saveUser} disabled={saving || !form.username || (!editingUserId && !form.password) || !form.name}>
                  {saving ? 'שומר...' : (editingUserId ? 'שמור שינויים' : 'הוסף משתמש')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
