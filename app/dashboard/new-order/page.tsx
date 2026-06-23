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
  imageUrl?: string | null;
  potSize?: string | null;
}

interface CartItem {
  item: InventoryItem;
  packages: number;
}

interface Customer {
  customerCode: string;
  customerName: string;
  agentName: string | null;
}

export default function NewOrderPage() {
  const { data: session } = useSession();
  const role = (session?.user as any)?.role;

  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [qualityFilter, setQualityFilter] = useState('');
  const [modelFilter, setModelFilter] = useState('');
  const [potSizeFilter, setPotSizeFilter] = useState('');
  const [storeOpen, setStoreOpen] = useState(true);
  
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);

  // Agent/admin fields
  const [customerName, setCustomerName] = useState('');
  const [customerDropdownOpen, setCustomerDropdownOpen] = useState(false);
  const [mobileCartOpen, setMobileCartOpen] = useState(false);
  const [cartNumber, setCartNumber] = useState('');
  const [orderNumber, setOrderNumber] = useState('');
  const [lineNumber, setLineNumber] = useState('');
  const [prodOrderNumber, setProdOrderNumber] = useState('');
  const [prodLineNumber, setProdLineNumber] = useState('');
  const [deliveryDate, setDeliveryDate] = useState(() => new Date().toISOString().split('T')[0]);

  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch('/api/inventory').then(r => r.json()),
      fetch('/api/config').then(r => r.json()),
      fetch('/api/customers').then(r => r.json())
    ]).then(([invData, configData, custData]) => {
      setInventory(invData);
      if (configData && typeof configData.storeOpen === 'boolean') {
        setStoreOpen(configData.storeOpen);
      }
      setCustomers(custData || []);
      setLoading(false);
    });
  }, []);

  const inStockInventory = useMemo(() => {
    return inventory.filter(i => Math.floor(i.quantity / i.packageSize) >= 1);
  }, [inventory]);

  const filteredItems = useMemo(() => {
    return inStockInventory.filter(item => {
      if (qualityFilter && item.quality !== qualityFilter) return false;
      if (modelFilter && item.modelCode !== modelFilter) return false;
      if (potSizeFilter && item.potSize !== potSizeFilter) return false;
      if (search) {
        const term = search.toLowerCase();
        if (!item.itemName.toLowerCase().includes(term)) {
          return false;
        }
      }
      return true;
    });
  }, [inStockInventory, search, qualityFilter, modelFilter, potSizeFilter]);

  const potSizes = useMemo(() => {
    const relevant = inStockInventory.filter(item => {
      if (qualityFilter && item.quality !== qualityFilter) return false;
      if (modelFilter && item.modelCode !== modelFilter) return false;
      if (search && !item.itemName.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
    return Array.from(new Set(relevant.map(i => i.potSize).filter(Boolean) as string[])).sort();
  }, [inStockInventory, search, qualityFilter, modelFilter]);

  const qualities = useMemo(() => {
    const relevant = inStockInventory.filter(item => {
      if (modelFilter && item.modelCode !== modelFilter) return false;
      if (potSizeFilter && item.potSize !== potSizeFilter) return false;
      if (search && !item.itemName.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
    return Array.from(new Set(relevant.map(i => i.quality))).sort();
  }, [inStockInventory, search, modelFilter, potSizeFilter]);

  const models = useMemo(() => {
    const relevant = inStockInventory.filter(item => {
      if (qualityFilter && item.quality !== qualityFilter) return false;
      if (potSizeFilter && item.potSize !== potSizeFilter) return false;
      if (search && !item.itemName.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
    const map = new Map<string, string>();
    relevant.forEach(i => map.set(i.modelCode, i.modelName));
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [inStockInventory, search, qualityFilter, potSizeFilter]);

  function updateCart(item: InventoryItem, deltaPackages: number, absolutePackages?: number) {
    setCart(prev => {
      const existing = prev.find(c => c.item.id === item.id);
      const currentPackages = existing ? existing.packages : 0;
      let newPackages = currentPackages + deltaPackages;
      if (absolutePackages !== undefined) {
        newPackages = absolutePackages;
      }
      
      if (newPackages <= 0) {
        return prev.filter(c => c.item.id !== item.id);
      }
      
      if (role !== 'customer' || true) {
        const availablePackages = Math.floor(item.quantity / item.packageSize);
        if (newPackages > availablePackages) {
          setErrorMsg(`אין מספיק מלאי מ-${item.itemName} ${item.modelName}. זמין: ${availablePackages} אריזות`);
          setTimeout(() => setErrorMsg(''), 3000);
          return prev;
        }
      }

      if (existing) {
        return prev.map(c => c.item.id === item.id ? { ...c, packages: newPackages } : c);
      }
      return [...prev, { item, packages: newPackages }];
    });
  }

  async function submitOrder() {
    if (cart.length === 0) return;
    
    let submitCustomerName = role === 'customer' ? session?.user?.name : customerName;
    let submitCustomerCode = null;
    let submitAgentName = null;

    if (role !== 'customer') {
      const selectedCustomer = customers.find(c => c.customerName === customerName);
      if (!selectedCustomer) {
        setErrorMsg('יש לבחור לקוח מתוך הרשימה הקיימת בלבד');
        return;
      }
      submitCustomerCode = selectedCustomer.customerCode;
      submitAgentName = selectedCustomer.agentName;
    }

    setSubmitting(true);
    setErrorMsg('');

    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerName: submitCustomerName,
        customerCode: submitCustomerCode,
        agentName: submitAgentName,
        cartNumber,
        orderNumber,
        lineNumber,
        prodOrderNumber,
        prodLineNumber,
        deliveryDate,
        items: cart.map(c => ({
          itemCode: c.item.itemCode,
          itemName: c.item.itemName,
          modelCode: c.item.modelCode,
          modelName: c.item.modelName,
          quality: c.item.quality,
          bloomPct: c.item.bloomPct,
          packages: c.packages,
          packageSize: c.item.packageSize
        }))
      })
    });

    const data = await res.json();
    if (res.ok) {
      setSuccessMsg('הזמנתך בוצעה, התחלנו לארוז ✓');
      setCart([]);
      setMobileCartOpen(false);
      setCustomerName(''); setCartNumber(''); setOrderNumber('');
      setLineNumber(''); setProdOrderNumber(''); setProdLineNumber(''); setDeliveryDate(new Date().toISOString().split('T')[0]);
      fetch('/api/inventory').then(r => r.json()).then(setInventory);
      setTimeout(() => setSuccessMsg(''), 5000);
    } else {
      setErrorMsg(data.error || 'שגיאה בביצוע ההזמנה');
    }
    setSubmitting(false);
  }

  if (loading) return <div style={{ color: 'var(--text-muted)', padding: '40px' }}>טוען...</div>;

  if (role === 'customer' && !storeOpen) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', textAlign: 'center' }}>
        <div style={{ fontSize: '64px', marginBottom: '20px' }}>🛑</div>
        <h1 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '12px' }}>
          לצערנו כל המלאי הוזמן
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '16px' }}>
          מוזמנים לבדוק שוב מחר!
        </p>
      </div>
    );
  }

  return (
    <div className="new-order-grid">
      
      {/* Left: Catalog Main Area */}
      <div>
        <h1 style={{ fontSize: '20px', fontWeight: 800, marginBottom: '20px' }}>הזמנה חדשה</h1>

        {/* Agent/admin order fields */}
        {(role === 'admin' || role === 'agent') && (
          <div className="card" style={{ marginBottom: '16px' }}>
            <div style={{ fontWeight: 700, fontSize: '13px', marginBottom: '14px', color: 'var(--accent-light)' }}>פרטי הזמנה</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px' }}>
              <div className="form-group" style={{ position: 'relative' }}>
                <label className="form-label">שם לקוח *</label>
                <input 
                  className="input" 
                  value={customerName} 
                  onChange={e => {
                    const val = e.target.value;
                    setCustomerName(val);
                    setCustomerDropdownOpen(val.length > 0);
                  }} 
                  onFocus={() => {
                    if (customerName.length > 0) setCustomerDropdownOpen(true);
                  }}
                  onBlur={() => setTimeout(() => setCustomerDropdownOpen(false), 200)}
                  placeholder="חפש ובחר לקוח..." 
                  autoComplete="off"
                />
                {customerDropdownOpen && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    background: 'var(--bg-panel)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    boxShadow: '0 10px 25px -5px rgba(0,0,0,0.2)',
                    maxHeight: '220px',
                    overflowY: 'auto',
                    zIndex: 50,
                    marginTop: '4px',
                    display: 'flex',
                    flexDirection: 'column'
                  }}>
                    {customers.filter(c => c.customerName.includes(customerName)).map(c => (
                      <div 
                        key={c.customerCode}
                        style={{
                          padding: '10px 14px',
                          cursor: 'pointer',
                          borderBottom: '1px solid var(--border)',
                          fontWeight: 600,
                          fontSize: '14px'
                        }}
                        onMouseDown={() => {
                          setCustomerName(c.customerName);
                          setCustomerDropdownOpen(false);
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-base)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        {c.customerName}
                        {c.agentName && <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginRight: '8px' }}>({c.agentName})</span>}
                      </div>
                    ))}
                    {customers.filter(c => c.customerName.includes(customerName)).length === 0 && (
                      <div style={{ padding: '12px', color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center' }}>לא נמצאו לקוחות</div>
                    )}
                  </div>
                )}
              </div>
              <div className="form-group">
                <label className="form-label">תאריך נדרש *</label>
                <input className="input" type="date" value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)} />
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

        {/* Filters and Search */}
        <div className="card" style={{ marginBottom: '16px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{ flex: 2, minWidth: '200px' }}>
            <input className="input" placeholder="חיפוש חופשי (לפי שם פריט בלבד)..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div style={{ flex: 1, minWidth: '120px' }}>
            <select className="input" value={qualityFilter} onChange={e => setQualityFilter(e.target.value)}>
              <option value="">כל האיכויות</option>
              {qualities.map(q => <option key={q} value={q}>איכות {q}</option>)}
            </select>
          </div>
          <div style={{ flex: 1, minWidth: '150px' }}>
            <select className="input" value={modelFilter} onChange={e => setModelFilter(e.target.value)}>
              <option value="">כל הדגמים</option>
              {models.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
            </select>
          </div>
          <div style={{ flex: 1, minWidth: '120px' }}>
            <select className="input" value={potSizeFilter} onChange={e => setPotSizeFilter(e.target.value)}>
              <option value="">כל העציצים</option>
              {potSizes.map(p => <option key={p} value={p}>עציץ {p}</option>)}
            </select>
          </div>
        </div>

        {/* Catalog List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {filteredItems.map(item => {
            const cartItem = cart.find(c => c.item.id === item.id);
            const packagesInCart = cartItem ? cartItem.packages : 0;
            const availablePackages = Math.floor(item.quantity / item.packageSize);
            const isOutOfStock = availablePackages <= 0;

            return (
              <div key={item.id} className="card" style={{ padding: '12px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                {/* Image */}
                <div style={{ width: '48px', height: '48px', borderRadius: '6px', background: 'var(--bg-panel)', border: '1px solid var(--border)', overflow: 'hidden', flexShrink: 0 }}>
                  <img 
                    src={`/api/gallery/resolve?itemCode=${item.itemCode}&modelCode=${item.modelCode}`} 
                    alt={item.itemName} 
                    style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'pointer' }} 
                    onClick={() => setZoomedImage(`/api/gallery/resolve?itemCode=${item.itemCode}&modelCode=${item.modelCode}`)}
                    onError={(e) => { e.currentTarget.style.display = 'none'; if(e.currentTarget.nextElementSibling) (e.currentTarget.nextElementSibling as HTMLElement).style.display = 'flex'; }} 
                  />
                  <div style={{ width: '100%', height: '100%', display: 'none', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>🌱</div>
                </div>

                {/* Info */}
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 800, fontSize: '15px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {item.itemName} <span className="badge badge-amber" style={{ fontSize: '12px' }}>{item.modelName}</span>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px', display: 'flex', gap: '12px' }}>
                    <span>איכות: <strong style={{ color: 'var(--accent-light)' }}>{item.quality}</strong></span>
                    <span>פריחה: <strong>{item.bloomPct}%</strong></span>
                    <span>אריזה: <strong>{item.packageSize}</strong> יח'</span>
                    {item.potSize && <span>עציץ: <strong>{item.potSize}</strong></span>}
                  </div>
                </div>

                {/* Stock & Actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                  {role !== 'customer' && (
                    <div style={{ textAlign: 'center', minWidth: '60px' }}>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>זמין</div>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: isOutOfStock ? 'var(--red)' : 'var(--green)' }}>
                        {availablePackages}
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-base)', borderRadius: '8px', border: '1px solid var(--border)', overflow: 'hidden' }}>
                    <button 
                      onClick={() => updateCart(item, -1)}
                      style={{ background: 'none', border: 'none', padding: '8px 12px', cursor: 'pointer', color: packagesInCart > 0 ? 'var(--red)' : 'var(--text-muted)', fontSize: '18px', fontWeight: 800 }}
                      disabled={packagesInCart === 0}
                    >-</button>
                    <input 
                      type="text" 
                      inputMode="numeric"
                      value={packagesInCart || ''} 
                      onChange={e => {
                        let val = parseInt(e.target.value);
                        if (isNaN(val) || val < 0) val = 0;
                        updateCart(item, 0, val);
                      }}
                      style={{ width: '40px', textAlign: 'center', fontWeight: 800, fontSize: '15px', background: 'transparent', border: 'none', outline: 'none', color: 'inherit' }}
                      placeholder="0"
                    />
                    <button 
                      onClick={() => updateCart(item, 1)}
                      style={{ background: 'none', border: 'none', padding: '8px 12px', cursor: 'pointer', color: isOutOfStock || packagesInCart >= availablePackages ? 'var(--text-muted)' : 'var(--green)', fontSize: '18px', fontWeight: 800 }}
                      disabled={isOutOfStock || packagesInCart >= availablePackages}
                    >+</button>
                  </div>
                </div>
              </div>
            );
          })}
          
          {filteredItems.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
              לא נמצאו פריטים במלאי התואמים לסינון.
            </div>
          )}
        </div>

        {errorMsg && (
          <div style={{ position: 'fixed', bottom: '20px', right: '20px', background: 'rgba(248,113,113,0.95)', border: '1px solid var(--red)', borderRadius: '8px', padding: '12px 20px', color: '#fff', fontSize: '14px', zIndex: 100, boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
            {errorMsg}
          </div>
        )}
        {successMsg && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, backdropFilter: 'blur(5px)' }}>
            <div style={{ background: 'var(--bg-panel, #ffffff)', padding: '60px 40px', borderRadius: '24px', textAlign: 'center', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', maxWidth: '90%', width: '500px', border: '4px solid var(--green, #22c55e)', position: 'relative' }}>
              <button 
                onClick={() => setSuccessMsg('')} 
                style={{ position: 'absolute', top: '20px', right: '20px', background: 'var(--bg-base, #f3f4f6)', border: 'none', borderRadius: '50%', width: '36px', height: '36px', fontSize: '18px', cursor: 'pointer', color: 'var(--text-primary, #000)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                ✕
              </button>
              <div style={{ fontSize: '80px', marginBottom: '24px' }}>📦</div>
              <h2 style={{ fontSize: '32px', color: 'var(--text-primary, #000)', margin: '0 0 16px 0', fontWeight: 900, lineHeight: 1.3 }}>
                {successMsg}
              </h2>
              <p style={{ fontSize: '20px', color: 'var(--text-muted, #6b7280)', margin: 0, fontWeight: 500 }}>תודה רבה!</p>
            </div>
          </div>
        )}
      </div>

      {/* Right: Cart (Sticky on desktop, Modal on mobile) */}
      <div className={`cart-container ${mobileCartOpen ? 'mobile-modal' : ''}`}>
        <div className="card" style={{ position: 'relative' }}>
          {mobileCartOpen && (
            <button 
              onClick={() => setMobileCartOpen(false)}
              style={{ position: 'absolute', top: '16px', left: '16px', background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: '50%', width: '32px', height: '32px', fontSize: '14px', cursor: 'pointer', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}
            >✕</button>
          )}
          <div style={{ fontWeight: 800, fontSize: '14px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', paddingLeft: mobileCartOpen ? '36px' : '0' }}>
            <span>🛒 עגלת הזמנה</span>
            <span className="badge badge-amber">{cart.length} פריטים</span>
          </div>

          {cart.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: '12px', textAlign: 'center', padding: '24px 0' }}>
              העגלה ריקה.<br />הוסף פריטים מהרשימה בעזרת ה-(+)
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px', maxHeight: '400px', overflowY: 'auto', paddingRight: '4px' }}>
                {cart.map((c, i) => (
                  <div key={i} style={{ background: 'var(--bg-panel)', borderRadius: '8px', padding: '10px 12px', border: '1px solid var(--border)' }}>
                    <div style={{ fontWeight: 700, fontSize: '12px', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {c.item.itemName} <span className="badge badge-amber" style={{ fontSize: '10px', padding: '2px 6px' }}>{c.item.modelName}</span>
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>איכות {c.item.quality} | פריחה {c.item.bloomPct}%</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                      <div style={{ fontSize: '11px' }}>
                        <span className="badge badge-blue">{c.packages} אריזות</span>
                        <span style={{ color: 'var(--text-muted)', marginRight: '6px' }}>{c.packages * c.item.packageSize} יח'</span>
                      </div>
                      <button
                        style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: '16px', padding: '0' }}
                        onClick={() => updateCart(c.item, -c.packages)}
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
                  <span style={{ color: 'var(--accent-light)' }}>{cart.reduce((s, c) => s + c.packages * c.item.packageSize, 0)}</span>
                </div>
              </div>

              <button
                className="btn-primary"
                style={{ width: '100%', padding: '12px' }}
                onClick={submitOrder}
                disabled={submitting || (role !== 'customer' && (!customerName || !deliveryDate))}
              >
                {submitting ? 'מבצע הזמנה...' : '✓ בצע הזמנה'}
              </button>
              {role !== 'customer' && (!customerName || !deliveryDate) && (
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center', marginTop: '8px' }}>
                  נדרש שם לקוח ותאריך נדרש (למעלה)
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Mobile Floating Cart Button */}
      {cart.length > 0 && !mobileCartOpen && (
        <button className="mobile-cart-btn" onClick={() => setMobileCartOpen(true)}>
          🛒 סיום הזמנה ({cart.reduce((s, c) => s + c.packages, 0)} אריזות)
        </button>
      )}

      {zoomedImage && (
        <div 
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, backdropFilter: 'blur(5px)' }}
          onClick={() => setZoomedImage(null)}
        >
          <button 
            onClick={() => setZoomedImage(null)} 
            style={{ position: 'absolute', top: '20px', right: '20px', background: 'var(--bg-base, #f3f4f6)', border: 'none', borderRadius: '50%', width: '44px', height: '44px', fontSize: '24px', cursor: 'pointer', color: 'var(--text-primary, #000)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10001 }}
          >
            ✕
          </button>
          <img 
            src={zoomedImage} 
            alt="Zoomed view" 
            style={{ maxWidth: '90%', maxHeight: '90vh', objectFit: 'contain', borderRadius: '12px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }} 
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
