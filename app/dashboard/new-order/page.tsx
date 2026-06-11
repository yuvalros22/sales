'use client';
import { useSession } from 'next-auth/react';
import { useEffect, useState, useMemo } from 'react';

interface InventoryItem {
  id: string;
  item_code: string;
  item_name: string;
  model_code: string;
  model_name: string;
  quality: string;
  bloom_pct: string;
  quantity: number;
  package_size: number;
}

interface CartItem {
  item: InventoryItem;
  packages: number;
}

export default function NewOrderPage() {
  const { data: session } = useSession();
  const role = (session?.user as any)?.role;

  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);

  // Agent/admin fields
  const [customerName, setCustomerName] = useState('');
  const [cartNumber, setCartNumber] = useState('');
  const [orderNumber, setOrderNumber] = useState('');
  const [lineNumber, setLineNumber] = useState('');
  const [prodOrderNumber, setProdOrderNumber] = useState('');
  const [prodLineNumber, setProdLineNumber] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Item picker
  const [selectedItemCode, setSelectedItemCode] = useState('');
  const [selectedModelCode, setSelectedModelCode] = useState('');
  const [selectedVariant, setSelectedVariant] = useState<InventoryItem | null>(null);
  const [packagesInput, setPackagesInput] = useState(1);

  useEffect(() => {
    fetch('/api/inventory').then(r => r.json()).then(d => { setInventory(d); setLoading(false); });
  }, []);

  const grouped = useMemo(() => {
    const map: Record<string, { itemName: string; models: Record<string, InventoryItem[]> }> = {};
    for (const item of inventory) {
      if (!map[item.item_code]) map[item.item_code] = { itemName: item.item_name, models: {} };
      if (!map[item.item_code].models[item.model_code])
        map[item.item_code].models[item.model_code] = [];
      map[item.item_code].models[item.model_code].push(item);
    }
    return map;
  }, [inventory]);

  const filteredItems = useMemo(() => {
    if (!search) return Object.entries(grouped);
    return Object.entries(grouped).filter(([code, data]) =>
      data.itemName.includes(search) || code.includes(search) ||
      Object.values(data.models).flat().some(i => i.model_name.includes(search))
    );
  }, [grouped, search]);

  const selectedItemModels = selectedItemCode ? grouped[selectedItemCode]?.models : {};
  const selectedModelVariants = selectedItemCode && selectedModelCode
    ? (grouped[selectedItemCode]?.models[selectedModelCode] || [])
    : [];

  function addToCart() {
    if (!selectedVariant) return;
    const needed = packagesInput * selectedVariant.package_size;
    
    if (role !== 'customer' || true) { // Check availability
      const existing = cart.find(c =>
        c.item.item_code === selectedVariant.item_code &&
        c.item.model_code === selectedVariant.model_code &&
        c.item.quality === selectedVariant.quality &&
        c.item.bloom_pct === selectedVariant.bloom_pct
      );
      const alreadyInCart = existing ? existing.packages * existing.item.package_size : 0;
      
      if (alreadyInCart + needed > selectedVariant.quantity) {
        setErrorMsg(`אין מספיק מלאי. זמין: ${Math.floor(selectedVariant.quantity / selectedVariant.package_size)} אריזות`);
        setTimeout(() => setErrorMsg(''), 3000);
        return;
      }
    }

    setCart(prev => {
      const existing = prev.find(c =>
        c.item.item_code === selectedVariant.item_code &&
        c.item.model_code === selectedVariant.model_code &&
        c.item.quality === selectedVariant.quality &&
        c.item.bloom_pct === selectedVariant.bloom_pct
      );
      if (existing) {
        return prev.map(c => c === existing ? { ...c, packages: c.packages + packagesInput } : c);
      }
      return [...prev, { item: selectedVariant, packages: packagesInput }];
    });

    setSelectedItemCode('');
    setSelectedModelCode('');
    setSelectedVariant(null);
    setPackagesInput(1);
  }

  async function submitOrder() {
    if (cart.length === 0) return;
    setSubmitting(true);
    setErrorMsg('');

    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerName: role === 'customer' ? session?.user?.name : customerName,
        cartNumber,
        orderNumber,
        lineNumber,
        prodOrderNumber,
        prodLineNumber,
        items: cart.map(c => ({
          itemCode: c.item.item_code,
          itemName: c.item.item_name,
          modelCode: c.item.model_code,
          modelName: c.item.model_name,
          quality: c.item.quality,
          bloomPct: c.item.bloom_pct,
          packages: c.packages,
          packageSize: c.item.package_size
        }))
      })
    });

    const data = await res.json();
    if (res.ok) {
      setSuccessMsg('ההזמנה בוצעה בהצלחה! ✓');
      setCart([]);
      setCustomerName(''); setCartNumber(''); setOrderNumber('');
      setLineNumber(''); setProdOrderNumber(''); setProdLineNumber('');
      // Refresh inventory
      fetch('/api/inventory').then(r => r.json()).then(setInventory);
    } else {
      setErrorMsg(data.error || 'שגיאה בביצוע ההזמנה');
    }
    setSubmitting(false);
  }

  if (loading) return <div style={{ color: 'var(--text-muted)', padding: '40px' }}>טוען...</div>;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '20px', alignItems: 'start' }}>
      {/* Left: item picker */}
      <div>
        <h1 style={{ fontSize: '20px', fontWeight: 800, marginBottom: '20px' }}>הזמנה חדשה</h1>

        {/* Agent/admin order fields */}
        {(role === 'admin' || role === 'agent') && (
          <div className="card" style={{ marginBottom: '16px' }}>
            <div style={{ fontWeight: 700, fontSize: '13px', marginBottom: '14px', color: 'var(--accent-light)' }}>פרטי הזמנה</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px' }}>
              <div className="form-group">
                <label className="form-label">שם לקוח *</label>
                <input className="input" value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="שם הלקוח" />
              </div>
              <div className="form-group">
                <label className="form-label">מספר עגלה *</label>
                <input className="input" value={cartNumber} onChange={e => setCartNumber(e.target.value)} placeholder="מס' עגלה" />
              </div>
              <div className="form-group">
                <label className="form-label">מספר הזמנה</label>
                <input className="input" value={orderNumber} onChange={e => setOrderNumber(e.target.value)} placeholder="אופציונלי" />
              </div>
              <div className="form-group">
                <label className="form-label">מספר שורה</label>
                <input className="input" value={lineNumber} onChange={e => setLineNumber(e.target.value)} placeholder="אופציונלי" />
              </div>
              <div className="form-group">
                <label className="form-label">הזמנת יצור</label>
                <input className="input" value={prodOrderNumber} onChange={e => setProdOrderNumber(e.target.value)} placeholder="אופציונלי" />
              </div>
              <div className="form-group">
                <label className="form-label">שורת יצור</label>
                <input className="input" value={prodLineNumber} onChange={e => setProdLineNumber(e.target.value)} placeholder="אופציונלי" />
              </div>
            </div>
          </div>
        )}

        {/* Item selector */}
        <div className="card" style={{ marginBottom: '16px' }}>
          <div style={{ fontWeight: 700, fontSize: '13px', marginBottom: '14px', color: 'var(--accent-light)' }}>הוספת פריט</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div className="form-group">
              <label className="form-label">חיפוש פריט</label>
              <input className="input" placeholder="חפש לפי שם פריט..." value={search} onChange={e => { setSearch(e.target.value); setSelectedItemCode(''); setSelectedModelCode(''); setSelectedVariant(null); }} />
            </div>

            <div className="form-group">
              <label className="form-label">בחר פריט</label>
              <select className="input" value={selectedItemCode} onChange={e => { setSelectedItemCode(e.target.value); setSelectedModelCode(''); setSelectedVariant(null); }}>
                <option value="">— בחר פריט —</option>
                {filteredItems.map(([code, data]) => (
                  <option key={code} value={code}>{data.itemName} ({code})</option>
                ))}
              </select>
            </div>

            {selectedItemCode && (
              <div className="form-group">
                <label className="form-label">בחר דגם</label>
                <select className="input" value={selectedModelCode} onChange={e => { setSelectedModelCode(e.target.value); setSelectedVariant(null); }}>
                  <option value="">— בחר דגם —</option>
                  {Object.entries(selectedItemModels || {}).map(([code, variants]) => (
                    <option key={code} value={code}>{variants[0].model_name} ({code})</option>
                  ))}
                </select>
              </div>
            )}

            {selectedModelCode && (
              <div className="form-group">
                <label className="form-label">בחר איכות ופריחה</label>
                <select className="input" value={selectedVariant?.id || ''} onChange={e => {
                  const v = selectedModelVariants.find(i => i.id === e.target.value) || null;
                  setSelectedVariant(v);
                }}>
                  <option value="">— בחר —</option>
                  {selectedModelVariants.map(v => {
                    const avail = Math.floor(v.quantity / v.package_size);
                    const available = v.quantity >= v.package_size;
                    return (
                      <option key={v.id} value={v.id} disabled={!available}>
                        איכות {v.quality} | פריחה {v.bloom_pct}% | אריזה: {v.package_size} יח' {role !== 'customer' ? `| ${avail} אריזות` : available ? '| זמין' : '| לא זמין'}
                      </option>
                    );
                  })}
                </select>
              </div>
            )}

            {selectedVariant && (
              <div style={{ background: 'var(--bg-panel)', borderRadius: '8px', padding: '12px', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '10px' }}>
                  גודל אריזה: <strong style={{ color: 'var(--accent-light)' }}>{selectedVariant.package_size} יחידות</strong>
                  {role !== 'customer' && (
                    <span style={{ marginRight: '12px' }}>
                      זמין: <strong style={{ color: 'var(--green)' }}>{Math.floor(selectedVariant.quantity / selectedVariant.package_size)} אריזות</strong>
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label">כמות אריזות</label>
                    <input
                      className="input"
                      type="number"
                      min="1"
                      max={Math.floor(selectedVariant.quantity / selectedVariant.package_size)}
                      value={packagesInput}
                      onChange={e => setPackagesInput(Math.max(1, Number(e.target.value)))}
                    />
                  </div>
                  <div style={{ paddingBottom: '1px' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px' }}>
                      = {packagesInput * selectedVariant.package_size} יחידות
                    </div>
                    <button className="btn-primary" onClick={addToCart}>הוסף לעגלה</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {errorMsg && (
          <div style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: '8px', padding: '12px', color: 'var(--red)', fontSize: '13px' }}>
            {errorMsg}
          </div>
        )}
        {successMsg && (
          <div style={{ background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.3)', borderRadius: '8px', padding: '12px', color: 'var(--green)', fontSize: '13px', fontWeight: 700 }}>
            {successMsg}
          </div>
        )}
      </div>

      {/* Right: Cart */}
      <div style={{ position: 'sticky', top: '20px' }}>
        <div className="card">
          <div style={{ fontWeight: 800, fontSize: '14px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between' }}>
            <span>🛒 עגלת הזמנה</span>
            <span className="badge badge-amber">{cart.length} פריטים</span>
          </div>

          {cart.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: '12px', textAlign: 'center', padding: '24px 0' }}>
              העגלה ריקה.<br />בחר פריטים משמאל.
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                {cart.map((c, i) => (
                  <div key={i} style={{ background: 'var(--bg-panel)', borderRadius: '8px', padding: '10px 12px', border: '1px solid var(--border)' }}>
                    <div style={{ fontWeight: 700, fontSize: '12px', marginBottom: '4px' }}>{c.item.item_name}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{c.item.model_name} | {c.item.quality} | {c.item.bloom_pct}%</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                      <div style={{ fontSize: '11px' }}>
                        <span className="badge badge-blue">{c.packages} אריזות</span>
                        <span style={{ color: 'var(--text-muted)', marginRight: '6px' }}>{c.packages * c.item.package_size} יח'</span>
                      </div>
                      <button
                        style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: '16px', padding: '0' }}
                        onClick={() => setCart(prev => prev.filter((_, j) => j !== i))}
                      >✕</button>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '12px', marginBottom: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                  <span>סה"כ אריזות:</span>
                  <span>{cart.reduce((s, c) => s + c.packages, 0)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 700 }}>
                  <span>סה"כ יחידות:</span>
                  <span style={{ color: 'var(--accent-light)' }}>{cart.reduce((s, c) => s + c.packages * c.item.package_size, 0)}</span>
                </div>
              </div>

              <button
                className="btn-primary"
                style={{ width: '100%', padding: '12px' }}
                onClick={submitOrder}
                disabled={submitting || (role !== 'customer' && !customerName)}
              >
                {submitting ? 'מבצע הזמנה...' : '✓ בצע הזמנה'}
              </button>
              {role !== 'customer' && !customerName && (
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center', marginTop: '8px' }}>
                  נדרש שם לקוח
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
