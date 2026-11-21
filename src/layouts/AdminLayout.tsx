import React, { useState } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Bell,
  Building2,
  CheckSquare,
  CreditCard,
  FileBarChart2,
  Globe,
  HandHeart,
  History,
  Image as ImageIcon,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { getRoleLabel } from '../utils/format.ts';

export type AdminRoute =
  | 'dashboard'
  | 'income'
  | 'zakat_verify'
  | 'expenses'
  | 'zakat_dist'
  | 'assets'
  | 'payment_methods'
  | 'donors'
  | 'reports'
  | 'posters'
  | 'users'
  | 'settings'
  | 'audit'
  | 'profile';

interface AdminLayoutProps {
  currentRoute: AdminRoute;
  onNavigate: (route: AdminRoute) => void;
  onExitToPublic: () => void;
  pendingCount?: number;
  children: React.ReactNode;
}

export function AdminLayout({
  currentRoute,
  onNavigate,
  onExitToPublic,
  pendingCount = 0,
  children,
}: AdminLayoutProps) {
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const role = user?.roleCode;
  const isFinance = role === 'ketua_dkm' || role === 'bendahara';
  const isContent = role === 'ketua_dkm' || role === 'sekretaris';
  const isKetua = role === 'ketua_dkm';

  const menuGroups: Array<{
    title: string;
    items: Array<{ route: AdminRoute; label: string; icon: any; visible: boolean; badge?: number }>;
  }> = [
    {
      title: 'Utama',
      items: [
        { route: 'dashboard', label: 'Ringkasan Dashboard', icon: LayoutDashboard, visible: true },
      ],
    },
    {
      title: 'Keuangan & Zakat',
      items: [
        { route: 'income', label: 'Pemasukan Manual', icon: ArrowDownLeft, visible: isFinance },
        {
          route: 'zakat_verify',
          label: 'Verifikasi Zakat & Donasi',
          icon: CheckSquare,
          visible: isFinance,
          badge: pendingCount > 0 ? pendingCount : undefined,
        },
        { route: 'expenses', label: 'Pengeluaran Kas', icon: ArrowUpRight, visible: isFinance },
        { route: 'zakat_dist', label: 'Distribusi Zakat (Asnaf)', icon: HandHeart, visible: isFinance },
        { route: 'assets', label: 'Aset & Inventaris Masjid', icon: Building2, visible: isFinance },
        { route: 'payment_methods', label: 'Metode Pembayaran', icon: CreditCard, visible: isFinance },
        { route: 'donors', label: 'Data Donatur', icon: Users, visible: isFinance },
        { route: 'reports', label: 'Laporan PDF & Excel', icon: FileBarChart2, visible: isFinance },
      ],
    },
    {
      title: 'Sekretariat & Konten',
      items: [
        { route: 'posters', label: 'Poster, Kegiatan & Kalender', icon: ImageIcon, visible: isContent },
      ],
    },
    {
      title: 'Tata Kelola & Sistem',
      items: [
        { route: 'users', label: 'Akun Pengurus (RBAC)', icon: ShieldCheck, visible: isKetua },
        { route: 'settings', label: 'Pengaturan Masjid', icon: Settings, visible: isKetua },
        { route: 'audit', label: 'Audit Log Keuangan', icon: History, visible: isFinance },
        { route: 'profile', label: 'Profil & Password', icon: Users, visible: true },
      ],
    },
  ];

  const handleSelect = (r: AdminRoute) => {
    setSidebarOpen(false);
    onNavigate(r);
  };

  const currentTitle =
    menuGroups.flatMap((g) => g.items).find((i) => i.route === currentRoute)?.label || 'Dashboard';

  return (
    <div className="min-h-screen flex bg-[#F7F5EE] text-[#14221B]">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`no-print fixed lg:static inset-y-0 left-0 z-50 w-[264px] shrink-0 bg-[#064E3B] text-emerald-50 flex flex-col transition-transform duration-200 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="h-16 px-5 flex items-center justify-between border-b border-emerald-800/70">
          <div className="flex items-center gap-2.5">
            <img
              src="/src/assets/images/mosque_emblem_logo_1795249573681.jpg"
              alt="Logo"
              className="w-7 h-7 rounded object-cover bg-[#FAF9F5]"
            />
            <span className="font-display font-bold text-base tracking-tight text-white">
              Panel DKM
            </span>
          </div>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-1.5 text-emerald-200 hover:text-white"
            aria-label="Tutup sidebar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
          {menuGroups.map((group) => {
            const visibleItems = group.items.filter((i) => i.visible);
            if (visibleItems.length === 0) return null;
            return (
              <div key={group.title}>
                <div className="px-3 mb-2 text-[11px] font-semibold tracking-wider text-emerald-300/80 uppercase">
                  {group.title}
                </div>
                <div className="space-y-1">
                  {visibleItems.map((item) => {
                    const Icon = item.icon;
                    const active = currentRoute === item.route;
                    return (
                      <button
                        key={item.route}
                        type="button"
                        onClick={() => handleSelect(item.route)}
                        className={`w-full flex items-center justify-between gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                          active
                            ? 'bg-emerald-800/90 text-white'
                            : 'text-emerald-100/85 hover:bg-emerald-800/40 hover:text-white'
                        }`}
                      >
                        <span className="flex items-center gap-2.5 truncate">
                          <Icon className="w-4 h-4 shrink-0" />
                          <span className="truncate">{item.label}</span>
                        </span>
                        {item.badge !== undefined && (
                          <span className="px-2 py-0.5 text-[11px] font-mono font-semibold bg-[#D4AF63] text-[#14221B] rounded">
                            {item.badge}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <div className="p-3 border-t border-emerald-800/70 space-y-1.5">
          <button
            type="button"
            onClick={onExitToPublic}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-emerald-100 hover:bg-emerald-800/50 transition-colors"
          >
            <Globe className="w-4 h-4" />
            Lihat Situs Publik
          </button>
          <button
            type="button"
            onClick={async () => {
              await logout();
              onExitToPublic();
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-red-200 hover:bg-red-900/40 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Keluar
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="no-print h-16 bg-white border-b border-[#E4DFD3] px-4 sm:px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg border border-[#E4DFD3] text-[#14221B]"
              aria-label="Buka menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="text-sm font-medium text-[#4A5A51] truncate">
              DKM MasjidKu <span aria-hidden="true">/</span>{' '}
              <span className="text-[#14221B] font-semibold">{currentTitle}</span>
            </div>
          </div>

          <div className="flex items-center gap-4 shrink-0">
            {isFinance && pendingCount > 0 && (
              <button
                type="button"
                onClick={() => onNavigate('zakat_verify')}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-amber-50 border border-amber-200 text-amber-900 rounded-lg hover:bg-amber-100 transition-colors whitespace-nowrap"
              >
                <Bell className="w-3.5 h-3.5 text-amber-700" />
                <span>{pendingCount} Menunggu Verifikasi</span>
              </button>
            )}
            <div className="text-right hidden sm:block">
              <div className="text-xs font-semibold text-[#14221B]">{user?.fullName}</div>
              <div className="text-[11px] text-[#5F6F65]">
                {getRoleLabel(user?.roleCode || '')}
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}
