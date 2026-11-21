import { eq } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import {
  announcements,
  eventPosters,
  financialAccounts,
  financialCategories,
  islamicEvents,
  mosqueActivities,
  mosqueSettings,
  permissions,
  rolePermissions,
  roles,
  users,
} from '../../db/schema.ts';
import { hashPassword } from './auth.ts';

let seedPromise: Promise<void> | null = null;
let seeded = false;

export async function ensureInitialData(): Promise<void> {
  if (seeded) return;
  if (seedPromise) return seedPromise;

  seedPromise = (async () => {
    try {
      // 1. Roles
      const existingRoles = await db.select().from(roles);
      if (existingRoles.length === 0) {
        await db.insert(roles).values([
          {
            code: 'ketua_dkm',
            name: 'Ketua DKM',
            description: 'Pemegang akses tertinggi: pengelolaan akun pengurus, persetujuan pengeluaran, konten, dan konfigurasi masjid.',
          },
          {
            code: 'bendahara',
            name: 'Bendahara',
            description: 'Pengelolaan kas masjid, dana zakat, input pemasukan/pengeluaran, verifikasi zakat, distribusi asnaf, dan ekspor laporan.',
          },
          {
            code: 'sekretaris',
            name: 'Sekretaris',
            description: 'Pengelolaan poster kegiatan, agenda masjid, pengumuman, dan kalender hari besar Islam.',
          },
        ]).onConflictDoNothing();
      }

      // 2. Permissions
      const permDefs = [
        { code: 'finance.view', name: 'Lihat Keuangan', module: 'finance' },
        { code: 'finance.income.create', name: 'Input Pemasukan', module: 'finance' },
        { code: 'finance.expense.create', name: 'Input Pengeluaran', module: 'finance' },
        { code: 'finance.expense.approve', name: 'Setujui Pengeluaran', module: 'finance' },
        { code: 'finance.zakat.verify', name: 'Verifikasi Zakat', module: 'finance' },
        { code: 'finance.zakat.distribute', name: 'Distribusi Zakat', module: 'finance' },
        { code: 'finance.reports.export', name: 'Ekspor Laporan Keuangan', module: 'finance' },
        { code: 'content.manage', name: 'Kelola Poster & Kegiatan', module: 'content' },
        { code: 'system.users.manage', name: 'Kelola Akun Pengurus', module: 'system' },
        { code: 'system.settings.manage', name: 'Pengaturan Masjid', module: 'system' },
      ];
      for (const p of permDefs) {
        await db.insert(permissions).values(p).onConflictDoNothing();
      }

      const allRoles = await db.select().from(roles);
      const allPerms = await db.select().from(permissions);
      const roleMap = new Map(allRoles.map((r) => [r.code, r.id]));
      const permMap = new Map(allPerms.map((p) => [p.code, p.id]));

      const rolePermMatrix: Record<string, string[]> = {
        ketua_dkm: permDefs.map((p) => p.code),
        bendahara: [
          'finance.view',
          'finance.income.create',
          'finance.expense.create',
          'finance.zakat.verify',
          'finance.zakat.distribute',
          'finance.reports.export',
        ],
        sekretaris: ['content.manage'],
      };

      for (const [rCode, pCodes] of Object.entries(rolePermMatrix)) {
        const roleId = roleMap.get(rCode);
        if (!roleId) continue;
        for (const pCode of pCodes) {
          const permId = permMap.get(pCode);
          if (!permId) continue;
          await db
            .insert(rolePermissions)
            .values({ roleId, permissionId: permId })
            .onConflictDoNothing();
        }
      }

      // 3. Mosque Settings
      const existingSettings = await db.select().from(mosqueSettings).limit(1);
      if (existingSettings.length === 0) {
        await db.insert(mosqueSettings).values({
          mosqueName: 'Masjid Agung Al-Ikhlas',
          tagline: 'Pusat Ibadah, Dakwah, dan Pemberdayaan Umat',
          logoUrl: '/src/assets/images/mosque_emblem_logo_1795249573681.jpg',
          heroImageUrl: '/src/assets/images/hero_mosque_architecture_1795249574221.jpg',
          address: 'Jl. Masjid Raya No. 1, Kebayoran Baru, Jakarta Selatan',
          city: 'Jakarta',
          province: 'DKI Jakarta',
          country: 'Indonesia',
          latitude: '-6.2088',
          longitude: '106.8456',
          timezone: 'WIB',
          calculationMethod: 20,
          whatsappNumber: '0812-0000-0000 (Isi Nomor Resmi DKM)',
          email: 'sekretariat@masjid-contoh.or.id',
        });
      }

      // 4. Financial Accounts (Strict 3-fund separation)
      const accountDefs = [
        {
          code: 'mosque_cash',
          name: 'Kas Operasional & Pembangunan Masjid',
          description: 'Pembukuan khusus infak, sedekah, donasi umum, kotak amal, serta pengeluaran operasional dan pembangunan masjid.',
        },
        {
          code: 'zakat_fitrah',
          name: 'Dana Zakat Fitrah',
          description: 'Pembukuan terpisah khusus penerimaan dan penyaluran Zakat Fitrah untuk delapan golongan asnaf.',
        },
        {
          code: 'zakat_mal',
          name: 'Dana Zakat Mal',
          description: 'Pembukuan terpisah khusus penerimaan dan penyaluran Zakat Mal untuk delapan golongan asnaf.',
        },
      ];
      for (const acc of accountDefs) {
        await db.insert(financialAccounts).values(acc).onConflictDoNothing();
      }

      // 5. Financial Categories
      const existingCats = await db.select().from(financialCategories);
      if (existingCats.length === 0) {
        await db.insert(financialCategories).values([
          // Income - Mosque Cash
          { name: 'Infak', type: 'income', fundType: 'mosque_cash', description: 'Penerimaan infak jamaah masuk ke kas masjid' },
          { name: 'Sedekah', type: 'income', fundType: 'mosque_cash', description: 'Penerimaan sedekah umum masuk ke kas masjid' },
          { name: 'Donasi Umum', type: 'income', fundType: 'mosque_cash', description: 'Donasi tanpa pembatasan penggunaan' },
          { name: 'Kotak Amal', type: 'income', fundType: 'mosque_cash', description: 'Pemasukan kotak amal Jumat dan harian' },
          { name: 'Sumbangan Operasional', type: 'income', fundType: 'mosque_cash', description: 'Sumbangan khusus operasional dan fasilitas masjid' },
          { name: 'Pemasukan Lainnya', type: 'income', fundType: 'mosque_cash', description: 'Pemasukan kas lain yang sah' },
          // Income - Zakat
          { name: 'Zakat Fitrah', type: 'income', fundType: 'zakat_fitrah', description: 'Penerimaan Zakat Fitrah (terpisah dari kas)' },
          { name: 'Zakat Mal', type: 'income', fundType: 'zakat_mal', description: 'Penerimaan Zakat Mal (terpisah dari kas)' },
          // Expense - Mosque Cash Only
          { name: 'Pembangunan', type: 'expense', fundType: 'mosque_cash', description: 'Biaya pembangunan gedung dan sarana masjid' },
          { name: 'Renovasi', type: 'expense', fundType: 'mosque_cash', description: 'Renovasi dan perbaikan bangunan masjid' },
          { name: 'Pembelian Material', type: 'expense', fundType: 'mosque_cash', description: 'Pembelian semen, pasir, dan material bangunan' },
          { name: 'Listrik', type: 'expense', fundType: 'mosque_cash', description: 'Tagihan listrik dan penerangan masjid' },
          { name: 'Air', type: 'expense', fundType: 'mosque_cash', description: 'Tagihan PDAM dan sarana air wudhu' },
          { name: 'Kebersihan', type: 'expense', fundType: 'mosque_cash', description: 'Alat dan operasional kebersihan masjid' },
          { name: 'Gaji Marbot', type: 'expense', fundType: 'mosque_cash', description: 'Honorarium marbot, imam, dan petugas kebersihan' },
          { name: 'Perawatan Fasilitas', type: 'expense', fundType: 'mosque_cash', description: 'Pemeliharaan AC, sound system, dan karpet' },
          { name: 'Kegiatan Keagamaan', type: 'expense', fundType: 'mosque_cash', description: 'Biaya kajian, pengajian, dan hari besar Islam' },
          { name: 'Operasional', type: 'expense', fundType: 'mosque_cash', description: 'Kebutuhan kesekretariatan dan operasional harian' },
          { name: 'Lainnya', type: 'expense', fundType: 'mosque_cash', description: 'Pengeluaran kas lainnya yang disetujui' },
        ]);
      }

      // 6. Islamic Events (Major Islamic Milestones - editable by Admin)
      const existingEvents = await db.select().from(islamicEvents);
      if (existingEvents.length === 0) {
        await db.insert(islamicEvents).values([
          {
            title: 'Tahun Baru Islam 1448 H',
            eventType: 'hari_besar',
            hijriDay: 1,
            hijriMonth: 1,
            hijriYear: 1448,
            gregorianDate: '2026-06-16',
            description: 'Peringatan 1 Muharram 1448 H, muhasabah dan doa awal tahun bersama jamaah.',
            isOfficial: true,
          },
          {
            title: 'Maulid Nabi Muhammad SAW',
            eventType: 'hari_besar',
            hijriDay: 12,
            hijriMonth: 3,
            hijriYear: 1448,
            gregorianDate: '2026-08-25',
            description: 'Peringatan kelahiran Rasulullah SAW dengan pembacaan sirah nabawiyah dan shalawat.',
            isOfficial: true,
          },
          {
            title: 'Isra Mikraj Nabi Muhammad SAW',
            eventType: 'hari_besar',
            hijriDay: 27,
            hijriMonth: 7,
            hijriYear: 1448,
            gregorianDate: '2027-01-05',
            description: 'Kajian hikmah perjalanan Isra Mikraj dan penguatan kualitas ibadah salat lima waktu.',
            isOfficial: true,
          },
          {
            title: 'Awal Ramadan 1448 H',
            eventType: 'hari_besar',
            hijriDay: 1,
            hijriMonth: 9,
            hijriYear: 1448,
            gregorianDate: '2027-02-08',
            description: 'Penetapan awal Ramadan 1448 H (menyesuaikan hasil sidang itsbat resmi).',
            isOfficial: true,
          },
          {
            title: 'Nuzulul Quran',
            eventType: 'hari_besar',
            hijriDay: 17,
            hijriMonth: 9,
            hijriYear: 1448,
            gregorianDate: '2027-02-24',
            description: 'Peringatan turunnya Al-Quran beserta khataman dan kajian tadabbur.',
            isOfficial: true,
          },
          {
            title: 'Hari Raya Idulfitri 1448 H',
            eventType: 'hari_besar',
            hijriDay: 1,
            hijriMonth: 10,
            hijriYear: 1448,
            gregorianDate: '2027-03-10',
            description: 'Salat Idulfitri berjamaah dan penyaluran Zakat Fitrah sebelum khatib naik mimbar.',
            isOfficial: true,
          },
          {
            title: 'Hari Raya Iduladha 1447 H',
            eventType: 'hari_besar',
            hijriDay: 10,
            hijriMonth: 12,
            hijriYear: 1447,
            gregorianDate: '2026-05-27',
            description: 'Salat Iduladha berjamaah dan penyembelihan serta distribusi hewan kurban.',
            isOfficial: true,
          },
        ]);
      }

      // 7. Published Event Posters
      const existingPosters = await db.select().from(eventPosters);
      if (existingPosters.length === 0) {
        await db.insert(eventPosters).values([
          {
            title: 'Kajian Subuh & Tafsir Tematik Akhir Pekan',
            description: 'Kajian rutin membahas tafsir ayat-ayat akhlak dan muamalah bersama ustadz pembina masjid. Terbuka untuk seluruh jamaah putra dan putri serta dilengkapi sarapan bersama di serambi masjid.',
            imageUrl: '/src/assets/images/poster_kajian_subuh_1795249573167.jpg',
            eventDate: '2026-11-29',
            eventTime: '05:15 - 06:30 WIB',
            location: 'Ruang Utama Masjid Agung Al-Ikhlas',
            contactInfo: 'Sekretariat DKM (0812-0000-0000)',
            status: 'published',
            publishedAt: new Date(),
          },
          {
            title: 'Santunan Anak Yatim & Dhuafa Lingkungan Masjid',
            description: 'Program kepedulian sosial penyaluran bantuan pendidikan dan kebutuhan pokok bagi anak yatim serta keluarga prasejahtera di sekitar masjid.',
            imageUrl: '/src/assets/images/poster_santunan_yatim_1795249573832.jpg',
            eventDate: '2026-12-06',
            eventTime: '09:00 - 11:30 WIB',
            location: 'Pelataran & Aula Serbaguna Masjid',
            contactInfo: 'Bidang Sosial DKM (0812-0000-0000)',
            status: 'published',
            publishedAt: new Date(),
          },
          {
            title: 'Malam Qiyamul Lail & Munajat Bersama',
            description: 'Kegiatan ibadah malam bulanan meliputi salat tahajud berjamaah, dzikir, doa bersama, dan tausiyah penyucian jiwa menjelang subuh.',
            imageUrl: '/src/assets/images/poster_ramadan_itikaf_1795249574327.jpg',
            eventDate: '2026-12-12',
            eventTime: '03:00 - 04:45 WIB',
            location: 'Ruang Utama Masjid Agung Al-Ikhlas',
            contactInfo: 'Bidang Ibadah DKM (0812-0000-0000)',
            status: 'published',
            publishedAt: new Date(),
          },
        ]);
      }

      // 8. Mosque Activities
      const existingActivities = await db.select().from(mosqueActivities);
      if (existingActivities.length === 0) {
        await db.insert(mosqueActivities).values([
          {
            title: 'Kajian Fiqih Ibadah Praktis',
            category: 'Kajian Pekanan',
            description: 'Pendalaman tata cara bersuci, salat berjamaah, dan fiqih sehari-hari.',
            activityDate: '2026-11-27',
            startTime: '18:30',
            endTime: '19:30',
            location: 'Ruang Utama Masjid',
            speaker: 'Ustadz Ahmad Fauzi, Lc.',
            contactPerson: 'Sekretariat DKM',
            status: 'published',
          },
          {
            title: 'Tahsin & Tadarus Al-Quran Jamaah',
            category: 'Pendidikan Al-Quran',
            description: 'Bimbingan makharijul huruf dan tajwid untuk jamaah dewasa dan remaja.',
            activityDate: '2026-11-28',
            startTime: '16:00',
            endTime: '17:30',
            location: 'Serambi Timur Masjid',
            speaker: 'Ustadz H. Ridwan Kamil',
            contactPerson: 'Bidang Dakwah',
            status: 'published',
          },
        ]);
      }

      // 9. Announcements
      const existingAnnouncements = await db.select().from(announcements);
      if (existingAnnouncements.length === 0) {
        await db.insert(announcements).values([
          {
            title: 'Pembukaan Layanan Penerimaan Zakat, Infak, dan Sedekah Daring',
            content: 'Jamaah dapat menggunakan fitur Kalkulator Zakat & Donasi pada portal MasjidKu untuk menghitung kewajiban zakat dan mengirimkan konfirmasi pembayaran secara aman. Seluruh transaksi diverifikasi oleh Bendahara DKM.',
            priority: 'penting',
            isPublished: true,
          },
          {
            title: 'Pembaruan Jadwal Imam & Khatib Salat Jumat',
            content: 'Jadwal khatib dan imam salat Jumat bulan ini telah tersedia di papan informasi masjid dan dapat dilihat melalui agenda kegiatan portal MasjidKu.',
            priority: 'normal',
            isPublished: true,
          },
        ]);
      }

      // 10. Optional automated admin seed when ADMIN_INITIAL_PASSWORD is set
      const envPass = process.env.ADMIN_INITIAL_PASSWORD?.trim();
      if (envPass && envPass.length >= 8) {
        const ketuaRoleId = roleMap.get('ketua_dkm') ?? null;
        const existingKetua = await db
          .select()
          .from(users)
          .where(eq(users.roleCode, 'ketua_dkm'))
          .limit(1);
        const hashed = await hashPassword(envPass);
        if (existingKetua.length === 0) {
          await db.insert(users).values({
            fullName: 'Ketua DKM MasjidKu',
            username: 'ketuadkm',
            email: 'ketua@masjidku.or.id',
            passwordHash: hashed,
            roleId: ketuaRoleId,
            roleCode: 'ketua_dkm',
            isActive: true,
          });
        } else if (!existingKetua[0].passwordHash) {
          await db
            .update(users)
            .set({ passwordHash: hashed, updatedAt: new Date() })
            .where(eq(users.id, existingKetua[0].id));
        }
      }

      seeded = true;
    } catch (err) {
      seedPromise = null;
      throw err;
    }
  })();

  return seedPromise;
}
