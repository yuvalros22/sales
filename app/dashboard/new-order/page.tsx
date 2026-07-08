'use client';
import { useSession } from 'next-auth/react';
import { useEffect, useState, useMemo, useRef } from 'react';

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
  category?: string | null;
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

function MultiSelectDropdown({ values, onChange, options, placeholder }: { values: string[], onChange: (val: string[]) => void, options: {label: string, value: string}[], placeholder: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    function handleClickOutside(event: any) {
      if (ref.current && !ref.current.contains(event.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggle = (val: string) => {
    if (values.includes(val)) {
      onChange(values.filter(v => v !== val));
    } else {
      onChange([...values, val]);
    }
  };

  let selectedLabel = placeholder;
  if (values.length === 1) {
    selectedLabel = options.find(o => o.value === values[0])?.label || placeholder;
  } else if (values.length > 1) {
    selectedLabel = `${values.length} נבחרו`;
  }

  return (
    <div ref={ref} style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div 
        className="input" 
        style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: '100%', minHeight: '42px' }}
        onClick={() => setOpen(!open)}
      >
        <span style={{ color: values.length > 0 ? 'inherit' : 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', paddingLeft: '8px' }}>{selectedLabel}</span>
        <span style={{ fontSize: '10px', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', color: 'var(--text-muted)', flexShrink: 0 }}>▼</span>
      </div>
      {open && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          marginTop: '4px',
          background: 'var(--bg-panel)',
          border: '1px solid var(--border)',
          borderRadius: '8px',
          maxHeight: '250px',
          overflowY: 'auto',
          zIndex: 1000,
          boxShadow: '0 10px 25px -5px rgba(0,0,0,0.3)'
        }}>
          {values.length > 0 && (
            <div 
              style={{ padding: '10px 12px', cursor: 'pointer', borderBottom: '1px solid var(--border)', color: 'var(--accent-dark)', fontWeight: 700 }}
              onClick={() => { onChange([]); }}
            >
              נקה הכל
            </div>
          )}
          {options.map(opt => {
            const isSelected = values.includes(opt.value);
            return (
              <div 
                key={opt.value}
                style={{ 
                  padding: '10px 12px', 
                  cursor: 'pointer', 
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: isSelected ? 'rgba(0,0,0,0.05)' : 'transparent',
                  color: isSelected ? 'var(--accent-dark)' : 'var(--text-primary)',
                  fontWeight: isSelected ? 700 : 400
                }}
                onClick={() => { toggle(opt.value); }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.05)'}
                onMouseLeave={e => e.currentTarget.style.background = isSelected ? 'rgba(0,0,0,0.05)' : 'transparent'}
              >
                <div style={{ width: '16px', height: '16px', border: '1px solid currentColor', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {isSelected && <span style={{ fontSize: '12px' }}>✓</span>}
                </div>
                {opt.label}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function NewOrderPage() {
  const { data: session } = useSession();
  const role = (session?.user as any)?.role;

  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [qualityFilter, setQualityFilter] = useState<string[]>([]);
  const [modelFilter, setModelFilter] = useState<string[]>([]);
  const [potSizeFilter, setPotSizeFilter] = useState<string[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<string[]>([]);
  const [bloomFilter, setBloomFilter] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<'quality' | 'bloom' | 'name'>('quality');
  const [sortDesc, setSortDesc] = useState<boolean>(false);
  const [storeOpen, setStoreOpen] = useState(true);

  const handleSort = (column: 'quality' | 'bloom' | 'name') => {
    if (sortBy === column) {
      setSortDesc(!sortDesc);
    } else {
      setSortBy(column);
      setSortDesc(false);
    }
  };
  
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);

  // Agent/admin fields
  const [customerName, setCustomerName] = useState('');
  const [customerDropdownOpen, setCustomerDropdownOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [mobileCartOpen, setMobileCartOpen] = useState(false);
  const [cartNumber, setCartNumber] = useState('');
  const [orderNumber, setOrderNumber] = useState('');
  const [lineNumber, setLineNumber] = useState('');
  const [prodOrderNumber, setProdOrderNumber] = useState('');
  const [prodLineNumber, setProdLineNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [deliveryDate, setDeliveryDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [isDateFocused, setIsDateFocused] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, nextFieldId: string) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const nextField = document.getElementById(nextFieldId);
      if (nextField) {
        nextField.focus();
      }
    }
  };

  const filteredCustomers = useMemo(() => {
    return customers.filter(c => c.customerName.includes(customerName));
  }, [customers, customerName]);

  const handleCustomerKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!customerDropdownOpen) setCustomerDropdownOpen(true);
      setHighlightedIndex(prev => {
        const next = Math.min(prev + 1, filteredCustomers.length - 1);
        setTimeout(() => {
          const el = document.getElementById(`customer-item-${next}`);
          if (el) el.scrollIntoView({ block: 'nearest' });
        }, 0);
        return next;
      });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev => {
        const next = Math.max(prev - 1, -1);
        setTimeout(() => {
          const el = document.getElementById(`customer-item-${next}`);
          if (el) el.scrollIntoView({ block: 'nearest' });
        }, 0);
        return next;
      });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (customerDropdownOpen && highlightedIndex >= 0 && highlightedIndex < filteredCustomers.length) {
        setCustomerName(filteredCustomers[highlightedIndex].customerName);
      }
      setCustomerDropdownOpen(false);
      setHighlightedIndex(-1);
      const nextField = document.getElementById('deliveryDateInput');
      if (nextField) {
        nextField.focus();
      }
    } else if (e.key === 'Escape') {
      setCustomerDropdownOpen(false);
      setHighlightedIndex(-1);
    }
  };

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

    // Poll inventory every 15 seconds to keep available quantities live for others
    const interval = setInterval(() => {
      fetch('/api/inventory')
        .then(r => r.json())
        .then(data => setInventory(data))
        .catch(console.error);
    }, 15000);

    return () => clearInterval(interval);
  }, [session, role]);

  const inStockInventory = useMemo(() => {
    return inventory.filter(i => Math.floor(i.quantity / i.packageSize) >= 1 && i.potSize !== '136');
  }, [inventory]);

  const filteredItems = useMemo(() => {
    const filtered = inStockInventory.filter(item => {
      if (qualityFilter.length > 0 && !qualityFilter.includes(item.quality)) return false;
      if (modelFilter.length > 0 && !modelFilter.includes(item.modelCode)) return false;
      if (potSizeFilter.length > 0 && !potSizeFilter.includes(item.potSize || '')) return false;
      if (categoryFilter.length > 0 && !categoryFilter.includes(item.category || '')) return false;
      if (bloomFilter.length > 0 && !bloomFilter.includes(item.bloomPct)) return false;
      if (search) {
        const term = search.toLowerCase();
        if (!item.itemName.toLowerCase().includes(term)) {
          return false;
        }
      }
      return true;
    });

    return filtered.sort((a, b) => {
      const getQualityNum = (q: string) => {
        const matches = q.match(/\d+/g);
        return matches ? parseInt(matches[matches.length - 1], 10) : 999;
      };

      const qA = getQualityNum(a.quality);
      const qB = getQualityNum(b.quality);
      
      const bA = parseFloat(a.bloomPct) || 0;
      const bB = parseFloat(b.bloomPct) || 0;

      const nA = a.itemName || '';
      const nB = b.itemName || '';

      let cmp = 0;
      if (sortBy === 'quality') {
        if (qA !== qB) cmp = qA - qB;
        else if (bA !== bB) cmp = bB - bA;
        else cmp = nA.localeCompare(nB);
      } else if (sortBy === 'bloom') {
        if (bA !== bB) cmp = bB - bA;
        else if (qA !== qB) cmp = qA - qB;
        else cmp = nA.localeCompare(nB);
      } else {
        const nameCmp = nA.localeCompare(nB);
        if (nameCmp !== 0) cmp = nameCmp;
        else if (qA !== qB) cmp = qA - qB;
        else cmp = bB - bA;
      }
      return sortDesc ? -cmp : cmp;
    });
  }, [inStockInventory, search, qualityFilter, modelFilter, potSizeFilter, categoryFilter, bloomFilter, sortBy, sortDesc]);

  const categories = useMemo(() => {
    const relevant = inStockInventory.filter(item => {
      if (qualityFilter.length > 0 && !qualityFilter.includes(item.quality)) return false;
      if (modelFilter.length > 0 && !modelFilter.includes(item.modelCode)) return false;
      if (potSizeFilter.length > 0 && !potSizeFilter.includes(item.potSize || '')) return false;
      if (bloomFilter.length > 0 && !bloomFilter.includes(item.bloomPct)) return false;
      if (search && !item.itemName.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
    return Array.from(new Set(relevant.map(i => i.category).filter(Boolean) as string[])).sort();
  }, [inStockInventory, search, qualityFilter, modelFilter, potSizeFilter, bloomFilter]);

  const potSizes = useMemo(() => {
    const relevant = inStockInventory.filter(item => {
      if (qualityFilter.length > 0 && !qualityFilter.includes(item.quality)) return false;
      if (modelFilter.length > 0 && !modelFilter.includes(item.modelCode)) return false;
      if (categoryFilter.length > 0 && !categoryFilter.includes(item.category || '')) return false;
      if (bloomFilter.length > 0 && !bloomFilter.includes(item.bloomPct)) return false;
      if (search && !item.itemName.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
    return Array.from(new Set(relevant.map(i => i.potSize).filter(Boolean) as string[])).sort((a, b) => parseInt(a) - parseInt(b));
  }, [inStockInventory, search, qualityFilter, modelFilter, categoryFilter, bloomFilter]);

  const qualities = useMemo(() => {
    const relevant = inStockInventory.filter(item => {
      if (modelFilter.length > 0 && !modelFilter.includes(item.modelCode)) return false;
      if (potSizeFilter.length > 0 && !potSizeFilter.includes(item.potSize || '')) return false;
      if (categoryFilter.length > 0 && !categoryFilter.includes(item.category || '')) return false;
      if (bloomFilter.length > 0 && !bloomFilter.includes(item.bloomPct)) return false;
      if (search && !item.itemName.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
    return Array.from(new Set(relevant.map(i => i.quality))).sort((a, b) => {
      const getNum = (str: string) => {
        const matches = str.match(/\d+/g);
        return matches ? parseInt(matches[matches.length - 1], 10) : 999;
      };
      const numA = getNum(a);
      const numB = getNum(b);
      if (numA !== numB) return numA - numB;
      return a.localeCompare(b);
    });
  }, [inStockInventory, search, modelFilter, potSizeFilter, categoryFilter, bloomFilter]);

  const models = useMemo(() => {
    const relevant = inStockInventory.filter(item => {
      if (qualityFilter.length > 0 && !qualityFilter.includes(item.quality)) return false;
      if (potSizeFilter.length > 0 && !potSizeFilter.includes(item.potSize || '')) return false;
      if (categoryFilter.length > 0 && !categoryFilter.includes(item.category || '')) return false;
      if (bloomFilter.length > 0 && !bloomFilter.includes(item.bloomPct)) return false;
      if (search && !item.itemName.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
    const map = new Map<string, string>();
    relevant.forEach(i => map.set(i.modelCode, i.modelName));
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [inStockInventory, search, qualityFilter, potSizeFilter, categoryFilter, bloomFilter]);

  const blooms = useMemo(() => {
    const relevant = inStockInventory.filter(item => {
      if (qualityFilter.length > 0 && !qualityFilter.includes(item.quality)) return false;
      if (modelFilter.length > 0 && !modelFilter.includes(item.modelCode)) return false;
      if (potSizeFilter.length > 0 && !potSizeFilter.includes(item.potSize || '')) return false;
      if (categoryFilter.length > 0 && !categoryFilter.includes(item.category || '')) return false;
      if (search && !item.itemName.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
    return Array.from(new Set(relevant.map(i => i.bloomPct))).sort((a, b) => {
      return (parseFloat(a) || 0) - (parseFloat(b) || 0);
    });
  }, [inStockInventory, search, qualityFilter, modelFilter, potSizeFilter, categoryFilter]);

  function formatPotSize(p: string) {
    if (p === '1') return 'חומר ריבוי';
    if (p === '20') return 'קערה 20';
    if (p === '7') return 'כוס 7';
    return `עציץ ${p}`;
  }

  async function updateCart(item: InventoryItem, deltaPackages: number, absolutePackages?: number) {
    setCart(prev => {
      const existing = prev.find(c => c.item.id === item.id);
      const currentPackages = existing ? existing.packages : 0;
      let newPackages = currentPackages + deltaPackages;
      if (absolutePackages !== undefined) {
        newPackages = absolutePackages;
      }
      
      if (newPackages < 0) newPackages = 0;
      
      if (role !== 'customer' || true) {
        const availablePackages = Math.floor(item.quantity / item.packageSize);
        if (newPackages > availablePackages) {
          setErrorMsg(`אין מספיק מלאי עבור ${item.itemName} ${item.modelName}. זמין: ${availablePackages} אריזות`);
          setTimeout(() => setErrorMsg(''), 3000);
          return prev;
        }
      }

      // Sync with server in background
      fetch('/api/cart/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inventoryItemId: item.id,
          packages: newPackages,
          units: newPackages * item.packageSize
        })
      }).then(async res => {
        const data = await res.json();
        if (!res.ok) {
          setErrorMsg(data.error || 'שגיאה בשמירת המלאי לעגלה');
          setTimeout(() => setErrorMsg(''), 3000);
          // Revert on server error by re-fetching or just reverting to currentPackages
          setCart(current => {
            if (currentPackages === 0) return current.filter(c => c.item.id !== item.id);
            return current.map(c => c.item.id === item.id ? { ...c, packages: currentPackages } : c);
          });
        }
      }).catch(e => {
        setErrorMsg('שגיאת תקשורת בשמירת מלאי');
        setTimeout(() => setErrorMsg(''), 3000);
        setCart(current => {
          if (currentPackages === 0) return current.filter(c => c.item.id !== item.id);
          return current.map(c => c.item.id === item.id ? { ...c, packages: currentPackages } : c);
        });
      });

      if (newPackages === 0) {
        return prev.filter(c => c.item.id !== item.id);
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
        notes,
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
      setSuccessMsg('ההזמנה נשמרה בהצלחה!');
      setCart([]);
      setMobileCartOpen(false);
      setCustomerName(''); setCartNumber(''); setOrderNumber('');
      setLineNumber(''); setProdOrderNumber(''); setProdLineNumber(''); setNotes(''); setDeliveryDate(new Date().toISOString().split('T')[0]);
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
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', textAlign: 'center', padding: '0 20px' }}>
        <div style={{ fontSize: '64px', marginBottom: '20px' }}>🪴</div>
        <h1 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '12px' }}>
          מחר אנחנו מלאים עד העציץ האחרון
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '16px', maxWidth: '400px', lineHeight: '1.6' }}>
          ההזמנות למחר נסגרו, אבל אפשר לצלצל למשרד — לפעמים אנחנו מצליחים להצמיח מקום נוסף.
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
                  id="customerNameInput"
                  className="input" 
                  value={customerName} 
                  onChange={e => {
                    const val = e.target.value;
                    setCustomerName(val);
                    setCustomerDropdownOpen(val.length > 0);
                    setHighlightedIndex(val.length > 0 ? 0 : -1);
                  }} 
                  onFocus={() => {
                    if (customerName.length > 0) setCustomerDropdownOpen(true);
                  }}
                  onBlur={() => setTimeout(() => setCustomerDropdownOpen(false), 200)}
                  onKeyDown={handleCustomerKeyDown}
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
                    {filteredCustomers.map((c, idx) => (
                      <div 
                        id={`customer-item-${idx}`}
                        key={c.customerCode}
                        style={{
                          padding: '10px 14px',
                          cursor: 'pointer',
                          borderBottom: '1px solid var(--border)',
                          fontWeight: 600,
                          fontSize: '14px',
                          background: highlightedIndex === idx ? 'var(--bg-base)' : 'transparent'
                        }}
                        onMouseDown={() => {
                          setCustomerName(c.customerName);
                          setCustomerDropdownOpen(false);
                          setHighlightedIndex(-1);
                        }}
                        onMouseEnter={() => setHighlightedIndex(idx)}
                        onMouseLeave={() => setHighlightedIndex(-1)}
                      >
                        {c.customerName}
                        {c.agentName && <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginRight: '8px' }}>({c.agentName})</span>}
                      </div>
                    ))}
                    {filteredCustomers.length === 0 && (
                      <div style={{ padding: '12px', color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center' }}>לא נמצאו לקוחות</div>
                    )}
                  </div>
                )}
              </div>
              <div className="form-group">
                <label className="form-label">תאריך נדרש *</label>
                <input 
                  id="deliveryDateInput"
                  className="input" 
                  type={isDateFocused ? "date" : "text"} 
                  onFocus={() => setIsDateFocused(true)}
                  onBlur={() => setIsDateFocused(false)}
                  value={isDateFocused ? deliveryDate : (deliveryDate ? deliveryDate.split('-').reverse().join('/') : '')}
                  onChange={e => setDeliveryDate(e.target.value)} 
                  onKeyDown={e => handleKeyDown(e, 'cartNumberInput')}
                />
              </div>
              <div className="form-group">
                <label className="form-label">מספר עגלה *</label>
                <input id="cartNumberInput" className="input" value={cartNumber} onChange={e => setCartNumber(e.target.value)} onKeyDown={e => handleKeyDown(e, 'orderNumberInput')} placeholder="מס' עגלה" />
              </div>
              <div className="form-group">
                <label className="form-label">מספר הזמנה</label>
                <input id="orderNumberInput" className="input" value={orderNumber} onChange={e => setOrderNumber(e.target.value)} onKeyDown={e => handleKeyDown(e, 'lineNumberInput')} placeholder="אופציונלי" />
              </div>
              <div className="form-group">
                <label className="form-label">מספר שורה</label>
                <input id="lineNumberInput" className="input" value={lineNumber} onChange={e => setLineNumber(e.target.value)} onKeyDown={e => handleKeyDown(e, 'prodOrderNumberInput')} placeholder="אופציונלי" />
              </div>
              <div className="form-group">
                <label className="form-label">הזמנת יצור</label>
                <input id="prodOrderNumberInput" className="input" value={prodOrderNumber} onChange={e => setProdOrderNumber(e.target.value)} onKeyDown={e => handleKeyDown(e, 'prodLineNumberInput')} placeholder="אופציונלי" />
              </div>
              <div className="form-group">
                <label className="form-label">שורת ייצור</label>
                <input id="prodLineNumberInput" className="input" value={prodLineNumber} onChange={e => setProdLineNumber(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); document.getElementById('notesInput')?.focus(); } }} placeholder="הקלד כאן..." />
              </div>
            </div>
            <div className="form-group" style={{ marginTop: '10px' }}>
              <label className="form-label">הערות להזמנה</label>
              <textarea 
                id="notesInput" 
                className="input" 
                value={notes} 
                onChange={e => setNotes(e.target.value)} 
                placeholder="הערות מיוחדות, הנחיות מיוחדות..." 
                style={{ minHeight: '60px', width: '100%', resize: 'vertical' }} 
              />
            </div>
          </div>
        )}

        {/* Filters and Search */}
        <div className="card" style={{ marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ width: '100%' }}>
            <input id="searchItemInput" className="input" style={{ width: '100%' }} placeholder="חיפוש חופשי (לפי שם פריט בלבד)..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '110px' }}>
              <MultiSelectDropdown 
                values={categoryFilter} 
                onChange={setCategoryFilter} 
                options={categories.map(c => ({ label: c, value: c }))} 
                placeholder="כל סוגי העציצים" 
              />
            </div>
            <div style={{ flex: 1, minWidth: '110px' }}>
              <MultiSelectDropdown 
                values={potSizeFilter} 
                onChange={setPotSizeFilter} 
                options={potSizes.map(p => ({ label: formatPotSize(p), value: p }))} 
                placeholder="גודל עציץ (הכל)" 
              />
            </div>
            <div style={{ flex: 1, minWidth: '110px' }}>
              <MultiSelectDropdown 
                values={modelFilter} 
                onChange={setModelFilter} 
                options={models.map(([code, name]) => ({ label: name, value: code }))} 
                placeholder="כל הדגמים" 
              />
            </div>
            <div style={{ flex: 1, minWidth: '110px' }}>
              <MultiSelectDropdown 
                values={qualityFilter} 
                onChange={setQualityFilter} 
                options={qualities.map(q => ({ label: `איכות ${q}`, value: q }))} 
                placeholder="כל האיכויות" 
              />
            </div>
            <div style={{ flex: 1, minWidth: '110px' }}>
              <MultiSelectDropdown 
                values={bloomFilter} 
                onChange={setBloomFilter} 
                options={blooms.map(b => ({ label: `${b}% פריחה`, value: b }))} 
                placeholder="כל הפריחות" 
              />
            </div>
          </div>
        </div>

        {/* Catalog List */}
        <div style={{ overflowX: 'auto', paddingBottom: '16px', margin: '0 -16px', padding: '0 16px' }}>
          <div style={{ minWidth: '700px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {/* Table Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '0 12px', fontSize: '13px', fontWeight: 700, color: 'var(--text-muted)', userSelect: 'none' }}>
               <div style={{ width: '48px', flexShrink: 0 }}></div>
               <div style={{ flex: 1, minWidth: '150px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }} onClick={() => handleSort('name')}>
                 פריט ודגם {sortBy === 'name' ? (sortDesc ? '▲' : '▼') : <span style={{opacity: 0.3}}>▼</span>}
               </div>
               <div style={{ width: '80px', flexShrink: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }} onClick={() => handleSort('quality')}>
                 איכות {sortBy === 'quality' ? (sortDesc ? '▲' : '▼') : <span style={{opacity: 0.3}}>▼</span>}
               </div>
               <div style={{ width: '1px', flexShrink: 0 }}></div>
               <div style={{ width: '70px', flexShrink: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }} onClick={() => handleSort('bloom')}>
                 פריחה {sortBy === 'bloom' ? (sortDesc ? '▲' : '▼') : <span style={{opacity: 0.3}}>▼</span>}
               </div>
               <div style={{ width: '1px', flexShrink: 0 }}></div>
               <div style={{ width: '100px', flexShrink: 0 }}>אריזה / עציץ</div>
               {role !== 'customer' && <div style={{ width: '90px', flexShrink: 0, textAlign: 'center' }}>מלאי זמין</div>}
               <div style={{ width: '110px', flexShrink: 0, textAlign: 'center' }}>כמות להזמנה</div>
            </div>

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

                  {/* Item Name & Model */}
                  <div style={{ flex: 1, minWidth: '150px', display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-start' }}>
                    <div style={{ fontWeight: 800, fontSize: '15px', color: 'var(--text-primary)' }}>
                      {item.itemName}
                    </div>
                    <div>
                      <span className="badge" style={{ background: '#000', color: '#fff', fontSize: '15px', padding: '4px 10px', borderRadius: '12px' }}>
                        {item.modelName}
                      </span>
                    </div>
                  </div>
                    
                  {/* Quality */}
                  <div style={{ width: '80px', flexShrink: 0, fontSize: '15px', fontWeight: 800, color: '#000' }}>
                    {item.quality}
                  </div>

                  <div style={{ width: '1px', height: '30px', background: 'var(--border)', flexShrink: 0 }}></div>

                  {/* Bloom */}
                  <div style={{ width: '70px', flexShrink: 0, fontSize: '15px', fontWeight: 800, color: '#000' }}>
                    {item.bloomPct}%
                  </div>

                  <div style={{ width: '1px', height: '30px', background: 'var(--border)', flexShrink: 0 }}></div>

                  {/* Packaging & Pot Size */}
                  <div style={{ width: '100px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                    <div>אריזה: <strong>{item.packageSize}</strong> יח'</div>
                    {item.potSize && <div>{formatPotSize(item.potSize)}</div>}
                  </div>

                  {/* Stock */}
                  {role !== 'customer' && (
                    <div style={{ textAlign: 'center', width: '90px', flexShrink: 0 }}>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>זמין</div>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: (availablePackages - packagesInCart) <= 0 ? 'var(--red)' : 'var(--green)' }}>
                        {Math.max(0, availablePackages - packagesInCart)}
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginRight: '6px', fontWeight: 'normal' }}>
                          ({Math.max(0, availablePackages - packagesInCart) * item.packageSize} יח')
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div style={{ width: '110px', flexShrink: 0, display: 'flex', justifyContent: 'flex-end' }}>
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
