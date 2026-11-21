import React, { useCallback, useEffect, useState } from 'react';
import { Plus, Upload, X } from 'lucide-react';
import { apiRequest } from '../../services/api.ts';
import { useToast } from '../../context/ToastContext.tsx';
import { formatDateIndo, formatRupiah } from '../../utils/format.ts';

const EIGHT_ASNAF = [
  'Fakir',
  'Miskin',
  'Amil',
  'Mualaf',
  'Riqab',
  'Gharim',
  'Fisabilillah',
  'Ibnu Sabil',
] as const;

export function AdminZakatDistributionPage() {
  const { showToast } = useToast();
  const [items, setItems] = useState<any[]>([]);
  const [fitrahBalance, setFitrahBalance] = useState(0);
  const [malBalance, setMalBalance] = useState(0);
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [distributionDate, setDistributionDate] = useState(new Date().toISOString().slice(0, 10));
  const [zakatType, setZakatType] = useState<'zakat_fitrah' | 'zakat_mal'>('zakat_fitrah');
  const [asnafCategory, setAsnafCategory] = useState<string>('Fakir');
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [distRes, dashRes] = await Promise.all([
        apiRequest<{ items: any[] }>('/api/admin/finance/zakat-distributions'),
        apiRequest<any>('/api/admin/finance/dashboard'),
      ]);
      setItems(distRes.items);
      setFitrahBalance(dashRes.balances.zakatFitrah.balance);
      setMalBalance(dashRes.balances.zakatMal.balance);
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const form = new FormData();
      form.append('distributionDate', distributionDate);
      form.append('zakatType', zakatType);
      form.append('asnafCategory', asnafCategory);
      form.append('recipientName', recipientName.trim());
      if (recipientPhone.trim()) form.append('recipientPhone', recipientPhone.trim());
      form.append('amount', amount);
      form.append('description', description.trim());
      if (proofFile) form.append('proof', proofFile);

      const res = await apiRequest<{ message: string }>('/api/admin/finance/zakat-distributions', {
        method: 'POST',
        body: form,
      });
      showToast(res.message, 'success');
      setModalOpen(false);
      setRecipientName('');
      setRecipientPhone('');
      setAmount('');
      setDescription('');
      setProofFile(null);
      loadData();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#14221B]">
            Distribusi Dana Zakat (8 Asnaf)
          </h1>
          <p className="text-sm text-[#5F6F65] mt-1">
            Penyaluran diperiksa terhadap saldo Zakat Fitrah atau Zakat Mal yang tersedia dan wajib sesuai delapan asnaf.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold bg-[#064E3B] text-white rounded-lg hover:bg-emerald-800 whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          Catat Penyaluran Zakat
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white border border-[#E4DFD3] rounded-xl p-5">
          <div className="text-xs text-[#5F6F65]">Saldo Zakat Fitrah Tersedia</div>
          <div className="font-mono text-2xl font-bold text-[#064E3B] tabular-nums mt-1">
            {formatRupiah(fitrahBalance)}
          </div>
        </div>
        <div className="bg-white border border-[#E4DFD3] rounded-xl p-5">
          <div className="text-xs text-[#5F6F65]">Saldo Zakat Mal Tersedia</div>
          <div className="font-mono text-2xl font-bold text-[#064E3B] tabular-nums mt-1">
            {formatRupiah(malBalance)}
          </div>
        </div>
      </div>

      <div className="bg-white border border-[#E4DFD3] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-[#FAF9F5] border-b border-[#E4DFD3] text-xs text-[#5F6F65]">
              <tr>
                <th className="px-4 py-3">No. Transaksi</th>
                <th className="px-4 py-3">Tanggal</th>
                <th className="px-4 py-3">Jenis Zakat</th>
                <th className="px-4 py-3">Asnaf</th>
                <th className="px-4 py-3">Penerima (Mustahik)</th>
                <th className="px-4 py-3">Keterangan</th>
                <th className="px-4 py-3 text-right">Nominal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EFECE4]">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-[#5F6F65]">
                    Memuat data penyaluran zakat...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-[#5F6F65]">
                    Belum ada penyaluran zakat tercatat.
                  </td>
                </tr>
              ) : (
                items.map((row) => (
                  <tr key={row.id} className="hover:bg-[#FAF9F5]">
                    <td className="px-4 py-3 font-mono text-xs">{row.transactionNumber}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{formatDateIndo(row.distributionDate)}</td>
                    <td className="px-4 py-3">
                      {row.zakatType === 'zakat_fitrah' ? 'Zakat Fitrah' : 'Zakat Mal'}
                    </td>
                    <td className="px-4 py-3 font-semibold text-[#064E3B]">{row.asnafCategory}</td>
                    <td className="px-4 py-3">
                      <div>{row.recipientName}</div>
                      {row.recipientPhone && (
                        <div className="text-xs font-mono text-[#5F6F65]">{row.recipientPhone}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-[#4A5A51]">
                      {row.description}
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
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
          <div className="bg-white border border-[#E4DFD3] rounded-2xl max-w-lg w-full p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-lg font-bold text-[#14221B]">
                Catat Penyaluran Zakat (8 Asnaf)
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
                    value={distributionDate}
                    onChange={(e) => setDistributionDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-[#E4DFD3] rounded-lg bg-[#FAF9F5]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#4A5A51] mb-1">Sumber Dana Zakat</label>
                  <select
                    value={zakatType}
                    onChange={(e) => setZakatType(e.target.value as any)}
                    className="w-full px-3 py-2 text-sm border border-[#E4DFD3] rounded-lg bg-[#FAF9F5]"
                  >
                    <option value="zakat_fitrah">Zakat Fitrah ({formatRupiah(fitrahBalance)})</option>
                    <option value="zakat_mal">Zakat Mal ({formatRupiah(malBalance)})</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#4A5A51] mb-1">Golongan Asnaf *</label>
                  <select
                    value={asnafCategory}
                    onChange={(e) => setAsnafCategory(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-[#E4DFD3] rounded-lg bg-[#FAF9F5]"
                  >
                    {EIGHT_ASNAF.map((a) => (
                      <option key={a} value={a}>
                        {a}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#4A5A51] mb-1">Nominal Bantuan (IDR) *</label>
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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#4A5A51] mb-1">Nama Penerima *</label>
                  <input
                    type="text"
                    required
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-[#E4DFD3] rounded-lg bg-[#FAF9F5]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#4A5A51] mb-1">Kontak (Opsional)</label>
                  <input
                    type="text"
                    value={recipientPhone}
                    onChange={(e) => setRecipientPhone(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono border border-[#E4DFD3] rounded-lg bg-[#FAF9F5]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#4A5A51] mb-1">Keterangan *</label>
                <textarea
                  required
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-[#E4DFD3] rounded-lg bg-[#FAF9F5]"
                />
              </div>

              <label className="flex items-center gap-2 px-3 py-2 border border-dashed border-[#C7C0B0] rounded-lg bg-[#FAF9F5] cursor-pointer text-xs text-[#4A5A51]">
                <Upload className="w-4 h-4 text-[#064E3B]" />
                <span>{proofFile ? proofFile.name : 'Unggah bukti penyerahan (opsional)'}</span>
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
                  {submitting ? 'Menyimpan...' : 'Simpan Penyaluran'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
