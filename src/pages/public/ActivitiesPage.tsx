import { useEffect, useState } from 'react';
import { Calendar, Clock, MapPin, Phone, Search, X } from 'lucide-react';
import { apiRequest } from '../../services/api.ts';
import { formatDateIndo } from '../../utils/format.ts';
import { EventPoster, MosqueActivity } from '../../types/index.ts';

export function ActivitiesPage() {
  const [posters, setPosters] = useState<EventPoster[]>([]);
  const [activities, setActivities] = useState<MosqueActivity[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<EventPoster | null>(null);

  useEffect(() => {
    apiRequest<{ posters: EventPoster[]; activities: MosqueActivity[] }>('/api/public/posters')
      .then((res) => {
        setPosters(res.posters || []);
        setActivities(res.activities || []);
      })
      .finally(() => setLoading(false));
  }, []);

  const filteredPosters = posters.filter(
    (p) =>
      p.title.toLowerCase().includes(search.toLowerCase()) ||
      p.description.toLowerCase().includes(search.toLowerCase()) ||
      p.location.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-[#14221B]">
            Informasi & Poster Kegiatan Masjid
          </h1>
          <p className="text-sm text-[#5F6F65] mt-1">
            Daftar program dan poster kegiatan resmi yang telah dipublikasikan oleh Sekretaris DKM.
          </p>
        </div>

        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-[#5F6F65] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari kegiatan..."
            className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-[#E4DFD3] rounded-lg"
          />
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-96 bg-[#EAE5D9] rounded-xl animate-pulse" />
          ))}
        </div>
      ) : filteredPosters.length === 0 ? (
        <div className="bg-white border border-[#E4DFD3] rounded-xl p-10 text-center text-sm text-[#5F6F65]">
          Tidak ada poster kegiatan terpublikasi yang sesuai pencarian.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {filteredPosters.map((p) => (
            <article
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
              <div className="p-5 flex-1 flex flex-col justify-between">
                <div>
                  <div className="text-xs text-[#8C6826] font-medium mb-1">
                    {formatDateIndo(p.eventDate)} · {p.eventTime}
                  </div>
                  <h2 className="font-display text-lg font-bold text-[#14221B] mb-2">{p.title}</h2>
                  <p className="text-sm text-[#4A5A51] line-clamp-3 leading-relaxed">
                    {p.description}
                  </p>
                </div>

                <div className="mt-4 pt-4 border-t border-[#EFECE4] space-y-2">
                  <div className="text-xs text-[#5F6F65] flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{p.location}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelected(p)}
                    className="w-full py-2 text-xs font-semibold bg-[#064E3B] text-white rounded-lg hover:bg-emerald-800 transition-colors"
                  >
                    Lihat Detail Kegiatan
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Scheduled Regular Activities */}
      <div className="bg-white border border-[#E4DFD3] rounded-2xl p-6">
        <h2 className="font-display text-xl font-bold text-[#14221B] mb-4">
          Agenda Rutin & Kajian Terjadwal
        </h2>
        {activities.length === 0 ? (
          <p className="text-sm text-[#5F6F65]">Belum ada agenda kegiatan rutin.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activities.map((act) => (
              <div key={act.id} className="border border-[#E4DFD3] rounded-xl p-4 bg-[#FAF9F5]">
                <div className="text-xs text-[#8C6826] font-medium mb-1">
                  {act.category} · {formatDateIndo(act.activityDate)}
                </div>
                <h3 className="font-semibold text-[#14221B]">{act.title}</h3>
                <p className="text-xs text-[#4A5A51] mt-1 leading-relaxed">{act.description}</p>
                <div className="mt-3 text-xs text-[#5F6F65]">
                  {act.startTime}
                  {act.endTime ? ` - ${act.endTime}` : ''} · {act.location}
                  {act.speaker ? ` · ${act.speaker}` : ''}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Poster Detail Modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto">
          <div className="bg-white border border-[#E4DFD3] rounded-2xl max-w-3xl w-full overflow-hidden shadow-xl my-8">
            <div className="grid grid-cols-1 md:grid-cols-2">
              <div className="aspect-[3/4] bg-[#EFECE4]">
                <img
                  src={selected.imageUrl}
                  alt={selected.title}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="p-6 flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <span className="text-xs font-semibold text-[#8C6826]">Detail Poster Kegiatan</span>
                    <button
                      type="button"
                      onClick={() => setSelected(null)}
                      className="p-1 text-[#5F6F65] hover:text-[#14221B]"
                      aria-label="Tutup"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  <h2 className="font-display text-2xl font-bold text-[#14221B] mb-3">
                    {selected.title}
                  </h2>
                  <p className="text-sm text-[#4A5A51] leading-relaxed whitespace-pre-line mb-6">
                    {selected.description}
                  </p>
                  <div className="space-y-2.5 text-sm text-[#4A5A51] border-t border-[#EFECE4] pt-4">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-[#064E3B]" />
                      <span>{formatDateIndo(selected.eventDate)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-[#064E3B]" />
                      <span>{selected.eventTime}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-[#064E3B]" />
                      <span>{selected.location}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-[#064E3B]" />
                      <span>{selected.contactInfo}</span>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="mt-6 w-full py-2.5 text-xs font-semibold bg-[#064E3B] text-white rounded-lg"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
