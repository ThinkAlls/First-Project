import { Router } from 'express';
import { and, desc, eq, gte, lte, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db/index.ts';
import {
  announcements,
  donors,
  eventPosters,
  expenseTransactions,
  incomeTransactions,
  islamicEvents,
  mosqueActivities,
  mosqueAssets,
  mosquePaymentMethods,
  mosqueSettings,
  prayerSchedules,
  zakatDistributions,
  zakatTransactions,
} from '../../db/schema.ts';
import { uploadSingleFile } from '../middleware/upload.ts';
import { generateTxNumber, getFundBalances } from '../utils/finance.ts';
import { gregorianToHijri, hijriToGregorian } from '../utils/hijri.ts';
import { pollGatewayTransactionStatus } from '../utils/paymentGateway.ts';
import { ensureInitialData } from '../utils/seed.ts';

const router = Router();

const TIMEZONE_IANA: Record<string, string> = {
  WIB: 'Asia/Jakarta',
  WITA: 'Asia/Makassar',
  WIT: 'Asia/Jayapura',
};

function getTodayDateString(tz: string): string {
  const iana = TIMEZONE_IANA[tz] || 'Asia/Jakarta';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: iana,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const y = parts.find((p) => p.type === 'year')?.value;
  const m = parts.find((p) => p.type === 'month')?.value;
  const d = parts.find((p) => p.type === 'day')?.value;
  return `${y}-${m}-${d}`;
}

function cleanTimeStr(raw: string): string {
  return raw.replace(/\s*\(.*\)$/, '').trim();
}

async function fetchAladhanDay(
  lat: string,
  lng: string,
  city: string,
  country: string,
  method: number,
  tz: string,
  dateStr: string,
) {
  const [yyyy, mm, dd] = dateStr.split('-');
  const iana = TIMEZONE_IANA[tz] || 'Asia/Jakarta';
  const formattedDate = `${dd}-${mm}-${yyyy}`;
  const url = `https://api.aladhan.com/v1/timings/${formattedDate}?latitude=${encodeURIComponent(
    lat,
  )}&longitude=${encodeURIComponent(lng)}&method=${method}&timezonestring=${encodeURIComponent(iana)}`;

  const response = await fetch(url, { signal: AbortSignal.timeout(6500) });
  if (!response.ok) {
    throw new Error(`Aladhan API status ${response.status}`);
  }
  const json = (await response.json()) as any;
  if (json.code !== 200 || !json.data?.timings) {
    throw new Error('Aladhan payload invalid');
  }

  const timings = json.data.timings;
  const hijri = json.data.date?.hijri;

  const schedulePayload = {
    scheduleDate: dateStr,
    hijriDate: hijri?.date || '',
    hijriMonthName: hijri?.month?.en || gregorianToHijri(dateStr).monthName,
    hijriYear: hijri?.year || String(gregorianToHijri(dateStr).year),
    fajr: cleanTimeStr(timings.Fajr),
    sunrise: cleanTimeStr(timings.Sunrise),
    dhuhr: cleanTimeStr(timings.Dhuhr),
    asr: cleanTimeStr(timings.Asr),
    maghrib: cleanTimeStr(timings.Maghrib),
    isha: cleanTimeStr(timings.Isha),
    city,
    timezone: tz,
    method,
    source: 'aladhan_api',
  };

  await db
    .insert(prayerSchedules)
    .values(schedulePayload)
    .onConflictDoUpdate({
      target: [
        prayerSchedules.scheduleDate,
        prayerSchedules.city,
        prayerSchedules.timezone,
        prayerSchedules.method,
      ],
      set: {
        fajr: schedulePayload.fajr,
        sunrise: schedulePayload.sunrise,
        dhuhr: schedulePayload.dhuhr,
        asr: schedulePayload.asr,
        maghrib: schedulePayload.maghrib,
        isha: schedulePayload.isha,
        hijriDate: schedulePayload.hijriDate,
        hijriMonthName: schedulePayload.hijriMonthName,
        hijriYear: schedulePayload.hijriYear,
        updatedAt: new Date(),
      },
    });

  return { ...schedulePayload, country };
}

// Public Home Data
router.get('/home', async (_req, res) => {
  try {
    await ensureInitialData();
    const settingsRows = await db.select().from(mosqueSettings).limit(1);
    const settings = settingsRows[0];
    const balances = await getFundBalances();

    const posters = await db
      .select()
      .from(eventPosters)
      .where(eq(eventPosters.status, 'published'))
      .orderBy(desc(eventPosters.publishedAt))
      .limit(6);

    const activities = await db
      .select()
      .from(mosqueActivities)
      .where(eq(mosqueActivities.status, 'published'))
      .orderBy(mosqueActivities.activityDate)
      .limit(6);

    const activeAnnouncements = await db
      .select()
      .from(announcements)
      .where(eq(announcements.isPublished, true))
      .orderBy(desc(announcements.publishedAt))
      .limit(5);

    const tz = settings?.timezone || 'WIB';
    const todayStr = getTodayDateString(tz);
    const hijriToday = gregorianToHijri(todayStr);

    let todayPrayer: any = null;
    let prayerSourceStatus: 'live' | 'cached' | 'unavailable' = 'unavailable';

    try {
      todayPrayer = await fetchAladhanDay(
        settings?.latitude || '-6.2088',
        settings?.longitude || '106.8456',
        settings?.city || 'Jakarta',
        settings?.country || 'Indonesia',
        settings?.calculationMethod || 20,
        tz,
        todayStr,
      );
      prayerSourceStatus = 'live';
    } catch {
      const cached = await db
        .select()
        .from(prayerSchedules)
        .where(
          and(
            eq(prayerSchedules.scheduleDate, todayStr),
            eq(prayerSchedules.timezone, tz),
          ),
        )
        .limit(1);
      if (cached[0]) {
        todayPrayer = cached[0];
        prayerSourceStatus = 'cached';
      } else {
        const lastCached = await db
          .select()
          .from(prayerSchedules)
          .orderBy(desc(prayerSchedules.updatedAt))
          .limit(1);
        if (lastCached[0]) {
          todayPrayer = lastCached[0];
          prayerSourceStatus = 'cached';
        }
      }
    }

    return res.json({
      settings,
      todayStr,
      hijriToday,
      todayPrayer,
      prayerSourceStatus,
      balances,
      posters,
      activities,
      announcements: activeAnnouncements,
    });
  } catch (err) {
    console.error('Public home error:', err);
    return res.status(500).json({ error: 'Gagal memuat data beranda masjid.' });
  }
});

// Prayer Times (Daily + Monthly)
router.get('/prayer-times', async (req, res) => {
  try {
    await ensureInitialData();
    const settingsRows = await db.select().from(mosqueSettings).limit(1);
    const settings = settingsRows[0];

    const city = (req.query.city as string) || settings?.city || 'Jakarta';
    const lat = (req.query.lat as string) || settings?.latitude || '-6.2088';
    const lng = (req.query.lng as string) || settings?.longitude || '106.8456';
    const timezone = ((req.query.timezone as string) || settings?.timezone || 'WIB') as 'WIB' | 'WITA' | 'WIT';
    const method = Number(req.query.method || settings?.calculationMethod || 20);
    const todayStr = getTodayDateString(timezone);
    const [curY, curM] = todayStr.split('-').map(Number);
    const month = Number(req.query.month || curM);
    const year = Number(req.query.year || curY);
    const iana = TIMEZONE_IANA[timezone] || 'Asia/Jakarta';

    let todaySchedule: any = null;
    let monthlySchedules: any[] = [];
    let status: 'live' | 'cached' | 'unavailable' = 'unavailable';

    try {
      const url = `https://api.aladhan.com/v1/calendar/${year}/${month}?latitude=${encodeURIComponent(
        lat,
      )}&longitude=${encodeURIComponent(lng)}&method=${method}&timezonestring=${encodeURIComponent(iana)}`;

      const resp = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!resp.ok) throw new Error(`Aladhan calendar HTTP ${resp.status}`);
      const json = (await resp.json()) as any;
      if (json.code !== 200 || !Array.isArray(json.data)) {
        throw new Error('Aladhan calendar invalid');
      }

      monthlySchedules = json.data.map((item: any) => {
        const gParts = item.date.gregorian.date.split('-'); // DD-MM-YYYY
        const isoDate = `${gParts[2]}-${gParts[1]}-${gParts[0]}`;
        const hInfo = item.date.hijri;
        return {
          scheduleDate: isoDate,
          hijriDate: `${hInfo.day} ${hInfo.month.en} ${hInfo.year} H`,
          hijriMonthName: hInfo.month.en,
          hijriYear: String(hInfo.year),
          fajr: cleanTimeStr(item.timings.Fajr),
          sunrise: cleanTimeStr(item.timings.Sunrise),
          dhuhr: cleanTimeStr(item.timings.Dhuhr),
          asr: cleanTimeStr(item.timings.Asr),
          maghrib: cleanTimeStr(item.timings.Maghrib),
          isha: cleanTimeStr(item.timings.Isha),
          city,
          timezone,
          method,
          source: 'aladhan_api',
        };
      });

      // Cache today's schedule in DB
      const foundToday = monthlySchedules.find((s) => s.scheduleDate === todayStr) || monthlySchedules[0];
      if (foundToday) {
        todaySchedule = foundToday;
        await db
          .insert(prayerSchedules)
          .values(foundToday)
          .onConflictDoUpdate({
            target: [
              prayerSchedules.scheduleDate,
              prayerSchedules.city,
              prayerSchedules.timezone,
              prayerSchedules.method,
            ],
            set: {
              fajr: foundToday.fajr,
              sunrise: foundToday.sunrise,
              dhuhr: foundToday.dhuhr,
              asr: foundToday.asr,
              maghrib: foundToday.maghrib,
              isha: foundToday.isha,
              hijriDate: foundToday.hijriDate,
              updatedAt: new Date(),
            },
          });
      }
      status = 'live';
    } catch (apiErr) {
      console.warn('Aladhan API unavailable, falling back to last cached DB record:', apiErr);
      const cachedRows = await db
        .select()
        .from(prayerSchedules)
        .orderBy(desc(prayerSchedules.scheduleDate))
        .limit(31);
      if (cachedRows.length > 0) {
        todaySchedule = cachedRows.find((r) => r.scheduleDate === todayStr) || cachedRows[0];
        monthlySchedules = cachedRows;
        status = 'cached';
      }
    }

    return res.json({
      status,
      city,
      lat,
      lng,
      timezone,
      method,
      todayStr,
      hijriToday: gregorianToHijri(todayStr),
      todaySchedule,
      monthlySchedules,
    });
  } catch (err) {
    console.error('Prayer times error:', err);
    return res.status(500).json({ error: 'Gagal memuat jadwal salat.' });
  }
});

