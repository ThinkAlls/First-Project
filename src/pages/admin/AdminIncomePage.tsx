import React, { useCallback, useEffect, useState } from 'react';
import { Ban, Plus, Search, Upload, X } from 'lucide-react';
import { apiRequest } from '../../services/api.ts';
import { useToast } from '../../context/ToastContext.tsx';
import {
  formatDateIndo,
  formatRupiah,
  getFundLabel,
  getPaymentMethodLabel,
  getStatusLabel,
} from '../../utils/format.ts';

const INCOME_CATEGORIES = [
  'Infak',
  'Sedekah',
  'Donasi Umum',
  'Kotak Amal',
  'Sumbangan Operasional',
  'Pemasukan Lainnya',
  'Zakat Fitrah',
  'Zakat Mal',
];

function previewTargetLedger(cat: string, manualFund: string): string {
  if (cat === 'Zakat Fitrah') return 'Dana Zakat Fitrah';
  if (cat === 'Zakat Mal') return 'Dana Zakat Mal';
  if (cat === 'Pemasukan Lainnya') return getFundLabel(manualFund);
  return 'Kas Masjid';
}

export function AdminIncomePage() {
  const { showToast, confirm } = useToast();
  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [fundFilter, setFundFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [txDate, setTxDate] = useState(new Date().toISOString().slice(0, 10));
  const [categoryName, setCategoryName] = useState('Infak');
  const [fundType, setFundType] = useState<'mosque_cash' | 'zakat_fitrah' | 'zakat_mal'>('mosque_cash');
  const [donorName, setDonorName] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [description, setDescription] = useState('');
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ page: String(page), limit: '15' });
      if (search) q.set('search', search);
      if (fundFilter) q.set('fundType', fundFilter);
      if (startDate) q.set('startDate', startDate);
      if (endDate) q.set('endDate', endDate);
      const res = await apiRequest<{ items: any[]; total: number }>(
        `/api/admin/finance/income?${q.toString()}`,
      );
      setItems(res.items);
      setTotal(res.total);
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [page, search, fundFilter, startDate, endDate, showToast]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const form = new FormData();
      form.append('transactionDate', txDate);
      form.append('categoryName', categoryName);
      form.append('fundType', fundType);
      if (donorName.trim()) form.append('donorName', donorName.trim());
      form.append('amount', amount);
      form.append('paymentMethod', paymentMethod);
      form.append('description', description.trim());
      if (proofFile) form.append('proof', proofFile);

      const res = await apiRequest<{ message: string }>('/api/admin/finance/income', {
        method: 'POST',
        body: form,
      });
      showToast(res.message, 'success');
      setModalOpen(false);
      setAmount('');
      setDonorName('');
      setDescription('');
      setProofFile(null);
      loadItems();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async (row: any) => {
    const ok = await confirm({
      title: 'Batalkan Transaksi Pemasukan?',
      message: `Transaksi ${row.transactionNumber} (${formatRupiah(row.amount)}) tidak akan dihapus permanen melainkan ditandai Dibatalkan dengan audit log.`,
      confirmLabel: 'Ya, Batalkan Transaksi',
      danger: true,
    });
    if (!ok) return;
    try {
      await apiRequest(`/api/admin/finance/income/${row.id}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ note: 'Dibatalkan oleh pengurus melalui menu Pemasukan' }),
      });
      showToast('Transaksi dibatalkan dan dicatat di audit log.', 'success');
      loadItems();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#14221B]">
            Manajemen Pemasukan Manual
          </h1>
          <p className="text-sm text-[#5F6F65] mt-1">
            Sistem otomatis memisahkan Infak/Sedekah/Donasi ke Kas Masjid dan Zakat ke pembukuan Zakat.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold bg-[#064E3B] text-white rounded-lg hover:bg-emerald-800 whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          Input Pemasukan Manual
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
            placeholder="Cari no. transaksi, keterangan, atau donatur..."
            className="w-full pl-9 pr-3 py-2 text-xs bg-[#FAF9F5] border border-[#E4DFD3] rounded-lg"
          />
        </div>
        <select
          value={fundFilter}
          onChange={(e) => {
            setPage(1);
            setFundFilter(e.target.value);
          }}
          className="px-3 py-2 text-xs bg-[#FAF9F5] border border-[#E4DFD3] rounded-lg"
        >
          <option value="">Semua Pembukuan</option>
          <option value="mosque_cash">Kas Masjid</option>
          <option value="zakat_fitrah">Dana Zakat Fitrah</option>
          <option value="zakat_mal">Dana Zakat Mal</option>
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
                <th className="px-4 py-3">Pembukuan</th>
                <th className="px-4 py-3">Kategori</th>
                <th className="px-4 py-3">Pemberi Dana</th>
                <th className="px-4 py-3">Keterangan</th>
                <th className="px-4 py-3 text-right">Nominal</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EFECE4]">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-[#5F6F65]">
                    Memuat data pemasukan...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-[#5F6F65]">
                    Belum ada transaksi pemasukan yang sesuai filter.
                  </td>
                </tr>
              ) : (
                items.map((row) => (
                  <tr key={row.id} className="hover:bg-[#FAF9F5]">
                    <td className="px-4 py-3 font-mono text-xs">{row.transactionNumber}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{formatDateIndo(row.transactionDate)}</td>
                    <td className="px-4 py-3 font-medium text-[#064E3B]">{getFundLabel(row.fundType)}</td>
                    <td className="px-4 py-3">{row.categoryName}</td>
                    <td className="px-4 py-3">{row.donorName || '-'}</td>
                    <td className="px-4 py-3 text-xs text-[#4A5A51]">
                      {row.description} · {getPaymentMethodLabel(row.paymentMethod)}
                      {row.proofUrl && (
                        <>
                          {' · '}
                          <a
                            href={row.proofUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[#064E3B] underline"
                          >
                            Lihat Bukti
                          </a>
                        </>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold tabular-nums">
                      {formatRupiah(row.amount)}
                    </td>
                    <td className="px-4 py-3 text-xs font-medium">
                      {getStatusLabel(row.transactionStatus)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {row.transactionStatus !== 'cancelled' && (
                        <button
                          type="button"
                          onClick={() => handleCancel(row)}
                          className="inline-flex items-center gap-1 text-xs text-red-700 hover:underline"
                        >
                          <Ban className="w-3.5 h-3.5" />
                          Batalkan
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
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

      {/* Modal Input Pemasukan Manual */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
          <div className="bg-white border border-[#E4DFD3] rounded-2xl max-w-lg w-full p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-lg font-bold text-[#14221B]">
                Input Pemasukan Manual
              </h2>
              <button type="button" onClick={() => setModalOpen(false)}>
                <X className="w-5 h-5 text-[#5F6F65]" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
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
                    {INCOME_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {categoryName === 'Pemasukan Lainnya' && (
                <div>
                  <label className="block text-xs font-semibold text-[#4A5A51] mb-1">
                    Tujuan Pembukuan Dana
                  </label>
                  <select
                    value={fundType}
                    onChange={(e) => setFundType(e.target.value as any)}
                    className="w-full px-3 py-2 text-sm border border-[#E4DFD3] rounded-lg bg-[#FAF9F5]"
                  >
                    <option value="mosque_cash">Kas Masjid</option>
                    <option value="zakat_fitrah">Dana Zakat Fitrah</option>
                    <option value="zakat_mal">Dana Zakat Mal</option>
                  </select>
                </div>
              )}

              <div className="px-3.5 py-2.5 bg-[#FAF9F5] border border-[#E4DFD3] rounded-lg text-xs text-[#4A5A51]">
                Pembukuan Tujuan:{' '}
                <strong className="text-[#064E3B]">{previewTargetLedger(categoryName, fundType)}</strong>
              </div>

              <div className="grid grid-cols-2 gap-3">
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
                <div>
                  <label className="block text-xs font-semibold text-[#4A5A51] mb-1">
                    Metode Pembayaran
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-[#E4DFD3] rounded-lg bg-[#FAF9F5]"
                  >
                    <option value="cash">Tunai / Kotak Amal</option>
                    <option value="bank_transfer">Transfer Bank</option>
                    <option value="qris">QRIS</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#4A5A51] mb-1">
                  Nama Pemberi Dana (Opsional)
                </label>
                <input
                  type="text"
                  value={donorName}
                  onChange={(e) => setDonorName(e.target.value)}
                  placeholder="Hamba Allah / Nama Jamaah"
                  className="w-full px-3 py-2 text-sm border border-[#E4DFD3] rounded-lg bg-[#FAF9F5]"
                />
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
                  placeholder="Contoh: Kotak amal Jumat pekan ke-3"
                  className="w-full px-3 py-2 text-sm border border-[#E4DFD3] rounded-lg bg-[#FAF9F5]"
                />
              </div>

              <div>
                <label className="flex items-center gap-2 px-3 py-2 border border-dashed border-[#C7C0B0] rounded-lg bg-[#FAF9F5] cursor-pointer text-xs text-[#4A5A51]">
                  <Upload className="w-4 h-4 text-[#064E3B]" />
                  <span>{proofFile ? proofFile.name : 'Unggah bukti transaksi (opsional)'}</span>
                  <input
                    type="file"
                    accept=".jpg,.jpeg,.png,.webp,.pdf"
                    className="hidden"
                    onChange={(e) => setProofFile(e.target.files?.[0] || null)}
                  />
                </label>
              </div>

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
                  {submitting ? 'Menyimpan...' : 'Simpan Pemasukan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
