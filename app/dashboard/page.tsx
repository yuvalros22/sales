'use client';
import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function DashboardPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [inventory, setInventory] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [invRes, ordRes] = await Promise.all([
        fetch('/api/inventory'),
        fetch('/api/orders')
      ]);
      if (invRes.ok) setInventory(await invRes.json());
      if (ordRes.ok) setOrders(await ordRes.json());
      setLoading(false);
    }
    load();
  }, []);

  const role = (session?.user as any)?.role;
  const totalItems = inventory.length;
  const totalStock = inventory.reduce((s: number, i: any) => s + (i.quantity || 0), 0);
  const todayOrders = orders.filter((o: any) => {
    const d = new Date(o.created_at);
    const today = new Date();
    return d.toDateString() === today.toDateString();
  }).length;

  if (loading) return <div style={{ color: 'var(--text-muted)', padding: '40px' }}>טוען...</div>;

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)' }}>
          שלום, {session?.user?.name} 👋
        </h1>
        <div style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '4px' }}>
          {new Date().toLocaleDateString('he-IL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '16px', marginBottom: '28px' }}>
        <div className="stat-card">
          <div className="stat-num">{totalItems}</div>
          <div className="stat-label">פריטים במלאי</div>
        </div>
        {role !== 'customer' && (
          <div className="stat-card">
            <div className="stat-num" style={{ color: 'var(--green)' }}>{Math.round(totalStock).toLocaleString()}</div>
            <div className="stat-label">יחידות זמינות</div>
          </div>
        )}
        <div className="stat-card">
          <div className="stat-num" style={{ color: 'var(--blue)' }}>{orders.length}</div>
          <div className="stat-label">סה"כ הזמנות</div>
        </div>
        <div className="stat-card">
          <div className="stat-num" style={{ color: 'var(--purple)' }}>{todayOrders}</div>
          <div className="stat-label">הזמנות היום</div>
        </div>
      </div>

      {/* Quick actions */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '28px' }}>
        <div className="card" style={{ cursor: 'pointer' }} onClick={() => router.push('/dashboard/inventory')}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ fontSize: '28px' }}>📦</div>
            <div>
              <div style={{ fontWeight: 700, marginBottom: '4px' }}>צפייה במלאי</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{totalItems} פריטים זמינים</div>
            </div>
          </div>
        </div>
        <div className="card" style={{ cursor: 'pointer' }} onClick={() => router.push('/dashboard/new-order')}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ fontSize: '28px' }}>➕</div>
            <div>
              <div style={{ fontWeight: 700, marginBottom: '4px' }}>הזמנה חדשה</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>צור הזמנה חדשה</div>
            </div>
          </div>
        </div>
        {(role === 'admin' || role === 'agent') && (
          <div className="card" style={{ cursor: 'pointer' }} onClick={() => router.push('/dashboard/upload')}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ fontSize: '28px' }}>⬆️</div>
              <div>
                <div style={{ fontWeight: 700, marginBottom: '4px' }}>העלאת מלאי</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>יבא קובץ Excel</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Recent orders */}
      <div className="card">
        <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>הזמנות אחרונות</span>
          <button className="btn-secondary" style={{ fontSize: '12px', padding: '5px 12px' }} onClick={() => router.push('/dashboard/orders')}>
            כל ההזמנות
          </button>
        </div>
        {orders.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '30px', fontSize: '12px' }}>
            אין הזמנות עדיין
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>תאריך</th>
                  {role !== 'customer' && <th>סוכן / לקוח</th>}
                  <th>לקוח</th>
                  <th>מספר פריטים</th>
                  <th>סה"כ יחידות</th>
                </tr>
              </thead>
              <tbody>
                {orders.slice(0, 8).map((order: any) => (
                  <tr key={order.id}>
                    <td style={{ color: 'var(--text-muted)' }}>
                      {new Date(order.created_at).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    {role !== 'customer' && (
                      <td>
                        <span className={`badge ${order.user_role === 'admin' ? 'badge-amber' : order.user_role === 'agent' ? 'badge-blue' : 'badge-green'}`}>
                          {order.user_name}
                        </span>
                      </td>
                    )}
                    <td>{order.customer_name || <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                    <td>{order.items?.length || 0} פריטים</td>
                    <td style={{ color: 'var(--accent-light)', fontWeight: 700 }}>
                      {order.items?.reduce((s: number, i: any) => s + i.units, 0) || 0}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