// Islamic Calendar & Conversion
router.get('/islamic-calendar', async (req, res) => {
  try {
    await ensureInitialData();
    const convertDate = req.query.convertDate as string | undefined;
    const convertHijri = req.query.convertHijri as string | undefined; // YYYY-MM-DD in hijri

    let conversionResult: any = null;
    if (convertDate && /^\d{4}-\d{2}-\d{2}$/.test(convertDate)) {
      conversionResult = {
        gregorian: convertDate,
        hijri: gregorianToHijri(convertDate),
      };
    } else if (convertHijri && /^\d{4}-\d{1,2}-\d{1,2}$/.test(convertHijri)) {
      const [hy, hm, hd] = convertHijri.split('-').map(Number);
      const gStr = hijriToGregorian(hd, hm, hy);
      conversionResult = {
        gregorian: gStr,
        hijri: gregorianToHijri(gStr),
      };
    }

    const events = await db
      .select()
      .from(islamicEvents)
      .orderBy(islamicEvents.gregorianDate);

    const activities = await db
      .select()
      .from(mosqueActivities)
      .where(eq(mosqueActivities.status, 'published'))
      .orderBy(mosqueActivities.activityDate);

    const todayStr = getTodayDateString('WIB');
    return res.json({
      todayStr,
      hijriToday: gregorianToHijri(todayStr),
      conversionResult,
      events,
      activities,
    });
  } catch (err) {
    console.error('Islamic calendar error:', err);
    return res.status(500).json({ error: 'Gagal memuat kalender Islam.' });
  }
});

