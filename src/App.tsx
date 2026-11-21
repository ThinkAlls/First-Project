import { useCallback, useEffect, useState } from 'react';
import { useAuth } from './context/AuthContext.tsx';
import { apiRequest } from './services/api.ts';
import { PublicLayout, PublicRoute } from './layouts/PublicLayout.tsx';
import { AdminLayout, AdminRoute } from './layouts/AdminLayout.tsx';
import { HomePage } from './pages/public/HomePage.tsx';
import { PrayerTimesPage } from './pages/public/PrayerTimesPage.tsx';
import { IslamicCalendarPage } from './pages/public/IslamicCalendarPage.tsx';
import { ActivitiesPage } from './pages/public/ActivitiesPage.tsx';
import { TransparencyPage } from './pages/public/TransparencyPage.tsx';
import { MosqueInfoPage } from './pages/public/MosqueInfoPage.tsx';
import { ZakatCalculatorPayPage } from './pages/public/ZakatCalculatorPayPage.tsx';
import { AdminLoginPage } from './pages/admin/AdminLoginPage.tsx';
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage.tsx';
import { AdminIncomePage } from './pages/admin/AdminIncomePage.tsx';
import { AdminZakatVerifyPage } from './pages/admin/AdminZakatVerifyPage.tsx';
import { AdminExpensePage } from './pages/admin/AdminExpensePage.tsx';
import { AdminZakatDistributionPage } from './pages/admin/AdminZakatDistributionPage.tsx';
import { AdminAssetsPage } from './pages/admin/AdminAssetsPage.tsx';
import { AdminPaymentMethodsPage } from './pages/admin/AdminPaymentMethodsPage.tsx';
import { AdminDonorsPage } from './pages/admin/AdminDonorsPage.tsx';
import { AdminReportsPage } from './pages/admin/AdminReportsPage.tsx';
import { AdminPostersPage } from './pages/admin/AdminPostersPage.tsx';
import {
  AdminAuditLogsPage,
  AdminProfilePage,
  AdminSettingsPage,
  AdminUsersPage,
} from './pages/admin/AdminUsersSettingsPage.tsx';
import { MosqueSettings } from './types/index.ts';

export default function App() {
  const { user, isAuthenticated } = useAuth();
  const [area, setArea] = useState<'public' | 'admin'>('public');
  const [publicRoute, setPublicRoute] = useState<PublicRoute>('home');
  const [adminRoute, setAdminRoute] = useState<AdminRoute>('dashboard');
  const [settings, setSettings] = useState<MosqueSettings | null>(null);
  const [pendingCount, setPendingCount] = useState(0);

  const loadSettings = useCallback(() => {
    apiRequest<{ settings: MosqueSettings }>('/api/public/mosque-info')
      .then((res) => setSettings(res.settings))
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const refreshPendingCount = useCallback(() => {
    if (!isAuthenticated) return;
    if (user?.roleCode === 'ketua_dkm' || user?.roleCode === 'bendahara') {
      apiRequest<any>('/api/admin/finance/dashboard')
        .then((res) => {
          setPendingCount((res.pendingZakatCount || 0) + (res.pendingExpenseCount || 0));
        })
        .catch(() => {});
    }
  }, [isAuthenticated, user?.roleCode]);

  const handlePublicNav = (target: PublicRoute | 'admin') => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (target === 'admin') {
      setArea('admin');
      return;
    }
    setArea('public');
    setPublicRoute(target);
  };

  if (area === 'admin') {
    if (!isAuthenticated) {
      return (
        <AdminLoginPage
          onSuccess={() => {
            setAdminRoute('dashboard');
          }}
          onBackPublic={() => setArea('public')}
        />
      );
    }

    const role = user?.roleCode;
    const isFinance = role === 'ketua_dkm' || role === 'bendahara';
    const isContent = role === 'ketua_dkm' || role === 'sekretaris';
    const isKetua = role === 'ketua_dkm';

    return (
      <AdminLayout
        currentRoute={adminRoute}
        onNavigate={(r) => setAdminRoute(r)}
        onExitToPublic={() => setArea('public')}
        pendingCount={pendingCount}
      >
        {adminRoute === 'dashboard' && (
          <AdminDashboardPage
            onNavigate={(r) => setAdminRoute(r)}
            onPendingCountChange={setPendingCount}
          />
        )}
        {adminRoute === 'income' && isFinance && <AdminIncomePage />}
        {adminRoute === 'zakat_verify' && isFinance && (
          <AdminZakatVerifyPage onVerifiedChange={refreshPendingCount} />
        )}
        {adminRoute === 'expenses' && isFinance && (
          <AdminExpensePage onBalanceChange={refreshPendingCount} />
        )}
        {adminRoute === 'zakat_dist' && isFinance && <AdminZakatDistributionPage />}
        {adminRoute === 'assets' && isFinance && <AdminAssetsPage />}
        {adminRoute === 'payment_methods' && isFinance && <AdminPaymentMethodsPage />}
        {adminRoute === 'donors' && isFinance && <AdminDonorsPage />}
        {adminRoute === 'reports' && isFinance && <AdminReportsPage />}
        {adminRoute === 'posters' && isContent && <AdminPostersPage />}
        {adminRoute === 'users' && isKetua && <AdminUsersPage />}
        {adminRoute === 'settings' && isKetua && <AdminSettingsPage onSaved={loadSettings} />}
        {adminRoute === 'audit' && isFinance && <AdminAuditLogsPage />}
        {adminRoute === 'profile' && <AdminProfilePage />}
      </AdminLayout>
    );
  }

  return (
    <PublicLayout
      currentRoute={publicRoute}
      onNavigate={handlePublicNav}
      settings={settings}
    >
      {publicRoute === 'home' && <HomePage onNavigate={handlePublicNav} />}
      {publicRoute === 'prayer' && <PrayerTimesPage />}
      {publicRoute === 'calendar' && <IslamicCalendarPage />}
      {publicRoute === 'activities' && <ActivitiesPage />}
      {publicRoute === 'transparency' && <TransparencyPage />}
      {publicRoute === 'info' && <MosqueInfoPage onNavigate={handlePublicNav} />}
      {publicRoute === 'zakat' && <ZakatCalculatorPayPage />}
    </PublicLayout>
  );
}
