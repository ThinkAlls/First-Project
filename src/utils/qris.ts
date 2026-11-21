export interface QrisTag {
  id: string;
  value: string;
}

export interface QrisParsedInfo {
  valid: boolean;
  reason?: string;
  isDynamic: boolean;
  merchantName: string;
  merchantCity: string;
  currency: string;
  amount: string;
  acquirerLabel: string;
  raw: string;
}

export type QrInspectionResult =
  | { kind: 'emv_qris'; info: QrisParsedInfo }
  | { kind: 'ewallet_url'; provider: string; url: string }
  | { kind: 'unsupported'; raw: string; reason: string };

/**
 * Standard EMVCo Merchant-Presented QR CRC-16/CCITT-FALSE
 * Polynomial: 0x1021, Init: 0xFFFF, No final XOR.
 */
export function crc16CCITT(input: string): string {
  let crc = 0xffff;
  for (let i = 0; i < input.length; i++) {
    crc ^= (input.charCodeAt(i) & 0xff) << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

export function parseEmvTags(payload: string): QrisTag[] | null {
  const clean = payload.trim();
  if (!clean || clean.length < 12) return null;

  const tags: QrisTag[] = [];
  let idx = 0;
  while (idx < clean.length) {
    if (idx + 4 > clean.length) return null;
    const id = clean.slice(idx, idx + 2);
    const lenStr = clean.slice(idx + 2, idx + 4);
    if (!/^\d{2}$/.test(lenStr)) return null;
    const len = Number(lenStr);
    const valStart = idx + 4;
    const valEnd = valStart + len;
    if (valEnd > clean.length) return null;
    tags.push({ id, value: clean.slice(valStart, valEnd) });
    idx = valEnd;
  }
  return tags;
}

function detectAcquirerLabel(tags: QrisTag[]): string {
  for (const t of tags) {
    const num = Number(t.id);
    if (num >= 26 && num <= 51) {
      const subTags = parseEmvTags(t.value);
      if (subTags) {
        const gui = (subTags.find((s) => s.id === '00')?.value || '').toUpperCase();
        if (gui.includes('DANA')) return 'DANA';
        if (gui.includes('GOPAY') || gui.includes('GO-JEK')) return 'GoPay';
        if (gui.includes('OVO')) return 'OVO';
        if (gui.includes('SHOPEE') || gui.includes('AIRPAY')) return 'ShopeePay';
        if (gui.includes('LINKAJA') || gui.includes('TCASH')) return 'LinkAja';
        if (gui.includes('BSI') || gui.includes('BANKBSI')) return 'Bank Syariah Indonesia (BSI)';
        if (gui.includes('BCA')) return 'BCA';
        if (gui.includes('BRI')) return 'BRI';
        if (gui.includes('MANDIRI')) return 'Bank Mandiri';
        if (gui.includes('BNI')) return 'BNI';
        if (gui.includes('NOBU')) return 'Nobu QRIS';
        if (gui.includes('MIDTRANS')) return 'Midtrans QRIS';
        if (gui.includes('XENDIT')) return 'Xendit QRIS';
      }
    }
  }
  return 'QRIS Nasional';
}

export function validateQrisPayload(payload: string): QrisParsedInfo {
  const clean = typeof payload === 'string' ? payload.trim() : '';
  const baseInvalid = (reason: string): QrisParsedInfo => ({
    valid: false,
    reason,
    isDynamic: false,
    merchantName: '',
    merchantCity: '',
    currency: '',
    amount: '',
    acquirerLabel: '',
    raw: clean,
  });

  if (!clean.startsWith('000201')) {
    return baseInvalid('Payload QRIS harus diawali dengan standar EMVCo "000201".');
  }
  if (clean.length < 40) {
    return baseInvalid('Panjang payload QRIS tidak mencukupi.');
  }

  const tags = parseEmvTags(clean);
  if (!tags) {
    return baseInvalid('Struktur tag EMVCo QRIS tidak valid.');
  }

  const crcTag = tags[tags.length - 1];
  if (!crcTag || crcTag.id !== '63' || crcTag.value.length !== 4) {
    return baseInvalid('Tag CRC (63) QRIS tidak ditemukan.');
  }

  const bodyWithoutCrcVal = clean.slice(0, clean.length - 4);
  const expectedCrc = crc16CCITT(bodyWithoutCrcVal);
  if (expectedCrc !== crcTag.value.toUpperCase()) {
    return baseInvalid(`Checksum CRC-16 QRIS tidak cocok (terbaca ${crcTag.value}, seharusnya ${expectedCrc}).`);
  }

  const hasMerchantInfo = tags.some((t) => {
    const n = Number(t.id);
    return n >= 26 && n <= 51;
  });
  if (!hasMerchantInfo) {
    return baseInvalid('Data Merchant Account Information (Tag 26–51) tidak ditemukan.');
  }

  const tag01 = tags.find((t) => t.id === '01')?.value || '11';
  const merchantName = tags.find((t) => t.id === '59')?.value || '';
  const merchantCity = tags.find((t) => t.id === '60')?.value || '';
  const currency = tags.find((t) => t.id === '53')?.value || '360';
  const amount = tags.find((t) => t.id === '54')?.value || '';

  return {
    valid: true,
    isDynamic: tag01 === '12',
    merchantName,
    merchantCity,
    currency,
    amount,
    acquirerLabel: detectAcquirerLabel(tags),
    raw: clean,
  };
}

/**
 * Converts a valid static/dynamic EMVCo QRIS payload into a Dynamic QRIS
 * containing exact integer Rupiah amount (Tag 54) and recalculated CRC-16 (Tag 63).
 */
export function buildDynamicQris(staticQris: string, amountIdr: number): string | null {
  const info = validateQrisPayload(staticQris);
  if (!info.valid) return null;

  const tags = parseEmvTags(info.raw);
  if (!tags) return null;

  const roundedAmount = Math.round(Number(amountIdr));
  const useDynamic = Number.isFinite(roundedAmount) && roundedAmount > 0;

  const filtered = tags.filter((t) => t.id !== '54' && t.id !== '63');
  const updated: QrisTag[] = [];
  let insertedAmount = false;

  for (const tag of filtered) {
    if (tag.id === '01') {
      updated.push({ id: '01', value: useDynamic ? '12' : '11' });
      continue;
    }
    if (useDynamic && !insertedAmount && tag.id === '58') {
      updated.push({ id: '54', value: String(roundedAmount) });
      insertedAmount = true;
    }
    updated.push(tag);
    if (useDynamic && !insertedAmount && tag.id === '53') {
      updated.push({ id: '54', value: String(roundedAmount) });
      insertedAmount = true;
    }
  }

  if (useDynamic && !insertedAmount) {
    updated.push({ id: '54', value: String(roundedAmount) });
  }

  const serialized = updated
    .map((t) => `${t.id}${String(t.value.length).padStart(2, '0')}${t.value}`)
    .join('');

  const withCrcPrefix = `${serialized}6304`;
  return `${withCrcPrefix}${crc16CCITT(withCrcPrefix)}`;
}

const EWALLET_URL_PROVIDERS: Array<{ pattern: RegExp; provider: string }> = [
  { pattern: /^https:\/\/(link|qr|m)\.dana\.id\//i, provider: 'DANA' },
  { pattern: /^https:\/\/([^/]+\.)?gopay\.co\.id\//i, provider: 'GoPay' },
  { pattern: /^https:\/\/gojek\.link\//i, provider: 'GoPay' },
  { pattern: /^https:\/\/([^/]+\.)?ovo\.id\//i, provider: 'OVO' },
  { pattern: /^https:\/\/([^/]+\.)?(shopee\.co\.id|airpay\.co\.id)\//i, provider: 'ShopeePay' },
  { pattern: /^https:\/\/([^/]+\.)?linkaja\.id\//i, provider: 'LinkAja' },
];

export function detectQrPayloadType(raw: string): QrInspectionResult {
  const clean = raw.trim();
  if (!clean) {
    return { kind: 'unsupported', raw: '', reason: 'Payload QR kosong.' };
  }

  if (clean.startsWith('000201')) {
    return { kind: 'emv_qris', info: validateQrisPayload(clean) };
  }

  for (const rule of EWALLET_URL_PROVIDERS) {
    if (rule.pattern.test(clean)) {
      return { kind: 'ewallet_url', provider: rule.provider, url: clean };
    }
  }

  if (/^https:\/\//i.test(clean)) {
    return { kind: 'ewallet_url', provider: 'Tautan Pembayaran', url: clean };
  }

  return {
    kind: 'unsupported',
    raw: clean,
    reason: 'Format QR bukan standar EMVCo QRIS (000201...) maupun tautan pembayaran HTTPS resmi e-wallet.',
  };
}