// Public Published Posters & Activities
router.get('/posters', async (_req, res) => {
  try {
    await ensureInitialData();
    const posters = await db
      .select()
      .from(eventPosters)
      .where(eq(eventPosters.status, 'published'))
      .orderBy(desc(eventPosters.publishedAt));

    const activities = await db
      .select()
      .from(mosqueActivities)
      .where(eq(mosqueActivities.status, 'published'))
      .orderBy(mosqueActivities.activityDate);

    return res.json({ posters, activities });
  } catch (err) {
    console.error('Public posters error:', err);
    return res.status(500).json({ error: 'Gagal memuat informasi kegiatan.' });
  }
});

router.get('/posters/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: 'ID kegiatan tidak valid.' });
    }
    const rows = await db
      .select()
      .from(eventPosters)
      .where(and(eq(eventPosters.id, id), eq(eventPosters.status, 'published')))
      .limit(1);

    if (!rows[0]) {
      return res.status(404).json({ error: 'Poster kegiatan tidak ditemukan atau belum dipublikasikan.' });
    }
    return res.json({ poster: rows[0] });
  } catch (err) {
    console.error('Public poster detail error:', err);
    return res.status(500).json({ error: 'Gagal memuat detail kegiatan.' });
  }
});

// Public Mosque Info
router.get('/mosque-info', async (_req, res) => {
  try {
    await ensureInitialData();
    const settingsRows = await db.select().from(mosqueSettings).limit(1);
    const activeAnnouncements = await db
      .select()
      .from(announcements)
      .where(eq(announcements.isPublished, true))
      .orderBy(desc(announcements.publishedAt));
    const activities = await db
      .select()
      .from(mosqueActivities)
      .where(eq(mosqueActivities.status, 'published'))
      .orderBy(mosqueActivities.activityDate);

    return res.json({
      settings: settingsRows[0],
      announcements: activeAnnouncements,
      activities,
    });
  } catch (err) {
    console.error('Public mosque-info error:', err);
    return res.status(500).json({ error: 'Gagal memuat profil masjid.' });
  }
});

