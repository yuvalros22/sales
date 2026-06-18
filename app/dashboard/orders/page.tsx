'use client';
import { useSession } from 'next-auth/react';
import { useEffect, useState, useMemo } from 'react';

export default function OrdersPage() {
  const { data: session } = useSession();
  const role = (session?.user as any)?.role;
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [search, setSearch] = useState('');
  
  // Tabs and History
  const [tab, setTab] = useState<'current' | 'history'>('current');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Cart number edit state
  const [editingCartId, setEditingCartId] = useState<string | null>(null);
  const [editCartNumber, setEditCartNumber] = useState('');

  useEffect(() => {
    fetchOrders();
  }, []);

  async function fetchOrders() {
    const res = await fetch('/api/orders');
    const data = await res.json();
    setOrders(data);
    setLoading(false);
  }

  async function exportExcel() {
    setExporting(true);
    const res = await fetch('/api/orders/export');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `orders_${new Date().toISOString().slice(0, 10)}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
    setExporting(false);
  }

  async function toggleIsEntered(id: string, current: boolean) {
    await fetch('/api/orders', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, isEntered: !current })
    });
    fetchOrders(); // refresh
  }

  async function saveCartNumber(id: string) {
    await fetch('/api/orders', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, cartNumber: editCartNumber })
    });
    setEditingCartId(null);
    fetchOrders();
  }

  async function deleteOrder(id: string) {
    if (!window.confirm('האם אתה בטוח שברצונך למחוק הזמנה זו? כל היחידות יוחזרו למלאי.')) return;
    const res = await fetch(`/api/orders?id=${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) alert(data.error || 'שגיאה במחיקה');
    fetchOrders();
  }

  const displayedOrders = useMemo(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    // Filter by tab
    let filtered = orders.filter(o => {
      const orderDate = new Date(o.createdAt);
      const isToday = orderDate >= todayStart;

      if (tab === 'current') {
        // Today OR (Not Today AND NOT Entered)
        return isToday || (!isToday && !o.isEntered);
      } else {
        // History: Not Today AND Entered
        if (isToday || !o.isEntered) return false;
        
        // Date filters for history
        if (fromDate && orderDate < new Date(fromDate)) return false;
        if (toDate) {
          const to = new Date(toDate);
          to.setHours(23, 59, 59, 999);
          if (orderDate > to) return false;
        }
        return true;
      }
    });

    // Search filter
    if (search) {
      const s = search.toLowerCase();
      filtered = filtered.filter(o => 
        o.customerName?.toLowerCase().includes(s) ||
        o.user_name?.toLowerCase().includes(s) ||
        o.cartNumber?.toLowerCase().includes(s) ||
        o.orderNumber?.toLowerCase().includes(s)
      );
    }

    // Sort by Customer Name / User Name ascending
    filtered.sort((a, b) => {
      const nameA = a.customerName || a.user_name || '';
      const nameB = b.customerName || b.user_name || '';
      return nameA.localeCompare(nameB);
    });

    return filtered;
  }, [orders, tab, search, fromDate, toDate]);

  if (loading) return <div style={{ color: 'var(--text-muted)', padding: '40px' }}>טוען...</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 800 }}>
          {role === 'customer' ? 'ההזמנות שלי' : 'ניהול הזמנות'}
        </h1>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <input className="input" style={{ maxWidth: '220px' }} placeholder="חיפוש חופשי..." value={search} onChange={e => setSearch(e.target.value)} />
          {(role === 'admin' || role === 'agent') && (
            <button className="btn-primary" onClick={exportExcel} disabled={exporting}>
              {exporting ? 'מייצא...' : '⬇️ ייצוא לאקסל'}
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '16px', borderBottom: '1px solid var(--border)', marginBottom: '20px' }}>
        <button 
          onClick={() => setTab('current')}
          style={{ 
            padding: '10px 16px', background: 'none', border: 'none', fontSize: '15px', fontWeight: tab === 'current' ? 800 : 500,
            color: tab === 'current' ? 'var(--text-primary)' : 'var(--text-muted)',
            borderBottom: tab === 'current' ? '2px solid var(--accent)' : '2px solid transparent',
            cursor: 'pointer', fontFamily: 'inherit'
          }}
        >
          הזמנות נוכחיות
        </button>
        <button 
          onClick={() => setTab('history')}
          style={{ 
            padding: '10px 16px', background: 'none', border: 'none', fontSize: '15px', fontWeight: tab === 'history' ? 800 : 500,
            color: tab === 'history' ? 'var(--text-primary)' : 'var(--text-muted)',
            borderBottom: tab === 'history' ? '2px solid var(--accent)' : '2px solid transparent',
            cursor: 'pointer', fontFamily: 'inherit'
          }}
        >
          היסטוריה
        </button>
      </div>

      {/* History Filters */}
      {tab === 'history' && (
        <div className="card" style={{ marginBottom: '20px', display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">מתאריך</label>
            <input type="date" className="input" value={fromDate} onChange={e => setFromDate(e.target.value)} />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">עד תאריך</label>
            <input type="date" className="input" value={toDate} onChange={e => setToDate(e.target.value)} />
          </div>
          <button className="btn-secondary" onClick={() => { setFromDate(''); setToDate(''); }} style={{ height: '38px' }}>
            נקה סינון
          </button>
        </div>
      )}

      {/* Summary badges */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <span className="badge badge-blue">{displayedOrders.length} הזמנות ב-{tab === 'current' ? 'נוכחיות' : 'היסטוריה'}</span>
        <span className="badge badge-amber">
          {displayedOrders.reduce((s, o) => s + (o.items?.reduce((ss: number, i: any) => ss + i.packages, 0) || 0), 0)} אריזות
        </span>
        <span className="badge badge-green">
          {displayedOrders.reduce((s, o) => s + (o.items?.reduce((ss: number, i: any) => ss + i.units, 0) || 0), 0).toLocaleString()} יחידות
        </span>
      </div>

      {displayedOrders.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
          אין הזמנות תואמות
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {displayedOrders.map((order: any) => (
            <div key={order.id} className="card" style={{ padding: '0', overflow: 'hidden' }}>
              <div
                style={{ padding: '14px 18px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}
                onClick={() => setExpanded(expanded === order.id ? null : order.id)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    {new Date(order.createdAt).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: '2-digit' })}{' '}
                    {new Date(order.createdAt).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  {role !== 'customer' && (
                    <span className={`badge ${order.user_role === 'admin' ? 'badge-amber' : order.user_role === 'agent' ? 'badge-blue' : 'badge-green'}`}>
                      {order.user_name}
                    </span>
                  )}
                  {order.customerName && (
                    <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-primary)' }}>{order.customerName}</span>
                  )}
                  {order.cartNumber && (
                    <span className="badge badge-purple">עגלה: {order.cartNumber}</span>
                  )}
                  {order.orderNumber && (
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>הזמנה: {order.orderNumber}</span>
                  )}
                  
                  {/* isEntered Checkbox and PDF Export */}
                  {(role === 'admin' || role === 'agent') && (
                    <div onClick={(e) => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: '12px', marginLeft: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <input 
                          type="checkbox" 
                          checked={order.isEntered} 
                          onChange={() => toggleIsEntered(order.id, order.isEntered)}
                          style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                        />
                        <span style={{ fontSize: '11px', color: order.isEntered ? 'var(--green)' : 'var(--text-muted)' }}>
                          {order.isEntered ? 'הוקלד למעלה' : 'לא הוקלד'}
                        </span>
                      </div>
                      
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(`/print/order/${order.id}`, '_blank');
                        }}
                        style={{ background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: '6px', padding: '4px 8px', fontSize: '11px', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}
                      >
                        📄 ייצא ל-PDF / הדפס
                      </button>
                    </div>
                  )}
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    {order.items?.length || 0} פריטים |{' '}
                    <strong style={{ color: 'var(--accent-light)' }}>
                      {order.items?.reduce((s: number, i: any) => s + i.units, 0) || 0}
                    </strong> יח'
                  </span>
                  <span style={{ color: 'var(--text-muted)' }}>{expanded === order.id ? '▲' : '▼'}</span>
                </div>
              </div>

              {expanded === order.id && (
                <div style={{ borderTop: '1px solid var(--border)', padding: '14px 18px', background: 'var(--bg-panel)' }}>
                  {/* Order metadata */}
                  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '14px', alignItems: 'center' }}>
                    {order.lineNumber && <span className="badge badge-blue">שורה: {order.lineNumber}</span>}
                    {order.prodOrderNumber && <span className="badge badge-purple">הז' יצור: {order.prodOrderNumber}</span>}
                    {order.prodLineNumber && <span className="badge badge-purple">שורת יצור: {order.prodLineNumber}</span>}
                    {order.deliveryDate && (
                      <span className="badge badge-amber">
                        תאריך קבלה: {new Date(order.deliveryDate).toLocaleDateString('he-IL')}
                      </span>
                    )}
                    
                    {/* Inline edit cart number */}
                    {(role === 'admin' || role === 'agent') && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginRight: 'auto' }}>
                        {editingCartId === order.id ? (
                          <>
                            <input 
                              type="text" 
                              className="input" 
                              style={{ width: '100px', padding: '4px 8px', fontSize: '12px', minHeight: 'auto' }} 
                              value={editCartNumber} 
                              onChange={e => setEditCartNumber(e.target.value)} 
                              placeholder="מס' עגלה" 
                            />
                            <button 
                              className="btn-primary" 
                              style={{ padding: '4px 8px', fontSize: '11px', minHeight: 'auto' }}
                              onClick={() => saveCartNumber(order.id)}
                            >
                              שמור
                            </button>
                            <button 
                              className="btn-secondary" 
                              style={{ padding: '4px 8px', fontSize: '11px', minHeight: 'auto' }}
                              onClick={() => setEditingCartId(null)}
                            >
                              ביטול
                            </button>
                          </>
                        ) : (
                          <>
                            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>עגלה: {order.cartNumber || '---'}</span>
                            <button 
                              style={{ background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.2)', color: 'var(--accent-light)', cursor: 'pointer', fontSize: '11px', padding: '4px 8px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}
                              onClick={() => {
                                setEditingCartId(order.id);
                                setEditCartNumber(order.cartNumber || '');
                              }}
                            >
                              ✏️ ערוך
                            </button>
                          </>
                        )}
                        {order.isEntered ? (
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            לא ניתן למחוק - כבר הוקלדה
                          </span>
                        ) : (
                          <button 
                            style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', color: 'var(--red)', cursor: 'pointer', fontSize: '11px', padding: '4px 8px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}
                            onClick={() => deleteOrder(order.id)}
                          >
                            🗑️ מחק
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>שם פריט</th>
                        <th>קוד פריט</th>
                        <th>שם דגם</th>
                        <th>קוד דגם</th>
                        <th>איכות</th>
                        <th>פריחה</th>
                        <th>גודל אריזה</th>
                        <th>אריזות</th>
                        <th>יחידות</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(order.items || []).map((item: any) => (
                        <tr key={item.id}>
                          <td style={{ fontWeight: 700 }}>{item.itemName}</td>
                          <td style={{ color: 'var(--text-muted)' }}>{item.itemCode}</td>
                          <td>{item.modelName}</td>
                          <td style={{ color: 'var(--text-muted)' }}>{item.modelCode}</td>
                          <td><span className="badge badge-purple">{item.quality}</span></td>
                          <td>{item.bloomPct}%</td>
                          <td style={{ color: 'var(--text-muted)' }}>{item.packageSize}</td>
                          <td><span className="badge badge-blue">{item.packages}</span></td>
                          <td style={{ color: 'var(--accent-light)', fontWeight: 700 }}>{item.units}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
