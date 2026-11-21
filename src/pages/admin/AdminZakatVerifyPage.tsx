import { useCallback, useEffect, useState } from 'react';
import { Check, ExternalLink, X } from 'lucide-react';
import { apiRequest } from '../../services/api.ts';
import { useToast } from '../../context/ToastContext.tsx';
import {
  formatDateTimeIndo,
  formatRupiah,
  getFundLabel,
  getPaymentMethodLabel,
  getStatusLabel,
} from '../../utils/format.ts';

export function AdminZakatVerifyPage({ onVerifiedChange }: { onVerifiedChange?: () => void }) {
  const { showToast } = useToast();
  const [items, setItems] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any | null>(null);
  const [note, setNote] = useState('');
  const [processing, setProcessing] = useState(false);

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const q = statusFilter ? `?status=${statusFilter}` : '';
      const res = await apiRequest<{ items: any[] }>(`/api/admin/finance/zakat${q}`);
      setItems(res.items);
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, showToast]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  const handleDecision = async (decision: 'verified' | 'rejected') => {
    if (!selected) return;
    setProcessing(true);
    try {
      const res = await apiRequest<{ message: string }>(
        `/api/admin/finance/zakat/${selected.id}/verify`,
        {
          method: 'POST',
          body: JSON.stringify({ decision, note }),
        },
      );
      showToast(res.message, 'success');
      setSelected(null);
      setNote('');
      loadList();
      onVerifiedChange?.();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#14221B]">
            Verifikasi Pembayaran Zakat & Donasi
          </h1>
          <p className="text-sm text-[#5F6F65] mt-1">
            Transaksi yang disetujui otomatis dicatat satu kali ke pembukuan Dana Zakat atau Kas Masjid sesuai jenisnya.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1 p-1 bg-white border border-[#E4DFD3] rounded-xl">
          {[
            { val: 'pending', label: 'Menunggu Verifikasi' },
            { val: 'waiting_payment', label: 'Menunggu Pembayaran' },
            { val: 'verified', label: 'Diterima' },
            { val: 'rejected', label: 'Ditolak' },
            { val: '', label: 'Semua' },
          ].map((tab) => (
            <button
              key={tab.label}
              type="button"
              onClick={() => setStatusFilter(tab.val)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap ${
                statusFilter === tab.val
                  ? 'bg-[#064E3B] text-white'
                  : 'text-[#5F6F65] hover:text-[#14221B]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white border border-[#E4DFD3] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-[#FAF9F5] border-b border-[#E4DFD3] text-xs text-[#5F6F65]">
              <tr>
                <th className="px-4 py-3">No. Transaksi & Tgl Pengajuan</th>
                <th className="px-4 py-3">Donatur / Muzaki</th>
                <th className="px-4 py-3">Jenis & Tujuan Dana</th>
                <th className="px-4 py-3">Metode & Bukti</th>
                <th className="px-4 py-3 text-right">Nominal</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EFECE4]">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-[#5F6F65]">
                    Memuat data transaksi...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-[#5F6F65]">
                    Tidak ada transaksi pada filter ini.
                  </td>
                </tr>
              ) : (
                items.map((row) => (
                  <tr key={row.id} className="hover:bg-[#FAF9F5]">
                    <td className="px-4 py-3 font-mono text-xs">
                      <div className="font-semibold text-[#14221B]">{row.transactionNumber}</div>
                      <div className="text-[11px] text-[#5F6F65]">{formatDateTimeIndo(row.createdAt)}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-[#14221B]">{row.donorName}</div>
                      <div className="text-xs font-mono text-[#5F6F65]">{row.whatsappNumber}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium uppercase text-xs">
                        {row.paymentType.replace('_', ' ')}
                        {row.paymentType === 'zakat_fitrah' && row.fitrahForm
                          ? ` (${row.fitrahForm === 'beras' ? 'Beras' : 'Uang'})`
                          : ''}
                      </div>
                      <div className="text-xs text-[#064E3B]">{getFundLabel(row.fundType)}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-xs font-medium text-[#14221B]">
                        {row.paymentMethodLabel || getPaymentMethodLabel(row.paymentMethod)}
                      </div>
                      <div className="text-[11px] mt-0.5">
                        {row.proofUrl ? (
                          <span className="text-emerald-700 font-medium">
                            Bukti ada{row.paymentDate ? ` · Tgl Bayar ${row.paymentDate}` : ''}
                          </span>
                        ) : (
                          <span className="text-[#5F6F65]">Belum ada bukti</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold tabular-nums">
                      {formatRupiah(row.amount)}
                    </td>
                    <td className="px-4 py-3 text-xs font-semibold">
                      <span
                        className={
                          row.transactionStatus === 'verified'
                            ? 'text-emerald-700'
                            : row.transactionStatus === 'rejected'
                              ? 'text-red-700'
                              : row.transactionStatus === 'waiting_payment'
                                ? 'text-[#5F6F65]'
                                : 'text-[#8C6826]'
                        }
                      >
                        {getStatusLabel(row.transactionStatus)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          setSelected(row);
                          setNote(row.verificationNote || '');
                        }}
                        className="px-3 py-1.5 text-xs font-semibold bg-[#FAF9F5] border border-[#E4DFD3] rounded-lg hover:border-[#064E3B]"
                      >
                        {row.transactionStatus === 'pending'
                          ? 'Periksa & Verifikasi'
                          : row.transactionStatus === 'waiting_payment'
                            ? 'Tinjau'
                            : 'Lihat Detail'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Verification Modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
          <div className="bg-white border border-[#E4DFD3] rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-[#14221B]">
                Detail Verifikasi {selected.transactionNumber}
              </h2>
              <button type="button" onClick={() => setSelected(null)}>
                <X className="w-5 h-5 text-[#5F6F65]" />
              </button>
            </div>

            <div className="bg-[#FAF9F5] border border-[#E4DFD3] rounded-xl p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-[#5F6F65]">Status Saat Ini</span>
                <span className="font-bold text-[#14221B]">
                  {getStatusLabel(selected.transactionStatus)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#5F6F65]">Nama</span>
                <span className="font-semibold">{selected.donorName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#5F6F65]">WhatsApp</span>
                <span className="font-mono">{selected.whatsappNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#5F6F65]">Jenis & Pembukuan Tujuan</span>
                <span className="font-semibold text-[#064E3B]">
                  {selected.paymentType.replace('_', ' ').toUpperCase()} · {getFundLabel(selected.fundType)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#5F6F65]">Metode Pembayaran</span>
                <span className="font-medium">
                  {selected.paymentMethodLabel || getPaymentMethodLabel(selected.paymentMethod)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#5F6F65]">Nominal</span>
                <span className="font-mono font-bold tabular-nums">{formatRupiah(selected.amount)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-[#5F6F65]">Tanggal Pengajuan</span>
                <span>{formatDateTimeIndo(selected.createdAt)}</span>
              </div>
              {selected.paymentDate && (
                <div className="flex justify-between text-xs">
                  <span className="text-[#5F6F65]">Tanggal Bayar Donatur</span>
                  <span className="font-mono font-semibold">{selected.paymentDate}</span>
                </div>
              )}
              {selected.notes && (
                <div className="pt-2 border-t border-[#E4DFD3] text-xs text-[#4A5A51]">
                  Catatan Donatur: {selected.notes}
                </div>
              )}
            </div>

            {selected.proofUrl ? (
              <div>
                <div className="flex items-center justify-between text-xs font-semibold text-[#4A5A51] mb-2">
                  <span>Bukti Pembayaran</span>
                  <a
                    href={selected.proofUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[#064E3B] hover:underline"
                  >
                    <span>Buka Penuh</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                {selected.proofUrl.endsWith('.pdf') ? (
                  <a
                    href={selected.proofUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="block p-4 border border-[#E4DFD3] rounded-lg text-xs text-[#064E3B] underline"
                  >
                    Unduh / Lihat Bukti PDF
                  </a>
                ) : (
                  <img
                    src={selected.proofUrl}
                    alt="Bukti Transfer"
                    referrerPolicy="no-referrer"
                    className="max-h-64 w-full object-contain rounded-lg border border-[#E4DFD3] bg-[#FAF9F5]"
                  />
                )}
              </div>
            ) : (
              <div className="text-xs text-[#5F6F65] bg-[#FAF9F5] p-3 rounded-lg border border-[#E4DFD3]">
                {selected.transactionStatus === 'waiting_payment'
                  ? 'Donatur belum menyelesaikan pembayaran dan belum mengunggah bukti pembayaran.'
                  : 'Tidak ada lampiran bukti (pembayaran tunai atau gateway otomatis).'}
              </div>
            )}

            {(selected.transactionStatus === 'pending' || selected.transactionStatus === 'waiting_payment') && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-[#4A5A51] mb-1">
                    Catatan Verifikasi (Opsional)
                  </label>
                  <textarea
                    rows={2}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Contoh: Dana telah masuk mutasi rekening masjid"
                    className="w-full px-3 py-2 text-sm border border-[#E4DFD3] rounded-lg bg-[#FAF9F5]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    disabled={processing}
                    onClick={() => handleDecision('rejected')}
                    className="inline-flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold border border-red-300 text-red-700 rounded-lg hover:bg-red-50 disabled:opacity-60"
                  >
                    <X className="w-4 h-4" />
                    Tolak
                  </button>
                  {(selected.transactionStatus === 'pending' || selected.paymentMethod === 'cash') && (
                    <button
                      type="button"
                      disabled={processing}
                      onClick={() => handleDecision('verified')}
                      className="inline-flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold bg-[#064E3B] text-white rounded-lg hover:bg-emerald-800 disabled:opacity-60"
                    >
                      <Check className="w-4 h-4" />
                      Setujui & Catat Dana
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
