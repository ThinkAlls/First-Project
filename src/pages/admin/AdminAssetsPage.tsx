import React, { useCallback, useEffect, useState } from 'react';
import { Building2, Edit3, Package, Plus, Search, Trash2, Upload, X } from 'lucide-react';
import { apiRequest } from '../../services/api.ts';
import { useToast } from '../../context/ToastContext.tsx';
import { formatDateIndo, formatRupiah } from '../../utils/format.ts';
import { AssetSummary, MosqueAsset } from '../../types/index.ts';

const ASSET_CATEGORIES = [
  'Tanah & Bangunan',
  'Elektronik & Audio',
  'Perlengkapan Ibadah',
  'Kendaraan Operasional',
  'Furnitur & Sarana',
  'Lainnya',
] as const;

const CONDITIONS = ['Baik', 'Perlu Perawatan', 'Rusak Ringan', 'Rusak Berat'] as const;

const ACQUISITION_SOURCES = [
  'Pembelian Kas Masjid',
  'Wakaf',
  'Hibah Jamaah',
  'Bantuan Lembaga / Pemerintah',
  'Inventaris Lama',
];

export function AdminAssetsPage() {
  const { showToast, confirm } = useToast();
  const [items, setItems] = useState<MosqueAsset[]>([]);
  const [summary, setSummary] = useState<AssetSummary>({
    totalItems: 0,
    totalQuantity: 0,
    totalNominalValue: 0,
  });
  const [mosqueCashBalance, setMosqueCashBalance] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  const [q, setQ] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [conditionFilter, setConditionFilter] = useState('');

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<MosqueAsset | null>(null);
  const [saving, setSaving] = useState(false);

  // Form fields
  const [assetName, setAssetName] = useState('');
  const [category, setCategory] = useState<string>(ASSET_CATEGORIES[0]);
  const [quantity, setQuantity] = useState<number>(1);
  const [unit, setUnit] = useState('Unit');
  const [acquisitionDate, setAcquisitionDate] = useState(new Date().toISOString().slice(0, 10));
  const [acquisitionSource, setAcquisitionSource] = useState(ACQUISITION_SOURCES[0]);
  const [conditionStatus, setConditionStatus] = useState<MosqueAsset['conditionStatus']>('Baik');
  const [nominalValue, setNominalValue] = useState<string>('');
  const [location, setLocation] = useState('Area Utama Masjid');
  const [notes, setNotes] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);

  const loadAssets = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set('q', q.trim());
      if (categoryFilter) params.set('category', categoryFilter);
      if (conditionFilter) params.set('condition', conditionFilter);

      const res = await apiRequest<{
        items: MosqueAsset[];
        summary: AssetSummary;
        mosqueCashBalance: number;
      }>(`/api/admin/finance/assets?${params.toString()}`);

      setItems(res.items || []);
      setSummary(res.summary || { totalItems: 0, totalQuantity: 0, totalNominalValue: 0 });
      setMosqueCashBalance(Number(res.mosqueCashBalance ?? 0));
    } catch (err: any) {
      showToast(err.message || 'Gagal memuat data aset.', 'error');
    } finally {
      setLoading(false);
    }
  }, [q, categoryFilter, conditionFilter, showToast]);

  useEffect(() => {
    loadAssets();
  }, [loadAssets]);

  const openCreateModal = () => {
    setEditingAsset(null);
    setAssetName('');
    setCategory(ASSET_CATEGORIES[0]);
    setQuantity(1);
    setUnit('Unit');
    setAcquisitionDate(new Date().toISOString().slice(0, 10));
    setAcquisitionSource(ACQUISITION_SOURCES[0]);
    setConditionStatus('Baik');
    setNominalValue('');
    setLocation('Area Utama Masjid');
    setNotes('');
    setPhotoFile(null);
    setModalOpen(true);
  };

  const openEditModal = (asset: MosqueAsset) => {
    setEditingAsset(asset);
    setAssetName(asset.assetName);
    setCategory(asset.category);
    setQuantity(asset.quantity);
    setUnit(asset.unit);
    setAcquisitionDate(asset.acquisitionDate);
    setAcquisitionSource(asset.acquisitionSource);
    setConditionStatus(asset.conditionStatus);
    setNominalValue(String(Number(asset.nominalValue || 0)));
    setLocation(asset.location);
    setNotes(asset.notes || '');
    setPhotoFile(null);
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('assetName', assetName.trim());
      fd.append('category', category);
      fd.append('quantity', String(quantity));
      fd.append('unit', unit.trim());
      fd.append('acquisitionDate', acquisitionDate);
      fd.append('acquisitionSource', acquisitionSource.trim());
      fd.append('conditionStatus', conditionStatus);
      fd.append('nominalValue', String(Number(nominalValue || 0)));
      fd.append('location', location.trim());
      fd.append('notes', notes.trim());
      if (photoFile) fd.append('photo', photoFile);

      if (editingAsset) {
        const res = await apiRequest<{ message: string }>(
          `/api/admin/finance/assets/${editingAsset.id}`,
          { method: 'PUT', body: fd },
        );
        showToast(res.message, 'success');
      } else {
        const res = await apiRequest<{ message: string }>('/api/admin/finance/assets', {
          method: 'POST',
          body: fd,
        });
        showToast(res.message, 'success');
      }

      setModalOpen(false);
      loadAssets();
    } catch (err: any) {
      showToast(err.message || 'Gagal menyimpan data aset.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (asset: MosqueAsset) => {
    const ok = await confirm({
      title: 'Nonaktifkan Aset Masjid?',
      message: `${asset.assetName} (${formatRupiah(asset.nominalValue)}) akan dihapus dari daftar aset aktif. Saldo Kas Masjid tidak berubah.`,
      danger: true,
    });
    if (!ok) return;
    try {
      const res = await apiRequest<{ message: string }>(`/api/admin/finance/assets/${asset.id}`, {
        method: 'DELETE',
      });
      showToast(res.message, 'success');
      loadAssets();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#14221B]">
            Inventaris & Nominal Aset Masjid
          </h1>
          <p className="text-sm text-[#5F6F65] mt-1">
            Catat seluruh aset tetap, tanah wakaf, dan perlengkapan masjid.{' '}
            <strong className="text-[#064E3B]">
              Nominal nilai aset dipisahkan sepenuhnya dari saldo Kas Masjid maupun Dana Zakat.
            </strong>
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold bg-[#064E3B] text-white rounded-lg hover:bg-emerald-800 shrink-0"
        >
          <Plus className="w-4 h-4" />
          Input Aset Baru
        </button>
      </div>

      {/* Strict Separation KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[#FAF9F5] border-2 border-[#D4AF63] rounded-xl p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#8C6826]">
              Total Nominal Aset Masjid
            </span>
            <Building2 className="w-4 h-4 text-[#8C6826]" />
          </div>
          <div className="font-mono text-2xl font-bold text-[#14221B] tabular-nums mt-2">
            {formatRupiah(summary.totalNominalValue)}
          </div>
          <div className="text-[11px] text-[#5F6F65] mt-2">
            Pembukuan Aset Tetap (tidak digabung dengan kas tunai)
          </div>
        </div>

        <div className="bg-white border border-[#E4DFD3] rounded-xl p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#5F6F65]">Jumlah Item & Unit Aset</span>
            <Package className="w-4 h-4 text-[#064E3B]" />
          </div>
          <div className="font-mono text-2xl font-bold text-[#14221B] tabular-nums mt-2">
            {summary.totalItems} Item
          </div>
          <div className="text-[11px] text-[#5F6F65] mt-2">
            Total {summary.totalQuantity} kuantitas barang/bidang tercatat
          </div>
        </div>

        <div className="bg-[#064E3B] text-white rounded-xl p-5">
          <div className="text-xs text-emerald-200">Saldo Kas Masjid (Terpisah dari Aset)</div>
          <div className="font-mono text-2xl font-bold tabular-nums mt-2">
            {formatRupiah(mosqueCashBalance)}
          </div>
          <div className="text-[11px] text-emerald-200/80 mt-2">
            Dana likuid operasional yang siap dibelanjakan
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white border border-[#E4DFD3] rounded-xl p-4 flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-[#5F6F65] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cari kode aset, nama aset, atau lokasi..."
            className="w-full pl-9 pr-3 py-2 text-xs border border-[#E4DFD3] rounded-lg bg-[#FAF9F5]"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-3 py-2 text-xs border border-[#E4DFD3] rounded-lg bg-[#FAF9F5]"
        >
          <option value="">Semua Kategori</option>
          {ASSET_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          value={conditionFilter}
          onChange={(e) => setConditionFilter(e.target.value)}
          className="px-3 py-2 text-xs border border-[#E4DFD3] rounded-lg bg-[#FAF9F5]"
        >
          <option value="">Semua Kondisi</option>
          {CONDITIONS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {/* Assets Table */}
      <div className="bg-white border border-[#E4DFD3] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-[#FAF9F5] border-b border-[#E4DFD3] text-xs text-[#5F6F65]">
              <tr>
                <th className="px-4 py-3">Kode</th>
                <th className="px-4 py-3">Nama Aset & Lokasi</th>
                <th className="px-4 py-3">Kategori & Sumber</th>
                <th className="px-4 py-3">Jumlah</th>
                <th className="px-4 py-3">Kondisi</th>
                <th className="px-4 py-3">Tgl Perolehan</th>
                <th className="px-4 py-3 text-right">Nominal Aset</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EFECE4]">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-[#5F6F65]">
                    Memuat data aset masjid...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-[#5F6F65]">
                    Belum ada data aset masjid tercatat. Klik &quot;Input Aset Baru&quot; untuk menambahkan.
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id} className="hover:bg-[#FAF9F5]">
                    <td className="px-4 py-3 font-mono text-xs text-[#5F6F65] whitespace-nowrap">
                      {item.assetCode}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {item.photoUrl && (
                          <img
                            src={item.photoUrl}
                            alt={item.assetName}
                            className="w-10 h-10 rounded-lg object-cover border border-[#E4DFD3] shrink-0"
                          />
                        )}
                        <div>
                          <div className="font-semibold text-[#14221B]">{item.assetName}</div>
                          <div className="text-xs text-[#5F6F65]">{item.location}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-xs font-medium text-[#14221B]">{item.category}</div>
                      <div className="text-[11px] text-[#5F6F65]">{item.acquisitionSource}</div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs tabular-nums whitespace-nowrap">
                      {item.quantity} {item.unit}
                    </td>
                    <td className="px-4 py-3 text-xs font-semibold">
                      <span
                        className={
                          item.conditionStatus === 'Baik'
                            ? 'text-emerald-700'
                            : item.conditionStatus === 'Perlu Perawatan'
                              ? 'text-[#8C6826]'
                              : 'text-red-700'
                        }
                      >
                        {item.conditionStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs whitespace-nowrap">
                      {formatDateIndo(item.acquisitionDate)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-[#14221B] tabular-nums whitespace-nowrap">
                      {formatRupiah(item.nominalValue)}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEditModal(item)}
                          className="p-1.5 rounded-lg border border-[#E4DFD3] text-[#064E3B] hover:bg-[#FAF9F5]"
                          title="Edit aset"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(item)}
                          className="p-1.5 rounded-lg border border-[#E4DFD3] text-red-700 hover:bg-red-50"
                          title="Hapus / nonaktifkan aset"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Input / Edit Aset */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-xl my-8">
            <div className="flex items-center justify-between pb-4 border-b border-[#EFECE4]">
              <div>
                <h2 className="font-display text-lg font-bold text-[#14221B]">
                  {editingAsset ? 'Edit Data Aset Masjid' : 'Input Aset Masjid Baru'}
                </h2>
                <p className="text-xs text-[#5F6F65]">
                  Nilai nominal aset dicatat terpisah dari Kas Masjid dan Dana Zakat.
                </p>
              </div>
              <button type="button" onClick={() => setModalOpen(false)}>
                <X className="w-5 h-5 text-[#5F6F65]" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 mt-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-[#4A5A51] mb-1">
                    Nama Aset *
                  </label>
                  <input
                    type="text"
                    required
                    value={assetName}
                    onChange={(e) => setAssetName(e.target.value)}
                    placeholder="Contoh: Sound System Ruang Utama / Tanah Wakaf Halaman"
                    className="w-full px-3 py-2 text-sm border border-[#E4DFD3] rounded-lg bg-[#FAF9F5]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#4A5A51] mb-1">
                    Kategori Aset *
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-[#E4DFD3] rounded-lg bg-[#FAF9F5]"
                  >
                    {ASSET_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#4A5A51] mb-1">
                    Nominal Nilai Aset (IDR) *
                  </label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={nominalValue}
                    onChange={(e) => setNominalValue(e.target.value)}
                    placeholder="Contoh: 15000000"
                    className="w-full px-3 py-2 text-sm font-mono border border-[#E4DFD3] rounded-lg bg-[#FAF9F5] tabular-nums"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-[#4A5A51] mb-1">
                      Jumlah *
                    </label>
                    <input
                      type="number"
                      required
                      min={1}
                      value={quantity}
                      onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
                      className="w-full px-3 py-2 text-sm font-mono border border-[#E4DFD3] rounded-lg bg-[#FAF9F5]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#4A5A51] mb-1">
                      Satuan *
                    </label>
                    <input
                      type="text"
                      required
                      value={unit}
                      onChange={(e) => setUnit(e.target.value)}
                      placeholder="Unit / Set / m²"
                      className="w-full px-3 py-2 text-sm border border-[#E4DFD3] rounded-lg bg-[#FAF9F5]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#4A5A51] mb-1">
                    Tanggal Perolehan *
                  </label>
                  <input
                    type="date"
                    required
                    value={acquisitionDate}
                    onChange={(e) => setAcquisitionDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-[#E4DFD3] rounded-lg bg-[#FAF9F5]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#4A5A51] mb-1">
                    Sumber Perolehan *
                  </label>
                  <select
                    value={acquisitionSource}
                    onChange={(e) => setAcquisitionSource(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-[#E4DFD3] rounded-lg bg-[#FAF9F5]"
                  >
                    {ACQUISITION_SOURCES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#4A5A51] mb-1">
                    Kondisi Aset *
                  </label>
                  <select
                    value={conditionStatus}
                    onChange={(e) => setConditionStatus(e.target.value as any)}
                    className="w-full px-3 py-2 text-sm border border-[#E4DFD3] rounded-lg bg-[#FAF9F5]"
                  >
                    {CONDITIONS.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-[#4A5A51] mb-1">
                    Lokasi Penempatan *
                  </label>
                  <input
                    type="text"
                    required
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Contoh: Ruang Salat Utama / Gudang Lt. 2"
                    className="w-full px-3 py-2 text-sm border border-[#E4DFD3] rounded-lg bg-[#FAF9F5]"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-[#4A5A51] mb-1">
                    Foto Aset (Opsional — JPG/PNG/WebP maks. 5MB)
                  </label>
                  <label className="flex items-center gap-2 px-3 py-2.5 border border-dashed border-[#C7C0B0] rounded-lg bg-[#FAF9F5] cursor-pointer text-xs">
                    <Upload className="w-4 h-4 text-[#064E3B]" />
                    <span>
                      {photoFile
                        ? photoFile.name
                        : editingAsset?.photoUrl
                          ? 'Ganti foto aset (opsional)'
                          : 'Pilih foto aset (opsional)...'}
                    </span>
                    <input
                      type="file"
                      accept=".jpg,.jpeg,.png,.webp"
                      className="hidden"
                      onChange={(e) => setPhotoFile(e.target.files?.[0] || null)}
                    />
                  </label>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-[#4A5A51] mb-1">
                    Catatan / Spesifikasi
                  </label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Merk, nomor sertifikat wakaf, atau keterangan tambahan..."
                    className="w-full px-3 py-2 text-sm border border-[#E4DFD3] rounded-lg bg-[#FAF9F5]"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#EFECE4]">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-xs border border-[#E4DFD3] rounded-lg"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 text-xs font-semibold bg-[#064E3B] text-white rounded-lg hover:bg-emerald-800 disabled:opacity-60"
                >
                  {saving ? 'Menyimpan...' : editingAsset ? 'Simpan Perubahan' : 'Simpan Aset'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
