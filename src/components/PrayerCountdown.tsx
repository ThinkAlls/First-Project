import { useEffect, useMemo, useState } from 'react';
import { PrayerSchedule } from '../types/index.ts';

const TZ_OFFSETS: Record<string, number> = {
  WIB: 7,
  WITA: 8,
  WIT: 9,
};

function getNowInZoneSeconds(tz: string): number {
  const offsetHours = TZ_OFFSETS[tz] ?? 7;
  const nowUtc = Date.now();
  const zoneDate = new Date(nowUtc + offsetHours * 3600 * 1000);
  return zoneDate.getUTCHours() * 3600 + zoneDate.getUTCMinutes() * 60 + zoneDate.getUTCSeconds();
}

function parseTimeToSeconds(hhmm: string): number {
  const clean = hhmm.split(' ')[0] || '00:00';
  const [h, m] = clean.split(':').map(Number);
  return (h || 0) * 3600 + (m || 0) * 60;
}

export function useNextPrayerCountdown(schedule: PrayerSchedule | null, timezone: string) {
  const [nowSec, setNowSec] = useState(() => getNowInZoneSeconds(timezone));

  useEffect(() => {
    setNowSec(getNowInZoneSeconds(timezone));
    const timer = setInterval(() => {
      setNowSec(getNowInZoneSeconds(timezone));
    }, 1000);
    return () => clearInterval(timer);
  }, [timezone]);

  return useMemo(() => {
    if (!schedule) return null;

    const list = [
      { key: 'fajr', label: 'Subuh', time: schedule.fajr },
      { key: 'sunrise', label: 'Terbit', time: schedule.sunrise },
      { key: 'dhuhr', label: 'Zuhur', time: schedule.dhuhr },
      { key: 'asr', label: 'Asar', time: schedule.asr },
      { key: 'maghrib', label: 'Magrib', time: schedule.maghrib },
      { key: 'isha', label: 'Isya', time: schedule.isha },
    ];

    let next = list.find((item) => parseTimeToSeconds(item.time) > nowSec);
    let diff = 0;

    if (next) {
      diff = parseTimeToSeconds(next.time) - nowSec;
    } else {
      next = list[0];
      diff = 86400 - nowSec + parseTimeToSeconds(next.time);
    }

    const hrs = String(Math.floor(diff / 3600)).padStart(2, '0');
    const mins = String(Math.floor((diff % 3600) / 60)).padStart(2, '0');
    const secs = String(diff % 60).padStart(2, '0');

    return {
      nextKey: next.key,
      nextLabel: next.label,
      nextTime: next.time,
      countdown: `${hrs}:${mins}:${secs}`,
    };
  }, [schedule, nowSec]);
}
