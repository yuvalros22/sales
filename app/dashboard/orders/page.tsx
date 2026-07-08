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
  
  // Sort & Filter
  const [sortBy, setSortBy] = useState<'createdAt' | 'customerName' | 'cartNumber' | 'agentName'>('createdAt');
  const [sortDesc, setSortDesc] = useState<boolean>(true);
  const [showStatus, setShowStatus] = useState<'all' | 'untyped'>('all');
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());

  function handleSort(column: 'createdAt' | 'customerName' | 'cartNumber' | 'agentName') {
    if (sortBy === column) {
      setSortDesc(!sortDesc);
    } else {
      setSortBy(column);
      setSortDesc(false);
    }
  }

  function handleSelectAll(displayedOrdersList: any[]) {
    if (selectedOrders.size === displayedOrdersList.length && displayedOrdersList.length > 0) {
      setSelectedOrders(new Set());
    } else {
      setSelectedOrders(new Set(displayedOrdersList.map((o: any) => o.id)));
    }
  }

  function toggleOrderSelection(id: string) {
    const newSet = new Set(selectedOrders);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedOrders(newSet);
  }

  function bulkPrint() {
    if (selectedOrders.size === 0) return;
    sessionStorage.setItem('printOrderIds', JSON.stringify(Array.from(selectedOrders)));
    window.open('/print/orders', '_blank');
  }

  const [tab, setTab] = useState<'current' | 'history'>('current');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [showAllHistory, setShowAllHistory] = useState(false);

  // Cart number edit state
  const [editingCartId, setEditingCartId] = useState<string | null>(null);
  const [editCartNumber, setEditCartNumber] = useState('');

  useEffect(() => {
    fetchOrders();
  }, [showAllHistory]);

  async function fetchOrders() {
    setLoading(true);
    const res = await fetch(`/api/orders${showAllHistory ? '?allHistory=true' : ''}`);
    const data = await res.json();
    setOrders(data);
    setLoading(false);
  }

  async function exportExcel() {
    setExporting(true);
    const orderIds = Array.from(selectedOrders);
    const res = await fetch('/api/orders/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderIds })
    });
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

      // untyped filter
      if (showStatus === 'untyped' && o.isEntered) {
        return false;
      }

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

    // Sort
    filtered.sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'createdAt') {
        cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      } else if (sortBy === 'customerName') {
        const nameA = a.customerName || a.user_name || '';
        const nameB = b.customerName || b.user_name || '';
        cmp = nameA.localeCompare(nameB);
      } else if (sortBy === 'cartNumber') {
        const cA = a.cartNumber || '';
        const cB = b.cartNumber || '';
        cmp = cA.localeCompare(cB);
      } else if (sortBy === 'agentName') {
        const agA = a.user_name || '';
        const agB = b.user_name || '';
        cmp = agA.localeCompare(agB);
      }
      return sortDesc ? -cmp : cmp;
    });

    return filtered;
  }, [orders, tab, search, fromDate, toDate, sortBy, sortDesc, showStatus]);

  if (loading) return <div style={{ color: 'var(--text-muted)', padding: '40px' }}>טוען...</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 800 }}>
          {role === 'customer' ? 'ההזמנות שלי' : 'ניהול הזמנות'}
        </h1>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', flex: 1, justifyContent: 'flex-end' }}>
          <input className="input" style={{ minWidth: '150px', flex: 1, maxWidth: '200px' }} placeholder="חיפוש חופשי..." value={search} onChange={e => setSearch(e.target.value)} />
          {/* Filter Status (Toggle Switch) */}
          <div 
            style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', background: 'var(--bg-panel)', padding: '0 16px', height: '42px', borderRadius: '8px', border: '1px solid var(--border)' }}
            onClick={() => setShowStatus(showStatus === 'all' ? 'untyped' : 'all')}
            title={showStatus === 'untyped' ? 'מציג רק הזמנות שלא הוקלדו' : 'מציג את כל ההזמנות'}
          >
            <span style={{ fontSize: '14px', fontWeight: 600, color: showStatus === 'untyped' ? 'var(--text-primary)' : 'var(--text-muted)', userSelect: 'none' }}>
              הצג רק לא הוקלד
            </span>
            <div style={{
              width: '44px', height: '24px', borderRadius: '12px',
              background: showStatus === 'untyped' ? 'var(--green)' : 'var(--border)',
              position: 'relative', transition: 'background 0.3s'
            }}>
              <div style={{
                width: '20px', height: '20px', borderRadius: '50%', background: '#fff',
                position: 'absolute', top: '2px', right: showStatus === 'untyped' ? '22px' : '2px',
                transition: 'right 0.3s cubic-bezier(0.4, 0.0, 0.2, 1)', boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
              }} />
            </div>
          </div>

          {(role === 'admin' || role === 'agent') && selectedOrders.size > 0 && (
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', background: 'var(--bg-panel)', padding: '0 16px', borderRadius: '8px', height: '42px', border: '1px solid var(--border)' }}>
              <span style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '14px', marginLeft: '8px' }}>
                {selectedOrders.size} מסומנים
              </span>
              <button className="btn-secondary" style={{ height: '32px', fontSize: '13px', padding: '0 12px', margin: 0 }} onClick={bulkPrint}>
                🖨️ הדפס
              </button>
              <button className="btn-primary" style={{ height: '32px', fontSize: '13px', padding: '0 12px', margin: 0 }} onClick={exportExcel} disabled={exporting}>
                {exporting ? 'מייצא...' : '⬇️ אקסל'}
              </button>
            </div>
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
        <div style={{ overflowX: 'auto', paddingBottom: '16px', margin: '0 -16px', padding: '0 16px' }}>
          <div style={{ minWidth: '900px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            
            {/* Table Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '0 18px', fontSize: '13px', fontWeight: 700, color: 'var(--text-muted)', userSelect: 'none' }}>
               <div style={{ width: '20px', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                 <input 
                   type="checkbox" 
                   checked={displayedOrders.length > 0 && selectedOrders.size === displayedOrders.length}
                   onChange={() => handleSelectAll(displayedOrders)}
                   style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                   title="בחר הכל במסך זה"
                 />
               </div>
               <div style={{ width: '120px', flexShrink: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }} onClick={() => handleSort('createdAt')}>
                 זמן הכנסה {sortBy === 'createdAt' ? (sortDesc ? '▼' : '▲') : <span style={{opacity: 0.3}}>▼</span>}
               </div>
               <div style={{ flex: 1, minWidth: '150px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }} onClick={() => handleSort('customerName')}>
                 שם לקוח {sortBy === 'customerName' ? (sortDesc ? '▼' : '▲') : <span style={{opacity: 0.3}}>▼</span>}
               </div>
               {role !== 'customer' && <div style={{ width: '100px', flexShrink: 0 }}>שם מזין</div>}
               <div style={{ width: '100px', flexShrink: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }} onClick={() => handleSort('agentName')}>
                 שם סוכן {sortBy === 'agentName' ? (sortDesc ? '▼' : '▲') : <span style={{opacity: 0.3}}>▼</span>}
               </div>
               <div style={{ width: '120px', flexShrink: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }} onClick={() => handleSort('cartNumber')}>
                 עגלה / הזמנה {sortBy === 'cartNumber' ? (sortDesc ? '▼' : '▲') : <span style={{opacity: 0.3}}>▼</span>}
               </div>
               {role !== 'customer' && <div style={{ width: '180px', flexShrink: 0 }}>סטטוס</div>}
               <div style={{ width: '120px', flexShrink: 0, textAlign: 'left' }}>סה״כ פריטים</div>
            </div>

            {displayedOrders.map((order: any) => (
              <div key={order.id} className="card" style={{ padding: '0', overflow: 'hidden', border: selectedOrders.has(order.id) ? '2px solid var(--accent)' : '1px solid var(--border)' }}>
                <div
                  style={{ padding: '14px 18px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '16px', background: selectedOrders.has(order.id) ? 'var(--bg-base)' : 'transparent' }}
                  onClick={() => setExpanded(expanded === order.id ? null : order.id)}
                >
                  <div style={{ width: '20px', flexShrink: 0, display: 'flex', alignItems: 'center' }} onClick={e => e.stopPropagation()}>
                    <input 
                      type="checkbox" 
                      checked={selectedOrders.has(order.id)}
                      onChange={() => toggleOrderSelection(order.id)}
                      style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                    />
                  </div>
                  <div style={{ width: '120px', flexShrink: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>
                    <div style={{ fontWeight: 600 }}>{new Date(order.createdAt).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: '2-digit' })}</div>
                    <div style={{ fontSize: '11px' }}>{new Date(order.createdAt).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}</div>
                  </div>

                  <div style={{ flex: 1, minWidth: '150px' }}>
                    {order.customerName ? (
                      <span style={{ fontWeight: 800, fontSize: '15px', color: 'var(--text-primary)' }}>{order.customerName}</span>
                    ) : '-'}
                  </div>

                  {role !== 'customer' && (
                    <div style={{ width: '100px', flexShrink: 0 }}>
                      <span className={`badge ${order.user_role === 'admin' ? 'badge-amber' : order.user_role === 'agent' ? 'badge-blue' : 'badge-green'}`}>
                        {order.user_name}
                      </span>
                    </div>
                  )}

                  <div style={{ width: '100px', flexShrink: 0 }}>
                    {order.agentName ? (
                      <span className="badge badge-purple" style={{ fontSize: '12px' }}>{order.agentName}</span>
                    ) : '-'}
                  </div>

                  <div style={{ width: '120px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start' }}>
                    {order.cartNumber && <span className="badge badge-purple" style={{ alignSelf: 'flex-start' }}>עגלה: {order.cartNumber}</span>}
                    {order.orderNumber && <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>הזמנה: {order.orderNumber}</span>}
                    {!order.cartNumber && !order.orderNumber && '-'}
                  </div>

                  {/* Status & PDF */}
                  {role !== 'customer' && (
                    <div style={{ width: '180px', flexShrink: 0, display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div onClick={(e) => { e.stopPropagation(); toggleIsEntered(order.id, order.isEntered); }} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <div style={{ 
                          width: '18px', height: '18px', borderRadius: '4px', 
                          background: order.isEntered ? 'var(--green)' : 'transparent', 
                          border: order.isEntered ? 'none' : '2px solid var(--text-muted)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: '#fff', fontSize: '12px', fontWeight: 900
                        }}>
                          {order.isEntered && '✓'}
                        </div>
                        <span style={{ fontSize: '12px', fontWeight: order.isEntered ? 700 : 500, color: order.isEntered ? 'var(--green)' : 'var(--text-muted)' }}>
                          {order.isEntered ? 'הוקלד' : 'לא הוקלד'}
                        </span>
                      </div>
                      
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(`/print/order/${order.id}`, '_blank');
                        }}
                        style={{ background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: '6px', padding: '4px 8px', fontSize: '11px', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}
                      >
                        📄 ייצא
                      </button>
                    </div>
                  )}

                  <div style={{ width: '120px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      {order.items?.length || 0} פר' |{' '}
                      <strong style={{ color: 'var(--accent-light)', fontSize: '14px' }}>
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

                  <div className="table-responsive">
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
                </div>
              )}
            </div>
          ))}
          {tab === 'history' && !showAllHistory && (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '20px' }}>
              <button className="btn-secondary" onClick={() => setShowAllHistory(true)}>
                טען היסטוריה ישנה יותר...
              </button>
            </div>
          )}
          </div>
        </div>
      )}
    </div>
  );
}
