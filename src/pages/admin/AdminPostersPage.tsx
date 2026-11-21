import React, { useCallback, useEffect, useState } from 'react';
import { Eye, Plus, Trash2, Upload, X } from 'lucide-react';
import { apiRequest } from '../../services/api.ts';
import { useToast } from '../../context/ToastContext.tsx';
import { formatDateIndo, getStatusLabel } from '../../utils/format.ts';

export function AdminPostersPage() {
  const { showToast, confirm } = useToast();
  const [tab, setTab] = useState<'posters' | 'activities' | 'announcements' | 'islamic'>('posters');

  const [posters, setPosters] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [islamicEvents, setIslamicEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Poster modal
  const [posterModal, setPosterModal] = useState(false);
  const [editingPoster, setEditingPoster] = useState<any | null>(null);
  const [previewPoster, setPreviewPoster] = useState<any | null>(null);
  const [pTitle, setPTitle] = useState('');
  const [pDesc, setPDesc] = useState('');
  const [pDate, setPDate] = useState(new Date().toISOString().slice(0, 10));
  const [pTime, setPTime] = useState('08:00 WIB');
  const [pLocation, setPLocation] = useState('Ruang Utama Masjid');
  const [pContact, setPContact] = useState('Sekretariat DKM');
  const [pStatus, setPStatus] = useState<'draft' | 'published' | 'archived'>('draft');
  const [pFile, setPFile] = useState<File | null>(null);

  // Activity form
  const [actModal, setActModal] = useState(false);
  const [aTitle, setATitle] = useState('');
  const [aCategory, setACategory] = useState('Kajian Rutin');
  const [aDate, setADate] = useState(new Date().toISOString().slice(0, 10));
  const [aStart, setAStart] = useState('18:30');
  const [aLoc, setALoc] = useState('Ruang Utama Masjid');
  const [aSpeaker, setASpeaker] = useState('');
  const [aDesc, setADesc] = useState('');

  // Announcement form
  const [annModal, setAnnModal] = useState(false);
  const [anTitle, setAnTitle] = useState('');
  const [anContent, setAnContent] = useState('');
  const [anPriority, setAnPriority] = useState<'normal' | 'penting'>('normal');

  // Islamic Event edit modal
  const [evModal, setEvModal] = useState(false);
  const [editingEv, setEditingEv] = useState<any | null>(null);
  const [evTitle, setEvTitle] = useState('');
  const [evType, setEvType] = useState<'hari_besar' | 'kegiatan_khusus'>('hari_besar');
  const [evHDay, setEvHDay] = useState(1);
  const [evHMonth, setEvHMonth] = useState(1);
  const [evHYear, setEvHYear] = useState(1448);
  const [evGDate, setEvGDate] = useState(new Date().toISOString().slice(0, 10));
  const [evDesc, setEvDesc] = useState('');

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [p, a, an, ev] = await Promise.all([
        apiRequest<{ items: any[] }>('/api/admin/content/posters'),
        apiRequest<{ items: any[] }>('/api/admin/content/activities'),
        apiRequest<{ items: any[] }>('/api/admin/content/announcements'),
        apiRequest<{ items: any[] }>('/api/admin/content/islamic-events'),
      ]);
      setPosters(p.items);
      setActivities(a.items);
      setAnnouncements(an.items);
      setIslamicEvents(ev.items);
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const openPosterCreate = () => {
    setEditingPoster(null);
    setPTitle('');
    setPDesc('');
    setPDate(new Date().toISOString().slice(0, 10));
    setPTime('08:00 - 10:00 WIB');
    setPLocation('Ruang Utama Masjid');
    setPContact('Sekretariat DKM');
    setPStatus('draft');
    setPFile(null);
    setPosterModal(true);
  };

  const openPosterEdit = (p: any) => {
    setEditingPoster(p);
    setPTitle(p.title);
    setPDesc(p.description);
    setPDate(p.eventDate);
    setPTime(p.eventTime);
    setPLocation(p.location);
    setPContact(p.contactInfo);
    setPStatus(p.status);
    setPFile(null);
    setPosterModal(true);
  };

  const handlePosterSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const form = new FormData();
      form.append('title', pTitle);
      form.append('description', pDesc);
      form.append('eventDate', pDate);
      form.append('eventTime', pTime);
      form.append('location', pLocation);
      form.append('contactInfo', pContact);
      form.append('status', pStatus);
      if (pFile) form.append('image', pFile);

      if (editingPoster) {
        await apiRequest(`/api/admin/content/posters/${editingPoster.id}`, {
          method: 'PUT',
          body: form,
        });
        showToast('Poster kegiatan diperbarui.', 'success');
      } else {
        await apiRequest('/api/admin/content/posters', {
          method: 'POST',
          body: form,
        });
        showToast('Poster kegiatan ditambahkan.', 'success');
      }
      setPosterModal(false);
      loadAll();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handlePosterStatus = async (id: number, status: 'draft' | 'published' | 'archived') => {
    try {
      await apiRequest(`/api/admin/content/posters/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      showToast(`Status poster diubah menjadi ${getStatusLabel(status)}.`, 'success');
      loadAll();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleDeletePoster = async (p: any) => {
    const ok = await confirm({
      title: 'Hapus Poster Kegiatan?',
      message: `Poster "${p.title}" akan dihapus permanen.`,
      confirmLabel: 'Hapus',
      danger: true,
    });
    if (!ok) return;
    try {
      await apiRequest(`/api/admin/content/posters/${p.id}`, { method: 'DELETE' });
      showToast('Poster dihapus.', 'success');
      loadAll();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleSaveActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/api/admin/content/activities', {
        method: 'POST',
        body: JSON.stringify({
          title: aTitle,
          category: aCategory,
          activityDate: aDate,
          startTime: aStart,
          location: aLoc,
          speaker: aSpeaker,
          description: aDesc,
          status: 'published',
        }),
      });
      showToast('Agenda kegiatan ditambahkan.', 'success');
      setActModal(false);
      setATitle('');
      setADesc('');
      loadAll();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleSaveAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/api/admin/content/announcements', {
        method: 'POST',
        body: JSON.stringify({
          title: anTitle,
          content: anContent,
          priority: anPriority,
          isPublished: true,
        }),
      });
      showToast('Pengumuman dipublikasikan.', 'success');
      setAnnModal(false);
      setAnTitle('');
      setAnContent('');
      loadAll();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const openEvModal = (ev?: any) => {
    if (ev) {
      setEditingEv(ev);
      setEvTitle(ev.title);
      setEvType(ev.eventType);
      setEvHDay(ev.hijriDay);
      setEvHMonth(ev.hijriMonth);
      setEvHYear(ev.hijriYear);
      setEvGDate(ev.gregorianDate);
      setEvDesc(ev.description);
    } else {
      setEditingEv(null);
      setEvTitle('');
      setEvType('hari_besar');
      setEvHDay(1);
      setEvHMonth(1);
      setEvHYear(1448);
      setEvGDate(new Date().toISOString().slice(0, 10));
      setEvDesc('');
    }
    setEvModal(true);
  };

  const handleSaveEv = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        title: evTitle,
        eventType: evType,
        hijriDay: evHDay,
        hijriMonth: evHMonth,
        hijriYear: evHYear,
        gregorianDate: evGDate,
        description: evDesc,
      };
      if (editingEv) {
        await apiRequest(`/api/admin/content/islamic-events/${editingEv.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      } else {
        await apiRequest('/api/admin/content/islamic-events', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }
      showToast('Kalender hari besar Islam disimpan.', 'success');
      setEvModal(false);
      loadAll();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#14221B]">
            Manajemen Poster, Kegiatan & Kalender Islam
          </h1>
          <p className="text-sm text-[#5F6F65] mt-1">
            Hanya poster berstatus Terbit (Published) yang muncul pada halaman publik.
          </p>
        </div>

        <div className="flex flex-wrap gap-1 p-1 bg-white border border-[#E4DFD3] rounded-xl">
          {[
            { id: 'posters', label: 'Poster Kegiatan' },
            { id: 'activities', label: 'Agenda Rutin' },
            { id: 'announcements', label: 'Pengumuman' },
            { id: 'islamic', label: 'Kalender Hari Besar' },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id as any)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg ${
                tab === t.id ? 'bg-[#064E3B] text-white' : 'text-[#5F6F65]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* TAB 1: POSTERS */}
      {tab === 'posters' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={openPosterCreate}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold bg-[#064E3B] text-white rounded-lg"
            >
              <Plus className="w-4 h-4" />
              Buat Poster Baru
            </button>
          </div>

          {loading ? (
            <div className="h-64 bg-[#EAE5D9] rounded-xl animate-pulse" />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {posters.map((p) => (
                <div
                  key={p.id}
                  className="bg-white border border-[#E4DFD3] rounded-xl overflow-hidden flex flex-col"
                >
                  <div className="aspect-[3/4] bg-[#EFECE4]">
                    <img
                      src={p.imageUrl}
                      alt={p.title}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                    <div>
                      <div className="text-xs font-semibold text-[#8C6826]">
                        {getStatusLabel(p.status)} · {formatDateIndo(p.eventDate)}
                      </div>
                      <h3 className="font-display font-bold text-[#14221B] mt-1">{p.title}</h3>
                      <p className="text-xs text-[#5F6F65] line-clamp-2 mt-1">{p.description}</p>
                    </div>

                    <div className="pt-3 border-t border-[#EFECE4] flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setPreviewPoster(p)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs border border-[#E4DFD3] rounded-lg"
                      >
                        <Eye className="w-3.5 h-3.5" /> Preview
                      </button>
                      <button
                        type="button"
                        onClick={() => openPosterEdit(p)}
                        className="px-2.5 py-1.5 text-xs border border-[#E4DFD3] rounded-lg"
                      >
                        Edit
                      </button>
                      {p.status !== 'published' && (
                        <button
                          type="button"
                          onClick={() => handlePosterStatus(p.id, 'published')}
                          className="px-2.5 py-1.5 text-xs font-semibold bg-[#064E3B] text-white rounded-lg"
                        >
                          Terbitkan
                        </button>
                      )}
                      {p.status === 'published' && (
                        <button
                          type="button"
                          onClick={() => handlePosterStatus(p.id, 'archived')}
                          className="px-2.5 py-1.5 text-xs font-semibold bg-amber-100 text-amber-900 rounded-lg"
                        >
                          Arsipkan
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDeletePoster(p)}
                        className="p-1.5 text-red-700 hover:bg-red-50 rounded-lg ml-auto"
                        aria-label="Hapus poster"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: ACTIVITIES */}
      {tab === 'activities' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setActModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold bg-[#064E3B] text-white rounded-lg"
            >
              <Plus className="w-4 h-4" />
              Tambah Agenda Kegiatan
            </button>
          </div>
          <div className="bg-white border border-[#E4DFD3] rounded-xl divide-y divide-[#EFECE4]">
            {activities.map((a) => (
              <div key={a.id} className="p-4 flex items-center justify-between gap-4">
                <div>
                  <div className="text-xs text-[#8C6826]">
                    {a.category} · {formatDateIndo(a.activityDate)} · {a.startTime}
                  </div>
                  <div className="font-semibold text-sm text-[#14221B]">{a.title}</div>
                  <div className="text-xs text-[#5F6F65]">{a.location}</div>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    const ok = await confirm({
                      title: 'Hapus Agenda?',
                      message: `Hapus agenda "${a.title}"?`,
                      danger: true,
                    });
                    if (!ok) return;
                    await apiRequest(`/api/admin/content/activities/${a.id}`, { method: 'DELETE' });
                    loadAll();
                  }}
                  className="text-xs text-red-700 hover:underline"
                >
                  Hapus
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: ANNOUNCEMENTS */}
      {tab === 'announcements' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setAnnModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold bg-[#064E3B] text-white rounded-lg"
            >
              <Plus className="w-4 h-4" />
              Buat Pengumuman
            </button>
          </div>
          <div className="bg-white border border-[#E4DFD3] rounded-xl divide-y divide-[#EFECE4]">
            {announcements.map((an) => (
              <div key={an.id} className="p-4 flex items-start justify-between gap-4">
                <div>
                  <div className="text-xs font-medium text-[#8C6826]">
                    {an.priority === 'penting' ? 'Penting' : 'Normal'}
                  </div>
                  <div className="font-semibold text-sm text-[#14221B]">{an.title}</div>
                  <p className="text-xs text-[#4A5A51] mt-1">{an.content}</p>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    const ok = await confirm({
                      title: 'Hapus Pengumuman?',
                      message: `Hapus pengumuman "${an.title}"?`,
                      danger: true,
                    });
                    if (!ok) return;
                    await apiRequest(`/api/admin/content/announcements/${an.id}`, {
                      method: 'DELETE',
                    });
                    loadAll();
                  }}
                  className="text-xs text-red-700 hover:underline"
                >
                  Hapus
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: ISLAMIC EVENTS */}
      {tab === 'islamic' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => openEvModal()}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold bg-[#064E3B] text-white rounded-lg"
            >
              <Plus className="w-4 h-4" />
              Tambah Hari Besar / Penyesuaian
            </button>
          </div>
          <div className="bg-white border border-[#E4DFD3] rounded-xl divide-y divide-[#EFECE4]">
            {islamicEvents.map((ev) => (
              <div key={ev.id} className="p-4 flex items-center justify-between gap-4">
                <div>
                  <div className="text-xs text-[#8C6826] font-mono">
                    {ev.hijriDay}/{ev.hijriMonth}/{ev.hijriYear} H · {formatDateIndo(ev.gregorianDate)}
                  </div>
                  <div className="font-semibold text-sm text-[#14221B]">{ev.title}</div>
                  <div className="text-xs text-[#5F6F65]">{ev.description}</div>
                </div>
                <button
                  type="button"
                  onClick={() => openEvModal(ev)}
                  className="px-3 py-1.5 text-xs border border-[#E4DFD3] rounded-lg"
                >
                  Sesuaikan Tanggal
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* POSTER CREATE/EDIT MODAL */}
      {posterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
          <div className="bg-white border border-[#E4DFD3] rounded-2xl max-w-lg w-full p-6 shadow-xl my-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-lg font-bold">
                {editingPoster ? 'Edit Poster Kegiatan' : 'Buat Poster Kegiatan'}
              </h2>
              <button type="button" onClick={() => setPosterModal(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handlePosterSave} className="space-y-3.5">
              <input
                type="text"
                required
                value={pTitle}
                onChange={(e) => setPTitle(e.target.value)}
                placeholder="Judul Kegiatan"
                className="w-full px-3 py-2 text-sm border border-[#E4DFD3] rounded-lg bg-[#FAF9F5]"
              />
              <textarea
                required
                rows={3}
                value={pDesc}
                onChange={(e) => setPDesc(e.target.value)}
                placeholder="Deskripsi kegiatan..."
                className="w-full px-3 py-2 text-sm border border-[#E4DFD3] rounded-lg bg-[#FAF9F5]"
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="date"
                  required
                  value={pDate}
                  onChange={(e) => setPDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-[#E4DFD3] rounded-lg bg-[#FAF9F5]"
                />
                <input
                  type="text"
                  required
                  value={pTime}
                  onChange={(e) => setPTime(e.target.value)}
                  placeholder="08:00 - 10:00 WIB"
                  className="w-full px-3 py-2 text-sm border border-[#E4DFD3] rounded-lg bg-[#FAF9F5]"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  required
                  value={pLocation}
                  onChange={(e) => setPLocation(e.target.value)}
                  placeholder="Lokasi"
                  className="w-full px-3 py-2 text-sm border border-[#E4DFD3] rounded-lg bg-[#FAF9F5]"
                />
                <input
                  type="text"
                  required
                  value={pContact}
                  onChange={(e) => setPContact(e.target.value)}
                  placeholder="Narahubung"
                  className="w-full px-3 py-2 text-sm border border-[#E4DFD3] rounded-lg bg-[#FAF9F5]"
                />
              </div>
              <select
                value={pStatus}
                onChange={(e) => setPStatus(e.target.value as any)}
                className="w-full px-3 py-2 text-sm border border-[#E4DFD3] rounded-lg bg-[#FAF9F5]"
              >
                <option value="draft">Simpan sebagai Draft</option>
                <option value="published">Publikasikan ke Halaman Publik</option>
                <option value="archived">Arsipkan</option>
              </select>
              <label className="flex items-center gap-2 px-3 py-2 border border-dashed border-[#C7C0B0] rounded-lg bg-[#FAF9F5] cursor-pointer text-xs">
                <Upload className="w-4 h-4 text-[#064E3B]" />
                <span>{pFile ? pFile.name : 'Unggah gambar poster (JPG/PNG/WebP)'}</span>
                <input
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp"
                  className="hidden"
                  onChange={(e) => setPFile(e.target.files?.[0] || null)}
                />
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPosterModal(false)}
                  className="px-4 py-2 text-xs font-semibold border border-[#E4DFD3] rounded-lg"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-semibold bg-[#064E3B] text-white rounded-lg"
                >
                  Simpan Poster
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PREVIEW MODAL */}
      {previewPoster && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-xl">
            <img
              src={previewPoster.imageUrl}
              alt={previewPoster.title}
              referrerPolicy="no-referrer"
              className="w-full aspect-[3/4] object-cover"
            />
            <div className="p-5">
              <h3 className="font-display font-bold text-lg">{previewPoster.title}</h3>
              <p className="text-xs text-[#5F6F65] mt-1">
                {formatDateIndo(previewPoster.eventDate)} · {previewPoster.eventTime} · {previewPoster.location}
              </p>
              <button
                type="button"
                onClick={() => setPreviewPoster(null)}
                className="mt-4 w-full py-2 text-xs font-semibold bg-[#064E3B] text-white rounded-lg"
              >
                Tutup Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ACTIVITY MODAL */}
      {actModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4">
            <h2 className="font-display text-lg font-bold">Tambah Agenda Kegiatan</h2>
            <form onSubmit={handleSaveActivity} className="space-y-3">
              <input
                type="text"
                required
                value={aTitle}
                onChange={(e) => setATitle(e.target.value)}
                placeholder="Nama Kegiatan"
                className="w-full px-3 py-2 text-sm border border-[#E4DFD3] rounded-lg"
              />
              <input
                type="text"
                required
                value={aCategory}
                onChange={(e) => setACategory(e.target.value)}
                placeholder="Kategori"
                className="w-full px-3 py-2 text-sm border border-[#E4DFD3] rounded-lg"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="date"
                  required
                  value={aDate}
                  onChange={(e) => setADate(e.target.value)}
                  className="px-3 py-2 text-sm border border-[#E4DFD3] rounded-lg"
                />
                <input
                  type="text"
                  required
                  value={aStart}
                  onChange={(e) => setAStart(e.target.value)}
                  placeholder="18:30"
                  className="px-3 py-2 text-sm border border-[#E4DFD3] rounded-lg"
                />
              </div>
              <input
                type="text"
                required
                value={aLoc}
                onChange={(e) => setALoc(e.target.value)}
                placeholder="Lokasi"
                className="w-full px-3 py-2 text-sm border border-[#E4DFD3] rounded-lg"
              />
              <input
                type="text"
                value={aSpeaker}
                onChange={(e) => setASpeaker(e.target.value)}
                placeholder="Pemateri / Ustadz (opsional)"
                className="w-full px-3 py-2 text-sm border border-[#E4DFD3] rounded-lg"
              />
              <textarea
                required
                rows={2}
                value={aDesc}
                onChange={(e) => setADesc(e.target.value)}
                placeholder="Deskripsi"
                className="w-full px-3 py-2 text-sm border border-[#E4DFD3] rounded-lg"
              />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setActModal(false)} className="px-4 py-2 text-xs border rounded-lg">
                  Batal
                </button>
                <button type="submit" className="px-4 py-2 text-xs font-semibold bg-[#064E3B] text-white rounded-lg">
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ANNOUNCEMENT MODAL */}
      {annModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4">
            <h2 className="font-display text-lg font-bold">Buat Pengumuman Masjid</h2>
            <form onSubmit={handleSaveAnnouncement} className="space-y-3">
              <input
                type="text"
                required
                value={anTitle}
                onChange={(e) => setAnTitle(e.target.value)}
                placeholder="Judul Pengumuman"
                className="w-full px-3 py-2 text-sm border border-[#E4DFD3] rounded-lg"
              />
              <select
                value={anPriority}
                onChange={(e) => setAnPriority(e.target.value as any)}
                className="w-full px-3 py-2 text-sm border border-[#E4DFD3] rounded-lg"
              >
                <option value="normal">Prioritas Normal</option>
                <option value="penting">Pengumuman Penting</option>
              </select>
              <textarea
                required
                rows={3}
                value={anContent}
                onChange={(e) => setAnContent(e.target.value)}
                placeholder="Isi pengumuman..."
                className="w-full px-3 py-2 text-sm border border-[#E4DFD3] rounded-lg"
              />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setAnnModal(false)} className="px-4 py-2 text-xs border rounded-lg">
                  Batal
                </button>
                <button type="submit" className="px-4 py-2 text-xs font-semibold bg-[#064E3B] text-white rounded-lg">
                  Terbitkan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ISLAMIC EVENT MODAL */}
      {evModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4">
            <h2 className="font-display text-lg font-bold">
              {editingEv ? 'Sesuaikan Tanggal Hari Besar' : 'Tambah Hari Besar Islam'}
            </h2>
            <form onSubmit={handleSaveEv} className="space-y-3">
              <input
                type="text"
                required
                value={evTitle}
                onChange={(e) => setEvTitle(e.target.value)}
                placeholder="Nama Peringatan"
                className="w-full px-3 py-2 text-sm border border-[#E4DFD3] rounded-lg"
              />
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={evHDay}
                  onChange={(e) => setEvHDay(Number(e.target.value))}
                  placeholder="Tgl H"
                  className="px-3 py-2 text-sm border border-[#E4DFD3] rounded-lg"
                />
                <input
                  type="number"
                  min={1}
                  max={12}
                  value={evHMonth}
                  onChange={(e) => setEvHMonth(Number(e.target.value))}
                  placeholder="Bln H"
                  className="px-3 py-2 text-sm border border-[#E4DFD3] rounded-lg"
                />
                <input
                  type="number"
                  min={1400}
                  max={1550}
                  value={evHYear}
                  onChange={(e) => setEvHYear(Number(e.target.value))}
                  placeholder="Thn H"
                  className="px-3 py-2 text-sm border border-[#E4DFD3] rounded-lg"
                />
              </div>
              <input
                type="date"
                required
                value={evGDate}
                onChange={(e) => setEvGDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-[#E4DFD3] rounded-lg"
              />
              <textarea
                required
                rows={2}
                value={evDesc}
                onChange={(e) => setEvDesc(e.target.value)}
                placeholder="Keterangan"
                className="w-full px-3 py-2 text-sm border border-[#E4DFD3] rounded-lg"
              />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setEvModal(false)} className="px-4 py-2 text-xs border rounded-lg">
                  Batal
                </button>
                <button type="submit" className="px-4 py-2 text-xs font-semibold bg-[#064E3B] text-white rounded-lg">
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