// Public Financial Transparency (NO donor personal info, strictly segregated Cash vs Zakat)
router.get('/transparency', async (req, res) => {
  try {
    await ensureInitialData();
    const monthParam = req.query.month ? Number(req.query.month) : null;
    const yearParam = req.query.year ? Number(req.query.year) : new Date().getFullYear();

    const balances = await getFundBalances();

    let startDate = `${yearParam}-01-01`;
    let endDate = `${yearParam}-12-31`;
    if (monthParam && monthParam >= 1 && monthParam <= 12) {
      const mStr = String(monthParam).padStart(2, '0');
      const lastDay = new Date(yearParam, monthParam, 0).getDate();
      startDate = `${yearParam}-${mStr}-01`;
      endDate = `${yearParam}-${mStr}-${String(lastDay).padStart(2, '0')}`;
    }

    // Sanitized income history (never select donorName or donorId for public!)
    const publicIncome = await db
      .select({
        id: incomeTransactions.id,
        transactionNumber: incomeTransactions.transactionNumber,
        transactionDate: incomeTransactions.transactionDate,
        fundType: incomeTransactions.fundType,
        categoryName: incomeTransactions.categoryName,
        amount: incomeTransactions.amount,
        paymentMethod: incomeTransactions.paymentMethod,
        description: incomeTransactions.description,
      })
      .from(incomeTransactions)
      .where(
        and(
          eq(incomeTransactions.transactionStatus, 'verified'),
          gte(incomeTransactions.transactionDate, startDate),
          lte(incomeTransactions.transactionDate, endDate),
        ),
      )
      .orderBy(desc(incomeTransactions.transactionDate), desc(incomeTransactions.id))
      .limit(100);

    // Sanitized expense history (Mosque Cash only)
    const publicExpenses = await db
      .select({
        id: expenseTransactions.id,
        transactionNumber: expenseTransactions.transactionNumber,
        transactionDate: expenseTransactions.transactionDate,
        categoryName: expenseTransactions.categoryName,
        amount: expenseTransactions.amount,
        paymentMethod: expenseTransactions.paymentMethod,
        description: expenseTransactions.description,
      })
      .from(expenseTransactions)
      .where(
        and(
          eq(expenseTransactions.transactionStatus, 'approved'),
          gte(expenseTransactions.transactionDate, startDate),
          lte(expenseTransactions.transactionDate, endDate),
        ),
      )
      .orderBy(desc(expenseTransactions.transactionDate), desc(expenseTransactions.id))
      .limit(100);

    // Sanitized zakat distribution history (no recipient phone!)
    const publicZakatDistributions = await db
      .select({
        id: zakatDistributions.id,
        transactionNumber: zakatDistributions.transactionNumber,
        distributionDate: zakatDistributions.distributionDate,
        zakatType: zakatDistributions.zakatType,
        asnafCategory: zakatDistributions.asnafCategory,
        amount: zakatDistributions.amount,
        description: zakatDistributions.description,
      })
      .from(zakatDistributions)
      .where(
        and(
          eq(zakatDistributions.status, 'approved'),
          gte(zakatDistributions.distributionDate, startDate),
          lte(zakatDistributions.distributionDate, endDate),
        ),
      )
      .orderBy(desc(zakatDistributions.distributionDate), desc(zakatDistributions.id))
      .limit(100);

    // Monthly chart data for selected year
    const yearStart = `${yearParam}-01-01`;
    const yearEnd = `${yearParam}-12-31`;

    const monthlyCashInc = await db
      .select({
        month: sql<string>`SUBSTRING(${incomeTransactions.transactionDate}, 1, 7)`,
        total: sql<string>`COALESCE(SUM(${incomeTransactions.amount}), 0)`,
      })
      .from(incomeTransactions)
      .where(
        and(
          eq(incomeTransactions.transactionStatus, 'verified'),
          eq(incomeTransactions.fundType, 'mosque_cash'),
          gte(incomeTransactions.transactionDate, yearStart),
          lte(incomeTransactions.transactionDate, yearEnd),
        ),
      )
      .groupBy(sql`SUBSTRING(${incomeTransactions.transactionDate}, 1, 7)`);

    const monthlyCashExp = await db
      .select({
        month: sql<string>`SUBSTRING(${expenseTransactions.transactionDate}, 1, 7)`,
        total: sql<string>`COALESCE(SUM(${expenseTransactions.amount}), 0)`,
      })
      .from(expenseTransactions)
      .where(
        and(
          eq(expenseTransactions.transactionStatus, 'approved'),
          gte(expenseTransactions.transactionDate, yearStart),
          lte(expenseTransactions.transactionDate, yearEnd),
        ),
      )
      .groupBy(sql`SUBSTRING(${expenseTransactions.transactionDate}, 1, 7)`);

    const monthlyZakatInc = await db
      .select({
        month: sql<string>`SUBSTRING(${incomeTransactions.transactionDate}, 1, 7)`,
        fundType: incomeTransactions.fundType,
        total: sql<string>`COALESCE(SUM(${incomeTransactions.amount}), 0)`,
      })
      .from(incomeTransactions)
      .where(
        and(
          eq(incomeTransactions.transactionStatus, 'verified'),
          sql`${incomeTransactions.fundType} IN ('zakat_fitrah', 'zakat_mal')`,
          gte(incomeTransactions.transactionDate, yearStart),
          lte(incomeTransactions.transactionDate, yearEnd),
        ),
      )
      .groupBy(
        sql`SUBSTRING(${incomeTransactions.transactionDate}, 1, 7)`,
        incomeTransactions.fundType,
      );

    const monthlyZakatDist = await db
      .select({
        month: sql<string>`SUBSTRING(${zakatDistributions.distributionDate}, 1, 7)`,
        total: sql<string>`COALESCE(SUM(${zakatDistributions.amount}), 0)`,
      })
      .from(zakatDistributions)
      .where(
        and(
          eq(zakatDistributions.status, 'approved'),
          gte(zakatDistributions.distributionDate, yearStart),
          lte(zakatDistributions.distributionDate, yearEnd),
        ),
      )
      .groupBy(sql`SUBSTRING(${zakatDistributions.distributionDate}, 1, 7)`);

    const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    const cashIncMap = new Map(monthlyCashInc.map((r) => [r.month, Number(r.total)]));
    const cashExpMap = new Map(monthlyCashExp.map((r) => [r.month, Number(r.total)]));
    const fitrahMap = new Map<string, number>();
    const malMap = new Map<string, number>();
    for (const r of monthlyZakatInc) {
      if (r.fundType === 'zakat_fitrah') fitrahMap.set(r.month, Number(r.total));
      if (r.fundType === 'zakat_mal') malMap.set(r.month, Number(r.total));
    }
    const zDistMap = new Map(monthlyZakatDist.map((r) => [r.month, Number(r.total)]));

    const cashChart = monthLabels.map((label, idx) => {
      const key = `${yearParam}-${String(idx + 1).padStart(2, '0')}`;
      return {
        month: label,
        pemasukan: cashIncMap.get(key) ?? 0,
        pengeluaran: cashExpMap.get(key) ?? 0,
      };
    });

    const zakatChart = monthLabels.map((label, idx) => {
      const key = `${yearParam}-${String(idx + 1).padStart(2, '0')}`;
      return {
        month: label,
        zakatFitrah: fitrahMap.get(key) ?? 0,
        zakatMal: malMap.get(key) ?? 0,
        penyaluran: zDistMap.get(key) ?? 0,
      };
    });

    // Sanitized active mosque assets (strictly separated from cash & zakat)
    const publicAssets = await db
      .select({
        id: mosqueAssets.id,
        assetCode: mosqueAssets.assetCode,
        assetName: mosqueAssets.assetName,
        category: mosqueAssets.category,
        quantity: mosqueAssets.quantity,
        unit: mosqueAssets.unit,
        acquisitionDate: mosqueAssets.acquisitionDate,
        acquisitionSource: mosqueAssets.acquisitionSource,
        conditionStatus: mosqueAssets.conditionStatus,
        nominalValue: mosqueAssets.nominalValue,
        location: mosqueAssets.location,
        photoUrl: mosqueAssets.photoUrl,
      })
      .from(mosqueAssets)
      .where(eq(mosqueAssets.isActive, true))
      .orderBy(desc(mosqueAssets.id))
      .limit(200);

    return res.json({
      balances,
      period: { month: monthParam, year: yearParam, startDate, endDate },
      publicIncome,
      publicExpenses,
      publicZakatDistributions,
      publicAssets,
      cashChart,
      zakatChart,
    });
  } catch (err) {
    console.error('Public transparency error:', err);
    return res.status(500).json({ error: 'Gagal memuat data transparansi keuangan.' });
  }
});

