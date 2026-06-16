'use client';
import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';

export default function OrdersPage() {
  const { data: session } = useSession();
  const role = (session?.user as any)?.role;
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [search, setSearch] = useState('');

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

  const filtered = orders.filter(o => {
    if (!search) return true;
    return (
      o.customerName?.includes(search) ||
      o.user_name?.includes(search) ||
      o.cartNumber?.includes(search) ||
      o.orderNumber?.includes(search)
    );
  });

  if (loading) return <div style={{ color: 'var(--text-muted)', padding: '40px' }}>טוען...</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 800 }}>
          {role === 'customer' ? 'ההזמנות שלי' : 'ניהול הזמנות'}
        </h1>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <input className="input" style={{ maxWidth: '220px' }} placeholder="חיפוש..." value={search} onChange={e => setSearch(e.target.value)} />
          {(role === 'admin' || role === 'agent') && (
            <button className="btn-primary" onClick={exportExcel} disabled={exporting}>
              {exporting ? 'מייצא...' : '⬇️ ייצוא לאקסל'}
            </button>
          )}
        </div>
      </div>

      {/* Summary badges */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <span className="badge badge-blue">{orders.length} הזמנות</span>
        <span className="badge badge-amber">
          {orders.reduce((s, o) => s + (o.items?.reduce((ss: number, i: any) => ss + i.packages, 0) || 0), 0)} אריזות
        </span>
        <span className="badge badge-green">
          {orders.reduce((s, o) => s + (o.items?.reduce((ss: number, i: any) => ss + i.units, 0) || 0), 0).toLocaleString()} יחידות
        </span>
      </div>

      {filtered.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
          אין הזמנות עדיין
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {filtered.map((order: any) => (
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
                    <span style={{ fontWeight: 700, fontSize: '13px' }}>{order.customerName}</span>
                  )}
                  {order.cartNumber && (
                    <span className="badge badge-purple">עגלה: {order.cartNumber}</span>
                  )}
                  {order.orderNumber && (
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>הזמנה: {order.orderNumber}</span>
                  )}
                  
                  {/* isEntered Checkbox inside the header */}
                  {(role === 'admin' || role === 'agent') && (
                    <div onClick={(e) => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '10px' }}>
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
                <div style={{ borderTop: '1px solid var(--border)', padding: '14px 18px' }}>
                  {/* Order metadata */}
                  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '14px' }}>
                    {order.lineNumber && <span className="badge badge-blue">שורה: {order.lineNumber}</span>}
                    {order.prodOrderNumber && <span className="badge badge-purple">הז' יצור: {order.prodOrderNumber}</span>}
                    {order.prodLineNumber && <span className="badge badge-purple">שורת יצור: {order.prodLineNumber}</span>}
                    {order.deliveryDate && (
                      <span className="badge badge-amber">
                        תאריך קבלה: {new Date(order.deliveryDate).toLocaleDateString('he-IL')}
                      </span>
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
