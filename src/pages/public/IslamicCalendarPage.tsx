import { useEffect, useState } from 'react';
import { ArrowLeftRight, CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { apiRequest } from '../../services/api.ts';
import { formatDateIndo } from '../../utils/format.ts';
import { IslamicEvent, MosqueActivity } from '../../types/index.ts';

interface CalendarResponse {
  todayStr: string;
  hijriToday: { day: number; month: number; monthName: string; year: number; formatted: string };
  events: IslamicEvent[];
  activities: MosqueActivity[];
}

const HIJRI_MONTHS = [
  'Muharram',
  'Safar',
  'Rabiul Awal',
  'Rabiul Akhir',
  'Jumadil Awal',
  'Jumadil Akhir',
  'Rajab',
  'Syaban',
  'Ramadan',
  'Syawal',
  'Dzulkaidah',
  'Dzulhijjah',
];

export function IslamicCalendarPage() {
  const [data, setData] = useState<CalendarResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const [viewYear, setViewYear] = useState(new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(new Date().getMonth() + 1);

  // Bidirectional converter state
  const [gregorianInput, setGregorianInput] = useState(new Date().toISOString().slice(0, 10));
  const [hijriDay, setHijriDay] = useState(1);
  const [hijriMonth, setHijriMonth] = useState(9);
  const [hijriYear, setHijriYear] = useState(1448);
  const [convOutput, setConvOutput] = useState<string>('');

  useEffect(() => {
    apiRequest<CalendarResponse>('/api/public/islamic-calendar')
      .then((res) => {
        setData(res);
        setGregorianInput(res.todayStr);
        setConvOutput(`${formatDateIndo(res.todayStr)} = ${res.hijriToday.formatted}`);
      })
      .finally(() => setLoading(false));
  }, []);

  const convertToHijri = async () => {
    const res = await apiRequest<any>(
      `/api/public/islamic-calendar?convertDate=${encodeURIComponent(gregorianInput)}`,
    );
    if (res.conversionResult) {
      setConvOutput(
        `${formatDateIndo(res.conversionResult.gregorian)} = ${res.conversionResult.hijri.formatted}`,
      );
    }
  };

  const convertToGregorian = async () => {
    const res = await apiRequest<any>(
      `/api/public/islamic-calendar?convertHijri=${hijriYear}-${hijriMonth}-${hijriDay}`,
    );
    if (res.conversionResult) {
      setConvOutput(
        `${hijriDay} ${HIJRI_MONTHS[hijriMonth - 1]} ${hijriYear} H = ${formatDateIndo(
          res.conversionResult.gregorian,
        )}`,
      );
    }
  };

  const daysInMonth = new Date(viewYear, viewMonth, 0).getDate();
  const firstWeekday = new Date(viewYear, viewMonth - 1, 1).getDay(); // 0=Sun
  const monthPrefix = `${viewYear}-${String(viewMonth).padStart(2, '0')}`;

  const monthEvents = (data?.events || []).filter((e) => e.gregorianDate.startsWith(monthPrefix));
  const monthActivities = (data?.activities || []).filter((a) =>
    a.activityDate.startsWith(monthPrefix),
  );

  const prevMonth = () => {
    if (viewMonth === 1) {
      setViewMonth(12);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (viewMonth === 12) {
      setViewMonth(1);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-[#14221B]">
            Kalender Islam & Hari Besar
          </h1>
          <p className="text-sm text-[#5F6F65] mt-1">
            {data
              ? `Hari ini: ${formatDateIndo(data.todayStr)} · ${data.hijriToday.formatted}`
              : 'Memuat penanggalan Hijriah & Masehi...'}
          </p>
        </div>
      </div>

      {/* Date Converter */}
      <div className="bg-white border border-[#E4DFD3] rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <ArrowLeftRight className="w-4 h-4 text-[#064E3B]" />
          <h2 className="font-display text-lg font-bold text-[#14221B]">
            Konversi Tanggal Masehi ↔ Hijriah
          </h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-[#4A5A51]">Masehi ke Hijriah</label>
            <div className="flex gap-2">
              <input
                type="date"
                value={gregorianInput}
                onChange={(e) => setGregorianInput(e.target.value)}
                className="flex-1 px-3 py-2 text-sm border border-[#E4DFD3] rounded-lg bg-[#FAF9F5]"
              />
              <button
                type="button"
                onClick={convertToHijri}
                className="px-4 py-2 text-xs font-semibold bg-[#064E3B] text-white rounded-lg hover:bg-emerald-800 whitespace-nowrap"
              >
                Konversi
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-semibold text-[#4A5A51]">Hijriah ke Masehi</label>
            <div className="flex flex-wrap gap-2">
              <input
                type="number"
                min={1}
                max={30}
                value={hijriDay}
                onChange={(e) => setHijriDay(Number(e.target.value))}
                className="w-20 px-3 py-2 text-sm border border-[#E4DFD3] rounded-lg bg-[#FAF9F5] tabular-nums"
              />
              <select
                value={hijriMonth}
                onChange={(e) => setHijriMonth(Number(e.target.value))}
                className="flex-1 min-w-[140px] px-3 py-2 text-sm border border-[#E4DFD3] rounded-lg bg-[#FAF9F5]"
              >
                {HIJRI_MONTHS.map((m, idx) => (
                  <option key={m} value={idx + 1}>
                    {m}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min={1400}
                max={1550}
                value={hijriYear}
                onChange={(e) => setHijriYear(Number(e.target.value))}
                className="w-24 px-3 py-2 text-sm border border-[#E4DFD3] rounded-lg bg-[#FAF9F5] tabular-nums"
              />
              <button
                type="button"
                onClick={convertToGregorian}
                className="px-4 py-2 text-xs font-semibold bg-[#064E3B] text-white rounded-lg hover:bg-emerald-800 whitespace-nowrap"
              >
                Konversi
              </button>
            </div>
          </div>
        </div>

        {convOutput && (
          <div className="mt-4 px-4 py-3 bg-[#FAF9F5] border border-[#E4DFD3] rounded-lg text-sm font-medium text-[#064E3B]">
            Hasil Konversi: {convOutput}
          </div>
        )}
      </div>

      {/* Calendar Grid + Islamic Holidays */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white border border-[#E4DFD3] rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-display text-lg font-bold text-[#14221B]">
              {new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(
                new Date(viewYear, viewMonth - 1, 1),
              )}
            </h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={prevMonth}
                className="p-2 border border-[#E4DFD3] rounded-lg hover:bg-[#FAF9F5]"
                aria-label="Bulan sebelumnya"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={nextMonth}
                className="p-2 border border-[#E4DFD3] rounded-lg hover:bg-[#FAF9F5]"
                aria-label="Bulan berikutnya"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-2 text-center text-xs font-semibold text-[#5F6F65] mb-2">
            {['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'].map((d) => (
              <div key={d} className="py-1">
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: firstWeekday }).map((_, i) => (
              <div key={`empty-${i}`} className="h-20 rounded-lg bg-[#FAF9F5]/50" />
            ))}
            {Array.from({ length: daysInMonth }).map((_, idx) => {
              const day = idx + 1;
              const iso = `${viewYear}-${String(viewMonth).padStart(2, '0')}-${String(day).padStart(
                2,
                '0',
              )}`;
              const isToday = data?.todayStr === iso;
              const dayEvents = monthEvents.filter((e) => e.gregorianDate === iso);
              const dayActs = monthActivities.filter((a) => a.activityDate === iso);

              return (
                <div
                  key={iso}
                  className={`h-20 rounded-lg border p-1.5 flex flex-col justify-between text-left ${
                    isToday
                      ? 'bg-[#064E3B] text-white border-[#064E3B]'
                      : dayEvents.length > 0
                        ? 'bg-amber-50/80 border-amber-300'
                        : 'bg-[#FAF9F5] border-[#E4DFD3]'
                  }`}
                >
                  <span className="font-mono text-xs font-semibold tabular-nums">{day}</span>
                  <div className="space-y-0.5 overflow-hidden">
                    {dayEvents.map((ev) => (
                      <div
                        key={ev.id}
                        className={`text-[10px] leading-tight truncate font-medium ${
                          isToday ? 'text-[#E7C983]' : 'text-[#8C6826]'
                        }`}
                        title={ev.title}
                      >
                        {ev.title}
                      </div>
                    ))}
                    {dayActs.map((ac) => (
                      <div
                        key={ac.id}
                        className={`text-[10px] leading-tight truncate ${
                          isToday ? 'text-emerald-100' : 'text-[#064E3B]'
                        }`}
                        title={ac.title}
                      >
                        {ac.title}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Major Islamic Events List */}
        <div className="bg-white border border-[#E4DFD3] rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <CalendarDays className="w-5 h-5 text-[#064E3B]" />
            <h2 className="font-display text-lg font-bold text-[#14221B]">
              Hari Besar Islam (DKM)
            </h2>
          </div>
          <p className="text-xs text-[#5F6F65] mb-4 leading-relaxed">
            Penanggalan hari besar Islam dapat disesuaikan oleh pengurus DKM mengikuti ketetapan resmi.
          </p>

          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-14 bg-[#EAE5D9] rounded-lg animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="divide-y divide-[#EFECE4]">
              {(data?.events || []).map((ev) => (
                <div key={ev.id} className="py-3.5 first:pt-0 last:pb-0">
                  <div className="text-xs text-[#8C6826] font-medium">
                    {ev.hijriDay} {HIJRI_MONTHS[ev.hijriMonth - 1]} {ev.hijriYear} H{' '}
                    <span aria-hidden="true">·</span> {formatDateIndo(ev.gregorianDate)}
                  </div>
                  <div className="font-semibold text-sm text-[#14221B] mt-0.5">{ev.title}</div>
                  <p className="text-xs text-[#5F6F65] mt-1 leading-relaxed">{ev.description}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