// Public Payment Standards, Active Payment Methods & Settings for Calculator
router.get('/payment-methods', async (_req, res) => {
  try {
    const items = await db
      .select()
      .from(mosquePaymentMethods)
      .where(eq(mosquePaymentMethods.isActive, true))
      .orderBy(desc(mosquePaymentMethods.id));
    return res.json({ items });
  } catch (err) {
    console.error('Public payment methods error:', err);
    return res.status(500).json({ error: 'Gagal memuat metode pembayaran masjid.' });
  }
});

router.get('/calculator-config', async (_req, res) => {
  try {
    await ensureInitialData();
    const rows = await db.select().from(mosqueSettings).limit(1);
    const s = rows[0];
    const activeMethods = await db
      .select()
      .from(mosquePaymentMethods)
      .where(eq(mosquePaymentMethods.isActive, true))
      .orderBy(desc(mosquePaymentMethods.id));

    return res.json({
      zakatFitrahRiceKg: Number(s?.zakatFitrahRiceKg ?? 2.5),
      zakatFitrahMoneyAmount: Number(s?.zakatFitrahMoneyAmount ?? 45000),
      goldPricePerGram: Number(s?.goldPricePerGram ?? 1450000),
      bankName: s?.bankName ?? '',
      bankAccountNumber: s?.bankAccountNumber ?? '',
      bankAccountHolder: s?.bankAccountHolder ?? '',
      qrisImageUrl: s?.qrisImageUrl ?? '',
      paymentChannels: s?.paymentChannels ?? null,
      paymentMethods: activeMethods,
      whatsappNumber: s?.whatsappNumber ?? '',
      mosqueName: s?.mosqueName ?? 'MasjidKu',
      mosqueLogoUrl: s?.logoUrl ?? '',
    });
  } catch (err) {
    console.error('Calculator config error:', err);
    return res.status(500).json({ error: 'Gagal memuat konfigurasi kalkulator.' });
  }
});

// Submit Public Payment (Infak / Sedekah / Zakat Fitrah / Zakat Mal)
// Step 4 Submit: validates all inputs, generates unique txNumber, saves as 'waiting_payment' ("Menunggu Pembayaran"),
// and returns destination QRIS / bank / e-wallet instructions strictly AFTER submit.
const paymentSchema = z.object({
  donorName: z.string().trim().min(2, 'Nama lengkap wajib diisi (minimal 2 karakter)').max(120),
  whatsappNumber: z
    .string()
    .trim()
    .min(8, 'Nomor WhatsApp minimal 8 digit')
    .max(20)
    .regex(/^[0-9+\-\s()]+$/, 'Nomor WhatsApp hanya boleh berisi angka')
    .refine((val) => val.replace(/\D/g, '').length >= 8, {
      message: 'Nomor WhatsApp wajib memiliki minimal 8 digit angka',
    }),
  paymentType: z.enum(['zakat_fitrah', 'zakat_mal', 'infak', 'sedekah']),
  fitrahForm: z.enum(['uang', 'beras']).optional(),
  soulCount: z.coerce.number().int().min(1).max(100).optional(),
  amount: z.coerce.number().positive('Nominal pembayaran harus lebih besar dari nol').max(10000000000),
  paymentMethod: z.enum([
    'bank_transfer',
    'dana',
    'gopay',
    'ovo',
    'shopeepay',
    'linkaja',
    'qris',
    'cash',
  ]),
  paymentMethodId: z.coerce.number().int().positive().optional(),
  paymentMethodLabel: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(500).optional(),
});

function isPlaceholderBankAccount(val: string | null | undefined): boolean {
  if (!val) return true;
  const clean = val.trim().toLowerCase();
  return !clean || clean.includes('0000-0000-0000') || clean.includes('isi rekening') || clean.includes('placeholder');
}

