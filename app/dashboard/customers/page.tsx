'use client';
import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';

interface Customer {
  customerCode: string;
  customerName: string;
  agentName: string | null;
  isActive: boolean;
}

export default function CustomersPage() {
  const { data: session } = useSession();
  const role = (session?.user as any)?.role;
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  const [editingItem, setEditingItem] = useState<Customer | null>(null);
  const [isNew, setIsNew] = useState(false);

  useEffect(() => {
    fetchCustomers();
  }, []);

  async function fetchCustomers() {
    const res = await fetch('/api/customers');
    const data = await res.json();
    setCustomers(data);
    setLoading(false);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!editingItem) return;
    
    await fetch('/api/customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editingItem)
    });
    
    setEditingItem(null);
    setIsNew(false);
    fetchCustomers();
  }

  async function handleDelete(code: string) {
    if (!confirm('האם למחוק לקוח זה?')) return;
    await fetch(`/api/customers?code=${code}`, { method: 'DELETE' });
    fetchCustomers();
  }

  const filtered = customers.filter(c => 
    c.customerCode.includes(search) || 
    c.customerName.includes(search) ||
    (c.agentName && c.agentName.includes(search))
  );

  if (role !== 'admin') return <div style={{ padding: '40px' }}>אין לך הרשאה לעמוד זה.</div>;
  if (loading) return <div style={{ color: 'var(--text-muted)', padding: '40px' }}>טוען...</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 800 }}>מאגר לקוחות קבועים</h1>
        <div style={{ display: 'flex', gap: '10px' }}>
          <input className="input" placeholder="חיפוש..." value={search} onChange={e => setSearch(e.target.value)} />
          <button className="btn-primary" onClick={() => { setIsNew(true); setEditingItem({ customerCode: '', customerName: '', agentName: '', isActive: true }); }}>
            ➕ לקוח חדש
          </button>
        </div>
      </div>

      {editingItem && (
        <div className="card" style={{ marginBottom: '20px', border: '2px solid var(--accent-light)' }}>
          <div style={{ fontWeight: 700, marginBottom: '14px' }}>{isNew ? 'יצירת לקוח חדש' : 'עריכת לקוח'}</div>
          <form onSubmit={handleSave} style={{ display: 'flex', gap: '10px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div className="form-group" style={{ flex: 1, minWidth: '120px' }}>
              <label className="form-label">קוד לקוח *</label>
              <input className="input" required disabled={!isNew} value={editingItem.customerCode} onChange={e => setEditingItem({...editingItem, customerCode: e.target.value})} />
            </div>
            <div className="form-group" style={{ flex: 2, minWidth: '180px' }}>
              <label className="form-label">שם לקוח *</label>
              <input className="input" required value={editingItem.customerName} onChange={e => setEditingItem({...editingItem, customerName: e.target.value})} />
            </div>
            <div className="form-group" style={{ flex: 1, minWidth: '150px' }}>
              <label className="form-label">שם סוכן</label>
              <input className="input" value={editingItem.agentName || ''} onChange={e => setEditingItem({...editingItem, agentName: e.target.value})} />
            </div>
            <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingBottom: '12px' }}>
              <input type="checkbox" checked={editingItem.isActive} onChange={e => setEditingItem({...editingItem, isActive: e.target.checked})} style={{ width: '18px', height: '18px' }} />
              <label className="form-label" style={{ marginBottom: 0 }}>לקוח פעיל</label>
            </div>
            <div style={{ paddingBottom: '1px', display: 'flex', gap: '8px' }}>
              <button type="submit" className="btn-primary">שמור</button>
              <button type="button" className="btn-secondary" onClick={() => setEditingItem(null)}>ביטול</button>
            </div>
          </form>
        </div>
      )}

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>קוד לקוח</th>
                <th>שם לקוח</th>
                <th>שם סוכן</th>
                <th>סטטוס</th>
                <th style={{ width: '100px', textAlign: 'center' }}>פעולות</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(item => (
                <tr key={item.customerCode}>
                  <td style={{ color: 'var(--text-muted)' }}>{item.customerCode}</td>
                  <td style={{ fontWeight: 700 }}>{item.customerName}</td>
                  <td><span className="badge badge-purple">{item.agentName || '-'}</span></td>
                  <td>
                    {item.isActive ? <span className="badge badge-green">פעיל</span> : <span className="badge badge-amber">לא פעיל</span>}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <button style={{ background: 'none', border: 'none', cursor: 'pointer', marginRight: '10px' }} onClick={() => { setIsNew(false); setEditingItem(item); }}>✏️</button>
                    <button style={{ background: 'none', border: 'none', cursor: 'pointer' }} onClick={() => handleDelete(item.customerCode)}>🗑️</button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>לא נמצאו לקוחות</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
