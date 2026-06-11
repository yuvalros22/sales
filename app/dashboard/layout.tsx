'use client';
import { useSession, signOut } from 'next-auth/react';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

const navItems = {
  admin: [
    { href: '/dashboard', label: 'סקירה כללית', icon: '📊' },
    { href: '/dashboard/inventory', label: 'מלאי', icon: '📦' },
    { href: '/dashboard/orders', label: 'הזמנות', icon: '📋' },
    { href: '/dashboard/upload', label: 'העלאת מלאי', icon: '⬆️' },
    { href: '/dashboard/users', label: 'ניהול משתמשים', icon: '👥' },
  ],
  agent: [
    { href: '/dashboard', label: 'סקירה כללית', icon: '📊' },
    { href: '/dashboard/inventory', label: 'מלאי', icon: '📦' },
    { href: '/dashboard/orders', label: 'הזמנות', icon: '📋' },
    { href: '/dashboard/upload', label: 'העלאת מלאי', icon: '⬆️' },
    { href: '/dashboard/new-order', label: 'הזמנה חדשה', icon: '➕' },
  ],
  customer: [
    { href: '/dashboard', label: 'סקירה', icon: '📊' },
    { href: '/dashboard/inventory', label: 'קטלוג', icon: '📦' },
    { href: '/dashboard/orders', label: 'ההזמנות שלי', icon: '📋' },
    { href: '/dashboard/new-order', label: 'הזמנה חדשה', icon: '➕' },
  ],
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login');
  }, [status, router]);

  if (status === 'loading') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-base)' }}>
        <div style={{ color: 'var(--text-muted)' }}>טוען...</div>
      </div>
    );
  }

  if (!session) return null;

  const role = (session.user as any)?.role as keyof typeof navItems;
  const items = navItems[role] || navItems.customer;

  return (
    <div className="layout">
      {/* Sidebar */}
      <div className="sidebar">
        <div className="sidebar-logo">🌿 FlowerStock</div>

        <nav style={{ flex: 1 }}>
          {items.map(item => (
            <button
              key={item.href}
              className={`sidebar-item ${pathname === item.href ? 'active' : ''}`}
              onClick={() => router.push(item.href)}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
          <div style={{ padding: '8px 10px', marginBottom: '8px' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>{session.user?.name}</div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
              <span className={`badge ${role === 'admin' ? 'badge-amber' : role === 'agent' ? 'badge-blue' : 'badge-green'}`} style={{ padding: '1px 8px' }}>
                {role === 'admin' ? 'מנהל' : role === 'agent' ? 'סוכן' : 'לקוח'}
              </span>
            </div>
          </div>
          <button className="sidebar-item" onClick={() => signOut({ callbackUrl: '/login' })}>
            <span>🚪</span>
            <span>יציאה</span>
          </button>
        </div>
      </div>

      {/* Main */}
      <main className="main-content">
        {children}
      </main>
    </div>
  );
}