router.post('/zakat-payments', uploadSingleFile.single('proof'), async (req, res) => {
  try {
    await ensureInitialData();
    const parsed = paymentSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Data pembayaran tidak valid.' });
    }

    const {
      donorName,
      whatsappNumber,
      paymentType,
      fitrahForm,
      soulCount,
      amount,
      paymentMethod,
      paymentMethodId,
      paymentMethodLabel,
      notes,
    } = parsed.data;

    const fundType =
      paymentType === 'zakat_fitrah'
        ? 'zakat_fitrah'
        : paymentType === 'zakat_mal'
          ? 'zakat_mal'
          : 'mosque_cash';

    const cleanWa = whatsappNumber.replace(/[^\d+]/g, '');
    const proofUrl = req.file ? `/uploads/${req.file.filename}` : null;
    const txNumber = generateTxNumber('ZKT');

    const settingsRows = await db.select().from(mosqueSettings).limit(1);
    const s = settingsRows[0];
    const programKey: 'zakat' | 'infak' | 'sedekah' =
      paymentType === 'zakat_fitrah' || paymentType === 'zakat_mal'
        ? 'zakat'
        : paymentType === 'infak'
          ? 'infak'
          : 'sedekah';
    const ch = s?.paymentChannels?.[programKey];

    const activeMethods = await db
      .select()
      .from(mosquePaymentMethods)
      .where(eq(mosquePaymentMethods.isActive, true));

    let chosenMethod: typeof mosquePaymentMethods.$inferSelect | null = null;
    if (paymentMethodId) {
      chosenMethod = activeMethods.find((m) => m.id === paymentMethodId) ?? null;
      if (!chosenMethod) {
        return res.status(400).json({
          error: 'Metode pembayaran yang dipilih tidak aktif atau tidak tersedia.',
        });
      }
      if (chosenMethod.programScope !== 'all' && chosenMethod.programScope !== programKey) {
        return res.status(400).json({
          error: 'Metode pembayaran tersebut tidak berlaku untuk jenis pembayaran ini.',
        });
      }
    } else if (paymentMethod !== 'cash') {
      // Check whether this paymentMethod has a valid configured fallback in activeMethods or mosqueSettings
      const hasLegacyQris = Boolean(ch?.qrisPayload || ch?.ewalletQrImageUrl || s?.qrisImageUrl);
      const hasLegacyBank = !isPlaceholderBankAccount(ch?.accountNumber || s?.bankAccountNumber);
      const legacyWalletProvider = (ch?.ewalletProvider || 'dana').toLowerCase();
      const hasLegacyWallet =
        Boolean(ch?.danaNumber || ch?.danaLink || ch?.ewalletQrImageUrl) &&
        legacyWalletProvider === paymentMethod;
      const hasDedicatedMatching = activeMethods.some((m) => {
        if (m.programScope !== 'all' && m.programScope !== programKey) return false;
        if (paymentMethod === 'bank_transfer') return m.accountType === 'bank_transfer';
        if (paymentMethod === 'qris') return m.accountType === 'e_wallet' && m.providerName.toLowerCase().includes('qris');
        return m.accountType === 'e_wallet' && m.providerName.toLowerCase().includes(paymentMethod);
      });

      const isConfigured =
        hasDedicatedMatching ||
        (paymentMethod === 'qris' && hasLegacyQris) ||
        (paymentMethod === 'bank_transfer' && hasLegacyBank) ||
        hasLegacyWallet;

      if (!isConfigured) {
        return res.status(400).json({
          error: 'Metode pembayaran yang dipilih belum diaktifkan dan dikonfigurasi oleh Ketua DKM.',
        });
      }
    }

    const resolvedMethodLabel =
      paymentMethodLabel ||
      (chosenMethod
        ? `${chosenMethod.providerName}${chosenMethod.accountNumber ? ` (${chosenMethod.accountNumber})` : ''}`
        : paymentMethod === 'qris'
          ? 'QRIS Resmi Masjid'
          : paymentMethod === 'bank_transfer'
            ? `Transfer Bank — ${ch?.bankName || s?.bankName || 'Rekening Resmi Masjid'}`
            : paymentMethod === 'cash'
              ? fitrahForm === 'beras'
                ? 'Tunai / Serah Beras di Masjid'
                : 'Tunai di Masjid'
              : `E-Wallet ${paymentMethod.toUpperCase()}`);

    const created = await db.transaction(async (tx) => {
      const existingDonor = await tx
        .select()
        .from(donors)
        .where(eq(donors.whatsappNumber, cleanWa))
        .limit(1);

      let donorId: number;
      if (existingDonor[0]) {
        donorId = existingDonor[0].id;
      } else {
        const d = await tx
          .insert(donors)
          .values({
            fullName: donorName.trim(),
            whatsappNumber: cleanWa,
          })
          .returning();
        donorId = d[0].id;
      }

      const inserted = await tx
        .insert(zakatTransactions)
        .values({
          transactionNumber: txNumber,
          donorId,
          donorName: donorName.trim(),
          whatsappNumber: cleanWa,
          paymentType,
          fundType,
          soulCount: paymentType === 'zakat_fitrah' ? soulCount || 1 : null,
          fitrahForm: paymentType === 'zakat_fitrah' ? fitrahForm || 'uang' : null,
          amount: amount.toFixed(2),
          paymentMethod,
          paymentMethodId: chosenMethod?.id ?? null,
          paymentMethodLabel: resolvedMethodLabel,
          notes: notes?.trim() || null,
          proofUrl,
          transactionStatus: proofUrl ? 'pending' : 'waiting_payment',
        })
        .returning();

      return inserted[0];
    });

    return res.status(201).json({
      transaction: {
        transactionNumber: created.transactionNumber,
        donorName: created.donorName,
        whatsappNumber: created.whatsappNumber,
        paymentType: created.paymentType,
        fundType: created.fundType,
        soulCount: created.soulCount,
        fitrahForm: created.fitrahForm,
        amount: Number(created.amount),
        paymentMethod: created.paymentMethod,
        paymentMethodId: created.paymentMethodId,
        paymentMethodLabel: created.paymentMethodLabel,
        paymentDate: created.paymentDate,
        proofUrl: created.proofUrl,
        transactionStatus: created.transactionStatus,
        createdAt: created.createdAt,
      },
      mosque: {
        mosqueName: s?.mosqueName ?? 'MasjidKu',
        logoUrl: s?.logoUrl ?? '',
      },
      destination: chosenMethod
        ? {
            programKey,
            programLabel: programKey === 'zakat' ? 'Zakat' : programKey === 'infak' ? 'Infak' : 'Sedekah',
            bankName:
              chosenMethod.accountType === 'bank_transfer' ? chosenMethod.providerName : '',
            accountNumber:
              chosenMethod.accountType === 'bank_transfer' ? chosenMethod.accountNumber : '',
            accountHolder:
              chosenMethod.accountType === 'bank_transfer' ? chosenMethod.accountHolder : '',
            ewalletProvider:
              chosenMethod.accountType === 'e_wallet' ? chosenMethod.providerName : '',
            danaNumber:
              chosenMethod.accountType === 'e_wallet' ? chosenMethod.accountNumber : '',
            danaHolder:
              chosenMethod.accountType === 'e_wallet' ? chosenMethod.accountHolder : '',
            danaLink: chosenMethod.paymentLink || '',
            qrisPayload: chosenMethod.qrisPayload || '',
            qrisMerchantName: chosenMethod.qrisMerchantName || '',
            ewalletQrImageUrl: chosenMethod.qrCodeUrl || '',
            qrisImageUrl: chosenMethod.qrCodeUrl || s?.qrisImageUrl || '',
            preferredCodeFormat: ch?.preferredCodeFormat || 'both',
          }
        : {
            programKey,
            programLabel: programKey === 'zakat' ? 'Zakat' : programKey === 'infak' ? 'Infak' : 'Sedekah',
            bankName: ch?.bankName || s?.bankName || 'Rekening Resmi Masjid',
            accountNumber: ch?.accountNumber || s?.bankAccountNumber || '',
            accountHolder: ch?.accountHolder || s?.bankAccountHolder || '',
            ewalletProvider: ch?.ewalletProvider || 'dana',
            danaNumber: ch?.danaNumber || '',
            danaHolder: ch?.danaHolder || `E-Wallet ${programKey.toUpperCase()} Masjid`,
            danaLink: ch?.danaLink || '',
            qrisPayload: ch?.qrisPayload || '',
            qrisMerchantName: ch?.qrisMerchantName || '',
            ewalletQrImageUrl: ch?.ewalletQrImageUrl || '',
            qrisImageUrl: s?.qrisImageUrl || '',
            preferredCodeFormat: ch?.preferredCodeFormat || 'both',
          },
      message:
        'Transaksi berhasil dibuat dengan status Menunggu Pembayaran. Silakan ikuti instruksi pembayaran di bawah lalu konfirmasi pembayaran Anda.',
    });
  } catch (err: any) {
    console.error('Submit public payment error:', err);
    return res.status(500).json({ error: err.message || 'Gagal menyimpan pengajuan pembayaran.' });
  }
});

