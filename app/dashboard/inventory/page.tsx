'use client';
import { useSession } from 'next-auth/react';
import { useEffect, useState, useMemo } from 'react';

interface InventoryItem {
  id: string;
  itemCode: string;
  itemName: string;
  modelCode: string;
  modelName: string;
  quality: string;
  bloomPct: string;
  quantity: number;
  packageSize: number;
}

export default function InventoryPage() {
  const { data: session } = useSession();
  const role = (session?.user as any)?.role;
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [editPackage, setEditPackage] = useState<{ item: InventoryItem; size: number } | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    const res = await fetch('/api/inventory');
    if (res.ok) setInventory(await res.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const grouped = useMemo(() => {
    const map: Record<string, { itemName: string; models: Record<string, InventoryItem[]> }> = {};
    for (const item of inventory) {
      if (!map[item.itemCode]) map[item.itemCode] = { itemName: item.itemName, models: {} };
      if (!map[item.itemCode].models[item.modelCode])
        map[item.itemCode].models[item.modelCode] = [];
      map[item.itemCode].models[item.modelCode].push(item);
    }
    return map;
  }, [inventory]);

  const filteredItems = useMemo(() => {
    return Object.entries(grouped).filter(([code, data]) =>
      !search ||
      data.itemName.includes(search) ||
      code.includes(search) ||
      Object.values(data.models).flat().some(i => i.modelName.includes(search))
    );
  }, [grouped, search]);

  async function savePackageSize() {
    if (!editPackage) return;
    setSaving(true);
    await fetch('/api/inventory/package-size', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        itemCode: editPackage.item.itemCode,
        modelCode: editPackage.item.modelCode,
        quality: editPackage.item.quality,
        bloomPct: editPackage.item.bloomPct,
        packageSize: editPackage.size
      })
    });
    await load();
    setEditPackage(null);
    setSaving(false);
  }

  if (loading) return <div style={{ color: 'var(--text-muted)', padding: '40px' }}>טוען מלאי...</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 800 }}>{role === 'customer' ? 'קטלוג מוצרים' : 'ניהול מלאי'}</h1>
        <div style={{ display: 'flex', gap: '10px', flex: 1, maxWidth: '320px' }}>
          <input
            className="input"
            placeholder="חיפוש לפי שם פריט, קוד, דגם..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Summary */}
      {role !== 'customer' && (
        <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
          <span className="badge badge-amber">{inventory.length} שורות מלאי</span>
          <span className="badge badge-green">
            {Math.round(inventory.reduce((s, i) => s + i.quantity, 0)).toLocaleString()} יחידות כוללות
          </span>
          <span className="badge badge-blue">{Object.keys(grouped).length} פריטים שונים</span>
        </div>
      )}

      {filteredItems.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
          {inventory.length === 0 ? 'אין מלאי. העלה קובץ Excel כדי להתחיל.' : 'לא נמצאו תוצאות לחיפוש זה.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {filteredItems.map(([itemCode, data]) => (
            <div key={itemCode} className="card" style={{ padding: '0', overflow: 'hidden' }}>
              {/* Item header */}
              <div
                style={{
                  padding: '14px 18px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  cursor: 'pointer',
                  background: selectedItem === itemCode ? 'rgba(251,191,36,0.05)' : 'transparent',
                  transition: 'background 0.15s'
                }}
                onClick={() => setSelectedItem(selectedItem === itemCode ? null : itemCode)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ fontSize: '20px' }}>🌸</div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '14px' }}>{data.itemName}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>קוד: {itemCode} · {Object.keys(data.models).length} דגמים</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {role !== 'customer' && (
                    <span className="badge badge-green">
                      {Math.round(Object.values(data.models).flat().reduce((s, i) => s + i.quantity, 0)).toLocaleString()} יח'
                    </span>
                  )}
                  <span style={{ color: 'var(--text-muted)', fontSize: '18px' }}>{selectedItem === itemCode ? '▲' : '▼'}</span>
                </div>
              </div>

              {/* Expanded models */}
              {selectedItem === itemCode && (
                <div style={{ borderTop: '1px solid var(--border)' }}>
                  {Object.entries(data.models).map(([modelCode, variants]) => (
                    <div key={modelCode} style={{ borderBottom: '1px solid rgba(30,45,69,0.5)', padding: '12px 18px' }}>
                      <div style={{ fontWeight: 700, fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '10px' }}>
                        🌿 {variants[0].modelName} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({modelCode})</span>
                      </div>
                      <div className="table-responsive">
                        <table className="data-table">
                          <thead>
                            <tr>
                              <th>איכות</th>
                              <th>% פריחה</th>
                              <th>גודל אריזה</th>
                              {role !== 'customer' ? <th>כמות במלאי</th> : <th>זמינות</th>}
                              {role === 'admin' && <th>פעולות</th>}
                            </tr>
                          </thead>
                          <tbody>
                            {variants.map(v => (
                              <tr key={v.id}>
                                <td>
                                  <span className="badge badge-purple">{v.quality}</span>
                                </td>
                                <td style={{ color: 'var(--text-secondary)' }}>{v.bloomPct}%</td>
                                <td>
                                  <span className="badge badge-blue">{v.packageSize} יח' לאריזה</span>
                                </td>
                                {role !== 'customer' ? (
                                  <td>
                                    <span style={{ color: v.quantity > 0 ? 'var(--green)' : 'var(--red)', fontWeight: 700 }}>
                                      {Math.round(v.quantity).toLocaleString()} יחידות
                                    </span>
                                    {v.quantity > 0 && (
                                      <span style={{ color: 'var(--text-muted)', fontSize: '11px', marginRight: '6px' }}>
                                        ({Math.floor(v.quantity / v.packageSize)} אריזות)
                                      </span>
                                    )}
                                  </td>
                                ) : (
                                  <td>
                                    <span className={`badge ${v.quantity >= v.packageSize ? 'badge-green' : 'badge-red'}`}>
                                      {v.quantity >= v.packageSize ? '✓ זמין להזמנה' : '✗ לא זמין'}
                                    </span>
                                  </td>
                                )}
                                {role === 'admin' && (
                                  <td>
                                    <button
                                      className="btn-secondary"
                                      style={{ fontSize: '11px', padding: '4px 10px' }}
                                      onClick={() => setEditPackage({ item: v, size: v.packageSize })}
                                    >
                                      עדכן אריזה
                                    </button>
                                  </td>
                                )}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Edit package size modal */}
      {editPackage && (
        <div className="modal-overlay" onClick={() => setEditPackage(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div style={{ fontWeight: 800, fontSize: '16px', marginBottom: '16px' }}>עדכון גודל אריזה</div>
            <div style={{ color: 'var(--text-secondary)', marginBottom: '16px', fontSize: '13px' }}>
              <strong>{editPackage.item.itemName}</strong> — {editPackage.item.modelName}<br />
              איכות: {editPackage.item.quality} | פריחה: {editPackage.item.bloomPct}%
            </div>
            <div className="form-group" style={{ marginBottom: '20px' }}>
              <label className="form-label">יחידות לאריזה</label>
              <input
                className="input"
                type="number"
                min="1"
                value={editPackage.size}
                onChange={e => setEditPackage({ ...editPackage, size: Number(e.target.value) })}
              />
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button className="btn-secondary" onClick={() => setEditPackage(null)}>ביטול</button>
              <button className="btn-primary" onClick={savePackageSize} disabled={saving}>
                {saving ? 'שומר...' : 'שמור'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
