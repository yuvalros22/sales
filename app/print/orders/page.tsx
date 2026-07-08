'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';

export default function BulkPrintOrdersPage() {
  const { data: session } = useSession();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchOrders() {
      try {
        const idsJson = sessionStorage.getItem('printOrderIds');
        if (!idsJson) {
          setError('לא נבחרו הזמנות להדפסה.');
          setLoading(false);
          return;
        }

        const orderIds = JSON.parse(idsJson);
        if (!Array.isArray(orderIds) || orderIds.length === 0) {
          setError('רשימת ההזמנות ריקה.');
          setLoading(false);
          return;
        }

        const res = await fetch('/api/orders/bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderIds })
        });

        if (!res.ok) {
          throw new Error('שגיאה בטעינת ההזמנות');
        }

        const data = await res.json();
        setOrders(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    if (session) {
      fetchOrders();
    }
  }, [session]);

  // Trigger print after rendering is complete
  useEffect(() => {
    if (!loading && orders.length > 0) {
      const timer = setTimeout(() => {
        window.print();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [loading, orders]);

  if (loading) return <div style={{ padding: '40px', textAlign: 'center', fontSize: '20px' }}>טוען הזמנות להדפסה...</div>;
  if (error) return <div style={{ padding: '40px', textAlign: 'center', color: 'red', fontSize: '20px' }}>{error}</div>;

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', direction: 'rtl', background: '#e5e7eb', minHeight: '100vh' }}>
      {orders.map((order, index) => (
        <div key={order.id} style={{
          background: 'white',
          padding: '40px',
          maxWidth: '800px',
          margin: '0 auto',
          marginBottom: index < orders.length - 1 ? '40px' : '0',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
          pageBreakAfter: index < orders.length - 1 ? 'always' : 'auto'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #ccc', paddingBottom: '20px', marginBottom: '20px' }}>
            <div>
              <h1 style={{ margin: '0 0 10px 0', fontSize: '28px' }}>הזמנה #{order.orderNumber || order.id.slice(-6)}</h1>
              <div style={{ color: '#555' }}>
                תאריך הזמנה: {new Date(order.createdAt).toLocaleDateString('he-IL')} {new Date(order.createdAt).toLocaleTimeString('he-IL')}
              </div>
              {order.deliveryDate && (
                <div style={{ fontWeight: 'bold', marginTop: '5px' }}>
                  תאריך נדרש לקבלה: {new Date(order.deliveryDate).toLocaleDateString('he-IL')}
                </div>
              )}
            </div>
            <div style={{ textAlign: 'left' }}>
              <h2 style={{ margin: '0 0 5px 0', fontSize: '20px' }}>{order.customerName || (order.user && order.user.name)}</h2>
              <div style={{ color: '#555' }}>עגלה: {order.cartNumber || '---'}</div>
              {order.lineNumber && <div style={{ color: '#555' }}>שורה: {order.lineNumber}</div>}
            </div>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '20px' }}>
            <thead>
              <tr style={{ background: '#f4f4f5', textAlign: 'right' }}>
                <th style={{ padding: '12px', borderBottom: '2px solid #ddd' }}>פריט</th>
                <th style={{ padding: '12px', borderBottom: '2px solid #ddd' }}>קוד</th>
                <th style={{ padding: '12px', borderBottom: '2px solid #ddd' }}>דגם</th>
                <th style={{ padding: '12px', borderBottom: '2px solid #ddd' }}>איכות</th>
                <th style={{ padding: '12px', borderBottom: '2px solid #ddd' }}>פריחה</th>
                <th style={{ padding: '12px', borderBottom: '2px solid #ddd' }}>אריזות</th>
                <th style={{ padding: '12px', borderBottom: '2px solid #ddd' }}>יח' באריזה</th>
                <th style={{ padding: '12px', borderBottom: '2px solid #ddd' }}>סה"כ יחידות</th>
              </tr>
            </thead>
            <tbody>
              {order.items?.map((item: any) => (
                <tr key={item.id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '12px', fontWeight: 'bold' }}>{item.itemName}</td>
                  <td style={{ padding: '12px', color: '#666' }}>{item.itemCode}</td>
                  <td style={{ padding: '12px' }}>{item.modelName}</td>
                  <td style={{ padding: '12px' }}>{item.quality}</td>
                  <td style={{ padding: '12px' }}>{item.bloomPct}%</td>
                  <td style={{ padding: '12px', fontWeight: 'bold' }}>{item.packages}</td>
                  <td style={{ padding: '12px', color: '#666' }}>{item.packageSize}</td>
                  <td style={{ padding: '12px', fontWeight: 'bold' }}>{item.units}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ marginTop: '40px', paddingTop: '20px', borderTop: '2px solid #ccc', display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '18px' }}>
            <div>סה"כ אריזות: {order.items?.reduce((s: number, i: any) => s + i.packages, 0) || 0}</div>
            <div>סה"כ יחידות: {(order.items?.reduce((s: number, i: any) => s + i.units, 0) || 0).toLocaleString()}</div>
          </div>
        </div>
      ))}

      <style dangerouslySetInnerHTML={{
        __html: `
          @media print {
            body { background: white; margin: 0; padding: 0; }
            .no-print { display: none !important; }
            div[style*="boxShadow"] { box-shadow: none !important; margin-bottom: 0 !important; }
          }
        `
      }} />

      <div style={{ marginTop: '40px', textAlign: 'center', paddingBottom: '40px' }} className="no-print">
        <button 
          onClick={() => window.print()}
          style={{ padding: '12px 24px', fontSize: '16px', background: '#22c55e', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          🖨️ הדפס מחדש / שמור כ-PDF
        </button>
      </div>
    </div>
  );
}
