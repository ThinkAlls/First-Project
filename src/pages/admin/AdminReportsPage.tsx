import { useCallback, useEffect, useState } from 'react';
import { FileSpreadsheet, FileText, Printer } from 'lucide-react';
import { apiRequest } from '../../services/api.ts';
import { useToast } from '../../context/ToastContext.tsx';
import {
  exportFinancialReportExcel,
  exportFinancialReportPdf,
  formatDateIndo,
  formatRupiah,
} from '../../utils/format.ts';

export function AdminReportsPage() {
  const { showToast } = useToast();
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('monthly');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [categoryName, setCategoryName] = useState('');
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const loadReport = useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ period });
      if (startDate && endDate) {
        q.set('startDate', startDate);
        q.set('endDate', endDate);
      }
      if (categoryName) q.set('categoryName', categoryName);

      const res = await apiRequest<any>(`/api/admin/finance/reports?${q.toString()}`);
      setReport(res);
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [period, startDate, endDate, categoryName, showToast]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const handleExportPdf = () => {
    if (!report) return;
    exportFinancialReportPdf(report);
    showToast('Laporan PDF berhasil diunduh.', 'success');
  };

  const handleExportExcel = async () => {
    if (!report) return;
    await exportFinancialReportExcel(report);
    showToast('Laporan Excel (.xlsx) berhasil diunduh.', 'success');
  };

  return (
    <div className="space-y-6">
      <div className="no-print flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#14221B]">
            Laporan Keuangan Terpisah (PDF, Excel & Cetak)
          </h1>
          <p className="text-sm text-[#5F6F65] mt-1">
            Perhitungan real-time dari database: Saldo Akhir = Saldo Awal + Total Pemasukan - Total Pengeluaran.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleExportPdf}
            disabled={!report}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-[#064E3B] text-white rounded-lg hover:bg-emerald-800"
          >
            <FileText className="w-4 h-4" />
            Export PDF
          </button>
          <button
            type="button"
            onClick={handleExportExcel}
            disabled={!report}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-[#8C6826] text-white rounded-lg hover:opacity-90"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Export Excel
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold border border-[#E4DFD3] bg-white text-[#14221B] rounded-lg hover:bg-[#FAF9F5]"
          >
            <Printer className="w-4 h-4" />
            Cetak
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="no-print bg-white border border-[#E4DFD3] rounded-xl p-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 p-1 bg-[#FAF9F5] border border-[#E4DFD3] rounded-lg">
          {[
            { id: 'daily', label: 'Harian' },
            { id: 'weekly', label: 'Mingguan' },
            { id: 'monthly', label: 'Bulanan' },
            { id: 'yearly', label: 'Tahunan' },
          ].map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                setStartDate('');
                setEndDate('');
                setPeriod(p.id as any);
              }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md ${
                period === p.id && !startDate
                  ? 'bg-white text-[#064E3B] shadow-sm'
                  : 'text-[#5F6F65]'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="px-3 py-2 text-xs bg-[#FAF9F5] border border-[#E4DFD3] rounded-lg"
        />
        <span className="text-xs text-[#5F6F65]">s/d</span>
        <input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className="px-3 py-2 text-xs bg-[#FAF9F5] border border-[#E4DFD3] rounded-lg"
        />
        <input
          type="text"
          value={categoryName}
          onChange={(e) => setCategoryName(e.target.value)}
          placeholder="Filter kategori (opsional)..."
          className="px-3 py-2 text-xs bg-[#FAF9F5] border border-[#E4DFD3] rounded-lg"
        />
      </div>

      {loading || !report ? (
        <div className="h-64 bg-[#EAE5D9] rounded-2xl animate-pulse" />
      ) : (
        <div className="space-y-8">
          <div className="text-xs text-[#5F6F65]">
            Periode Laporan: <strong>{formatDateIndo(report.period.startDate)}</strong> s/d{' '}
            <strong>{formatDateIndo(report.period.endDate)}</strong>
          </div>

          {/* Section A: Kas Masjid */}
          <div className="bg-white border border-[#E4DFD3] rounded-2xl p-6 space-y-5">
            <h2 className="font-display text-lg font-bold text-[#064E3B]">
              A. Laporan Kas Masjid
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl bg-[#FAF9F5] border border-[#E4DFD3]">
                <div className="text-xs text-[#5F6F65]">Saldo Awal Periode</div>
                <div className="font-mono text-lg font-bold tabular-nums mt-1">
                  {formatRupiah(report.cashReport.openingBalance)}
                </div>
              </div>
              <div className="p-4 rounded-xl bg-[#FAF9F5] border border-[#E4DFD3]">
                <div className="text-xs text-[#5F6F65]">Total Pemasukan Kas</div>
                <div className="font-mono text-lg font-bold text-emerald-800 tabular-nums mt-1">
                  + {formatRupiah(report.cashReport.totalIncome)}
                </div>
              </div>
              <div className="p-4 rounded-xl bg-[#FAF9F5] border border-[#E4DFD3]">
                <div className="text-xs text-[#5F6F65]">Total Pengeluaran Kas</div>
                <div className="font-mono text-lg font-bold text-[#8C6826] tabular-nums mt-1">
                  - {formatRupiah(report.cashReport.totalExpense)}
                </div>
              </div>
              <div className="p-4 rounded-xl bg-[#064E3B] text-white">
                <div className="text-xs text-emerald-200">Saldo Akhir Kas</div>
                <div className="font-mono text-lg font-bold tabular-nums mt-1">
                  {formatRupiah(report.cashReport.closingBalance)}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
              <div>
                <h3 className="text-xs font-semibold text-[#4A5A51] mb-2">
                  Pemasukan Kas ({report.cashReport.incomeTransactions.length})
                </h3>
                <div className="border border-[#E4DFD3] rounded-xl overflow-hidden">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-[#FAF9F5] border-b border-[#E4DFD3]">
                      <tr>
                        <th className="px-3 py-2">Tanggal</th>
                        <th className="px-3 py-2">Kategori</th>
                        <th className="px-3 py-2 text-right">Nominal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#EFECE4]">
                      {report.cashReport.incomeTransactions.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="px-3 py-4 text-center text-[#5F6F65]">
                            Tidak ada pemasukan kas.
                          </td>
                        </tr>
                      ) : (
                        report.cashReport.incomeTransactions.map((tx: any) => (
                          <tr key={tx.id}>
                            <td className="px-3 py-2">{tx.transactionDate}</td>
                            <td className="px-3 py-2">{tx.categoryName}</td>
                            <td className="px-3 py-2 text-right font-mono tabular-nums">
                              {formatRupiah(tx.amount)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <h3 className="text-xs font-semibold text-[#4A5A51] mb-2">
                  Pengeluaran Kas ({report.cashReport.expenseTransactions.length})
                </h3>
                <div className="border border-[#E4DFD3] rounded-xl overflow-hidden">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-[#FAF9F5] border-b border-[#E4DFD3]">
                      <tr>
                        <th className="px-3 py-2">Tanggal</th>
                        <th className="px-3 py-2">Kategori</th>
                        <th className="px-3 py-2 text-right">Nominal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#EFECE4]">
                      {report.cashReport.expenseTransactions.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="px-3 py-4 text-center text-[#5F6F65]">
                            Tidak ada pengeluaran kas.
                          </td>
                        </tr>
                      ) : (
                        report.cashReport.expenseTransactions.map((tx: any) => (
                          <tr key={tx.id}>
                            <td className="px-3 py-2">{tx.transactionDate}</td>
                            <td className="px-3 py-2">{tx.categoryName}</td>
                            <td className="px-3 py-2 text-right font-mono tabular-nums">
                              {formatRupiah(tx.amount)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

          {/* Section B: Laporan Dana Zakat */}
          <div className="bg-white border border-[#E4DFD3] rounded-2xl p-6 space-y-5">
            <h2 className="font-display text-lg font-bold text-[#14221B]">
              B. Laporan Dana Zakat (Fitrah & Mal)
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl bg-[#FAF9F5] border border-[#E4DFD3]">
                <div className="text-xs text-[#5F6F65]">Zakat Fitrah (Periode)</div>
                <div className="font-mono text-lg font-bold tabular-nums mt-1">
                  {formatRupiah(report.zakatReport.fitrahCollected)}
                </div>
              </div>
              <div className="p-4 rounded-xl bg-[#FAF9F5] border border-[#E4DFD3]">
                <div className="text-xs text-[#5F6F65]">Zakat Mal (Periode)</div>
                <div className="font-mono text-lg font-bold tabular-nums mt-1">
                  {formatRupiah(report.zakatReport.malCollected)}
                </div>
              </div>
              <div className="p-4 rounded-xl bg-[#FAF9F5] border border-[#E4DFD3]">
                <div className="text-xs text-[#5F6F65]">Penyaluran Asnaf (Periode)</div>
                <div className="font-mono text-lg font-bold text-[#8C6826] tabular-nums mt-1">
                  {formatRupiah(report.zakatReport.totalDistributed)}
                </div>
              </div>
              <div className="p-4 rounded-xl bg-[#FAF9F5] border border-[#D4AF63]">
                <div className="text-xs font-semibold text-[#8C6826]">Sisa Dana Zakat</div>
                <div className="font-mono text-lg font-bold text-[#064E3B] tabular-nums mt-1">
                  {formatRupiah(report.zakatReport.remainingZakatBalance)}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
