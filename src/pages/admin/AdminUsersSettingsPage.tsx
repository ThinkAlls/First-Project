import React, { useCallback, useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, KeyRound, Plus, QrCode, Upload, X } from 'lucide-react';
import { apiRequest } from '../../services/api.ts';
import { useAuth } from '../../context/AuthContext.tsx';
import { useToast } from '../../context/ToastContext.tsx';
import { formatDateTimeIndo, getRoleLabel } from '../../utils/format.ts';
import {
  EwalletProvider,
  MosqueSettings,
  PaymentChannelConfig,
  PaymentChannelsMap,
} from '../../types/index.ts';
import { validateQrisPayload } from '../../utils/qris.ts';
import { decodeQrFromFile, decodeQrFromImageUrl } from '../../utils/qrDecode.ts';

// 1. Akun Pengurus & RBAC (Ketua DKM only)
export function AdminUsersPage() {
  const { showToast, confirm } = useToast();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [roleCode, setRoleCode] = useState<'ketua_dkm' | 'bendahara' | 'sekretaris'>('bendahara');

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiRequest<{ items: any[] }>('/api/admin/system/users');
      setUsers(res.items);
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiRequest<{ message: string }>('/api/admin/system/users', {
        method: 'POST',
        body: JSON.stringify({ fullName, username, email, password, roleCode }),
      });
      showToast(res.message, 'success');
      setModalOpen(false);
      setFullName('');
      setUsername('');
      setEmail('');
      setPassword('');
      loadUsers();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleToggleActive = async (u: any) => {
    const ok = await confirm({
      title: u.isActive ? 'Nonaktifkan Akun Pengurus?' : 'Aktifkan Akun Pengurus?',
      message: `${u.fullName} (${getRoleLabel(u.roleCode)})`,
      danger: u.isActive,
    });
    if (!ok) return;
    try {
      const res = await apiRequest<{ message: string }>(
        `/api/admin/system/users/${u.id}/toggle-active`,
        { method: 'PATCH' },
      );
      showToast(res.message, 'success');
      loadUsers();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleRoleChange = async (u: any, nextRole: string) => {
    try {
      await apiRequest(`/api/admin/system/users/${u.id}`, {
        method: 'PUT',
        body: JSON.stringify({ fullName: u.fullName, email: u.email, roleCode: nextRole }),
      });
      showToast('Role pengurus diperbarui.', 'success');
      loadUsers();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#14221B]">
            Manajemen Akun Pengurus & RBAC
          </h1>
          <p className="text-sm text-[#5F6F65] mt-1">
            Hanya Ketua DKM yang dapat menambah akun, mengatur role (Ketua DKM, Bendahara, Sekretaris), dan menonaktifkan akun.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold bg-[#064E3B] text-white rounded-lg"
        >
          <Plus className="w-4 h-4" />
          Tambah Akun Pengurus
        </button>
      </div>

      <div className="bg-white border border-[#E4DFD3] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-[#FAF9F5] border-b border-[#E4DFD3] text-xs text-[#5F6F65]">
              <tr>
                <th className="px-4 py-3">Nama Lengkap</th>
                <th className="px-4 py-3">Username & Email</th>
                <th className="px-4 py-3">Role / Hak Akses</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Login Terakhir</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EFECE4]">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-[#5F6F65]">
                    Memuat data pengurus...
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id}>
                    <td className="px-4 py-3 font-medium">{u.fullName}</td>
                    <td className="px-4 py-3">
                      <div className="font-mono text-xs">{u.username}</div>
                      <div className="text-xs text-[#5F6F65]">{u.email}</div>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={u.roleCode}
                        onChange={(e) => handleRoleChange(u, e.target.value)}
                        className="px-2.5 py-1 text-xs border border-[#E4DFD3] rounded-lg bg-[#FAF9F5]"
                      >
                        <option value="ketua_dkm">Ketua DKM</option>
                        <option value="bendahara">Bendahara</option>
                        <option value="sekretaris">Sekretaris</option>
                      </select>
                    </td>
                    <td className="px-4 py-3 text-xs font-semibold">
                      <span className={u.isActive ? 'text-emerald-700' : 'text-red-700'}>
                        {u.isActive ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-[#5F6F65]">
                      {u.lastLoginAt ? formatDateTimeIndo(u.lastLoginAt) : 'Belum pernah'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleToggleActive(u)}
                        className="px-3 py-1 text-xs border border-[#E4DFD3] rounded-lg hover:bg-[#FAF9F5]"
                      >
                        {u.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-lg font-bold">Tambah Akun Pengurus DKM</h2>
              <button type="button" onClick={() => setModalOpen(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="space-y-3.5">
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Nama Lengkap"
                className="w-full px-3 py-2 text-sm border border-[#E4DFD3] rounded-lg bg-[#FAF9F5]"
              />
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Username (tanpa spasi)"
                className="w-full px-3 py-2 text-sm border border-[#E4DFD3] rounded-lg bg-[#FAF9F5]"
              />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                className="w-full px-3 py-2 text-sm border border-[#E4DFD3] rounded-lg bg-[#FAF9F5]"
              />
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password (min. 8 karakter)"
                className="w-full px-3 py-2 text-sm border border-[#E4DFD3] rounded-lg bg-[#FAF9F5]"
              />
              <select
                value={roleCode}
                onChange={(e) => setRoleCode(e.target.value as any)}
                className="w-full px-3 py-2 text-sm border border-[#E4DFD3] rounded-lg bg-[#FAF9F5]"
              >
                <option value="bendahara">Bendahara (Keuangan & Zakat)</option>
                <option value="sekretaris">Sekretaris (Poster, Agenda & Pengumuman)</option>
                <option value="ketua_dkm">Ketua DKM (Akses Penuh)</option>
              </select>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-xs border border-[#E4DFD3] rounded-lg"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-semibold bg-[#064E3B] text-white rounded-lg"
                >
                  Buat Akun
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// 2. Pengaturan Masjid & Keuangan (Ketua DKM only)
const DEFAULT_PAYMENT_CHANNELS: PaymentChannelsMap = {
  zakat: {
    bankName: 'Bank Syariah Indonesia (BSI)',
    accountNumber: '',
    accountHolder: 'DKM Masjid (Zakat)',
    ewalletProvider: 'dana',
    danaNumber: '',
    danaHolder: 'Unit Pengumpul Zakat Masjid',
    danaLink: '',
    qrisPayload: '',
    qrisMerchantName: '',
    ewalletQrImageUrl: '',
    preferredCodeFormat: 'both',
  },
  infak: {
    bankName: 'Bank Syariah Indonesia (BSI)',
    accountNumber: '',
    accountHolder: 'DKM Masjid (Infak)',
    ewalletProvider: 'dana',
    danaNumber: '',
    danaHolder: 'Kas Infak Masjid',
    danaLink: '',
    qrisPayload: '',
    qrisMerchantName: '',
    ewalletQrImageUrl: '',
    preferredCodeFormat: 'both',
  },
  sedekah: {
    bankName: 'Bank Syariah Indonesia (BSI)',
    accountNumber: '',
    accountHolder: 'DKM Masjid (Sedekah)',
    ewalletProvider: 'dana',
    danaNumber: '',
    danaHolder: 'Kas Sedekah Masjid',
    danaLink: '',
    qrisPayload: '',
    qrisMerchantName: '',
    ewalletQrImageUrl: '',
    preferredCodeFormat: 'both',
  },
};

export function AdminSettingsPage({ onSaved }: { onSaved?: () => void }) {
  const { showToast } = useToast();
  const [form, setForm] = useState<MosqueSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [activeChannelTab, setActiveChannelTab] = useState<'zakat' | 'infak' | 'sedekah'>('zakat');
  const [decodingQr, setDecodingQr] = useState(false);

  useEffect(() => {
    apiRequest<{ settings: MosqueSettings }>('/api/admin/system/settings')
      .then((res) => {
        const loaded = res.settings;
        setForm({
          ...loaded,
          paymentChannels: {
            zakat: { ...DEFAULT_PAYMENT_CHANNELS.zakat, ...(loaded.paymentChannels?.zakat || {}) },
            infak: { ...DEFAULT_PAYMENT_CHANNELS.infak, ...(loaded.paymentChannels?.infak || {}) },
            sedekah: { ...DEFAULT_PAYMENT_CHANNELS.sedekah, ...(loaded.paymentChannels?.sedekah || {}) },
          },
        });
      })
      .catch((err) => showToast(err.message, 'error'));
  }, [showToast]);

  const applyExtractedInspection = (
    targetTab: 'zakat' | 'infak' | 'sedekah' | 'all',
    decoded: Awaited<ReturnType<typeof decodeQrFromFile>>,
    uploadedUrl?: string,
  ) => {
    setForm((prev) => {
      if (!prev) return prev;
      const baseChannels = prev.paymentChannels || DEFAULT_PAYMENT_CHANNELS;
      const applyToChannel = (ch: PaymentChannelConfig): PaymentChannelConfig => {
        const next: PaymentChannelConfig = { ...ch };
        if (uploadedUrl) next.ewalletQrImageUrl = uploadedUrl;
        if (decoded.inspection?.kind === 'emv_qris' && decoded.inspection.info.valid) {
          next.qrisPayload = decoded.inspection.info.raw;
          next.qrisMerchantName = decoded.inspection.info.merchantName || ch.qrisMerchantName || '';
        } else if (decoded.inspection?.kind === 'ewallet_url') {
          next.danaLink = decoded.inspection.url;
        }
        return next;
      };

      if (targetTab === 'all') {
        return {
          ...prev,
          qrisImageUrl: uploadedUrl || prev.qrisImageUrl,
          paymentChannels: {
            zakat: applyToChannel(baseChannels.zakat),
            infak: applyToChannel(baseChannels.infak),
            sedekah: applyToChannel(baseChannels.sedekah),
          },
        };
      }

      return {
        ...prev,
        paymentChannels: {
          ...baseChannels,
          [targetTab]: applyToChannel(baseChannels[targetTab]),
        },
      };
    });
  };

  const handleUploadAsset = async (
    file: File,
    field: 'logoUrl' | 'heroImageUrl' | 'qrisImageUrl',
  ) => {
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await apiRequest<{ url: string }>('/api/admin/system/upload', {
        method: 'POST',
        body: fd,
      });
      setForm((prev) => (prev ? { ...prev, [field]: res.url } : prev));

      if (field === 'qrisImageUrl') {
        setDecodingQr(true);
        try {
          const decoded = await decodeQrFromFile(file);
          if (decoded.inspection?.kind === 'emv_qris' && decoded.inspection.info.valid) {
            applyExtractedInspection('all', decoded, res.url);
            showToast(
              `QRIS valid terdeteksi (${decoded.inspection.info.merchantName || 'Merchant'}) dan diterapkan ke seluruh program. Klik Simpan Pengaturan.`,
              'success',
            );
            return;
          }
          if (decoded.inspection?.kind === 'ewallet_url') {
            applyExtractedInspection('all', decoded, res.url);
            showToast(
              `Tautan QR ${decoded.inspection.provider} terdeteksi dan disimpan. Klik Simpan Pengaturan.`,
              'success',
            );
            return;
          }
        } finally {
          setDecodingQr(false);
        }
      }
      showToast('Gambar berhasil diunggah. Klik Simpan Pengaturan.', 'success');
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleUploadChannelQr = async (file: File, tab: 'zakat' | 'infak' | 'sedekah') => {
    setDecodingQr(true);
    try {
      const decoded = await decodeQrFromFile(file);
      const fd = new FormData();
      fd.append('file', file);
      const res = await apiRequest<{ url: string }>('/api/admin/system/upload', {
        method: 'POST',
        body: fd,
      });

      applyExtractedInspection(tab, decoded, res.url);

      if (decoded.inspection?.kind === 'emv_qris' && decoded.inspection.info.valid) {
        showToast(
          `QRIS EMVCo valid terdeteksi (${decoded.inspection.info.merchantName || decoded.inspection.info.acquirerLabel}). Siap menghasilkan QRIS dinamis sesuai nominal donatur!`,
          'success',
        );
      } else if (decoded.inspection?.kind === 'ewallet_url') {
        showToast(
          `QR resmi ${decoded.inspection.provider} terdeteksi. Siap dipindai langsung di aplikasi e-wallet.`,
          'success',
        );
      } else if (decoded.decodedText) {
        showToast(
          'Gambar QR tersimpan, namun format QR bukan standar EMVCo QRIS maupun tautan e-wallet resmi.',
          'error',
        );
      } else {
        showToast(
          'Gambar QR diunggah, tetapi kode QR tidak terbaca otomatis. Pastikan gambar tajam atau tempel payload QRIS EMVCo secara manual.',
          'success',
        );
      }
    } catch (err: any) {
      showToast(err.message || 'Gagal mengunggah gambar QR.', 'error');
    } finally {
      setDecodingQr(false);
    }
  };

  const handleExtractFromGlobalQr = async (tab: 'zakat' | 'infak' | 'sedekah') => {
    if (!form?.qrisImageUrl) {
      showToast('Belum ada gambar QRIS utama yang diunggah.', 'error');
      return;
    }
    setDecodingQr(true);
    try {
      const decoded = await decodeQrFromImageUrl(form.qrisImageUrl);
      if (decoded.inspection?.kind === 'emv_qris' && decoded.inspection.info.valid) {
        applyExtractedInspection(tab, decoded, form.qrisImageUrl);
        showToast(
          `Berhasil mengekstrak QRIS (${decoded.inspection.info.merchantName || 'Merchant'}) dari gambar QRIS utama.`,
          'success',
        );
      } else if (decoded.inspection?.kind === 'ewallet_url') {
        applyExtractedInspection(tab, decoded, form.qrisImageUrl);
        showToast(`Berhasil mengekstrak tautan ${decoded.inspection.provider}.`, 'success');
      } else {
        showToast('QR tidak dapat diekstrak menjadi EMVCo QRIS dari gambar tersebut.', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Gagal membaca gambar QRIS.', 'error');
    } finally {
      setDecodingQr(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    try {
      const res = await apiRequest<{ settings: MosqueSettings; message: string }>(
        '/api/admin/system/settings',
        { method: 'PUT', body: JSON.stringify(form) },
      );
      setForm(res.settings);
      showToast(res.message, 'success');
      onSaved?.();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  if (!form) return <div className="h-64 bg-[#EAE5D9] rounded-xl animate-pulse" />;

  return (
    <form onSubmit={handleSave} className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#14221B]">
            Pengaturan Informasi Masjid, Pembayaran & Zakat
          </h1>
          <p className="text-sm text-[#5F6F65] mt-1">
            Atur identitas masjid, rekening resmi, QRIS, harga emas, standar zakat fitrah, serta batas persetujuan pengeluaran.
          </p>
        </div>
        <button
          type="submit"
          disabled={saving}
          className="px-5 py-2.5 text-xs font-semibold bg-[#064E3B] text-white rounded-lg hover:bg-emerald-800 disabled:opacity-60"
        >
          {saving ? 'Menyimpan...' : 'Simpan Pengaturan'}
        </button>
      </div>

      {/* Section 1: Profil & Lokasi */}
      <div className="bg-white border border-[#E4DFD3] rounded-2xl p-6 space-y-4">
        <h2 className="font-display text-base font-bold text-[#14221B]">Identitas & Lokasi Masjid</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-[#4A5A51] mb-1">Nama Masjid</label>
            <input
              type="text"
              value={form.mosqueName}
              onChange={(e) => setForm({ ...form, mosqueName: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-[#E4DFD3] rounded-lg bg-[#FAF9F5]"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#4A5A51] mb-1">Tagline</label>
            <input
              type="text"
              value={form.tagline}
              onChange={(e) => setForm({ ...form, tagline: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-[#E4DFD3] rounded-lg bg-[#FAF9F5]"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-[#4A5A51] mb-1">Alamat Lengkap</label>
            <input
              type="text"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-[#E4DFD3] rounded-lg bg-[#FAF9F5]"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#4A5A51] mb-1">Kota</label>
            <input
              type="text"
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-[#E4DFD3] rounded-lg bg-[#FAF9F5]"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#4A5A51] mb-1">Zona Waktu</label>
            <select
              value={form.timezone}
              onChange={(e) => setForm({ ...form, timezone: e.target.value as any })}
              className="w-full px-3 py-2 text-sm border border-[#E4DFD3] rounded-lg bg-[#FAF9F5]"
            >
              <option value="WIB">WIB (UTC+7)</option>
              <option value="WITA">WITA (UTC+8)</option>
              <option value="WIT">WIT (UTC+9)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#4A5A51] mb-1">Nomor WhatsApp Resmi</label>
            <input
              type="text"
              value={form.whatsappNumber}
              onChange={(e) => setForm({ ...form, whatsappNumber: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-[#E4DFD3] rounded-lg bg-[#FAF9F5]"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#4A5A51] mb-1">Email Masjid</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-[#E4DFD3] rounded-lg bg-[#FAF9F5]"
            />
          </div>
        </div>
      </div>

      {/* Section 2: Rekening Bank, Akun E-Wallet & Integrasi QRIS Resmi */}
      <div className="bg-white border border-[#E4DFD3] rounded-2xl p-6 space-y-6">
        <div>
          <h2 className="font-display text-base font-bold text-[#14221B]">
            Rekening Bank, Akun E-Wallet & Integrasi QRIS Resmi (Zakat, Infak, Sedekah)
          </h2>
          <p className="text-xs text-[#5F6F65] mt-1 leading-relaxed">
            Masukkan nomor Rekening Bank, nomor E-Wallet (DANA / GoPay / OVO / ShopeePay / LinkAja), dan unggah QRIS / QR resmi agar QR pembayaran yang muncul di halaman publik benar-benar terintegrasi dan dapat dipindai langsung oleh aplikasi e-wallet maupun mobile banking.
          </p>
        </div>

        {/* Program Tabs */}
        <div className="flex flex-wrap items-center gap-2 border-b border-[#EFECE4] pb-3">
          {[
            { id: 'zakat', label: 'Program Zakat (Fitrah & Mal)' },
            { id: 'infak', label: 'Program Infak' },
            { id: 'sedekah', label: 'Program Sedekah' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveChannelTab(tab.id as any)}
              className={`px-4 py-2 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap shrink-0 ${
                activeChannelTab === tab.id
                  ? 'bg-[#064E3B] text-white border-[#064E3B]'
                  : 'bg-[#FAF9F5] text-[#4A5A51] border-[#E4DFD3] hover:border-[#064E3B]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {(() => {
          const channels = form.paymentChannels || DEFAULT_PAYMENT_CHANNELS;
          const ch: PaymentChannelConfig = channels[activeChannelTab];
          const programTitle =
            activeChannelTab === 'zakat' ? 'Zakat' : activeChannelTab === 'infak' ? 'Infak' : 'Sedekah';
          const qrisCheck = ch.qrisPayload?.trim() ? validateQrisPayload(ch.qrisPayload) : null;

          const updateChannel = (patch: Partial<PaymentChannelConfig>) => {
            setForm({
              ...form,
              paymentChannels: {
                ...channels,
                [activeChannelTab]: { ...ch, ...patch },
              },
            });
          };

          const applyCurrentQrisToAll = () => {
            if (!ch.qrisPayload?.trim() && !ch.ewalletQrImageUrl) {
              showToast('Isi atau unggah QRIS terlebih dahulu sebelum menerapkan ke semua program.', 'error');
              return;
            }
            setForm({
              ...form,
              paymentChannels: {
                zakat: {
                  ...channels.zakat,
                  qrisPayload: ch.qrisPayload || '',
                  qrisMerchantName: ch.qrisMerchantName || '',
                  ewalletQrImageUrl: ch.ewalletQrImageUrl || channels.zakat.ewalletQrImageUrl || '',
                },
                infak: {
                  ...channels.infak,
                  qrisPayload: ch.qrisPayload || '',
                  qrisMerchantName: ch.qrisMerchantName || '',
                  ewalletQrImageUrl: ch.ewalletQrImageUrl || channels.infak.ewalletQrImageUrl || '',
                },
                sedekah: {
                  ...channels.sedekah,
                  qrisPayload: ch.qrisPayload || '',
                  qrisMerchantName: ch.qrisMerchantName || '',
                  ewalletQrImageUrl: ch.ewalletQrImageUrl || channels.sedekah.ewalletQrImageUrl || '',
                },
              },
            });
            showToast('QRIS diterapkan ke program Zakat, Infak, dan Sedekah. Klik Simpan Pengaturan.', 'success');
          };

          return (
            <div className="space-y-6">
              {/* Sub-block 1: Bank */}
              <div className="space-y-3">
                <div className="text-xs font-bold text-[#064E3B] uppercase tracking-wide">
                  1. Rekening Bank ({programTitle})
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#4A5A51] mb-1">
                      Nama Bank
                    </label>
                    <input
                      type="text"
                      value={ch.bankName}
                      onChange={(e) => updateChannel({ bankName: e.target.value })}
                      placeholder="Contoh: Bank Syariah Indonesia (BSI)"
                      className="w-full px-3 py-2 text-sm border border-[#E4DFD3] rounded-lg bg-[#FAF9F5]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#4A5A51] mb-1">
                      No. Rekening Bank
                    </label>
                    <input
                      type="text"
                      value={ch.accountNumber}
                      onChange={(e) => updateChannel({ accountNumber: e.target.value })}
                      placeholder="Contoh: 7123456789"
                      className="w-full px-3 py-2 text-sm font-mono border border-[#E4DFD3] rounded-lg bg-[#FAF9F5]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#4A5A51] mb-1">
                      Atas Nama Rekening
                    </label>
                    <input
                      type="text"
                      value={ch.accountHolder}
                      onChange={(e) => updateChannel({ accountHolder: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-[#E4DFD3] rounded-lg bg-[#FAF9F5]"
                    />
                  </div>
                </div>
              </div>

              {/* Sub-block 2: E-Wallet */}
              <div className="space-y-3 pt-4 border-t border-[#EFECE4]">
                <div className="text-xs font-bold text-[#064E3B] uppercase tracking-wide">
                  2. Akun E-Wallet ({programTitle})
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#4A5A51] mb-1">
                      Provider E-Wallet
                    </label>
                    <select
                      value={ch.ewalletProvider || 'dana'}
                      onChange={(e) =>
                        updateChannel({ ewalletProvider: e.target.value as EwalletProvider })
                      }
                      className="w-full px-3 py-2 text-sm border border-[#E4DFD3] rounded-lg bg-[#FAF9F5]"
                    >
                      <option value="dana">DANA</option>
                      <option value="gopay">GoPay</option>
                      <option value="ovo">OVO</option>
                      <option value="shopeepay">ShopeePay</option>
                      <option value="linkaja">LinkAja</option>
                      <option value="qris">QRIS Nasional (Semua E-Wallet)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#4A5A51] mb-1">
                      No. HP / ID E-Wallet
                    </label>
                    <input
                      type="text"
                      value={ch.danaNumber}
                      onChange={(e) => updateChannel({ danaNumber: e.target.value })}
                      placeholder="Contoh: 085774321223"
                      className="w-full px-3 py-2 text-sm font-mono border border-[#E4DFD3] rounded-lg bg-[#FAF9F5]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#4A5A51] mb-1">
                      Atas Nama Akun E-Wallet
                    </label>
                    <input
                      type="text"
                      value={ch.danaHolder}
                      onChange={(e) => updateChannel({ danaHolder: e.target.value })}
                      placeholder="Contoh: DKM Masjid Al-Ikhlas"
                      className="w-full px-3 py-2 text-sm border border-[#E4DFD3] rounded-lg bg-[#FAF9F5]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#4A5A51] mb-1">
                      Link QR / Pembayaran E-Wallet (Opsional)
                    </label>
                    <input
                      type="url"
                      value={ch.danaLink || ''}
                      onChange={(e) => updateChannel({ danaLink: e.target.value })}
                      placeholder="https://link.dana.id/..."
                      className="w-full px-3 py-2 text-sm border border-[#E4DFD3] rounded-lg bg-[#FAF9F5]"
                    />
                  </div>
                </div>
              </div>

              {/* Sub-block 3: QRIS / QR Resmi Scannable Integration */}
              <div className="space-y-3 pt-4 border-t border-[#EFECE4]">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-xs font-bold text-[#064E3B] uppercase tracking-wide">
                      3. Integrasi QRIS / QR Resmi (Agar Bisa Di-Scan DANA & E-Wallet Lainnya)
                    </div>
                    <p className="text-xs text-[#5F6F65] mt-0.5">
                      Unggah foto/gambar QRIS dari DANA Bisnis, GoPay Merchant, ShopeePay, OVO, atau Bank. Sistem otomatis membaca kode EMVCo QRIS agar di halaman donatur QRIS berubah dinamis sesuai nominal dan tetap 100% bisa di-scan aplikasi e-wallet.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {form.qrisImageUrl && (
                      <button
                        type="button"
                        disabled={decodingQr}
                        onClick={() => handleExtractFromGlobalQr(activeChannelTab)}
                        className="px-3 py-1.5 text-xs font-semibold border border-[#E4DFD3] bg-[#FAF9F5] text-[#14221B] rounded-lg hover:border-[#064E3B]"
                      >
                        Ambil dari QRIS Utama Masjid
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={applyCurrentQrisToAll}
                      className="px-3 py-1.5 text-xs font-semibold border border-[#064E3B]/30 bg-emerald-50 text-[#064E3B] rounded-lg hover:bg-emerald-100"
                    >
                      Terapkan ke Semua Program
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
                  <div>
                    <label className="block text-xs font-semibold text-[#4A5A51] mb-1">
                      Unggah Gambar QRIS / QR E-Wallet ({programTitle})
                    </label>
                    <label className="flex items-center justify-center gap-2 px-4 py-3 border border-dashed border-[#C7C0B0] rounded-lg bg-[#FAF9F5] cursor-pointer text-xs font-medium text-[#14221B] hover:border-[#064E3B]">
                      <Upload className="w-4 h-4 text-[#064E3B] shrink-0" />
                      <span>
                        {decodingQr
                          ? 'Membaca kode QR...'
                          : ch.ewalletQrImageUrl
                            ? 'Ganti Gambar QRIS / E-Wallet'
                            : 'Pilih Gambar QRIS / QR DANA'}
                      </span>
                      <input
                        type="file"
                        accept=".jpg,.jpeg,.png,.webp"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleUploadChannelQr(file, activeChannelTab);
                        }}
                      />
                    </label>
                    {ch.ewalletQrImageUrl && (
                      <div className="mt-2 flex items-center gap-2 text-[11px] text-[#5F6F65]">
                        <QrCode className="w-3.5 h-3.5 text-[#064E3B]" />
                        <span>Gambar QR tersimpan</span>
                      </div>
                    )}
                  </div>

                  <div className="lg:col-span-2 space-y-2">
                    <label className="block text-xs font-semibold text-[#4A5A51]">
                      Payload String QRIS EMVCo (Terisi otomatis saat unggah gambar QRIS, atau tempel manual)
                    </label>
                    <textarea
                      rows={2}
                      value={ch.qrisPayload || ''}
                      onChange={(e) => {
                        const raw = e.target.value;
                        const parsed = validateQrisPayload(raw);
                        updateChannel({
                          qrisPayload: raw,
                          qrisMerchantName: parsed.valid ? parsed.merchantName : ch.qrisMerchantName,
                        });
                      }}
                      placeholder="00020101021126...6304XXXX"
                      className="w-full px-3 py-2 text-xs font-mono border border-[#E4DFD3] rounded-lg bg-[#FAF9F5]"
                    />
                    {qrisCheck && qrisCheck.valid && (
                      <div className="flex items-start gap-2 text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-semibold">EMVCo QRIS Valid</span>
                          {' · '}Merchant: <strong>{qrisCheck.merchantName || '-'}</strong>
                          {qrisCheck.merchantCity ? ` (${qrisCheck.merchantCity})` : ''}
                          {' · '}Penerbit: {qrisCheck.acquirerLabel}
                        </div>
                      </div>
                    )}
                    {qrisCheck && !qrisCheck.valid && (
                      <div className="flex items-start gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                        <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                        <span>{qrisCheck.reason}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        <div className="pt-4 border-t border-[#EFECE4]">
          <div className="text-xs font-semibold text-[#4A5A51] mb-3">
            Rekening Umum Masjid (Cadangan / Fallback)
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#4A5A51] mb-1">Nama Bank Umum</label>
              <input
                type="text"
                value={form.bankName}
                onChange={(e) => setForm({ ...form, bankName: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-[#E4DFD3] rounded-lg bg-[#FAF9F5]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#4A5A51] mb-1">Nomor Rekening Umum</label>
              <input
                type="text"
                value={form.bankAccountNumber}
                onChange={(e) => setForm({ ...form, bankAccountNumber: e.target.value })}
                className="w-full px-3 py-2 text-sm font-mono border border-[#E4DFD3] rounded-lg bg-[#FAF9F5]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#4A5A51] mb-1">Atas Nama Rekening Umum</label>
              <input
                type="text"
                value={form.bankAccountHolder}
                onChange={(e) => setForm({ ...form, bankAccountHolder: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-[#E4DFD3] rounded-lg bg-[#FAF9F5]"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-2">
          <div>
            <label className="block text-xs font-semibold text-[#4A5A51] mb-1">Beras Fitrah / Jiwa (kg)</label>
            <input
              type="number"
              step="0.1"
              value={form.zakatFitrahRiceKg}
              onChange={(e) => setForm({ ...form, zakatFitrahRiceKg: e.target.value })}
              className="w-full px-3 py-2 text-sm font-mono border border-[#E4DFD3] rounded-lg bg-[#FAF9F5]"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#4A5A51] mb-1">Uang Fitrah / Jiwa (IDR)</label>
            <input
              type="number"
              value={form.zakatFitrahMoneyAmount}
              onChange={(e) => setForm({ ...form, zakatFitrahMoneyAmount: e.target.value })}
              className="w-full px-3 py-2 text-sm font-mono border border-[#E4DFD3] rounded-lg bg-[#FAF9F5]"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#4A5A51] mb-1">Harga Emas / Gram (IDR)</label>
            <input
              type="number"
              value={form.goldPricePerGram}
              onChange={(e) => setForm({ ...form, goldPricePerGram: e.target.value })}
              className="w-full px-3 py-2 text-sm font-mono border border-[#E4DFD3] rounded-lg bg-[#FAF9F5]"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#4A5A51] mb-1">Batas Persetujuan Ketua (IDR)</label>
            <input
              type="number"
              value={form.expenseApprovalThreshold}
              onChange={(e) => setForm({ ...form, expenseApprovalThreshold: e.target.value })}
              className="w-full px-3 py-2 text-sm font-mono border border-[#E4DFD3] rounded-lg bg-[#FAF9F5]"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          <div>
            <label className="block text-xs font-semibold text-[#4A5A51] mb-1">Unggah QRIS Resmi Masjid</label>
            <label className="flex items-center gap-2 px-3 py-2 border border-dashed border-[#C7C0B0] rounded-lg bg-[#FAF9F5] cursor-pointer text-xs">
              <Upload className="w-4 h-4 text-[#064E3B]" />
              <span>{form.qrisImageUrl ? 'Ganti Gambar QRIS' : 'Upload QRIS Resmi'}</span>
              <input
                type="file"
                accept=".jpg,.jpeg,.png,.webp"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleUploadAsset(e.target.files[0], 'qrisImageUrl')}
              />
            </label>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#4A5A51] mb-1">Unggah Logo Masjid</label>
            <label className="flex items-center gap-2 px-3 py-2 border border-dashed border-[#C7C0B0] rounded-lg bg-[#FAF9F5] cursor-pointer text-xs">
              <Upload className="w-4 h-4 text-[#064E3B]" />
              <span>Ganti Logo Masjid</span>
              <input
                type="file"
                accept=".jpg,.jpeg,.png,.webp"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleUploadAsset(e.target.files[0], 'logoUrl')}
              />
            </label>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#4A5A51] mb-1">Unggah Foto Utama Masjid</label>
            <label className="flex items-center gap-2 px-3 py-2 border border-dashed border-[#C7C0B0] rounded-lg bg-[#FAF9F5] cursor-pointer text-xs">
              <Upload className="w-4 h-4 text-[#064E3B]" />
              <span>Ganti Foto Hero</span>
              <input
                type="file"
                accept=".jpg,.jpeg,.png,.webp"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleUploadAsset(e.target.files[0], 'heroImageUrl')}
              />
            </label>
          </div>
        </div>
      </div>
    </form>
  );
}

// 3. Audit Log Viewer (Ketua DKM & Bendahara)
export function AdminAuditLogsPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiRequest<{ items: any[] }>('/api/admin/system/audit-logs')
      .then((res) => setLogs(res.items || []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-[#14221B]">Audit Log Sistem & Keuangan</h1>
        <p className="text-sm text-[#5F6F65] mt-1">
          Catatan permanen seluruh aktivitas pembuatan, perubahan, persetujuan, dan pembatalan transaksi.
        </p>
      </div>

      <div className="bg-white border border-[#E4DFD3] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-[#FAF9F5] border-b border-[#E4DFD3] text-[#5F6F65]">
              <tr>
                <th className="px-4 py-3">Waktu</th>
                <th className="px-4 py-3">Pengguna</th>
                <th className="px-4 py-3">Aksi</th>
                <th className="px-4 py-3">Modul</th>
                <th className="px-4 py-3">No. Transaksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EFECE4]">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center">
                    Memuat audit log...
                  </td>
                </tr>
              ) : (
                logs.map((l) => (
                  <tr key={l.id}>
                    <td className="px-4 py-3 whitespace-nowrap">{formatDateTimeIndo(l.createdAt)}</td>
                    <td className="px-4 py-3">
                      <span className="font-semibold">{l.userName}</span> ({getRoleLabel(l.userRole)})
                    </td>
                    <td className="px-4 py-3 font-mono font-semibold text-[#064E3B]">{l.action}</td>
                    <td className="px-4 py-3">{l.module}</td>
                    <td className="px-4 py-3 font-mono">{l.transactionNumber || '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// 4. Own Profile & Change Password (All Roles)
export function AdminProfilePage() {
  const { user, updateLocalUser } = useAuth();
  const { showToast } = useToast();
  const [fullName, setFullName] = useState(user?.fullName || '');
  const [email, setEmail] = useState(user?.email || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiRequest<{ user: any }>('/api/auth/profile', {
        method: 'PUT',
        body: JSON.stringify({ fullName, email }),
      });
      updateLocalUser(res.user);
      showToast('Profil diperbarui.', 'success');
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiRequest<{ message: string }>('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      showToast(res.message, 'success');
      setCurrentPassword('');
      setNewPassword('');
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="font-display text-2xl font-bold text-[#14221B]">Profil & Keamanan Akun</h1>

      <form onSubmit={handleProfileUpdate} className="bg-white border border-[#E4DFD3] rounded-2xl p-6 space-y-4">
        <h2 className="font-display text-base font-bold">Informasi Profil ({getRoleLabel(user?.roleCode || '')})</h2>
        <div>
          <label className="block text-xs font-semibold text-[#4A5A51] mb-1">Nama Lengkap</label>
          <input
            type="text"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-[#E4DFD3] rounded-lg bg-[#FAF9F5]"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-[#4A5A51] mb-1">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-[#E4DFD3] rounded-lg bg-[#FAF9F5]"
          />
        </div>
        <button
          type="submit"
          className="px-5 py-2 text-xs font-semibold bg-[#064E3B] text-white rounded-lg"
        >
          Simpan Profil
        </button>
      </form>

      <form onSubmit={handlePasswordChange} className="bg-white border border-[#E4DFD3] rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-[#064E3B]" />
          <h2 className="font-display text-base font-bold">Ubah Password</h2>
        </div>
        <div>
          <label className="block text-xs font-semibold text-[#4A5A51] mb-1">
            Password Saat Ini (kosongkan jika sebelumnya hanya login Google)
          </label>
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-[#E4DFD3] rounded-lg bg-[#FAF9F5]"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-[#4A5A51] mb-1">
            Password Baru (min. 8 karakter)
          </label>
          <input
            type="password"
            required
            minLength={8}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-[#E4DFD3] rounded-lg bg-[#FAF9F5]"
          />
        </div>
        <button
          type="submit"
          className="px-5 py-2 text-xs font-semibold bg-[#064E3B] text-white rounded-lg"
        >
          Perbarui Password
        </button>
      </form>
    </div>
  );
}
