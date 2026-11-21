import { useCallback, useEffect, useState } from 'react';
import { Clock, MapPin, RefreshCw } from 'lucide-react';
import { apiRequest } from '../../services/api.ts';
import { formatDateIndo } from '../../utils/format.ts';
import { useNextPrayerCountdown } from '../../components/PrayerCountdown.tsx';
import { PrayerSchedule } from '../../types/index.ts';

interface PrayerTimesResponse {
  status: 'live' | 'cached' | 'unavailable';
  city: string;
  lat: string;
  lng: string;
  timezone: 'WIB' | 'WITA' | 'WIT';
  method: number;
  todayStr: string;
  hijriToday: { formatted: string };
  todaySchedule: PrayerSchedule | null;
  monthlySchedules: PrayerSchedule[];
}

const CITY_PRESETS = [
  { label: 'Jakarta (WIB)', city: 'Jakarta', lat: '-6.2088', lng: '106.8456', tz: 'WIB' as const },
  { label: 'Bandung (WIB)', city: 'Bandung', lat: '-6.9175', lng: '107.6191', tz: 'WIB' as const },
  { label: 'Surabaya (WIB)', city: 'Surabaya', lat: '-7.2575', lng: '112.7521', tz: 'WIB' as const },
  { label: 'Yogyakarta (WIB)', city: 'Yogyakarta', lat: '-7.7956', lng: '110.3695', tz: 'WIB' as const },
  { label: 'Medan (WIB)', city: 'Medan', lat: '3.5952', lng: '98.6722', tz: 'WIB' as const },
  { label: 'Makassar (WITA)', city: 'Makassar', lat: '-5.1477', lng: '119.4327', tz: 'WITA' as const },
  { label: 'Denpasar (WITA)', city: 'Denpasar', lat: '-8.6705', lng: '115.2126', tz: 'WITA' as const },
  { label: 'Jayapura (WIT)', city: 'Jayapura', lat: '-2.5916', lng: '140.6690', tz: 'WIT' as const },
];

const METHODS = [
  { id: 20, name: 'Kementerian Agama RI (Kemenag)' },
  { id: 3, name: 'Muslim World League (MWL)' },
  { id: 4, name: 'Umm Al-Qura University, Makkah' },
  { id: 5, name: 'Egyptian General Authority of Survey' },
  { id: 2, name: 'Islamic Society of North America (ISNA)' },
];

