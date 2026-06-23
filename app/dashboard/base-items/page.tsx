'use client';
import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';

interface BaseItem {
  itemCode: string;
  itemName: string;
  packageSize: number;
  imageUrl?: string | null;
  potSize?: string | null;
}

export default function BaseItemsPage() {
  const { data: session } = useSession();
  const role = (session?.user as any)?.role;
  const [items, setItems] = useState<BaseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  const [editingItem, setEditingItem] = useState<BaseItem | null>(null);
  const [isNew, setIsNew] = useState(false);

  useEffect(() => {
    fetchItems();
  }, []);

  async function fetchItems() {
    const res = await fetch('/api/base-items');
    const data = await res.json();
    setItems(data);
    setLoading(false);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!editingItem) return;
    
    await fetch('/api/base-items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editingItem)
    });
    
    setEditingItem(null);
    setIsNew(false);
    fetchItems();
  }

  async function handleDelete(code: string) {
    if (!confirm('האם למחוק פריט זה?')) return;
    await fetch(`/api/base-items?code=${code}`, { method: 'DELETE' });
    fetchItems();
  }



  const filtered = items.filter(i => 
    i.itemCode.includes(search) || i.itemName.includes(search)
  );

  if (role !== 'admin') return <div style={{ padding: '40px' }}>אין לך הרשאה לעמוד זה.</div>;
  if (loading) return <div style={{ color: 'var(--text-muted)', padding: '40px' }}>טוען...</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 800 }}>מאגר פריטים קבועים</h1>
        <div style={{ display: 'flex', gap: '10px' }}>
          <input className="input" placeholder="חיפוש..." value={search} onChange={e => setSearch(e.target.value)} />
          <button className="btn-primary" onClick={() => { setIsNew(true); setEditingItem({ itemCode: '', itemName: '', packageSize: 1, potSize: '' }); }}>
            ➕ פריט חדש
          </button>
        </div>
      </div>

      {editingItem && (
        <div className="card" style={{ marginBottom: '20px', border: '2px solid var(--accent-light)' }}>
          <div style={{ fontWeight: 700, marginBottom: '14px' }}>{isNew ? 'יצירת פריט חדש' : 'עריכת פריט'}</div>
          <form onSubmit={handleSave} style={{ display: 'flex', gap: '10px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div className="form-group" style={{ flex: 1, minWidth: '120px' }}>
              <label className="form-label">קוד פריט *</label>
              <input className="input" required disabled={!isNew} value={editingItem.itemCode} onChange={e => setEditingItem({...editingItem, itemCode: e.target.value})} />
            </div>
            <div className="form-group" style={{ flex: 2, minWidth: '180px' }}>
              <label className="form-label">שם פריט *</label>
              <input className="input" required value={editingItem.itemName} onChange={e => setEditingItem({...editingItem, itemName: e.target.value})} />
            </div>
            <div className="form-group" style={{ flex: 1, minWidth: '100px' }}>
              <label className="form-label">גודל אריזה *</label>
              <input type="number" min="1" className="input" required value={editingItem.packageSize} onChange={e => setEditingItem({...editingItem, packageSize: Number(e.target.value)})} />
            </div>
            <div className="form-group" style={{ flex: 1, minWidth: '100px' }}>
              <label className="form-label">גודל עציץ</label>
              <input className="input" value={editingItem.potSize || ''} onChange={e => setEditingItem({...editingItem, potSize: e.target.value})} placeholder="למשל 12" />
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
                <th>קוד פריט</th>
                <th>שם פריט</th>
                <th>גודל עציץ</th>
                <th>גודל אריזה</th>
                <th style={{ width: '100px', textAlign: 'center' }}>פעולות</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(item => (
                <tr key={item.itemCode}>
                  <td style={{ color: 'var(--text-muted)' }}>{item.itemCode}</td>
                  <td style={{ fontWeight: 700 }}>{item.itemName}</td>
                  <td><span className="badge badge-purple">{item.potSize || '-'}</span></td>
                  <td><span className="badge badge-blue">{item.packageSize} יחידות</span></td>
                  <td style={{ textAlign: 'center' }}>
                    <button style={{ background: 'none', border: 'none', cursor: 'pointer', marginRight: '10px' }} onClick={() => { setIsNew(false); setEditingItem(item); }}>✏️</button>
                    <button style={{ background: 'none', border: 'none', cursor: 'pointer' }} onClick={() => handleDelete(item.itemCode)}>🗑️</button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>לא נמצאו פריטים</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
