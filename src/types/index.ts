export type RoleCode = 'ketua_dkm' | 'bendahara' | 'sekretaris';
export type FundType = 'mosque_cash' | 'zakat_fitrah' | 'zakat_mal';

export interface UserProfile {
  id: number;
  fullName: string;
  username: string;
  email: string;
  roleCode: RoleCode;
  isActive?: boolean;
  lastLoginAt?: string | null;
  createdAt?: string;
}

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

export interface MosquePaymentMethod {
  id: number;
  accountType: 'bank_transfer' | 'e_wallet';
  providerName: string;
  accountNumber: string;
  accountHolder: string;
  programScope: 'all' | 'zakat' | 'infak' | 'sedekah';
  paymentLink?: string | null;
  qrCodeUrl?: string | null;
  qrisPayload?: string | null;
  qrisMerchantName?: string | null;
  notes?: string | null;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface MosqueAsset {
  id: number;
  assetCode: string;
  assetName: string;
  category: string;
  quantity: number;
  unit: string;
  acquisitionDate: string;
  acquisitionSource: string;
  conditionStatus: 'Baik' | 'Perlu Perawatan' | 'Rusak Ringan' | 'Rusak Berat';
  nominalValue: string | number;
  location: string;
  notes?: string | null;
  photoUrl?: string | null;
  isActive: boolean;
  createdAt?: string;
}

export interface AssetSummary {
  totalItems: number;
  totalQuantity: number;
  totalNominalValue: number;
}

export interface MosqueSettings {
  id: number;
  mosqueName: string;
  tagline: string;
  logoUrl: string;
  heroImageUrl: string;
  address: string;
  city: string;
  province: string;
  country: string;
  latitude: string;
  longitude: string;
  timezone: 'WIB' | 'WITA' | 'WIT';
  calculationMethod: number;
  whatsappNumber: string;
  email: string;
  shortDescription: string;
  history: string;
  vision: string;
  mission: string;
  dkmStructure: Array<{ position: string; name: string; period?: string }>;
  googleMapsUrl: string;
  bankName: string;
  bankAccountNumber: string;
  bankAccountHolder: string;
  qrisImageUrl: string;
  paymentChannels?: PaymentChannelsMap;
  initialCashBalance: string;
  initialZakatFitrahBalance: string;
  initialZakatMalBalance: string;
  zakatFitrahRiceKg: string;
  zakatFitrahMoneyAmount: string;
  goldPricePerGram: string;
  expenseApprovalThreshold: string;
}

export interface FundBalances {
  mosqueCash: {
    opening: number;
    income: number;
    expense: number;
    balance: number;
  };
  zakatFitrah: {
    opening: number;
    income: number;
    distributed: number;
    balance: number;
  };
  zakatMal: {
    opening: number;
    income: number;
    distributed: number;
    balance: number;
  };
  totalZakatCollected: number;
  totalZakatDistributed: number;
  totalZakatRemaining: number;
  mosqueAssets?: AssetSummary;
}

export interface PrayerSchedule {
  scheduleDate: string;
  hijriDate: string;
  hijriMonthName: string;
  hijriYear: string;
  fajr: string;
  sunrise: string;
  dhuhr: string;
  asr: string;
  maghrib: string;
  isha: string;
  city: string;
  timezone: string;
  method: number;
  source: string;
}

export interface EventPoster {
  id: number;
  title: string;
  description: string;
  imageUrl: string;
  eventDate: string;
  eventTime: string;
  location: string;
  contactInfo: string;
  status: 'draft' | 'published' | 'archived';
  publishedAt?: string | null;
  createdAt?: string;
}

export interface MosqueActivity {
  id: number;
  title: string;
  category: string;
  description: string;
  activityDate: string;
  startTime: string;
  endTime: string;
  location: string;
  speaker: string;
  contactPerson: string;
  status: string;
}

export interface Announcement {
  id: number;
  title: string;
  content: string;
  priority: 'normal' | 'penting';
  isPublished: boolean;
  publishedAt?: string;
}

export interface IslamicEvent {
  id: number;
  title: string;
  eventType: 'hari_besar' | 'kegiatan_khusus';
  hijriDay: number;
  hijriMonth: number;
  hijriYear: number;
  gregorianDate: string;
  description: string;
}