export function PrayerTimesPage() {
  const [city, setCity] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [timezone, setTimezone] = useState<'WIB' | 'WITA' | 'WIT'>('WIB');
  const [method, setMethod] = useState<number>(20);
  const [data, setData] = useState<PrayerTimesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadSchedule = useCallback(
    async (params?: { city?: string; lat?: string; lng?: string; tz?: string; m?: number }) => {
      setLoading(true);
      setError('');
      try {
        const q = new URLSearchParams();
        if (params?.city) q.set('city', params.city);
        if (params?.lat) q.set('lat', params.lat);
        if (params?.lng) q.set('lng', params.lng);
        if (params?.tz) q.set('timezone', params.tz);
        if (params?.m) q.set('method', String(params.m));

        const res = await apiRequest<PrayerTimesResponse>(
          `/api/public/prayer-times${q.toString() ? `?${q.toString()}` : ''}`,
        );
        setData(res);
        setCity(res.city);
        setLat(res.lat);
        setLng(res.lng);
        setTimezone(res.timezone);
        setMethod(res.method);
      } catch (err: any) {
        setError(err.message || 'Gagal mengambil jadwal salat.');
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    loadSchedule();
  }, [loadSchedule]);

  const countdown = useNextPrayerCountdown(data?.todaySchedule || null, timezone);

  const handlePresetChange = (presetLabel: string) => {
    const found = CITY_PRESETS.find((p) => p.label === presetLabel);
    if (found) {
      loadSchedule({
        city: found.city,
        lat: found.lat,
        lng: found.lng,
        tz: found.tz,
        m: method,
      });
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div>
          <h1 className="font-display text-3xl font-bold text-[#14221B]">
            Jadwal Salat Harian & Bulanan
          </h1>
          <p className="text-sm text-[#5F6F65] mt-1">
            {data ? `${formatDateIndo(data.todayStr)} · ${data.hijriToday.formatted}` : 'Memuat tanggal...'}
          </p>
        </div>

        {/* Location, Timezone & Method Controls */}
        <div className="bg-white border border-[#E4DFD3] rounded-xl p-4 flex flex-wrap items-center gap-3">
          <select
            aria-label="Pilih kota"
            value={CITY_PRESETS.find((p) => p.city === city)?.label || ''}
            onChange={(e) => handlePresetChange(e.target.value)}
            className="px-3 py-2 text-xs font-medium bg-[#FAF9F5] border border-[#E4DFD3] rounded-lg"
          >
            <option value="">Lokasi Masjid ({city || 'Default'})</option>
            {CITY_PRESETS.map((p) => (
              <option key={p.label} value={p.label}>
                {p.label}
              </option>
            ))}
          </select>

          <select
            aria-label="Zona waktu"
            value={timezone}
            onChange={(e) => {
              const tz = e.target.value as 'WIB' | 'WITA' | 'WIT';
              setTimezone(tz);
              loadSchedule({ city, lat, lng, tz, m: method });
            }}
            className="px-3 py-2 text-xs font-medium bg-[#FAF9F5] border border-[#E4DFD3] rounded-lg"
          >
            <option value="WIB">WIB (UTC+7)</option>
            <option value="WITA">WITA (UTC+8)</option>
            <option value="WIT">WIT (UTC+9)</option>
          </select>

          <select
            aria-label="Metode perhitungan"
            value={method}
            onChange={(e) => {
              const m = Number(e.target.value);
              setMethod(m);
              loadSchedule({ city, lat, lng, tz: timezone, m });
            }}
            className="px-3 py-2 text-xs font-medium bg-[#FAF9F5] border border-[#E4DFD3] rounded-lg max-w-[240px]"
          >
            {METHODS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => loadSchedule({ city, lat, lng, tz: timezone, m: method })}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-[#064E3B] text-white rounded-lg hover:bg-emerald-800"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Perbarui
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 text-sm rounded-xl p-4">
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-28 bg-[#EAE5D9] rounded-xl animate-pulse" />
          ))}
        </div>
      ) : data?.todaySchedule ? (
        <>
          <div className="bg-white border border-[#E4DFD3] rounded-2xl p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#EFECE4]">
              <div className="flex items-center gap-2 text-sm text-[#4A5A51]">
                <MapPin className="w-4 h-4 text-[#064E3B]" />
                <span className="font-semibold text-[#14221B]">{data.city}</span>
                <span aria-hidden="true">·</span>
                <span>{data.timezone}</span>
                <span aria-hidden="true">·</span>
                <span>
                  {data.status === 'live'
                    ? 'Sumber Aladhan API (Live)'
                    : 'Data Tersimpan Terakhir (API tidak terjangkau)'}
                </span>
              </div>

              {countdown && (
                <div className="flex items-center gap-2.5 bg-[#064E3B] text-white px-4 py-2 rounded-lg">
                  <Clock className="w-4 h-4 text-[#D4AF63]" />
                  <span className="text-xs">Menuju {countdown.nextLabel}</span>
                  <span className="font-mono text-sm font-bold tabular-nums">
                    {countdown.countdown}
                  </span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 pt-5">
              {[
                { key: 'fajr', label: 'Subuh', time: data.todaySchedule.fajr },
                { key: 'sunrise', label: 'Terbit', time: data.todaySchedule.sunrise },
                { key: 'dhuhr', label: 'Zuhur', time: data.todaySchedule.dhuhr },
                { key: 'asr', label: 'Asar', time: data.todaySchedule.asr },
                { key: 'maghrib', label: 'Magrib', time: data.todaySchedule.maghrib },
                { key: 'isha', label: 'Isya', time: data.todaySchedule.isha },
              ].map((item) => {
                const isNext = countdown?.nextKey === item.key;
                return (
                  <div
                    key={item.key}
                    className={`rounded-xl p-4 border ${
                      isNext
                        ? 'bg-[#064E3B] text-white border-[#064E3B]'
                        : 'bg-[#FAF9F5] text-[#14221B] border-[#E4DFD3]'
                    }`}
                  >
                    <div className={`text-xs ${isNext ? 'text-emerald-200' : 'text-[#5F6F65]'}`}>
                      {item.label}
                    </div>
                    <div className="font-mono text-2xl font-bold tabular-nums mt-1">
                      {item.time}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Monthly Table */}
          <div className="bg-white border border-[#E4DFD3] rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-[#EFECE4]">
              <h2 className="font-display text-lg font-bold text-[#14221B]">
                Jadwal Salat Bulanan ({data.city})
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-[#FAF9F5] border-b border-[#E4DFD3] text-xs font-semibold text-[#4A5A51]">
                  <tr>
                    <th className="px-4 py-3">Tanggal Masehi</th>
                    <th className="px-4 py-3">Tanggal Hijriah</th>
                    <th className="px-4 py-3">Subuh</th>
                    <th className="px-4 py-3">Terbit</th>
                    <th className="px-4 py-3">Zuhur</th>
                    <th className="px-4 py-3">Asar</th>
                    <th className="px-4 py-3">Magrib</th>
                    <th className="px-4 py-3">Isya</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EFECE4]">
                  {data.monthlySchedules.map((row) => {
                    const isToday = row.scheduleDate === data.todayStr;
                    return (
                      <tr
                        key={row.scheduleDate}
                        className={isToday ? 'bg-emerald-50/70 font-semibold' : 'hover:bg-[#FAF9F5]'}
                      >
                        <td className="px-4 py-2.5 whitespace-nowrap">{formatDateIndo(row.scheduleDate)}</td>
                        <td className="px-4 py-2.5 text-[#5F6F65] whitespace-nowrap">{row.hijriDate}</td>
                        <td className="px-4 py-2.5 font-mono tabular-nums">{row.fajr}</td>
                        <td className="px-4 py-2.5 font-mono tabular-nums">{row.sunrise}</td>
                        <td className="px-4 py-2.5 font-mono tabular-nums">{row.dhuhr}</td>
                        <td className="px-4 py-2.5 font-mono tabular-nums">{row.asr}</td>
                        <td className="px-4 py-2.5 font-mono tabular-nums">{row.maghrib}</td>
                        <td className="px-4 py-2.5 font-mono tabular-nums">{row.isha}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <div className="bg-white border border-[#E4DFD3] rounded-xl p-8 text-center text-sm text-[#5F6F65]">
          Jadwal salat belum tersedia saat ini karena layanan API sedang tidak dapat diakses dan belum ada data tersimpan.
        </div>
      )}
    </div>
  );
}