// Step 5: Donor uploads payment proof + payment date and presses KONFIRMASI PEMBAYARAN -> status becomes 'pending' (Menunggu Verifikasi)
async function handleConfirmPayment(req: any, res: any) {
  try {
    const txNum = (req.params.transactionNumber || '').trim().toUpperCase();
    const wa = ((req.body?.whatsappNumber as string) || '').replace(/[^\d+]/g, '');
    const rawDate = ((req.body?.paymentDate as string) || '').trim();

    if (!txNum || !wa) {
      return res.status(400).json({ error: 'Nomor transaksi dan WhatsApp wajib disertakan.' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'Silakan unggah file bukti pembayaran (JPG/PNG/WebP/PDF).' });
    }

    const paymentDate = rawDate || new Date().toISOString().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(paymentDate)) {
      return res.status(400).json({ error: 'Format tanggal pembayaran tidak valid (YYYY-MM-DD).' });
    }

    const rows = await db
      .select()
      .from(zakatTransactions)
      .where(
        and(
          eq(zakatTransactions.transactionNumber, txNum),
          eq(zakatTransactions.whatsappNumber, wa),
        ),
      )
      .limit(1);

    const existing = rows[0];
    if (!existing) {
      return res.status(404).json({ error: 'Transaksi tidak ditemukan atau nomor WhatsApp tidak cocok.' });
    }
    if (existing.transactionStatus !== 'waiting_payment' && existing.transactionStatus !== 'pending') {
      return res.status(400).json({
        error: 'Konfirmasi hanya dapat dilakukan untuk transaksi berstatus Menunggu Pembayaran atau Menunggu Verifikasi.',
      });
    }

    const proofUrl = `/uploads/${req.file.filename}`;
    const updated = await db
      .update(zakatTransactions)
      .set({
        proofUrl,
        paymentDate,
        transactionStatus: 'pending',
        updatedAt: new Date(),
      })
      .where(eq(zakatTransactions.id, existing.id))
      .returning();

    return res.json({
      transaction: {
        transactionNumber: updated[0].transactionNumber,
        proofUrl: updated[0].proofUrl,
        paymentDate: updated[0].paymentDate,
        transactionStatus: updated[0].transactionStatus,
      },
      message:
        'Terima kasih telah berkontribusi untuk masjid. Pembayaran Anda sedang menunggu pemeriksaan pengurus DKM.',
    });
  } catch (err: any) {
    console.error('Confirm payment error:', err);
    return res.status(500).json({ error: 'Gagal mengirim konfirmasi pembayaran.' });
  }
}

router.post('/zakat-payments/:transactionNumber/confirm', uploadSingleFile.single('proof'), handleConfirmPayment);
router.post('/zakat-payments/:transactionNumber/proof', uploadSingleFile.single('proof'), handleConfirmPayment);

