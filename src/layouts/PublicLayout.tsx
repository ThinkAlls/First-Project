import React, { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { MosqueSettings } from '../types/index.ts';

export type PublicRoute =
  | 'home'
  | 'prayer'
  | 'calendar'
  | 'activities'
  | 'transparency'
  | 'info'
  | 'zakat';

interface PublicLayoutProps {
  currentRoute: PublicRoute;
  onNavigate: (route: PublicRoute | 'admin') => void;
  settings?: MosqueSettings | null;
  children: React.ReactNode;
}

export function PublicLayout({ currentRoute, onNavigate, settings, children }: PublicLayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems: Array<{ route: PublicRoute; label: string }> = [
    { route: 'home', label: 'Beranda' },
    { route: 'prayer', label: 'Jadwal Salat' },
    { route: 'calendar', label: 'Kalender' },
    { route: 'transparency', label: 'Transparansi' },
    { route: 'info', label: 'Informasi' },
  ];

  const handleNav = (r: PublicRoute | 'admin') => {
    setMobileOpen(false);
    onNavigate(r);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF9F5] text-[#14221B]">
      {/* Strict 3-zone Top Bar Contract */}
      <header className="sticky top-0 z-40 bg-[#064E3B] text-white border-b border-emerald-950/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Single-line Brand Wordmark */}
          <button
            type="button"
            onClick={() => handleNav('home')}
            className="flex items-center gap-3 text-left whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-amber-400 rounded-md"
          >
            <img
              src={settings?.logoUrl || '/src/assets/images/mosque_emblem_logo_1795249573681.jpg'}
              alt="Logo Masjid"
              referrerPolicy="no-referrer"
              className="w-8 h-8 rounded-md object-cover bg-[#FAF9F5]"
            />
            <span className="font-display text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0">
              {settings?.mosqueName || 'MasjidKu'}
            </span>
          </button>

          {/* Zone 2: 5 concise single-line text nav links */}
          <nav className="hidden lg:flex items-center gap-7 text-sm font-medium text-emerald-100/90">
            {navItems.map((item) => {
              const active = currentRoute === item.route;
              return (
                <button
                  key={item.route}
                  type="button"
                  onClick={() => handleNav(item.route)}
                  className={`py-1 whitespace-nowrap shrink-0 transition-colors border-b-2 ${
                    active
                      ? 'text-white border-[#D4AF63]'
                      : 'border-transparent hover:text-white hover:border-emerald-300/60'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: Single Primary Action + Mobile toggle */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => handleNav('zakat')}
              className="hidden sm:inline-flex items-center justify-center px-4 py-2 text-xs font-semibold bg-[#D4AF63] text-[#14221B] rounded-lg hover:bg-[#DFBE76] transition-colors whitespace-nowrap shrink-0"
            >
              Zakat & Donasi
            </button>
            <button
              type="button"
              onClick={() => setMobileOpen((v) => !v)}
              className="lg:hidden p-2.5 rounded-lg text-emerald-100 hover:bg-emerald-800/60 transition-colors"
              aria-label="Menu navigasi"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Drawer */}
        {mobileOpen && (
          <div className="lg:hidden border-t border-emerald-800 bg-[#053E2F] px-4 py-4 space-y-1">
            {navItems.map((item) => (
              <button
                key={item.route}
                type="button"
                onClick={() => handleNav(item.route)}
                className={`block w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium ${
                  currentRoute === item.route
                    ? 'bg-emerald-800 text-white'
                    : 'text-emerald-100 hover:bg-emerald-900'
                }`}
              >
                {item.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => handleNav('activities')}
              className={`block w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium ${
                currentRoute === 'activities'
                  ? 'bg-emerald-800 text-white'
                  : 'text-emerald-100 hover:bg-emerald-900'
              }`}
            >
              Poster & Kegiatan
            </button>
            <button
              type="button"
              onClick={() => handleNav('zakat')}
              className="mt-2 w-full py-2.5 px-4 text-sm font-semibold bg-[#D4AF63] text-[#14221B] rounded-lg"
            >
              Kalkulator Zakat & Bayar
            </button>
            <button
              type="button"
              onClick={() => handleNav('admin')}
              className="w-full text-left px-3 py-2.5 rounded-lg text-xs text-emerald-200 hover:text-white"
            >
              Masuk Pengurus DKM
            </button>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1">{children}</main>

      {/* Clean Quiet Footer */}
      <footer className="bg-[#064E3B] text-emerald-100 border-t border-emerald-950/40 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 grid grid-cols-1 md:grid-cols-3 gap-10">
          <div>
            <h3 className="font-display text-lg font-bold text-white mb-2">
              {settings?.mosqueName || 'MasjidKu'}
            </h3>
            <p className="text-sm text-emerald-100/80 leading-relaxed mb-3">
              {settings?.address || 'Alamat Masjid Belum Diatur'}
            </p>
            <p className="text-xs text-emerald-200/75">
              WhatsApp: {settings?.whatsappNumber || '-'} · Email: {settings?.email || '-'}
            </p>
          </div>

          <div>
            <h4 className="font-display text-sm font-semibold text-white mb-3">Navigasi Publik</h4>
            <ul className="space-y-2 text-sm text-emerald-100/80">
              <li>
                <button type="button" onClick={() => handleNav('prayer')} className="hover:text-white transition-colors">
                  Jadwal Salat Harian & Bulanan
                </button>
              </li>
              <li>
                <button type="button" onClick={() => handleNav('calendar')} className="hover:text-white transition-colors">
                  Kalender Islam & Konversi Hijriah
                </button>
              </li>
              <li>
                <button type="button" onClick={() => handleNav('activities')} className="hover:text-white transition-colors">
                  Poster & Kegiatan Masjid
                </button>
              </li>
              <li>
                <button type="button" onClick={() => handleNav('transparency')} className="hover:text-white transition-colors">
                  Transparansi Kas & Dana Zakat
                </button>
              </li>
              <li>
                <button type="button" onClick={() => handleNav('zakat')} className="hover:text-white transition-colors">
                  Kalkulator Zakat, Infak & Sedekah
                </button>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-display text-sm font-semibold text-white mb-3">Pengelolaan DKM</h4>
            <p className="text-sm text-emerald-100/80 leading-relaxed mb-4">
              Akses khusus pengurus Dewan Kemakmuran Masjid untuk verifikasi zakat, pencatatan kas, dan publikasi kegiatan.
            </p>
            <button
              type="button"
              onClick={() => handleNav('admin')}
              className="px-4 py-2 text-xs font-semibold border border-emerald-500/60 text-white rounded-lg hover:bg-emerald-800 transition-colors"
            >
              Portal Pengurus DKM
            </button>
          </div>
        </div>
        <div className="border-t border-emerald-900/70 py-4 px-4 text-center text-xs text-emerald-200/70">
          © {new Date().getFullYear()} {settings?.mosqueName || 'MasjidKu'} — Sistem Informasi Masjid & Manajemen Keuangan DKM
        </div>
      </footer>
    </div>
  );
}
