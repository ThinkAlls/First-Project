import { relations } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export type EwalletProvider = 'dana' | 'gopay' | 'ovo' | 'shopeepay' | 'linkaja' | 'qris';

export interface PaymentChannelConfig {
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  ewalletProvider?: EwalletProvider;
  danaNumber: string;
  danaHolder: string;
  danaLink?: string;
  qrisPayload?: string;
  qrisMerchantName?: string;
  ewalletQrImageUrl?: string;
  preferredCodeFormat: 'qr' | 'barcode' | 'both';
}

export interface PaymentChannelsMap {
  zakat: PaymentChannelConfig;
  infak: PaymentChannelConfig;
  sedekah: PaymentChannelConfig;
}

// 1. Roles
export const roles = pgTable('roles', {
  id: serial('id').primaryKey(),
  code: text('code').notNull().unique(), // ketua_dkm | bendahara | sekretaris
  name: text('name').notNull(),
  description: text('description').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 2. Permissions
export const permissions = pgTable('permissions', {
  id: serial('id').primaryKey(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  module: text('module').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 3. Role Permissions
export const rolePermissions = pgTable(
  'role_permissions',
  {
    id: serial('id').primaryKey(),
    roleId: integer('role_id')
      .references(() => roles.id, { onDelete: 'cascade' })
      .notNull(),
    permissionId: integer('permission_id')
      .references(() => permissions.id, { onDelete: 'cascade' })
      .notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [uniqueIndex('role_perm_unique_idx').on(table.roleId, table.permissionId)],
);

// 4. Users (Pengurus DKM)
export const users = pgTable(
  'users',
  {
    id: serial('id').primaryKey(),
    uid: text('uid').unique(), // Firebase Auth UID (optional when created via username/password)
    fullName: text('full_name').notNull(),
    username: text('username').notNull().unique(),
    email: text('email').notNull().unique(),
    passwordHash: text('password_hash'),
    roleId: integer('role_id').references(() => roles.id),
    roleCode: text('role_code').notNull().default('sekretaris'), // ketua_dkm | bendahara | sekretaris
    isActive: boolean('is_active').notNull().default(true),
    lastLoginAt: timestamp('last_login_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [index('users_role_code_idx').on(table.roleCode)],
);

// 5. Mosque Settings
export const mosqueSettings = pgTable('mosque_settings', {
  id: serial('id').primaryKey(),
  mosqueName: text('mosque_name').notNull().default('Masjid Agung Al-Ikhlas'),
  tagline: text('tagline').notNull().default('Pusat Ibadah, Dakwah, dan Pemberdayaan Umat'),
  logoUrl: text('logo_url').notNull().default('/src/assets/images/mosque_emblem_logo_1795249573681.jpg'),
  heroImageUrl: text('hero_image_url').notNull().default('/src/assets/images/hero_mosque_architecture_1795249574221.jpg'),
  address: text('address').notNull().default('Jl. Masjid Raya No. 1, Kebayoran Baru, Jakarta Selatan'),
  city: text('city').notNull().default('Jakarta'),
  province: text('province').notNull().default('DKI Jakarta'),
  country: text('country').notNull().default('Indonesia'),
  latitude: text('latitude').notNull().default('-6.2088'),
  longitude: text('longitude').notNull().default('106.8456'),
  timezone: text('timezone').notNull().default('WIB'), // WIB | WITA | WIT
  calculationMethod: integer('calculation_method').notNull().default(20), // 20 = Kemenag RI in Aladhan
  whatsappNumber: text('whatsapp_number').notNull().default('0812-0000-0000 (Isi Nomor Resmi DKM)'),
  email: text('email').notNull().default('sekretariat@masjid-contoh.or.id'),
  shortDescription: text('short_description').notNull().default('MasjidKu menyajikan informasi ibadah, jadwal salat akurat, kegiatan kajian, dan transparansi pengelolaan dana umat secara terbuka.'),
  history: text('history').notNull().default('Didirikan atas swadaya masyarakat sebagai pusat pembinaan rohani, pendidikan Al-Quran, dan layanan sosial kemasyarakatan.'),
  vision: text('vision').notNull().default('Menjadi masjid percontohan yang makmur, transparan, dan memberdayakan masyarakat sekitar.'),
  mission: text('mission').notNull().default('Menyelenggarakan ibadah berjamaah yang khusyuk, pendidikan Islam berkelanjutan, serta tata kelola keuangan umat yang amanah dan akuntabel.'),
  dkmStructure: jsonb('dkm_structure').$type<Array<{ position: string; name: string; period?: string }>>().notNull().default([
    { position: 'Ketua DKM', name: 'Pengurus Ketua DKM (Atur di Pengaturan)', period: '2025 - 2028' },
    { position: 'Sekretaris', name: 'Pengurus Sekretaris (Atur di Pengaturan)', period: '2025 - 2028' },
    { position: 'Bendahara', name: 'Pengurus Bendahara (Atur di Pengaturan)', period: '2025 - 2028' },
  ]),
  googleMapsUrl: text('google_maps_url').notNull().default('https://maps.google.com/?q=-6.2088,106.8456'),
  bankName: text('bank_name').notNull().default('Bank Syariah Indonesia (BSI) - Placeholder'),
  bankAccountNumber: text('bank_account_number').notNull().default('0000-0000-0000 (Isi Rekening Resmi Masjid)'),
  bankAccountHolder: text('bank_account_holder').notNull().default('DKM Masjid Agung Al-Ikhlas'),
  qrisImageUrl: text('qris_image_url').default(''),
  paymentChannels: jsonb('payment_channels')
    .$type<PaymentChannelsMap>()
    .notNull()
    .default({
      zakat: {
        bankName: 'Bank Syariah Indonesia (BSI)',
        accountNumber: '',
        accountHolder: 'DKM Masjid Agung Al-Ikhlas (Zakat)',
        danaNumber: '',
        danaHolder: 'Unit Pengumpul Zakat Masjid',
        preferredCodeFormat: 'both',
      },
      infak: {
        bankName: 'Bank Syariah Indonesia (BSI)',
        accountNumber: '',
        accountHolder: 'DKM Masjid Agung Al-Ikhlas (Infak)',
        danaNumber: '',
        danaHolder: 'Kas Infak Masjid',
        preferredCodeFormat: 'both',
      },
      sedekah: {
        bankName: 'Bank Syariah Indonesia (BSI)',
        accountNumber: '',
        accountHolder: 'DKM Masjid Agung Al-Ikhlas (Sedekah)',
        danaNumber: '',
        danaHolder: 'Kas Sedekah Masjid',
        preferredCodeFormat: 'both',
      },
    }),
  initialCashBalance: numeric('initial_cash_balance', { precision: 15, scale: 2 }).notNull().default('0'),
  initialZakatFitrahBalance: numeric('initial_zakat_fitrah_balance', { precision: 15, scale: 2 }).notNull().default('0'),
  initialZakatMalBalance: numeric('initial_zakat_mal_balance', { precision: 15, scale: 2 }).notNull().default('0'),
  zakatFitrahRiceKg: numeric('zakat_fitrah_rice_kg', { precision: 5, scale: 2 }).notNull().default('2.50'),
  zakatFitrahMoneyAmount: numeric('zakat_fitrah_money_amount', { precision: 15, scale: 2 }).notNull().default('45000'),
  goldPricePerGram: numeric('gold_price_per_gram', { precision: 15, scale: 2 }).notNull().default('1450000'),
  expenseApprovalThreshold: numeric('expense_approval_threshold', { precision: 15, scale: 2 }).notNull().default('500000'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 6. Prayer Schedules (Cached from Aladhan API)
export const prayerSchedules = pgTable(
  'prayer_schedules',
  {
    id: serial('id').primaryKey(),
    scheduleDate: text('schedule_date').notNull(), // YYYY-MM-DD
    hijriDate: text('hijri_date').notNull(),
    hijriMonthName: text('hijri_month_name').notNull(),
    hijriYear: text('hijri_year').notNull(),
    fajr: text('fajr').notNull(),
    sunrise: text('sunrise').notNull(),
    dhuhr: text('dhuhr').notNull(),
    asr: text('asr').notNull(),
    maghrib: text('maghrib').notNull(),
    isha: text('isha').notNull(),
    city: text('city').notNull(),
    timezone: text('timezone').notNull(),
    method: integer('method').notNull(),
    source: text('source').notNull().default('aladhan_api'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('prayer_date_loc_idx').on(table.scheduleDate, table.city, table.timezone, table.method),
  ],
);

// 7. Islamic Events (Admin adjustable Hijri holidays & milestones)
export const islamicEvents = pgTable(
  'islamic_events',
  {
    id: serial('id').primaryKey(),
    title: text('title').notNull(),
    eventType: text('event_type').notNull(), // hari_besar | kegiatan_khusus
    hijriDay: integer('hijri_day').notNull(),
    hijriMonth: integer('hijri_month').notNull(),
    hijriYear: integer('hijri_year').notNull(),
    gregorianDate: text('gregorian_date').notNull(), // YYYY-MM-DD
    description: text('description').notNull(),
    isOfficial: boolean('is_official').notNull().default(true),
    createdBy: integer('created_by').references(() => users.id),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [index('islamic_events_date_idx').on(table.gregorianDate)],
);

// 8. Mosque Activities
export const mosqueActivities = pgTable(
  'mosque_activities',
  {
    id: serial('id').primaryKey(),
    title: text('title').notNull(),
    category: text('category').notNull().default('Kajian Rutin'),
    description: text('description').notNull(),
    activityDate: text('activity_date').notNull(), // YYYY-MM-DD
    startTime: text('start_time').notNull(),
    endTime: text('end_time').notNull().default(''),
    location: text('location').notNull(),
    speaker: text('speaker').notNull().default(''),
    contactPerson: text('contact_person').notNull().default(''),
    status: text('status').notNull().default('published'), // draft | published | archived
    createdBy: integer('created_by').references(() => users.id),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [index('activities_status_date_idx').on(table.status, table.activityDate)],
);

// 9. Announcements
export const announcements = pgTable(
  'announcements',
  {
    id: serial('id').primaryKey(),
    title: text('title').notNull(),
    content: text('content').notNull(),
    priority: text('priority').notNull().default('normal'), // normal | penting
    isPublished: boolean('is_published').notNull().default(true),
    publishedAt: timestamp('published_at').defaultNow(),
    expiresAt: text('expires_at'),
    createdBy: integer('created_by').references(() => users.id),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [index('announcements_pub_idx').on(table.isPublished)],
);

// 10. Event Posters (Sekretaris & Ketua DKM)
export const eventPosters = pgTable(
  'event_posters',
  {
    id: serial('id').primaryKey(),
    title: text('title').notNull(),
    description: text('description').notNull(),
    imageUrl: text('image_url').notNull(),
    eventDate: text('event_date').notNull(), // YYYY-MM-DD
    eventTime: text('event_time').notNull(),
    location: text('location').notNull(),
    contactInfo: text('contact_info').notNull(),
    status: text('status').notNull().default('draft'), // draft | published | archived
    createdBy: integer('created_by').references(() => users.id),
    publishedAt: timestamp('published_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [index('posters_status_idx').on(table.status, table.eventDate)],
);

// 11. Financial Accounts (Strict Ledger Separation)
export const financialAccounts = pgTable('financial_accounts', {
  id: serial('id').primaryKey(),
  code: text('code').notNull().unique(), // mosque_cash | zakat_fitrah | zakat_mal
  name: text('name').notNull(),
  description: text('description').notNull(),
  openingBalance: numeric('opening_balance', { precision: 15, scale: 2 }).notNull().default('0'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 12. Financial Categories
export const financialCategories = pgTable('financial_categories', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  type: text('type').notNull(), // income | expense
  fundType: text('fund_type').notNull(), // mosque_cash | zakat_fitrah | zakat_mal
  description: text('description').notNull().default(''),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 13. Donors (Private to Admin)
export const donors = pgTable(
  'donors',
  {
    id: serial('id').primaryKey(),
    fullName: text('full_name').notNull(),
    whatsappNumber: text('whatsapp_number').notNull(),
    email: text('email'),
    notes: text('notes'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [index('donors_wa_idx').on(table.whatsappNumber)],
);

// 14. Zakat & Online Donation Transactions (Public payment submissions)
export const zakatTransactions = pgTable(
  'zakat_transactions',
  {
    id: serial('id').primaryKey(),
    transactionNumber: text('transaction_number').notNull().unique(),
    donorId: integer('donor_id').references(() => donors.id),
    donorName: text('donor_name').notNull(),
    whatsappNumber: text('whatsapp_number').notNull(),
    paymentType: text('payment_type').notNull(), // zakat_fitrah | zakat_mal | infak | sedekah
    fundType: text('fund_type').notNull(), // mosque_cash | zakat_fitrah | zakat_mal
    soulCount: integer('soul_count').default(1),
    fitrahForm: text('fitrah_form'), // uang | beras | null
    amount: numeric('amount', { precision: 15, scale: 2 }).notNull(),
    paymentMethod: text('payment_method').notNull(), // qris | bank_transfer | dana | gopay | ovo | shopeepay | linkaja | cash
    paymentMethodId: integer('payment_method_id'),
    paymentMethodLabel: text('payment_method_label'),
    paymentDate: text('payment_date'), // YYYY-MM-DD submitted by donor during step 5 confirmation
    notes: text('notes'),
    proofUrl: text('proof_url'),
    transactionStatus: text('transaction_status').notNull().default('waiting_payment'), // waiting_payment | pending | verified | rejected
    verificationNote: text('verification_note'),
    verifiedBy: integer('verified_by').references(() => users.id),
    verifiedAt: timestamp('verified_at'),
    recordedIncomeId: integer('recorded_income_id'),
    gatewayProvider: text('gateway_provider'), // midtrans | xendit | custom_webhook
    gatewayReferenceId: text('gateway_reference_id'),
    gatewayStatus: text('gateway_status'),
    gatewayUpdatedAt: timestamp('gateway_updated_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('zakat_tx_num_idx').on(table.transactionNumber),
    index('zakat_tx_status_idx').on(table.transactionStatus),
    index('zakat_tx_wa_idx').on(table.whatsappNumber),
  ],
);

// 15. Income Transactions (Verified official ledger entries)
export const incomeTransactions = pgTable(
  'income_transactions',
  {
    id: serial('id').primaryKey(),
    transactionNumber: text('transaction_number').notNull().unique(),
    transactionDate: text('transaction_date').notNull(), // YYYY-MM-DD
    fundType: text('fund_type').notNull(), // mosque_cash | zakat_fitrah | zakat_mal
    categoryId: integer('category_id').references(() => financialCategories.id),
    categoryName: text('category_name').notNull(),
    donorId: integer('donor_id').references(() => donors.id),
    donorName: text('donor_name'),
    amount: numeric('amount', { precision: 15, scale: 2 }).notNull(),
    paymentMethod: text('payment_method').notNull(),
    description: text('description').notNull(),
    proofUrl: text('proof_url'),
    transactionStatus: text('transaction_status').notNull().default('verified'), // pending | verified | rejected | cancelled
    sourceType: text('source_type').notNull().default('manual'), // manual | zakat_payment
    sourceZakatId: integer('source_zakat_id').unique(), // Enforces 1-to-1: prevents double-recording
    createdBy: integer('created_by').references(() => users.id),
    approvedBy: integer('approved_by').references(() => users.id),
    approvedAt: timestamp('approved_at'),
    approvalNote: text('approval_note'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('income_date_fund_idx').on(table.transactionDate, table.fundType),
    index('income_status_idx').on(table.transactionStatus),
  ],
);

// 16. Expense Transactions (Mosque Cash ONLY)
export const expenseTransactions = pgTable(
  'expense_transactions',
  {
    id: serial('id').primaryKey(),
    transactionNumber: text('transaction_number').notNull().unique(),
    transactionDate: text('transaction_date').notNull(), // YYYY-MM-DD
    fundType: text('fund_type').notNull().default('mosque_cash'), // strictly mosque_cash
    categoryId: integer('category_id').references(() => financialCategories.id),
    categoryName: text('category_name').notNull(),
    recipientName: text('recipient_name').notNull(),
    amount: numeric('amount', { precision: 15, scale: 2 }).notNull(),
    paymentMethod: text('payment_method').notNull(),
    description: text('description').notNull(),
    proofUrl: text('proof_url'),
    transactionStatus: text('transaction_status').notNull().default('pending_approval'), // pending_approval | approved | rejected | cancelled
    requiresChairmanApproval: boolean('requires_chairman_approval').notNull().default(true),
    createdBy: integer('created_by').references(() => users.id),
    approvedBy: integer('approved_by').references(() => users.id),
    approvedAt: timestamp('approved_at'),
    approvalNote: text('approval_note'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('expense_date_idx').on(table.transactionDate),
    index('expense_status_idx').on(table.transactionStatus),
  ],
);

// 17. Zakat Distributions (8 Asnaf, strictly from zakat_fitrah or zakat_mal)
export const zakatDistributions = pgTable(
  'zakat_distributions',
  {
    id: serial('id').primaryKey(),
    transactionNumber: text('transaction_number').notNull().unique(),
    distributionDate: text('distribution_date').notNull(), // YYYY-MM-DD
    zakatType: text('zakat_type').notNull(), // zakat_fitrah | zakat_mal
    asnafCategory: text('asnaf_category').notNull(), // Fakir | Miskin | Amil | Mualaf | Riqab | Gharim | Fisabilillah | Ibnu Sabil
    recipientName: text('recipient_name').notNull(),
    recipientPhone: text('recipient_phone'),
    amount: numeric('amount', { precision: 15, scale: 2 }).notNull(),
    description: text('description').notNull(),
    proofUrl: text('proof_url'),
    status: text('status').notNull().default('approved'), // approved | cancelled
    createdBy: integer('created_by').references(() => users.id),
    approvedBy: integer('approved_by').references(() => users.id),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('zakat_dist_date_idx').on(table.distributionDate),
    index('zakat_dist_type_idx').on(table.zakatType),
  ],
);

// 18. Transaction Approvals
export const transactionApprovals = pgTable(
  'transaction_approvals',
  {
    id: serial('id').primaryKey(),
    entityType: text('entity_type').notNull(), // income | expense | zakat
    entityId: integer('entity_id').notNull(),
    transactionNumber: text('transaction_number').notNull(),
    action: text('action').notNull(), // submitted | approved | rejected | cancelled
    note: text('note'),
    actedBy: integer('acted_by').references(() => users.id),
    actedByName: text('acted_by_name').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('approvals_entity_idx').on(table.entityType, table.entityId)],
);

// 19. Audit Logs
export const auditLogs = pgTable(
  'audit_logs',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id').references(() => users.id),
    userName: text('user_name').notNull(),
    userRole: text('user_role').notNull(),
    action: text('action').notNull(), // CREATE | UPDATE | APPROVE | REJECT | CANCEL | VERIFY | LOGIN
    module: text('module').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: integer('entity_id'),
    transactionNumber: text('transaction_number'),
    previousValue: jsonb('previous_value'),
    newValue: jsonb('new_value'),
    ipAddress: text('ip_address'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('audit_module_idx').on(table.module),
    index('audit_created_idx').on(table.createdAt),
  ],
);

// 20. Mosque Assets (Strictly separated from Cash & Zakat balances)
export const mosqueAssets = pgTable(
  'mosque_assets',
  {
    id: serial('id').primaryKey(),
    assetCode: text('asset_code').notNull().unique(),
    assetName: text('asset_name').notNull(),
    category: text('category').notNull(), // Tanah & Bangunan | Elektronik & Audio | Perlengkapan Ibadah | Kendaraan Operasional | Furnitur & Sarana | Lainnya
    quantity: integer('quantity').notNull().default(1),
    unit: text('unit').notNull().default('Unit'),
    acquisitionDate: text('acquisition_date').notNull(), // YYYY-MM-DD
    acquisitionSource: text('acquisition_source').notNull().default('Pembelian Kas Masjid'),
    conditionStatus: text('condition_status').notNull().default('Baik'), // Baik | Perlu Perawatan | Rusak Ringan | Rusak Berat
    nominalValue: numeric('nominal_value', { precision: 15, scale: 2 }).notNull().default('0'),
    location: text('location').notNull().default('Area Utama Masjid'),
    notes: text('notes').default(''),
    photoUrl: text('photo_url'),
    isActive: boolean('is_active').notNull().default(true),
    createdBy: integer('created_by').references(() => users.id),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('assets_category_idx').on(table.category),
    index('assets_active_idx').on(table.isActive),
  ],
);

// 21. Mosque Payment Methods (Dedicated Admin Payment Accounts & QR Codes)
export const mosquePaymentMethods = pgTable(
  'mosque_payment_methods',
  {
    id: serial('id').primaryKey(),
    accountType: text('account_type').notNull(), // bank_transfer | e_wallet
    providerName: text('provider_name').notNull(), // e.g. Bank Syariah Indonesia (BSI), DANA, GoPay, OVO, ShopeePay, QRIS
    accountNumber: text('account_number').notNull().default(''),
    accountHolder: text('account_holder').notNull().default(''),
    programScope: text('program_scope').notNull().default('all'), // all | zakat | infak | sedekah
    paymentLink: text('payment_link').default(''),
    qrCodeUrl: text('qr_code_url').default(''),
    qrisPayload: text('qris_payload').default(''),
    qrisMerchantName: text('qris_merchant_name').default(''),
    notes: text('notes').default(''),
    isActive: boolean('is_active').notNull().default(true),
    createdBy: integer('created_by').references(() => users.id),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('payment_methods_type_idx').on(table.accountType),
    index('payment_methods_active_idx').on(table.isActive),
  ],
);

// Relations
export const rolesRelations = relations(roles, ({ many }) => ({
  users: many(users),
  rolePermissions: many(rolePermissions),
}));

export const usersRelations = relations(users, ({ one }) => ({
  role: one(roles, {
    fields: [users.roleId],
    references: [roles.id],
  }),
}));

export const zakatTransactionsRelations = relations(zakatTransactions, ({ one }) => ({
  donor: one(donors, {
    fields: [zakatTransactions.donorId],
    references: [donors.id],
  }),
}));

export const incomeTransactionsRelations = relations(incomeTransactions, ({ one }) => ({
  category: one(financialCategories, {
    fields: [incomeTransactions.categoryId],
    references: [financialCategories.id],
  }),
  donor: one(donors, {
    fields: [incomeTransactions.donorId],
    references: [donors.id],
  }),
}));

export const expenseTransactionsRelations = relations(expenseTransactions, ({ one }) => ({
  category: one(financialCategories, {
    fields: [expenseTransactions.categoryId],
    references: [financialCategories.id],
  }),
}));