// Poll Zakat / Donation Payment Status (DB + live Payment Gateway API if configured)
router.get('/zakat-payments/:transactionNumber/status', async (req, res) => {
  try {
    const txNum = (req.params.transactionNumber || '').trim().toUpperCase();
    const wa = ((req.query.whatsappNumber as string) || '').replace(/[^\d+]/g, '');

    if (!txNum || !wa) {
      return res.status(400).json({
        error: 'Nomor transaksi dan nomor WhatsApp wajib disertakan untuk memeriksa status.',
      });
    }

    const selectFields = {
      transactionNumber: zakatTransactions.transactionNumber,
      donorName: zakatTransactions.donorName,
      paymentType: zakatTransactions.paymentType,
      fundType: zakatTransactions.fundType,
      soulCount: zakatTransactions.soulCount,
      fitrahForm: zakatTransactions.fitrahForm,
      amount: zakatTransactions.amount,
      paymentMethod: zakatTransactions.paymentMethod,
      paymentMethodId: zakatTransactions.paymentMethodId,
      paymentMethodLabel: zakatTransactions.paymentMethodLabel,
      paymentDate: zakatTransactions.paymentDate,
      proofUrl: zakatTransactions.proofUrl,
      transactionStatus: zakatTransactions.transactionStatus,
      verificationNote: zakatTransactions.verificationNote,
      verifiedAt: zakatTransactions.verifiedAt,
      gatewayProvider: zakatTransactions.gatewayProvider,
      gatewayReferenceId: zakatTransactions.gatewayReferenceId,
      gatewayStatus: zakatTransactions.gatewayStatus,
      createdAt: zakatTransactions.createdAt,
    };

    const initialRows = await db
      .select(selectFields)
      .from(zakatTransactions)
      .where(
        and(
          eq(zakatTransactions.transactionNumber, txNum),
          eq(zakatTransactions.whatsappNumber, wa),
        ),
      )
      .limit(1);

    if (!initialRows[0]) {
      return res.status(404).json({
        error: 'Transaksi tidak ditemukan atau nomor WhatsApp tidak cocok.',
      });
    }

    let current = initialRows[0];
    let gatewayInfo = {
      configured: false,
      provider: null as string | null,
      checked: false,
      verified: current.transactionStatus === 'verified',
      gatewayStatus: current.gatewayStatus ?? null,
    };

    if (current.transactionStatus === 'pending' || current.transactionStatus === 'waiting_payment') {
      gatewayInfo = await pollGatewayTransactionStatus(txNum);
      if (gatewayInfo.verified || gatewayInfo.gatewayStatus) {
        const refreshed = await db
          .select(selectFields)
          .from(zakatTransactions)
          .where(eq(zakatTransactions.transactionNumber, txNum))
          .limit(1);
        if (refreshed[0]) {
          current = refreshed[0];
        }
      }
    }

    return res.json({
      transaction: {
        ...current,
        amount: Number(current.amount),
      },
      gateway: gatewayInfo,
    });
  } catch (err) {
    console.error('Poll payment status error:', err);
    return res.status(500).json({ error: 'Gagal memeriksa status pembayaran.' });
  }
});

// Check Zakat / Donation Payment Status using Transaction Number + WhatsApp
router.get('/zakat-payments/check', async (req, res) => {
  try {
    const txNum = ((req.query.transactionNumber as string) || '').trim().toUpperCase();
    const wa = ((req.query.whatsappNumber as string) || '').replace(/[^\d+]/g, '');

    if (!txNum || !wa) {
      return res.status(400).json({
        error: 'Masukkan nomor transaksi dan nomor WhatsApp untuk mengecek status.',
      });
    }

    const selectFields = {
      transactionNumber: zakatTransactions.transactionNumber,
      donorName: zakatTransactions.donorName,
      paymentType: zakatTransactions.paymentType,
      fundType: zakatTransactions.fundType,
      soulCount: zakatTransactions.soulCount,
      fitrahForm: zakatTransactions.fitrahForm,
      amount: zakatTransactions.amount,
      paymentMethod: zakatTransactions.paymentMethod,
      paymentMethodId: zakatTransactions.paymentMethodId,
      paymentMethodLabel: zakatTransactions.paymentMethodLabel,
      paymentDate: zakatTransactions.paymentDate,
      proofUrl: zakatTransactions.proofUrl,
      transactionStatus: zakatTransactions.transactionStatus,
      verificationNote: zakatTransactions.verificationNote,
      verifiedAt: zakatTransactions.verifiedAt,
      gatewayProvider: zakatTransactions.gatewayProvider,
      gatewayReferenceId: zakatTransactions.gatewayReferenceId,
      gatewayStatus: zakatTransactions.gatewayStatus,
      createdAt: zakatTransactions.createdAt,
    };

    let rows = await db
      .select(selectFields)
      .from(zakatTransactions)
      .where(
        and(
          eq(zakatTransactions.transactionNumber, txNum),
          eq(zakatTransactions.whatsappNumber, wa),
        ),
      )
      .limit(1);

    if (!rows[0]) {
      return res.status(404).json({
        error: 'Transaksi tidak ditemukan. Periksa kembali nomor transaksi dan nomor WhatsApp Anda.',
      });
    }

    if (rows[0].transactionStatus === 'pending' || rows[0].transactionStatus === 'waiting_payment') {
      const gw = await pollGatewayTransactionStatus(txNum);
      if (gw.verified || gw.gatewayStatus) {
        const refreshed = await db
          .select(selectFields)
          .from(zakatTransactions)
          .where(eq(zakatTransactions.transactionNumber, txNum))
          .limit(1);
        if (refreshed[0]) rows = refreshed;
      }
    }

    return res.json({ transaction: rows[0] });
  } catch (err) {
    console.error('Check payment status error:', err);
    return res.status(500).json({ error: 'Gagal memeriksa status transaksi.' });
  }
});

export default router;
