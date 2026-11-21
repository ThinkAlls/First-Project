import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Edit3,
  Landmark,
  Plus,
  QrCode,
  Smartphone,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { apiRequest } from '../../services/api.ts';
import { useToast } from '../../context/ToastContext.tsx';
import { MosquePaymentMethod } from '../../types/index.ts';
import { validateQrisPayload } from '../../utils/qris.ts';
import { decodeQrFromFile } from '../../utils/qrDecode.ts';

const BANK_SUGGESTIONS = [
  'Bank Syariah Indonesia (BSI)',
  'Bank Muamalat',
  'BCA Syariah',
  'BRI',
  'Bank Mandiri',
  'BCA',
  'BNI',
];

const EWALLET_SUGGESTIONS = ['DANA', 'GoPay', 'OVO', 'ShopeePay', 'LinkAja', 'QRIS Nasional'];

const PROGRAM_SCOPE_LABELS: Record<string, string> = {
  all: 'Semua Program (Zakat, Infak & Sedekah)',
  zakat: 'Khusus Zakat',
  infak: 'Khusus Infak',
  sedekah: 'Khusus Sedekah',
};

export function AdminPaymentMethodsPage() {
  const { showToast, confirm } = useToast();
  const [items, setItems] = useState<MosquePaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<'all' | 'bank_transfer' | 'e_wallet'>('all');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MosquePaymentMethod | null>(null);
  const [saving, setSaving] = useState(false);
  const [decodingQr, setDecodingQr] = useState(false);

  // Form state
  const [accountType, setAccountType] = useState<'bank_transfer' | 'e_wallet'>('bank_transfer');
  const [providerName, setProviderName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountHolder, setAccountHolder] = useState('');
  const [programScope, setProgramScope] = useState<'all' | 'zakat' | 'infak' | 'sedekah'>('all');
  const [paymentLink, setPaymentLink] = useState('');
  const [qrisPayload, setQrisPayload] = useState('');
  const [qrisMerchantName, setQrisMerchantName] = useState('');
  const [notes, setNotes] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [qrFile, setQrFile] = useState<File | null>(null);
  const [existingQrUrl, setExistingQrUrl] = useState('');
  const [previewQrObjectUrl, setPreviewQrObjectUrl] = useState('');

  const loadMethods = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiRequest<{ items: MosquePaymentMethod[] }>(
        '/api/admin/system/payment-methods',
      );
      setItems(res.items || []);
    } catch (err: any) {
      showToast(err.message || 'Gagal memuat metode pembayaran.', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadMethods();
  }, [loadMethods]);

  useEffect(() => {
    return () => {
      if (previewQrObjectUrl) URL.revokeObjectURL(previewQrObjectUrl);
    };
  }, [previewQrObjectUrl]);

  const resetForm = () => {
    setEditingItem(null);
    setAccountType('bank_transfer');
    setProviderName('');
    setAccountNumber('');
    setAccountHolder('');
    setProgramScope('all');
    setPaymentLink('');
    setQrisPayload('');
    setQrisMerchantName('');
    setNotes('');
    setIsActive(true);
    setQrFile(null);
    setExistingQrUrl('');
    if (previewQrObjectUrl) {
      URL.revokeObjectURL(previewQrObjectUrl);
      setPreviewQrObjectUrl('');
    }
  };

  const openCreateModal = () => {
    resetForm();
    setModalOpen(true);
  };

  const openEditModal = (item: MosquePaymentMethod) => {
    resetForm();
    setEditingItem(item);
    setAccountType(item.accountType);
    setProviderName(item.providerName);
    setAccountNumber(item.accountNumber || '');
    setAccountHolder(item.accountHolder || '');
    setProgramScope(item.programScope || 'all');
    setPaymentLink(item.paymentLink || '');
    setQrisPayload(item.qrisPayload || '');
    setQrisMerchantName(item.qrisMerchantName || '');
    setNotes(item.notes || '');
    setIsActive(item.isActive);
    setExistingQrUrl(item.qrCodeUrl || '');
    setModalOpen(true);
  };

  const handleQrFileChange = async (file: File | null) => {
    if (previewQrObjectUrl) {
      URL.revokeObjectURL(previewQrObjectUrl);
      setPreviewQrObjectUrl('');
    }
    setQrFile(file);
    if (!file) return;

    const objUrl = URL.createObjectURL(file);
    setPreviewQrObjectUrl(objUrl);

    setDecodingQr(true);
    try {
      const decoded = await decodeQrFromFile(file);
      if (decoded.inspection?.kind === 'emv_qris' && decoded.inspection.info.valid) {
        setQrisPayload(decoded.inspection.info.raw);
        setQrisMerchantName(decoded.inspection.info.merchantName || '');
        showToast(
          `QRIS EMVCo valid terdeteksi (${decoded.inspection.info.merchantName || decoded.inspection.info.acquirerLabel}).`,
          'success',
        );
      } else if (decoded.inspection?.kind === 'ewallet_url') {
        setPaymentLink(decoded.inspection.url);
        showToast(`Tautan resmi ${decoded.inspection.provider} terdeteksi dari gambar QR.`, 'success');
      } else if (decoded.decodedText) {
        showToast(
          'Gambar QR terpilih, namun bukan format EMVCo QRIS maupun tautan HTTPS resmi e-wallet.',
          'error',
        );
      } else {
        showToast(
          'Gambar QR terpasang. Pastikan gambar jelas atau tempel payload EMVCo QRIS jika ingin nominal terisi otomatis.',
          'success',
        );
      }
    } catch (err: any) {
      showToast(err.message || 'Gagal membaca gambar QR.', 'error');
    } finally {
      setDecodingQr(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!providerName.trim()) {
      showToast('Nama penyedia (Bank atau E-Wallet) wajib diisi.', 'error');
      return;
    }
    if (!accountNumber.trim() && !qrFile && !existingQrUrl && !qrisPayload.trim()) {
      showToast('Isi nomor rekening/e-wallet atau unggah gambar kode QR.', 'error');
      return;
    }

    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('accountType', accountType);
      fd.append('providerName', providerName.trim());
      fd.append('accountNumber', accountNumber.trim());
      fd.append('accountHolder', accountHolder.trim());
      fd.append('programScope', programScope);
      fd.append('paymentLink', paymentLink.trim());
      fd.append('qrisPayload', qrisPayload.trim());
      fd.append('qrisMerchantName', qrisMerchantName.trim());
      fd.append('notes', notes.trim());
      fd.append('isActive', String(isActive));
      if (!qrFile && existingQrUrl) {
        fd.append('qrCodeUrl', existingQrUrl);
      }
      if (qrFile) {
        fd.append('qrCode', qrFile);
      }

      if (editingItem) {
        const res = await apiRequest<{ message: string }>(
          `/api/admin/system/payment-methods/${editingItem.id}`,
          { method: 'PUT', body: fd },
        );
        showToast(res.message, 'success');
      } else {
        const res = await apiRequest<{ message: string }>('/api/admin/system/payment-methods', {
          method: 'POST',
          body: fd,
        });
        showToast(res.message, 'success');
      }
      setModalOpen(false);
      resetForm();
      loadMethods();
    } catch (err: any) {
      showToast(err.message || 'Gagal menyimpan metode pembayaran.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (item: MosquePaymentMethod) => {
    try {
      const res = await apiRequest<{ message: string }>(
        `/api/admin/system/payment-methods/${item.id}/toggle`,
        { method: 'PATCH' },
      );
      showToast(res.message, 'success');
      loadMethods();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleDelete = async (item: MosquePaymentMethod) => {
    const ok = await confirm({
      title: 'Hapus Metode Pembayaran?',
      message: `${item.providerName} (${item.accountNumber || 'QR'}) akan dihapus permanen dari daftar pembayaran publik.`,
      confirmLabel: 'Hapus',
      danger: true,
    });
    if (!ok) return;

    try {
      const res = await apiRequest<{ message: string }>(
        `/api/admin/system/payment-methods/${item.id}`,
        { method: 'DELETE' },
      );
      showToast(res.message, 'success');
      loadMethods();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const stats = useMemo(() => {
    const active = items.filter((i) => i.isActive);
    return {
      totalActive: active.length,
      bankCount: active.filter((i) => i.accountType === 'bank_transfer').length,
      walletCount: active.filter((i) => i.accountType === 'e_wallet').length,
      qrReadyCount: active.filter((i) => Boolean(i.qrCodeUrl || i.qrisPayload)).length,
    };
  }, [items]);

  const filteredItems = useMemo(() => {
    if (filterType === 'all') return items;
    return items.filter((i) => i.accountType === filterType);
  }, [items, filterType]);

  const qrisCheck = qrisPayload.trim() ? validateQrisPayload(qrisPayload) : null;
  const activePreviewUrl = previewQrObjectUrl || existingQrUrl;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#14221B]">
            Metode Pembayaran Masjid
          </h1>
          <p className="text-sm text-[#5F6F65] mt-1">
            Kelola daftar rekening Transfer Bank, akun E-Wallet, dan gambar QR Code resmi yang tampil di halaman pembayaran publik.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold bg-[#064E3B] text-white rounded-lg hover:bg-emerald-800 whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Tambah Metode Pembayaran</span>
        </button>
      </div>

      {/* 4 Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-[#E4DFD3] rounded-xl p-4">
          <div className="text-xs text-[#5F6F65]">Total Metode Aktif</div>
          <div className="font-mono text-2xl font-bold text-[#064E3B] tabular-nums mt-1">
            {stats.totalActive}
          </div>
        </div>
        <div className="bg-white border border-[#E4DFD3] rounded-xl p-4">
          <div className="text-xs text-[#5F6F65]">Transfer Bank Aktif</div>
          <div className="font-mono text-2xl font-bold text-[#14221B] tabular-nums mt-1">
            {stats.bankCount}
          </div>
        </div>
        <div className="bg-white border border-[#E4DFD3] rounded-xl p-4">
          <div className="text-xs text-[#5F6F65]">E-Wallet Aktif</div>
          <div className="font-mono text-2xl font-bold text-[#14221B] tabular-nums mt-1">
            {stats.walletCount}
          </div>
        </div>
        <div className="bg-white border border-[#E4DFD3] rounded-xl p-4">
          <div className="text-xs text-[#5F6F65]">Terintegrasi QR Code</div>
          <div className="font-mono text-2xl font-bold text-[#8C6826] tabular-nums mt-1">
            {stats.qrReadyCount}
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 p-1 bg-white border border-[#E4DFD3] rounded-xl">
          {[
            { id: 'all', label: `Semua (${items.length})` },
            {
              id: 'bank_transfer',
              label: `Transfer Bank (${items.filter((i) => i.accountType === 'bank_transfer').length})`,
            },
            {
              id: 'e_wallet',
              label: `E-Wallet (${items.filter((i) => i.accountType === 'e_wallet').length})`,
            },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterType(tab.id as any)}
              className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                filterType === tab.id
                  ? 'bg-[#064E3B] text-white'
                  : 'text-[#4A5A51] hover:text-[#14221B]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Payment Methods List */}
      <div className="bg-white border border-[#E4DFD3] rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-3">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-14 bg-[#FAF9F5] rounded-lg animate-pulse" />
            ))}
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="p-10 text-center space-y-3">
            <QrCode className="w-10 h-10 text-[#C7C0B0] mx-auto" />
            <div className="font-display text-base font-bold text-[#14221B]">
              Belum ada metode pembayaran
            </div>
            <p className="text-xs text-[#5F6F65] max-w-md mx-auto">
              Tambahkan rekening Transfer Bank atau akun E-Wallet (DANA, GoPay, OVO, ShopeePay, QRIS) beserta gambar QR Code agar donatur dapat memilihnya di halaman publik.
            </p>
            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-[#064E3B] text-white rounded-lg"
            >
              <Plus className="w-3.5 h-3.5" />
              Tambah Metode Pertama
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-[#FAF9F5] border-b border-[#E4DFD3] text-[#5F6F65]">
                <tr>
                  <th className="px-4 py-3 font-semibold">Tipe & Penyedia</th>
                  <th className="px-4 py-3 font-semibold">Nomor Rekening / E-Wallet</th>
                  <th className="px-4 py-3 font-semibold">Program</th>
                  <th className="px-4 py-3 font-semibold">QR Code</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EFECE4]">
                {filteredItems.map((item) => {
                  const hasValidQris = Boolean(
                    item.qrisPayload && validateQrisPayload(item.qrisPayload).valid,
                  );
                  return (
                    <tr key={item.id} className="hover:bg-[#FAF9F5]/60">
                      <td className="px-4 py-3.5">
                        <div className="flex items-start gap-2.5">
                          <div className="p-2 rounded-lg bg-[#FAF9F5] border border-[#E4DFD3] text-[#064E3B] shrink-0">
                            {item.accountType === 'bank_transfer' ? (
                              <Landmark className="w-4 h-4" />
                            ) : (
                              <Smartphone className="w-4 h-4" />
                            )}
                          </div>
                          <div>
                            <div className="font-semibold text-[#14221B] text-sm">
                              {item.providerName}
                            </div>
                            <div className="text-[11px] text-[#5F6F65]">
                              {item.accountType === 'bank_transfer' ? 'Transfer Bank' : 'E-Wallet'}
                              {item.accountHolder ? ` · a.n. ${item.accountHolder}` : ''}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 font-mono text-sm font-semibold text-[#064E3B] tabular-nums">
                        {item.accountNumber || '-'}
                      </td>
                      <td className="px-4 py-3.5 text-[#4A5A51]">
                        {PROGRAM_SCOPE_LABELS[item.programScope] || item.programScope}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2.5">
                          {item.qrCodeUrl && (
                            <img
                              src={item.qrCodeUrl}
                              alt={`QR ${item.providerName}`}
                              referrerPolicy="no-referrer"
                              className="w-10 h-10 object-cover rounded border border-[#E4DFD3] bg-white shrink-0"
                            />
                          )}
                          <div className="text-[11px]">
                            {hasValidQris ? (
                              <span className="font-semibold text-emerald-700">
                                QRIS EMVCo Dinamis
                                {item.qrisMerchantName ? ` · ${item.qrisMerchantName}` : ''}
                              </span>
                            ) : item.qrCodeUrl ? (
                              <span className="font-medium text-[#14221B]">Gambar QR Tersedia</span>
                            ) : (
                              <span className="text-[#5F6F65]">Tanpa QR</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <button
                          type="button"
                          onClick={() => handleToggleActive(item)}
                          className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg border transition-colors ${
                            item.isActive
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100'
                              : 'bg-[#FAF9F5] border-[#E4DFD3] text-[#5F6F65] hover:text-[#14221B]'
                          }`}
                        >
                          {item.isActive ? 'Aktif (Tampil Publik)' : 'Nonaktif'}
                        </button>
                      </td>
                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => openEditModal(item)}
                            className="p-1.5 rounded-lg border border-[#E4DFD3] text-[#4A5A51] hover:text-[#064E3B] hover:border-[#064E3B]"
                            title="Edit metode pembayaran"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(item)}
                            className="p-1.5 rounded-lg border border-[#E4DFD3] text-[#4A5A51] hover:text-red-700 hover:border-red-300"
                            title="Hapus metode pembayaran"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-[#E4DFD3] rounded-2xl max-w-2xl w-full p-6 space-y-5 my-8">
            <div className="flex items-center justify-between border-b border-[#EFECE4] pb-3">
              <div>
                <h2 className="font-display text-lg font-bold text-[#14221B]">
                  {editingItem ? 'Edit Metode Pembayaran' : 'Tambah Metode Pembayaran Masjid'}
                </h2>
                <p className="text-xs text-[#5F6F65] mt-0.5">
                  Data yang aktif akan langsung muncul sebagai pilihan donatur di halaman pembayaran publik.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setModalOpen(false);
                  resetForm();
                }}
                className="p-1.5 rounded-lg text-[#5F6F65] hover:text-[#14221B]"
                aria-label="Tutup modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Account Type */}
              <div>
                <label className="block text-xs font-semibold text-[#4A5A51] mb-1.5">
                  Tipe Akun Pembayaran *
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    {
                      id: 'bank_transfer',
                      label: 'Transfer Bank',
                      sub: 'Rekening bank syariah / konvensional',
                      icon: Landmark,
                    },
                    {
                      id: 'e_wallet',
                      label: 'E-Wallet / QRIS',
                      sub: 'DANA, GoPay, OVO, ShopeePay, LinkAja',
                      icon: Smartphone,
                    },
                  ].map((opt) => {
                    const Icon = opt.icon;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setAccountType(opt.id as any)}
                        className={`p-3 rounded-xl border text-left flex items-start gap-2.5 transition-colors ${
                          accountType === opt.id
                            ? 'bg-[#064E3B] text-white border-[#064E3B]'
                            : 'bg-[#FAF9F5] text-[#14221B] border-[#E4DFD3] hover:border-[#064E3B]'
                        }`}
                      >
                        <Icon className="w-4 h-4 shrink-0 mt-0.5" />
                        <div>
                          <div className="text-xs font-bold">{opt.label}</div>
                          <div
                            className={`text-[11px] mt-0.5 ${
                              accountType === opt.id ? 'text-emerald-100' : 'text-[#5F6F65]'
                            }`}
                          >
                            {opt.sub}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Provider Name + Suggestions */}
              <div>
                <label className="block text-xs font-semibold text-[#4A5A51] mb-1">
                  Nama Penyedia / Provider ({accountType === 'bank_transfer' ? 'Bank' : 'E-Wallet'}) *
                </label>
                <input
                  type="text"
                  required
                  value={providerName}
                  onChange={(e) => setProviderName(e.target.value)}
                  placeholder={
                    accountType === 'bank_transfer'
                      ? 'Contoh: Bank Syariah Indonesia (BSI)'
                      : 'Contoh: DANA, GoPay, OVO, ShopeePay, QRIS'
                  }
                  className="w-full px-3.5 py-2 text-sm border border-[#E4DFD3] rounded-lg bg-[#FAF9F5]"
                />
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {(accountType === 'bank_transfer' ? BANK_SUGGESTIONS : EWALLET_SUGGESTIONS).map(
                    (s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setProviderName(s)}
                        className={`px-2.5 py-1 text-[11px] font-medium rounded-md border transition-colors ${
                          providerName === s
                            ? 'bg-[#064E3B] text-white border-[#064E3B]'
                            : 'bg-[#FAF9F5] text-[#4A5A51] border-[#E4DFD3] hover:border-[#064E3B]'
                        }`}
                      >
                        {s}
                      </button>
                    ),
                  )}
                </div>
              </div>

              {/* Account Number & Account Holder */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#4A5A51] mb-1">
                    {accountType === 'bank_transfer'
                      ? 'Nomor Rekening Bank'
                      : 'Nomor HP / ID E-Wallet'}
                  </label>
                  <input
                    type="text"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    placeholder={
                      accountType === 'bank_transfer' ? 'Contoh: 7123456789' : 'Contoh: 085774321223'
                    }
                    className="w-full px-3.5 py-2 text-sm font-mono border border-[#E4DFD3] rounded-lg bg-[#FAF9F5]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#4A5A51] mb-1">
                    Atas Nama Pemilik Akun
                  </label>
                  <input
                    type="text"
                    value={accountHolder}
                    onChange={(e) => setAccountHolder(e.target.value)}
                    placeholder="Contoh: DKM Masjid Agung Al-Ikhlas"
                    className="w-full px-3.5 py-2 text-sm border border-[#E4DFD3] rounded-lg bg-[#FAF9F5]"
                  />
                </div>
              </div>

              {/* Program Scope & Payment Link */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#4A5A51] mb-1">
                    Berlaku Untuk Program
                  </label>
                  <select
                    value={programScope}
                    onChange={(e) => setProgramScope(e.target.value as any)}
                    className="w-full px-3.5 py-2 text-sm border border-[#E4DFD3] rounded-lg bg-[#FAF9F5]"
                  >
                    <option value="all">Semua Program (Zakat, Infak & Sedekah)</option>
                    <option value="zakat">Khusus Program Zakat</option>
                    <option value="infak">Khusus Program Infak</option>
                    <option value="sedekah">Khusus Program Sedekah</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#4A5A51] mb-1">
                    Tautan Pembayaran E-Wallet (Opsional)
                  </label>
                  <input
                    type="url"
                    value={paymentLink}
                    onChange={(e) => setPaymentLink(e.target.value)}
                    placeholder="https://link.dana.id/..."
                    className="w-full px-3.5 py-2 text-sm border border-[#E4DFD3] rounded-lg bg-[#FAF9F5]"
                  />
                </div>
              </div>

              {/* Upload QR Code + EMVCo Auto-Decoder */}
              <div className="bg-[#FAF9F5] border border-[#E4DFD3] rounded-xl p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-xs font-bold text-[#064E3B]">
                      Unggah Gambar Kode QR / QRIS Resmi
                    </div>
                    <p className="text-[11px] text-[#5F6F65] mt-0.5">
                      Gambar QR dari DANA, GoPay, OVO, ShopeePay, atau Bank akan dibaca otomatis agar QRIS tetap bisa dipindai ulang oleh e-wallet donatur.
                    </p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 items-start">
                  <label className="flex-1 w-full flex items-center justify-center gap-2 px-4 py-3 border border-dashed border-[#C7C0B0] rounded-lg bg-white cursor-pointer text-xs font-medium text-[#14221B] hover:border-[#064E3B]">
                    <Upload className="w-4 h-4 text-[#064E3B] shrink-0" />
                    <span className="truncate">
                      {decodingQr
                        ? 'Membaca kode QR...'
                        : qrFile
                          ? qrFile.name
                          : existingQrUrl
                            ? 'Ganti Gambar QR Code'
                            : 'Pilih Gambar QR Code (JPG/PNG/WebP)'}
                    </span>
                    <input
                      type="file"
                      accept=".jpg,.jpeg,.png,.webp"
                      className="hidden"
                      onChange={(e) => handleQrFileChange(e.target.files?.[0] || null)}
                    />
                  </label>

                  {activePreviewUrl && (
                    <div className="flex items-center gap-2 shrink-0">
                      <img
                        src={activePreviewUrl}
                        alt="Pratinjau QR"
                        referrerPolicy="no-referrer"
                        className="w-16 h-16 object-contain rounded-lg border border-[#E4DFD3] bg-white p-1"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setQrFile(null);
                          setExistingQrUrl('');
                          if (previewQrObjectUrl) {
                            URL.revokeObjectURL(previewQrObjectUrl);
                            setPreviewQrObjectUrl('');
                          }
                        }}
                        className="text-[11px] text-red-700 hover:underline"
                      >
                        Hapus QR
                      </button>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[#4A5A51] mb-1">
                    Payload QRIS EMVCo (Terisi otomatis dari gambar QRIS, atau tempel manual)
                  </label>
                  <textarea
                    rows={2}
                    value={qrisPayload}
                    onChange={(e) => {
                      const raw = e.target.value;
                      setQrisPayload(raw);
                      const info = validateQrisPayload(raw);
                      if (info.valid && info.merchantName) {
                        setQrisMerchantName(info.merchantName);
                      }
                    }}
                    placeholder="00020101021126...6304XXXX"
                    className="w-full px-3 py-2 text-xs font-mono border border-[#E4DFD3] rounded-lg bg-white"
                  />
                  {qrisCheck && qrisCheck.valid && (
                    <div className="mt-1.5 flex items-start gap-1.5 text-xs text-emerald-800">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 shrink-0 mt-0.5" />
                      <span>
                        EMVCo QRIS Valid · Merchant: <strong>{qrisCheck.merchantName || '-'}</strong> · Penerbit: {qrisCheck.acquirerLabel}
                      </span>
                    </div>
                  )}
                  {qrisCheck && !qrisCheck.valid && (
                    <div className="mt-1.5 flex items-start gap-1.5 text-xs text-red-700">
                      <AlertCircle className="w-3.5 h-3.5 text-red-600 shrink-0 mt-0.5" />
                      <span>{qrisCheck.reason}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                <div>
                  <label className="block text-xs font-semibold text-[#4A5A51] mb-1">
                    Catatan Instruksi (Opsional)
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Contoh: Khusus donasi operasional & infak Jumat"
                    className="w-full px-3.5 py-2 text-sm border border-[#E4DFD3] rounded-lg bg-[#FAF9F5]"
                  />
                </div>
                <label className="flex items-center gap-2 text-xs font-semibold text-[#14221B] pt-4 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="w-4 h-4 accent-[#064E3B] rounded"
                  />
                  <span>Tampilkan metode ini di halaman pembayaran publik</span>
                </label>
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-[#EFECE4]">
                <button
                  type="button"
                  onClick={() => {
                    setModalOpen(false);
                    resetForm();
                  }}
                  className="px-4 py-2 text-xs font-semibold border border-[#E4DFD3] text-[#4A5A51] rounded-lg hover:text-[#14221B]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving || decodingQr}
                  className="px-5 py-2 text-xs font-semibold bg-[#064E3B] text-white rounded-lg hover:bg-emerald-800 disabled:opacity-60"
                >
                  {saving
                    ? 'Menyimpan...'
                    : editingItem
                      ? 'Simpan Perubahan'
                      : 'Simpan Metode Pembayaran'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
