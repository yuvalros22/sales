import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/db';
import { notFound, redirect } from 'next/navigation';

export default async function PrintOrderPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');
  
  // Unwrap params if Next.js > 14
  const resolvedParams = await params;
  const id = resolvedParams?.id || (params as any).id;

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      user: true,
      items: true
    }
  });

  if (!order) return notFound();

  return (
    <div style={{ padding: '40px', maxWidth: '800px', margin: '0 auto', fontFamily: 'system-ui, sans-serif', direction: 'rtl' }}>
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
          <h2 style={{ margin: '0 0 5px 0', fontSize: '20px' }}>{order.customerName || order.user.name}</h2>
          <div style={{ color: '#555' }}>עגלה: {order.cartNumber || '---'}</div>
          {order.lineNumber && <div style={{ color: '#555' }}>שורה: {order.lineNumber}</div>}
          {order.prodOrderNumber && <div style={{ color: '#555' }}>הזמנת יצור: {order.prodOrderNumber}</div>}
          {order.prodLineNumber && <div style={{ color: '#555' }}>שורת ייצור: {order.prodLineNumber}</div>}
        </div>
      </div>

      {order.notes && (
        <div style={{ 
          background: '#f4f4f5', 
          padding: '12px 16px', 
          borderRadius: '8px', 
          marginBottom: '20px', 
          borderRight: '4px solid #22c55e', 
          fontSize: '14px',
          color: '#333'
        }}>
          <strong>הערות להזמנה:</strong> {order.notes}
        </div>
      )}

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
          {order.items.map((item) => (
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
        <div>סה"כ אריזות: {order.items.reduce((s, i) => s + i.packages, 0)}</div>
        <div>סה"כ יחידות: {order.items.reduce((s, i) => s + i.units, 0).toLocaleString()}</div>
      </div>

      <style dangerouslySetInnerHTML={{
        __html: `
          @media print {
            body { background: white; margin: 0; padding: 0; }
            button { display: none; }
          }
        `
      }} />

      <div 
        style={{ marginTop: '40px', textAlign: 'center' }} 
        className="no-print"
        dangerouslySetInnerHTML={{ __html: `
          <button 
            onclick="window.print()"
            style="padding: 12px 24px; font-size: 16px; background: #22c55e; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: bold;"
          >
            🖨️ הדפס / שמור כ-PDF
          </button>
        ` }}
      />

      <script dangerouslySetInnerHTML={{ __html: `setTimeout(() => window.print(), 500);` }} />
    </div>
  );
}
