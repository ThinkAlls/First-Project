import { useEffect, useState } from 'react';
import { Calendar, Clock, MapPin, ArrowRight, Megaphone, X } from 'lucide-react';
import { apiRequest } from '../../services/api.ts';
import { formatDateIndo, formatRupiah } from '../../utils/format.ts';
import { useNextPrayerCountdown } from '../../components/PrayerCountdown.tsx';
import { GeometricDivider } from '../../components/GeometricDivider.tsx';
import { PublicRoute } from '../../layouts/PublicLayout.tsx';
import {
  Announcement,
  EventPoster,
  FundBalances,
  MosqueActivity,
  MosqueSettings,
  PrayerSchedule,
} from '../../types/index.ts';

interface HomeData {
  settings: MosqueSettings;
  todayStr: string;
  hijriToday: { formatted: string };
  todayPrayer: PrayerSchedule | null;
  prayerSourceStatus: 'live' | 'cached' | 'unavailable';
  balances: FundBalances;
  posters: EventPoster[];
  activities: MosqueActivity[];
  announcements: Announcement[];
}

export function HomePage({ onNavigate }: { onNavigate: (r: PublicRoute) => void }) {
  const [data, setData] = useState<HomeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedPoster, setSelectedPoster] = useState<EventPoster | null>(null);

  useEffect(() => {
    apiRequest<HomeData>('/api/public/home')
      .then(setData)
      .catch((err) => setError(err.message || 'Gagal memuat beranda masjid.'))
      .finally(() => setLoading(false));
  }, []);

  const countdown = useNextPrayerCountdown(
    data?.todayPrayer || null,
    data?.settings?.timezone || 'WIB',
  );

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
        <div className="h-[420px] rounded-2xl bg-[#EAE5D9] animate-pulse" />
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-24 rounded-xl bg-[#EAE5D9] animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <p className="text-red-700 font-medium mb-4">{error || 'Data belum tersedia.'}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="px-4 py-2 text-sm font-medium bg-[#064E3B] text-white rounded-lg"
        >
          Muat Ulang
        </button>
      </div>
    );
  }

  const { settings, todayStr, hijriToday, todayPrayer, prayerSourceStatus, balances, posters, activities, announcements } = data;

  const prayerCards = todayPrayer
    ? [
        { key: 'fajr', label: 'Subuh', time: todayPrayer.fajr },
        { key: 'sunrise', label: 'Terbit', time: todayPrayer.sunrise },
        { key: 'dhuhr', label: 'Zuhur', time: todayPrayer.dhuhr },
        { key: 'asr', label: 'Asar', time: todayPrayer.asr },
        { key: 'maghrib', label: 'Magrib', time: todayPrayer.maghrib },
        { key: 'isha', label: 'Isya', time: todayPrayer.isha },
      ]
    : [];

  return (
    <div>
      {/* Hero Section */}
      <section className="relative bg-[#064E3B] text-white overflow-hidden">
        <div className="absolute inset-0">
          <img
            src={settings.heroImageUrl || '/src/assets/images/hero_mosque_architecture_1795249574221.jpg'}
            alt={settings.mosqueName}
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover opacity-55"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#042F24] via-[#064E3B]/75 to-[#064E3B]/45" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28">
          <div className="max-w-3xl">
            <div className="text-xs font-medium tracking-wide text-[#E7C983] mb-3">
              {formatDateIndo(todayStr)} <span aria-hidden="true">·</span> {hijriToday.formatted}
            </div>
            <h1 className="font-display text-4xl sm:text-5xl font-bold tracking-tight text-white [text-wrap:balance] leading-[1.12] mb-4">
              {settings.mosqueName}
            </h1>
            <p className="text-base sm:text-lg text-emerald-50/90 leading-relaxed mb-4 max-w-2xl">
              {settings.shortDescription}
            </p>
            <div className="flex items-center gap-2 text-sm text-emerald-100/85 mb-8">
              <MapPin className="w-4 h-4 text-[#D4AF63] shrink-0" />
              <span>{settings.address}</span>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={() => onNavigate('zakat')}
                className="px-6 py-3 text-sm font-semibold bg-[#D4AF63] text-[#14221B] rounded-lg hover:bg-[#DFBE76] transition-colors"
              >
                Kalkulator Zakat & Bayar
              </button>
              <button
                type="button"
                onClick={() => onNavigate('transparency')}
                className="px-6 py-3 text-sm font-semibold border border-white/35 text-white rounded-lg hover:bg-white/10 transition-colors"
              >
                Lihat Transparansi Dana
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Prayer Times Strip (Below Hero) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-8 relative z-10">
        <div className="bg-white border border-[#E4DFD3] rounded-2xl p-6 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-[#EFECE4]">
            <div>
              <h2 className="font-display text-lg font-bold text-[#14221B]">
                Jadwal Salat Hari Ini — {settings.city} ({settings.timezone})
              </h2>
              <p className="text-xs text-[#5F6F65] mt-0.5">
                {prayerSourceStatus === 'live'
                  ? 'Sumber waktu salat terhubung langsung ke Aladhan API'
                  : prayerSourceStatus === 'cached'
                    ? 'Menampilkan data jadwal salat tersimpan terakhir'
                    : 'Jadwal salat belum tersedia saat ini'}
              </p>
            </div>

            {countdown && (
              <div className="flex items-center gap-3 bg-[#FAF9F5] border border-[#E4DFD3] rounded-xl px-4 py-2.5">
                <Clock className="w-4 h-4 text-[#064E3B] shrink-0" />
                <div className="text-xs text-[#4A5A51]">
                  Menuju <span className="font-semibold text-[#14221B]">{countdown.nextLabel}</span>
                </div>
                <div className="font-mono text-base font-semibold text-[#064E3B] tabular-nums">
                  {countdown.countdown}
                </div>
              </div>
            )}
          </div>

          {prayerCards.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-5">
              {prayerCards.map((p) => {
                const isNext = countdown?.nextKey === p.key;
                return (
                  <div
                    key={p.key}
                    className={`rounded-xl px-4 py-3 border transition-colors ${
                      isNext
                        ? 'bg-[#064E3B] text-white border-[#064E3B]'
                        : 'bg-[#FAF9F5] text-[#14221B] border-[#E4DFD3]'
                    }`}
                  >
                    <div className={`text-xs font-medium ${isNext ? 'text-emerald-200' : 'text-[#5F6F65]'}`}>
                      {p.label}
                    </div>
                    <div className="font-mono text-xl font-semibold tabular-nums mt-1">
                      {p.time}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-6 text-sm text-[#5F6F65]">
              Jadwal salat belum dapat diambil. Silakan periksa pengaturan lokasi atau coba lagi nanti.
            </div>
          )}

          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={() => onNavigate('prayer')}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#064E3B] hover:text-emerald-700"
            >
              <span>Lihat Jadwal Bulanan & Pengaturan Zona Waktu</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </section>

      {/* Segregated Financial Transparency Summary */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-14">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
          <div>
            <h2 className="font-display text-2xl font-bold text-[#14221B]">
              Ringkasan Keuangan Masjid (Pembukuan Terpisah)
            </h2>
            <p className="text-sm text-[#5F6F65] mt-1">
              Kas Masjid dan Dana Zakat dikelola pada pembukuan terpisah sesuai ketentuan syariah.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('transparency')}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#064E3B] hover:underline whitespace-nowrap"
          >
            <span>Detail Laporan Publik</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          <div className="bg-white border border-[#E4DFD3] rounded-xl p-6">
            <div className="text-xs font-medium text-[#5F6F65]">Saldo Kas Masjid</div>
            <div className="font-mono text-2xl font-bold text-[#064E3B] tabular-nums mt-2">
              {formatRupiah(balances.mosqueCash.balance)}
            </div>
            <div className="text-xs text-[#5F6F65] mt-3 pt-3 border-t border-[#EFECE4] tabular-nums">
              Masuk {formatRupiah(balances.mosqueCash.income)} · Keluar {formatRupiah(balances.mosqueCash.expense)}
            </div>
          </div>

          <div className="bg-white border border-[#E4DFD3] rounded-xl p-6">
            <div className="text-xs font-medium text-[#5F6F65]">Dana Zakat Fitrah (Tersisa)</div>
            <div className="font-mono text-2xl font-bold text-[#14221B] tabular-nums mt-2">
              {formatRupiah(balances.zakatFitrah.balance)}
            </div>
            <div className="text-xs text-[#5F6F65] mt-3 pt-3 border-t border-[#EFECE4] tabular-nums">
              Terkumpul {formatRupiah(balances.zakatFitrah.income)} · Tersalurkan {formatRupiah(balances.zakatFitrah.distributed)}
            </div>
          </div>

          <div className="bg-white border border-[#E4DFD3] rounded-xl p-6">
            <div className="text-xs font-medium text-[#5F6F65]">Dana Zakat Mal (Tersisa)</div>
            <div className="font-mono text-2xl font-bold text-[#14221B] tabular-nums mt-2">
              {formatRupiah(balances.zakatMal.balance)}
            </div>
            <div className="text-xs text-[#5F6F65] mt-3 pt-3 border-t border-[#EFECE4] tabular-nums">
              Terkumpul {formatRupiah(balances.zakatMal.income)} · Tersalurkan {formatRupiah(balances.zakatMal.distributed)}
            </div>
          </div>

          <div className="bg-[#064E3B] text-white border border-[#064E3B] rounded-xl p-6 flex flex-col justify-between">
            <div>
              <div className="text-xs font-medium text-emerald-200">Tunaikan Kewajiban & Infak</div>
              <p className="text-sm text-emerald-50 mt-2 leading-relaxed">
                Hitung zakat fitrah, zakat mal, infak, atau sedekah Anda dengan kalkulator terpadu.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('zakat')}
              className="mt-4 w-full py-2.5 px-4 text-xs font-semibold bg-[#D4AF63] text-[#14221B] rounded-lg hover:bg-[#DFBE76] transition-colors"
            >
              Bayar Zakat & Infak Sekarang
            </button>
          </div>
        </div>

        {/* Separated Asset Valuation Strip */}
        <div className="mt-5 bg-[#FAF9F5] border border-[#E4DFD3] rounded-xl px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold text-[#8C6826]">
              Nilai Aset & Inventaris Masjid (Terpisah dari Kas Tunai)
            </div>
            <div className="text-xs text-[#5F6F65] mt-0.5">
              {balances.mosqueAssets?.totalItems ?? 0} jenis aset tetap ({balances.mosqueAssets?.totalQuantity ?? 0} unit/bidang) tercatat terpisah dari saldo kas.
            </div>
          </div>
          <div className="font-mono text-xl font-bold text-[#14221B] tabular-nums">
            {formatRupiah(balances.mosqueAssets?.totalNominalValue ?? 0)}
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <GeometricDivider />
      </div>

      {/* Published Event Posters */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
          <div>
            <h2 className="font-display text-2xl font-bold text-[#14221B]">
              Poster & Kegiatan Terpublikasi
            </h2>
            <p className="text-sm text-[#5F6F65] mt-1">
              Informasi program kajian, dakwah, dan kegiatan sosial resmi dari Sekretariat DKM.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('activities')}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#064E3B] hover:underline whitespace-nowrap"
          >
            <span>Semua Kegiatan</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {posters.length === 0 ? (
          <div className="bg-white border border-[#E4DFD3] rounded-xl p-8 text-center text-sm text-[#5F6F65]">
            Belum ada poster kegiatan yang dipublikasikan.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {posters.map((poster) => (
              <article
                key={poster.id}
                className="bg-white border border-[#E4DFD3] rounded-xl overflow-hidden flex flex-col"
              >
                <div className="aspect-[3/4] bg-[#EFECE4] overflow-hidden">
                  <img
                    src={poster.imageUrl}
                    alt={poster.title}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="p-5 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="text-xs text-[#5F6F65] mb-1.5">
                      {formatDateIndo(poster.eventDate)} <span aria-hidden="true">·</span> {poster.eventTime}
                    </div>
                    <h3 className="font-display text-lg font-bold text-[#14221B] leading-snug mb-2">
                      {poster.title}
                    </h3>
                    <p className="text-sm text-[#4A5A51] line-clamp-2 leading-relaxed">
                      {poster.description}
                    </p>
                  </div>
                  <div className="mt-4 pt-4 border-t border-[#EFECE4] flex items-center justify-between gap-2">
                    <span className="text-xs text-[#5F6F65] truncate">{poster.location}</span>
                    <button
                      type="button"
                      onClick={() => setSelectedPoster(poster)}
                      className="text-xs font-semibold text-[#064E3B] hover:underline whitespace-nowrap shrink-0"
                    >
                      Lihat Detail
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* Announcements & Upcoming Activities Split */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-14 grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white border border-[#E4DFD3] rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Megaphone className="w-5 h-5 text-[#064E3B]" />
            <h2 className="font-display text-xl font-bold text-[#14221B]">Pengumuman Masjid</h2>
          </div>
          {announcements.length === 0 ? (
            <p className="text-sm text-[#5F6F65]">Tidak ada pengumuman terbaru.</p>
          ) : (
            <div className="divide-y divide-[#EFECE4]">
              {announcements.map((a) => (
                <div key={a.id} className="py-4 first:pt-0 last:pb-0">
                  <div className="text-xs font-medium text-[#8C6826] mb-1">
                    {a.priority === 'penting' ? 'Pengumuman Penting' : 'Informasi DKM'}
                  </div>
                  <h3 className="font-semibold text-[#14221B] text-base mb-1">{a.title}</h3>
                  <p className="text-sm text-[#4A5A51] leading-relaxed">{a.content}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white border border-[#E4DFD3] rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="w-5 h-5 text-[#064E3B]" />
            <h2 className="font-display text-xl font-bold text-[#14221B]">Agenda Kajian & Program</h2>
          </div>
          {activities.length === 0 ? (
            <p className="text-sm text-[#5F6F65]">Belum ada agenda kegiatan terdaftar.</p>
          ) : (
            <div className="divide-y divide-[#EFECE4]">
              {activities.map((act) => (
                <div key={act.id} className="py-4 first:pt-0 last:pb-0">
                  <div className="text-xs text-[#5F6F65] mb-1">
                    {act.category} <span aria-hidden="true">·</span> {formatDateIndo(act.activityDate)}{' '}
                    <span aria-hidden="true">·</span> {act.startTime}
                  </div>
                  <h3 className="font-semibold text-[#14221B] text-base">{act.title}</h3>
                  <div className="text-xs text-[#4A5A51] mt-1">
                    {act.speaker ? `Pemateri: ${act.speaker} · ` : ''}
                    {act.location}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Poster Detail Modal */}
      {selectedPoster && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto">
          <div className="bg-white border border-[#E4DFD3] rounded-2xl max-w-2xl w-full overflow-hidden shadow-xl my-8">
            <div className="grid grid-cols-1 md:grid-cols-2">
              <div className="bg-[#EFECE4] aspect-[3/4]">
                <img
                  src={selectedPoster.imageUrl}
                  alt={selectedPoster.title}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="p-6 flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <span className="text-xs font-medium text-[#8C6826]">Poster Kegiatan Resmi</span>
                    <button
                      type="button"
                      onClick={() => setSelectedPoster(null)}
                      className="p-1 text-[#5F6F65] hover:text-[#14221B]"
                      aria-label="Tutup detail"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  <h3 className="font-display text-xl font-bold text-[#14221B] mb-3">
                    {selectedPoster.title}
                  </h3>
                  <p className="text-sm text-[#4A5A51] leading-relaxed mb-5">
                    {selectedPoster.description}
                  </p>
                  <div className="space-y-2 text-xs text-[#4A5A51] border-t border-[#EFECE4] pt-4">
                    <div>
                      <span className="font-semibold text-[#14221B]">Tanggal:</span>{' '}
                      {formatDateIndo(selectedPoster.eventDate)}
                    </div>
                    <div>
                      <span className="font-semibold text-[#14221B]">Waktu:</span>{' '}
                      {selectedPoster.eventTime}
                    </div>
                    <div>
                      <span className="font-semibold text-[#14221B]">Lokasi:</span>{' '}
                      {selectedPoster.location}
                    </div>
                    <div>
                      <span className="font-semibold text-[#14221B]">Narahubung:</span>{' '}
                      {selectedPoster.contactInfo}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedPoster(null)}
                  className="mt-6 w-full py-2.5 text-xs font-semibold bg-[#064E3B] text-white rounded-lg hover:bg-emerald-800"
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
