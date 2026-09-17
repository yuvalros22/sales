'use client';
import { useSession } from 'next-auth/react';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function DashboardPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [inventory, setInventory] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [promotions, setPromotions] = useState<any[]>([]);
  const [isEditingPromotions, setIsEditingPromotions] = useState(false);
  const [editPromotionsList, setEditPromotionsList] = useState<any[]>([]);
  const [savingPromotions, setSavingPromotions] = useState(false);
  const [expandedOrders, setExpandedOrders] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [storeOpen, setStoreOpen] = useState(true);

  useEffect(() => {
    async function load() {
      const [invRes, ordRes, configRes, promoRes] = await Promise.all([
        fetch('/api/inventory'),
        fetch('/api/orders'),
        fetch('/api/config'),
        fetch('/api/promotions')
      ]);
      if (invRes.ok) setInventory(await invRes.json());
      if (ordRes.ok) setOrders(await ordRes.json());
      if (configRes.ok) {
        const conf = await configRes.json();
        setStoreOpen(conf.storeOpen);
      }
      if (promoRes.ok) setPromotions(await promoRes.json());
      setLoading(false);
    }
    load();
  }, []);

  async function toggleStore(e: React.ChangeEvent<HTMLInputElement>) {
    const newValue = e.target.checked;
    setStoreOpen(newValue);
    await fetch('/api/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ storeOpen: newValue })
    });
  }

  async function savePromotions() {
    setSavingPromotions(true);
    try {
      const validPromos = editPromotionsList.filter(p => p.itemCode && p.price > 0);
      const res = await fetch('/api/promotions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validPromos)
      });
      if (res.ok) {
        setPromotions(await res.json());
        setIsEditingPromotions(false);
      } else {
        alert('שגיאה בשמירת המבצעים');
      }
    } catch (err) {
      console.error(err);
      alert('שגיאה בשמירת המבצעים');
    } finally {
      setSavingPromotions(false);
    }
  }

  function startEditingPromotions() {
    setEditPromotionsList(promotions.map(p => ({ ...p })));
    setIsEditingPromotions(true);
  }

  function toggleOrderExpanded(orderId: string) {
    setExpandedOrders(prev => ({
      ...prev,
      [orderId]: !prev[orderId]
    }));
  }

  const uniqueCatalogItems = Array.from(
    new Map(inventory.map((item: any) => [item.itemCode, { itemCode: item.itemCode, itemName: item.itemName }])).values()
  ).sort((a, b) => a.itemName.localeCompare(b.itemName));


  const role = (session?.user as any)?.role;
  const totalItems = inventory.length;
  const totalStock = inventory.reduce((s: number, i: any) => s + (i.quantity || 0), 0);
  const todayOrdersList = orders.filter((o: any) => {
    const d = new Date(o.createdAt);
    const today = new Date();
    return d.toDateString() === today.toDateString();
  });
  const todayOrders = todayOrdersList.length;
  const todayEntered = todayOrdersList.filter((o: any) => o.isEntered).length;

  if (loading) return <div style={{ color: 'var(--text-muted)', padding: '40px' }}>טוען...</div>;

  return (
    <div>
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)' }}>
            שלום, {session?.user?.name} 👋
          </h1>
          <div style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '4px' }}>
            {new Date().toLocaleDateString('he-IL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
        </div>
        {role === 'admin' && (
          <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', background: storeOpen ? 'rgba(74, 222, 128, 0.1)' : 'rgba(248, 113, 113, 0.1)', border: `1px solid ${storeOpen ? 'var(--green)' : 'var(--red)'}` }}>
            <div style={{ fontWeight: 700, fontSize: '14px', color: storeOpen ? 'var(--green)' : 'var(--red)' }}>
              {storeOpen ? 'האתר פתוח להזמנות' : 'האתר חסום ללקוחות'}
            </div>
            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
              <div style={{ position: 'relative' }}>
                <input type="checkbox" checked={storeOpen} onChange={toggleStore} style={{ opacity: 0, width: 0, height: 0, position: 'absolute' }} />
                <div style={{ width: '40px', height: '24px', background: storeOpen ? 'var(--green)' : 'var(--border)', borderRadius: '12px', transition: '0.3s', position: 'relative' }}>
                  <div style={{ position: 'absolute', top: '2px', left: storeOpen ? '2px' : '18px', width: '20px', height: '20px', background: '#fff', borderRadius: '50%', transition: '0.3s', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }}></div>
                </div>
              </div>
            </label>
          </div>
        )}
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
          <div className="stat-num" style={{ color: 'var(--blue)' }}>{todayOrders}</div>
          <div className="stat-label">סה"כ הזמנות היום</div>
        </div>
        <div className="stat-card">
          <div className="stat-num" style={{ color: 'var(--purple)' }}>{todayEntered}</div>
          <div className="stat-label">הזמנות שהוקלדו היום</div>
        </div>
      </div>

      {/* Promotions Section */}
      {isEditingPromotions ? (
        <div className="card" style={{ marginBottom: '28px', border: '1px solid var(--accent-light)' }}>
          <div style={{ fontWeight: 800, fontSize: '16px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>🏷️ ניהול מבצעים שבועיים</span>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>הזן פריטים ומחיר מיוחד</span>
          </div>

          <div style={{ overflowX: 'auto', marginBottom: '16px' }}>
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'right', padding: '10px' }}>מוצר מהקטלוג (בחירה מהירה)</th>
                  <th style={{ textAlign: 'right', padding: '10px', width: '150px' }}>קוד פריט</th>
                  <th style={{ textAlign: 'right', padding: '10px', width: '150px' }}>מחיר מבצע (₪)</th>
                  <th style={{ width: '60px' }}></th>
                </tr>
              </thead>
              <tbody>
                {editPromotionsList.map((row, index) => (
                  <tr key={index}>
                    <td style={{ padding: '8px' }}>
                      <select
                        style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-panel)', color: 'var(--text-primary)', fontSize: '13px', fontWeight: 'bold' }}
                        value={row.itemCode}
                        onChange={(e) => {
                          const code = e.target.value;
                          const matched = uniqueCatalogItems.find(item => item.itemCode === code);
                          const updatedList = [...editPromotionsList];
                          updatedList[index] = {
                            ...updatedList[index],
                            itemCode: code,
                            itemName: matched ? matched.itemName : ''
                          };
                          setEditPromotionsList(updatedList);
                        }}
                      >
                        <option value="">-- בחר פריט --</option>
                        {uniqueCatalogItems.map(item => (
                          <option key={item.itemCode} value={item.itemCode}>
                            {item.itemName} ({item.itemCode})
                          </option>
                        ))}
                      </select>
                    </td>
                    <td style={{ padding: '8px' }}>
                      <input
                        type="text"
                        style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-panel)', color: 'var(--text-primary)', fontSize: '13px' }}
                        value={row.itemCode}
                        onChange={(e) => {
                          const updatedList = [...editPromotionsList];
                          updatedList[index].itemCode = e.target.value;
                          setEditPromotionsList(updatedList);
                        }}
                        placeholder="קוד פריט"
                      />
                    </td>
                    <td style={{ padding: '8px' }}>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-panel)', color: 'var(--text-primary)', fontSize: '13px', fontWeight: 'bold' }}
                        value={row.price || ''}
                        onChange={(e) => {
                          const updatedList = [...editPromotionsList];
                          updatedList[index].price = parseFloat(e.target.value) || 0;
                          setEditPromotionsList(updatedList);
                        }}
                        placeholder="0.00"
                      />
                    </td>
                    <td style={{ padding: '8px', textAlign: 'center' }}>
                      <button
                        onClick={() => {
                          const updatedList = editPromotionsList.filter((_, i) => i !== index);
                          setEditPromotionsList(updatedList);
                        }}
                        style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold' }}
                        title="מחק שורה"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <button
              className="btn-secondary"
              onClick={() => setEditPromotionsList([...editPromotionsList, { itemCode: '', itemName: '', price: 0 }])}
              style={{ fontSize: '13px', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              ➕ הוסף שורת מבצע
            </button>
            <div style={{ marginRight: 'auto', display: 'flex', gap: '12px' }}>
              <button
                className="btn-secondary"
                onClick={() => setIsEditingPromotions(false)}
                style={{ fontSize: '13px', padding: '8px 16px' }}
                disabled={savingPromotions}
              >
                ביטול
              </button>
              <button
                className="btn-primary"
                onClick={savePromotions}
                style={{ fontSize: '13px', padding: '8px 20px', background: 'var(--green)', borderColor: 'var(--green)' }}
                disabled={savingPromotions}
              >
                {savingPromotions ? 'שומר...' : '✓ שמור מבצעים'}
              </button>
            </div>
          </div>
        </div>
      ) : (
        // Only show promotions card if there are promotions, OR if the user can manage them (admin/agent)
        (promotions.length > 0 || role === 'admin' || role === 'agent') && (
          <div className="card" style={{ marginBottom: '28px', border: '1px solid var(--accent-light)', background: 'linear-gradient(to bottom left, rgba(34, 197, 94, 0.04), transparent)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '22px' }}>🏷️</span>
                <span style={{ fontWeight: 800, fontSize: '16px', color: 'var(--text-primary)' }}>מבצעים שבועיים חמים</span>
                <span className="badge badge-amber" style={{ padding: '2px 8px', borderRadius: '12px', fontSize: '11px' }}>מלאי מוגבל!</span>
              </div>
              {(role === 'admin' || role === 'agent') && (
                <button
                  className="btn-secondary"
                  onClick={startEditingPromotions}
                  style={{ fontSize: '12px', padding: '6px 14px', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  ✍️ ניהול מבצעים
                </button>
              )}
            </div>

            {promotions.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '24px', fontSize: '13px' }}>
                אין מבצעים פעילים כרגע. סוכנים ומנהלים יכולים ללחוץ על "ניהול מבצעים" להוספה.
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
                {promotions.map((promo, idx) => (
                  <div
                    key={promo.id || idx}
                    style={{
                      background: 'var(--bg-panel)',
                      border: '1px solid var(--border)',
                      borderRadius: '12px',
                      padding: '14px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      position: 'relative',
                      overflow: 'hidden',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
                    }}
                  >
                    {/* Corner Tag Decor */}
                    <div style={{ position: 'absolute', top: 0, left: 0, background: 'var(--accent-light)', width: '32px', height: '32px', clipPath: 'polygon(0 0, 100% 0, 0 100%)', opacity: 0.8 }}></div>

                    <div>
                      <div style={{ fontWeight: 800, fontSize: '14px', color: 'var(--text-primary)', marginBottom: '4px', paddingLeft: '20px' }}>
                        {promo.itemName}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                        קוד פריט: {promo.itemCode}
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderTop: '1px dashed var(--border)', paddingTop: '10px' }}>
                      <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 'bold' }}>מחיר מבצע:</span>
                      <span style={{ fontSize: '18px', fontWeight: 900, color: 'var(--green)' }}>
                        ₪{promo.price.toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      )}

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
                {orders.slice(0, 8).map((order: any) => {
                  const isExpanded = !!expandedOrders[order.id];
                  return (
                    <React.Fragment key={order.id}>
                      <tr onClick={() => toggleOrderExpanded(order.id)} style={{ cursor: 'pointer' }} title="לחץ להצגת פריטי ההזמנה">
                        <td style={{ color: 'var(--text-muted)' }}>
                          {new Date(order.createdAt).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                          <span style={{ marginRight: '8px', fontSize: '11px', color: 'var(--accent-dark)', fontWeight: 'bold' }}>
                            {isExpanded ? '▲ סגור' : '▼ פרטים'}
                          </span>
                        </td>
                        {role !== 'customer' && (
                          <td>
                            <span className={`badge ${order.user_role === 'admin' ? 'badge-amber' : order.user_role === 'agent' ? 'badge-blue' : 'badge-green'}`}>
                              {order.user_name}
                            </span>
                          </td>
                        )}
                        <td>{order.customerName || <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                        <td>{order.items?.length || 0} פריטים</td>
                        <td style={{ color: 'var(--accent-light)', fontWeight: 700 }}>
                          {order.items?.reduce((s: number, i: any) => s + i.units, 0) || 0}
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr>
                          <td colSpan={role !== 'customer' ? 5 : 4} style={{ background: 'var(--bg-panel)', padding: '16px' }}>
                            <div style={{ fontWeight: 800, fontSize: '13px', marginBottom: '8px', color: 'var(--text-secondary)' }}>
                              📋 פירוט פריטי ההזמנה:
                            </div>
                            <div className="table-responsive" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                              <table className="data-table" style={{ background: '#fff', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                                <thead>
                                  <tr>
                                    <th style={{ background: 'var(--bg-base)' }}>שם פריט</th>
                                    <th style={{ background: 'var(--bg-base)' }}>קוד פריט</th>
                                    <th style={{ background: 'var(--bg-base)' }}>שם דגם</th>
                                    <th style={{ background: 'var(--bg-base)' }}>איכות</th>
                                    <th style={{ background: 'var(--bg-base)' }}>פריחה</th>
                                    <th style={{ background: 'var(--bg-base)' }}>אריזות</th>
                                    <th style={{ background: 'var(--bg-base)' }}>סה"כ יחידות</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {order.items?.map((item: any) => (
                                    <tr key={item.id}>
                                      <td style={{ fontWeight: 700 }}>{item.itemName}</td>
                                      <td style={{ color: 'var(--text-muted)' }}>{item.itemCode}</td>
                                      <td><span className="badge badge-amber">{item.modelName}</span></td>
                                      <td>{item.quality}</td>
                                      <td>{item.bloomPct}%</td>
                                      <td>{item.packages} אריזות ({item.packageSize} יח')</td>
                                      <td style={{ color: 'var(--accent-light)', fontWeight: 700 }}>{item.units} יח'</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                            {order.notes && (
                              <div style={{ marginTop: '12px', padding: '8px 12px', background: 'rgba(245, 158, 11, 0.08)', borderRight: '4px solid var(--accent-light)', borderRadius: '4px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                                <strong>הערות להזמנה:</strong> {order.notes}
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
