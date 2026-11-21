import React, { useCallback, useEffect, useState } from 'react';
import { Ban, Check, Plus, Search, Upload, X } from 'lucide-react';
import { apiRequest } from '../../services/api.ts';
import { useAuth } from '../../context/AuthContext.tsx';
import { useToast } from '../../context/ToastContext.tsx';
import {
  formatDateIndo,
  formatRupiah,
  getPaymentMethodLabel,
  getStatusLabel,
} from '../../utils/format.ts';

const EXPENSE_CATEGORIES = [
  'Pembangunan',
  'Renovasi',
  'Pembelian Material',
  'Listrik',
  'Air',
  'Kebersihan',
  'Gaji Marbot',
  'Perawatan Fasilitas',
  'Kegiatan Keagamaan',
  'Operasional',
  'Lainnya',
];

export function AdminExpensePage({ onBalanceChange }: { onBalanceChange?: () => void }) {
  const { user } = useAuth();
  const { showToast, confirm } = useToast();
  const isKetua = user?.roleCode === 'ketua_dkm';

  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [cashBalance, setCashBalance] = useState<number>(0);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [txDate, setTxDate] = useState(new Date().toISOString().slice(0, 10));
  const [categoryName, setCategoryName] = useState('Listrik');
  const [recipientName, setRecipientName] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [description, setDescription] = useState('');
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ page: String(page), limit: '15' });
      if (search) q.set('search', search);
      if (statusFilter) q.set('status', statusFilter);
      if (startDate) q.set('startDate', startDate);
      if (endDate) q.set('endDate', endDate);

      const [expRes, dashRes] = await Promise.all([
        apiRequest<{ items: any[]; total: number }>(`/api/admin/finance/expenses?${q.toString()}`),
        apiRequest<any>('/api/admin/finance/dashboard'),
      ]);
      setItems(expRes.items);
      setTotal(expRes.total);
      setCashBalance(dashRes.balances.mosqueCash.balance);
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, startDate, endDate, showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const form = new FormData();
      form.append('transactionDate', txDate);
      form.append('categoryName', categoryName);
      form.append('recipientName', recipientName.trim());
      form.append('amount', amount);
      form.append('paymentMethod', paymentMethod);
      form.append('description', description.trim());
      if (proofFile) form.append('proof', proofFile);

      const res = await apiRequest<{ message: string }>('/api/admin/finance/expenses', {
        method: 'POST',
        body: form,
      });
      showToast(res.message, 'success');
      setModalOpen(false);
      setRecipientName('');
      setAmount('');
      setDescription('');
      setProofFile(null);
      loadData();
      onBalanceChange?.();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleChairmanDecision = async (row: any, decision: 'approved' | 'rejected') => {
    const ok = await confirm({
      title: decision === 'approved' ? 'Setujui Pengeluaran Kas?' : 'Tolak Pengeluaran Kas?',
      message: `${row.transactionNumber} — ${row.categoryName} senilai ${formatRupiah(row.amount)} untuk ${row.recipientName}.`,
      confirmLabel: decision === 'approved' ? 'Setujui & Kurangi Kas' : 'Tolak Pengeluaran',
      danger: decision === 'rejected',
    });
    if (!ok) return;

    try {
      const res = await apiRequest<{ message: string }>(
        `/api/admin/finance/expenses/${row.id}/approve`,
        {
          method: 'POST',
          body: JSON.stringify({ decision }),
        },
      );
      showToast(res.message, 'success');
      loadData();
      onBalanceChange?.();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleCancel = async (row: any) => {
    const ok = await confirm({
      title: 'Batalkan Pengeluaran?',
      message: `Transaksi ${row.transactionNumber} akan ditandai Dibatalkan dengan audit log.`,
      confirmLabel: 'Ya, Batalkan',
      danger: true,
    });
    if (!ok) return;
    try {
      await apiRequest(`/api/admin/finance/expenses/${row.id}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ note: 'Dibatalkan oleh pengurus' }),
      });
      showToast('Pengeluaran dibatalkan.', 'success');
      loadData();
      onBalanceChange?.();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#14221B]">
            Manajemen Pengeluaran Kas Masjid
          </h1>
          <p className="text-sm text-[#5F6F65] mt-1">
            Pengeluaran hanya menggunakan Saldo Kas Masjid ({formatRupiah(cashBalance)}). Dana Zakat tidak dapat digunakan.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold bg-[#064E3B] text-white rounded-lg hover:bg-emerald-800 whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          Input Pengeluaran
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white border border-[#E4DFD3] rounded-xl p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-[#5F6F65] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
            placeholder="Cari no. transaksi, penerima, atau keterangan..."
            className="w-full pl-9 pr-3 py-2 text-xs bg-[#FAF9F5] border border-[#E4DFD3] rounded-lg"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => {
            setPage(1);
            setStatusFilter(e.target.value);
          }}
          className="px-3 py-2 text-xs bg-[#FAF9F5] border border-[#E4DFD3] rounded-lg"
        >
          <option value="">Semua Status</option>
          <option value="pending_approval">Menunggu Persetujuan Ketua</option>
          <option value="approved">Disetujui</option>
          <option value="rejected">Ditolak</option>
          <option value="cancelled">Dibatalkan</option>
        </select>
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="px-3 py-2 text-xs bg-[#FAF9F5] border border-[#E4DFD3] rounded-lg"
        />
        <input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className="px-3 py-2 text-xs bg-[#FAF9F5] border border-[#E4DFD3] rounded-lg"
        />
      </div>

      {/* Table */}
      <div className="bg-white border border-[#E4DFD3] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-[#FAF9F5] border-b border-[#E4DFD3] text-xs text-[#5F6F65]">
              <tr>
                <th className="px-4 py-3">No. Transaksi</th>
                <th className="px-4 py-3">Tanggal</th>
                <th className="px-4 py-3">Kategori</th>
                <th className="px-4 py-3">Penerima</th>
                <th className="px-4 py-3">Keterangan</th>
                <th className="px-4 py-3 text-right">Nominal</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EFECE4]">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-[#5F6F65]">
                    Memuat data pengeluaran...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-[#5F6F65]">
                    Belum ada transaksi pengeluaran.
                  </td>
                </tr>
              ) : (
                items.map((row) => (
                  <tr key={row.id} className="hover:bg-[#FAF9F5]">
                    <td className="px-4 py-3 font-mono text-xs">{row.transactionNumber}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{formatDateIndo(row.transactionDate)}</td>
                    <td className="px-4 py-3 font-medium">{row.categoryName}</td>
                    <td className="px-4 py-3">{row.recipientName}</td>
                    <td className="px-4 py-3 text-xs text-[#4A5A51]">
                      {row.description} · {getPaymentMethodLabel(row.paymentMethod)}
                      {row.proofUrl && (
                        <>
                          {' · '}
                          <a href={row.proofUrl} target="_blank" rel="noreferrer" className="text-[#064E3B] underline">
                            Bukti
                          </a>
                        </>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold tabular-nums">
                      {formatRupiah(row.amount)}
                    </td>
                    <td className="px-4 py-3 text-xs font-semibold">
                      <span
                        className={
                          row.transactionStatus === 'approved'
                            ? 'text-emerald-700'
                            : row.transactionStatus === 'rejected' || row.transactionStatus === 'cancelled'
                              ? 'text-red-700'
                              : 'text-[#8C6826]'
                        }
                      >
                        {getStatusLabel(row.transactionStatus)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap space-x-2">
                      {isKetua && row.transactionStatus === 'pending_approval' && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleChairmanDecision(row, 'approved')}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-[#064E3B] text-white rounded"
                          >
                            <Check className="w-3 h-3" /> Setujui
                          </button>
                          <button
                            type="button"
                            onClick={() => handleChairmanDecision(row, 'rejected')}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold border border-red-300 text-red-700 rounded"
                          >
                            <X className="w-3 h-3" /> Tolak
                          </button>
                        </>
                      )}
                      {row.transactionStatus !== 'cancelled' && row.transactionStatus !== 'rejected' && (
                        <button
                          type="button"
                          onClick={() => handleCancel(row)}
                          className="inline-flex items-center gap-1 text-xs text-red-700 hover:underline"
                        >
                          <Ban className="w-3.5 h-3.5" /> Batalkan
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="px-4 py-3 border-t border-[#EFECE4] flex items-center justify-between text-xs text-[#5F6F65]">
          <span>Total {total} transaksi</span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="px-3 py-1 border border-[#E4DFD3] rounded disabled:opacity-40"
            >
              Sebelumnya
            </button>
            <button
              type="button"
              disabled={page * 15 >= total}
              onClick={() => setPage((p) => p + 1)}
              className="px-3 py-1 border border-[#E4DFD3] rounded disabled:opacity-40"
            >
              Berikutnya
            </button>
          </div>
        </div>
      </div>

      {/* Modal Input Pengeluaran */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
          <div className="bg-white border border-[#E4DFD3] rounded-2xl max-w-lg w-full p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-lg font-bold text-[#14221B]">Input Pengeluaran Kas</h2>
              <button type="button" onClick={() => setModalOpen(false)}>
                <X className="w-5 h-5 text-[#5F6F65]" />
              </button>
            </div>

            <div className="mb-4 px-3.5 py-2.5 bg-[#FAF9F5] border border-[#E4DFD3] rounded-lg text-xs text-[#4A5A51]">
              Saldo Kas Masjid Tersedia:{' '}
              <strong className="font-mono text-[#064E3B]">{formatRupiah(cashBalance)}</strong>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#4A5A51] mb-1">Tanggal</label>
                  <input
                    type="date"
                    required
                    value={txDate}
                    onChange={(e) => setTxDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-[#E4DFD3] rounded-lg bg-[#FAF9F5]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#4A5A51] mb-1">Kategori</label>
                  <select
                    value={categoryName}
                    onChange={(e) => setCategoryName(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-[#E4DFD3] rounded-lg bg-[#FAF9F5]"
                  >
                    {EXPENSE_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#4A5A51] mb-1">
                    Penerima Pembayaran *
                  </label>
                  <input
                    type="text"
                    required
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    placeholder="PLN / Toko Bangunan / Marbot"
                    className="w-full px-3 py-2 text-sm border border-[#E4DFD3] rounded-lg bg-[#FAF9F5]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#4A5A51] mb-1">
                    Nominal (IDR) *
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono border border-[#E4DFD3] rounded-lg bg-[#FAF9F5]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#4A5A51] mb-1">
                  Metode Pembayaran
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-[#E4DFD3] rounded-lg bg-[#FAF9F5]"
                >
                  <option value="cash">Tunai Kas</option>
                  <option value="bank_transfer">Transfer Bank</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#4A5A51] mb-1">
                  Keterangan *
                </label>
                <textarea
                  required
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Rincian kebutuhan pengeluaran"
                  className="w-full px-3 py-2 text-sm border border-[#E4DFD3] rounded-lg bg-[#FAF9F5]"
                />
              </div>

              <label className="flex items-center gap-2 px-3 py-2 border border-dashed border-[#C7C0B0] rounded-lg bg-[#FAF9F5] cursor-pointer text-xs text-[#4A5A51]">
                <Upload className="w-4 h-4 text-[#064E3B]" />
                <span>{proofFile ? proofFile.name : 'Unggah nota / bukti pengeluaran (opsional)'}</span>
                <input
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp,.pdf"
                  className="hidden"
                  onChange={(e) => setProofFile(e.target.files?.[0] || null)}
                />
              </label>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold border border-[#E4DFD3] rounded-lg"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 text-xs font-semibold bg-[#064E3B] text-white rounded-lg hover:bg-emerald-800 disabled:opacity-60"
                >
                  {submitting ? 'Menyimpan...' : isKetua ? 'Simpan & Sahkan' : 'Ajukan ke Ketua DKM'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
