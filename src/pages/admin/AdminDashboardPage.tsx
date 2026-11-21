import { useEffect, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { apiRequest } from '../../services/api.ts';
import { useAuth } from '../../context/AuthContext.tsx';
import { formatDateTimeIndo, formatRupiah, getFundLabel, getRoleLabel, getStatusLabel } from '../../utils/format.ts';
import { AdminRoute } from '../../layouts/AdminLayout.tsx';
import { FundBalances } from '../../types/index.ts';

interface AdminDashboardPageProps {
  onNavigate: (r: AdminRoute) => void;
  onPendingCountChange?: (count: number) => void;
}

export function AdminDashboardPage({ onNavigate, onPendingCountChange }: AdminDashboardPageProps) {
  const { user } = useAuth();
  const isFinance = user?.roleCode === 'ketua_dkm' || user?.roleCode === 'bendahara';

  const [financeData, setFinanceData] = useState<{
    balances: FundBalances;
    monthIncome: number;
    monthExpense: number;
    pendingZakatCount: number;
    pendingExpenseCount: number;
    cashChart: any[];
    zakatChart: any[];
    recentIncome: any[];
    recentExpenses: any[];
    recentActivity: any[];
  } | null>(null);

  const [contentStats, setContentStats] = useState<{
    posters: any[];
    activities: any[];
    announcements: any[];
  } | null>(null);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isFinance) {
      apiRequest<any>('/api/admin/finance/dashboard')
        .then((res) => {
          setFinanceData(res);
          onPendingCountChange?.((res.pendingZakatCount || 0) + (res.pendingExpenseCount || 0));
        })
        .finally(() => setLoading(false));
    } else {
      Promise.all([
        apiRequest<{ items: any[] }>('/api/admin/content/posters'),
        apiRequest<{ items: any[] }>('/api/admin/content/activities'),
        apiRequest<{ items: any[] }>('/api/admin/content/announcements'),
      ])
        .then(([p, a, an]) => {
          setContentStats({ posters: p.items, activities: a.items, announcements: an.items });
        })
        .finally(() => setLoading(false));
    }
  }, [isFinance, onPendingCountChange]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 bg-[#EAE5D9] rounded-xl animate-pulse" />
          ))}
        </div>
        <div className="h-80 bg-[#EAE5D9] rounded-2xl animate-pulse" />
      </div>
    );
  }

  // Sekretaris View
  if (!isFinance && contentStats) {
    const published = contentStats.posters.filter((p) => p.status === 'published').length;
    const drafts = contentStats.posters.filter((p) => p.status === 'draft').length;
    const archived = contentStats.posters.filter((p) => p.status === 'archived').length;

    return (
      <div className="space-y-8">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#14221B]">
            Dashboard Sekretariat & Publikasi
          </h1>
          <p className="text-sm text-[#5F6F65] mt-1">
            Kelola poster kegiatan, agenda kajian, pengumuman masjid, dan tanggal hari besar Islam.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="bg-white border border-[#E4DFD3] rounded-xl p-5">
            <div className="text-xs text-[#5F6F65]">Poster Terbit</div>
            <div className="font-mono text-2xl font-bold text-[#064E3B] tabular-nums mt-1">
              {published}
            </div>
          </div>
          <div className="bg-white border border-[#E4DFD3] rounded-xl p-5">
            <div className="text-xs text-[#5F6F65]">Draft Poster</div>
            <div className="font-mono text-2xl font-bold text-[#8C6826] tabular-nums mt-1">
              {drafts}
            </div>
          </div>
          <div className="bg-white border border-[#E4DFD3] rounded-xl p-5">
            <div className="text-xs text-[#5F6F65]">Poster Diarsipkan</div>
            <div className="font-mono text-2xl font-bold text-[#14221B] tabular-nums mt-1">
              {archived}
            </div>
          </div>
          <div className="bg-white border border-[#E4DFD3] rounded-xl p-5">
            <div className="text-xs text-[#5F6F65]">Agenda & Pengumuman</div>
            <div className="font-mono text-2xl font-bold text-[#14221B] tabular-nums mt-1">
              {contentStats.activities.length + contentStats.announcements.length}
            </div>
          </div>
        </div>

        <div className="bg-white border border-[#E4DFD3] rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-lg font-bold text-[#14221B]">
              Manajemen Poster & Informasi Masjid
            </h2>
            <p className="text-sm text-[#5F6F65] mt-1">
              Unggah poster baru, simpan sebagai draft, atau terbitkan langsung ke halaman publik.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('posters')}
            className="px-5 py-2.5 text-xs font-semibold bg-[#064E3B] text-white rounded-lg hover:bg-emerald-800 whitespace-nowrap"
          >
            Buka Kelola Poster & Kegiatan
          </button>
        </div>
      </div>
    );
  }

  if (!financeData) return null;

  const { balances } = financeData;

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#14221B]">
            Dashboard Keuangan DKM ({getRoleLabel(user?.roleCode || '')})
          </h1>
          <p className="text-sm text-[#5F6F65] mt-1">
            Ringkasan waktu nyata dari database untuk pembukuan Kas Masjid dan Dana Zakat yang terpisah.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onNavigate('income')}
            className="px-3.5 py-2 text-xs font-semibold bg-[#064E3B] text-white rounded-lg hover:bg-emerald-800"
          >
            + Pemasukan Manual
          </button>
          <button
            type="button"
            onClick={() => onNavigate('expenses')}
            className="px-3.5 py-2 text-xs font-semibold border border-[#E4DFD3] bg-white text-[#14221B] rounded-lg hover:bg-[#FAF9F5]"
          >
            + Pengeluaran Kas
          </button>
          <button
            type="button"
            onClick={() => onNavigate('assets')}
            className="px-3.5 py-2 text-xs font-semibold border border-[#D4AF63] bg-[#FAF9F5] text-[#14221B] rounded-lg hover:bg-amber-50"
          >
            + Input Aset Masjid
          </button>
        </div>
      </div>

      {/* 8 KPI Cards (Cash & Zakat strictly segregated) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#064E3B] text-white rounded-xl p-5">
          <div className="text-xs text-emerald-200">Saldo Kas Masjid</div>
          <div className="font-mono text-2xl font-bold tabular-nums mt-1.5">
            {formatRupiah(balances.mosqueCash.balance)}
          </div>
          <div className="text-[11px] text-emerald-200/80 mt-2">
            Terpisah dari dana zakat
          </div>
        </div>

        <div className="bg-white border border-[#E4DFD3] rounded-xl p-5">
          <div className="text-xs text-[#5F6F65]">Pemasukan Kas Bulan Ini</div>
          <div className="font-mono text-2xl font-bold text-emerald-800 tabular-nums mt-1.5">
            {formatRupiah(financeData.monthIncome)}
          </div>
        </div>

        <div className="bg-white border border-[#E4DFD3] rounded-xl p-5">
          <div className="text-xs text-[#5F6F65]">Pengeluaran Kas Bulan Ini</div>
          <div className="font-mono text-2xl font-bold text-[#8C6826] tabular-nums mt-1.5">
            {formatRupiah(financeData.monthExpense)}
          </div>
        </div>

        <div className="bg-white border border-[#E4DFD3] rounded-xl p-5">
          <div className="text-xs text-[#5F6F65]">Menunggu Verifikasi / Persetujuan</div>
          <div className="font-mono text-2xl font-bold text-[#14221B] tabular-nums mt-1.5">
            {financeData.pendingZakatCount + financeData.pendingExpenseCount}
          </div>
          <div className="text-[11px] text-[#5F6F65] mt-2">
            {financeData.pendingZakatCount} Zakat/Donasi · {financeData.pendingExpenseCount} Pengeluaran
          </div>
        </div>

        <div className="bg-white border border-[#E4DFD3] rounded-xl p-5">
          <div className="text-xs text-[#5F6F65]">Total Zakat Fitrah Terkumpul</div>
          <div className="font-mono text-xl font-bold text-[#14221B] tabular-nums mt-1.5">
            {formatRupiah(balances.zakatFitrah.income)}
          </div>
        </div>

        <div className="bg-white border border-[#E4DFD3] rounded-xl p-5">
          <div className="text-xs text-[#5F6F65]">Total Zakat Mal Terkumpul</div>
          <div className="font-mono text-xl font-bold text-[#14221B] tabular-nums mt-1.5">
            {formatRupiah(balances.zakatMal.income)}
          </div>
        </div>

        <div className="bg-white border border-[#E4DFD3] rounded-xl p-5">
          <div className="text-xs text-[#5F6F65]">Total Zakat Tersalurkan</div>
          <div className="font-mono text-xl font-bold text-[#8C6826] tabular-nums mt-1.5">
            {formatRupiah(balances.totalZakatDistributed)}
          </div>
        </div>

        <div className="bg-[#FAF9F5] border border-[#D4AF63] rounded-xl p-5">
          <div className="text-xs font-semibold text-[#8C6826]">Sisa Dana Zakat</div>
          <div className="font-mono text-xl font-bold text-[#064E3B] tabular-nums mt-1.5">
            {formatRupiah(balances.totalZakatRemaining)}
          </div>
        </div>
      </div>

      {/* Separate Mosque Fixed Asset Valuation Card */}
      <div className="bg-white border border-[#E4DFD3] rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-xs font-semibold text-[#8C6826]">
            Nilai Aset & Inventaris Masjid (Terpisah dari Kas Tunai & Dana Zakat)
          </div>
          <div className="flex flex-wrap items-baseline gap-3 mt-1">
            <span className="font-mono text-2xl font-bold text-[#14221B] tabular-nums">
              {formatRupiah(balances.mosqueAssets?.totalNominalValue ?? 0)}
            </span>
            <span className="text-xs text-[#5F6F65]">
              ({balances.mosqueAssets?.totalItems ?? 0} item · {balances.mosqueAssets?.totalQuantity ?? 0} unit)
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onNavigate('assets')}
          className="px-4 py-2 text-xs font-semibold border border-[#064E3B] text-[#064E3B] rounded-lg hover:bg-emerald-50 shrink-0"
        >
          Kelola Aset Masjid
        </button>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-[#E4DFD3] rounded-2xl p-6">
          <h2 className="font-display text-base font-bold text-[#14221B] mb-4">
            Arus Kas Masjid Bulanan
          </h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={financeData.cashChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EFECE4" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${Math.round(v / 1000)}rb`} />
                <Tooltip formatter={(v: any) => formatRupiah(v)} />
                <Legend />
                <Bar dataKey="pemasukan" name="Pemasukan Kas" fill="#064E3B" radius={[4, 4, 0, 0]} />
                <Bar dataKey="pengeluaran" name="Pengeluaran Kas" fill="#B48A3E" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white border border-[#E4DFD3] rounded-2xl p-6">
          <h2 className="font-display text-base font-bold text-[#14221B] mb-4">
            Penerimaan & Penyaluran Zakat
          </h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={financeData.zakatChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EFECE4" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${Math.round(v / 1000)}rb`} />
                <Tooltip formatter={(v: any) => formatRupiah(v)} />
                <Legend />
                <Bar dataKey="penerimaan" name="Penerimaan Zakat" fill="#047857" radius={[4, 4, 0, 0]} />
                <Bar dataKey="penyaluran" name="Penyaluran Asnaf" fill="#D4AF63" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Recent Transactions & Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-[#E4DFD3] rounded-2xl p-6">
          <h2 className="font-display text-base font-bold text-[#14221B] mb-4">
            Transaksi Pemasukan Terbaru
          </h2>
          {financeData.recentIncome.length === 0 ? (
            <p className="text-sm text-[#5F6F65]">Belum ada transaksi pemasukan tercatat.</p>
          ) : (
            <div className="divide-y divide-[#EFECE4]">
              {financeData.recentIncome.map((tx) => (
                <div key={tx.id} className="py-3 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-xs font-mono text-[#5F6F65]">
                      {tx.transactionNumber} · {getFundLabel(tx.fundType)}
                    </div>
                    <div className="text-sm font-medium text-[#14221B] truncate">
                      {tx.categoryName} — {tx.description}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-mono text-sm font-bold text-emerald-800 tabular-nums">
                      {formatRupiah(tx.amount)}
                    </div>
                    <div className="text-[11px] text-[#5F6F65]">{getStatusLabel(tx.transactionStatus)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white border border-[#E4DFD3] rounded-2xl p-6">
          <h2 className="font-display text-base font-bold text-[#14221B] mb-4">
            Aktivitas Pengurus Terbaru (Audit Log)
          </h2>
          {financeData.recentActivity.length === 0 ? (
            <p className="text-sm text-[#5F6F65]">Belum ada aktivitas tercatat.</p>
          ) : (
            <div className="divide-y divide-[#EFECE4]">
              {financeData.recentActivity.map((log) => (
                <div key={log.id} className="py-3 flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-xs text-[#8C6826] font-medium">
                      {log.action} · {log.module}
                    </div>
                    <div className="text-sm text-[#14221B]">
                      {log.userName} ({getRoleLabel(log.userRole)})
                    </div>
                    {log.transactionNumber && (
                      <div className="text-xs font-mono text-[#5F6F65]">{log.transactionNumber}</div>
                    )}
                  </div>
                  <div className="text-[11px] text-[#5F6F65] whitespace-nowrap">
                    {formatDateTimeIndo(log.createdAt)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
