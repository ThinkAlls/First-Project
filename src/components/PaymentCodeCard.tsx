import { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import JsBarcode from 'jsbarcode';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  QrCode,
  ScanBarcode,
} from 'lucide-react';
import { formatRupiah, getPaymentMethodLabel } from '../utils/format.ts';
import { buildDynamicQris, detectQrPayloadType, validateQrisPayload } from '../utils/qris.ts';
import { decodeQrFromImageUrl } from '../utils/qrDecode.ts';

interface PaymentCodeCardProps {
  programLabel: string; // "Zakat" | "Infak" | "Sedekah"
  mosqueName?: string;
  mosqueLogoUrl?: string;
  selectedMethod:
    | 'bank_transfer'
    | 'dana'
    | 'gopay'
    | 'ovo'
    | 'shopeepay'
    | 'linkaja'
    | 'qris';
  bankName: string;
  bankAccountNumber: string;
  bankAccountHolder: string;
  ewalletProvider?: string;
  ewalletNumber?: string;
  ewalletHolder?: string;
  ewalletLink?: string;
  qrisPayload?: string;
  qrisMerchantName?: string;
  ewalletQrImageUrl?: string;
  globalQrisImageUrl?: string;
  nominalAmount: number;
  transactionNumber: string;
  staticQrisMode?: boolean;
}

function sanitizeNumber(raw: string | undefined): string {
  if (!raw) return '';
  return raw.replace(/\(.*?\)/g, '').replace(/[^0-9A-Za-z+\-]/g, '').trim();
}

const EWALLET_PORTAL_LINKS: Record<string, { label: string; url: string }> = {
  dana: { label: 'Buka Aplikasi DANA', url: 'https://link.dana.id/' },
  gopay: { label: 'Info Pembayaran GoPay', url: 'https://gopay.co.id/' },
  ovo: { label: 'Info Pembayaran OVO', url: 'https://www.ovo.id/' },
  shopeepay: { label: 'Info Pembayaran ShopeePay', url: 'https://shopeepay.co.id/' },
  linkaja: { label: 'Info Pembayaran LinkAja', url: 'https://www.linkaja.id/' },
};

export function PaymentCodeCard({
  programLabel,
  mosqueName = '',
  mosqueLogoUrl = '',
  selectedMethod,
  bankName,
  bankAccountNumber,
  bankAccountHolder,
  ewalletProvider = 'dana',
  ewalletNumber = '',
  ewalletHolder = '',
  ewalletLink = '',
  qrisPayload = '',
  qrisMerchantName = '',
  ewalletQrImageUrl = '',
  globalQrisImageUrl = '',
  nominalAmount,
  transactionNumber,
  staticQrisMode = true,
}: PaymentCodeCardProps) {
  const cleanBankAcc = sanitizeNumber(bankAccountNumber);
  const cleanWalletAcc = sanitizeNumber(ewalletNumber);
  const fallbackQrImg =
    selectedMethod === 'qris'
      ? globalQrisImageUrl || ewalletQrImageUrl || ''
      : ewalletQrImageUrl || globalQrisImageUrl || '';

  const [decodedFallbackPayload, setDecodedFallbackPayload] = useState<string>('');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [barcodeDataUrl, setBarcodeDataUrl] = useState<string>('');
  const [showRefBarcode, setShowRefBarcode] = useState(false);
  const [copiedField, setCopiedField] = useState<'account' | 'wallet' | 'amount' | null>(null);

  // If admin uploaded a QRIS/e-wallet image before saving text payload, try decoding it automatically
  useEffect(() => {
    let active = true;
    if (qrisPayload.trim() || !fallbackQrImg) {
      setDecodedFallbackPayload('');
      return;
    }
    decodeQrFromImageUrl(fallbackQrImg)
      .then((res) => {
        if (active && res.decodedText) {
          setDecodedFallbackPayload(res.decodedText);
        }
      })
      .catch(() => {
        if (active) setDecodedFallbackPayload('');
      });
    return () => {
      active = false;
    };
  }, [qrisPayload, fallbackQrImg]);

  // Determine the authentic scannable payload (prefer static uploaded QRIS image or static QR payload when staticQrisMode is enabled)
  const scannableSource = useMemo(() => {
    if (staticQrisMode && fallbackQrImg) {
      return {
        mode: 'uploaded_image' as const,
        imageUrl: fallbackQrImg,
      };
    }

    const candidateQris = qrisPayload.trim() || decodedFallbackPayload.trim();
    if (candidateQris) {
      const qrisCheck = validateQrisPayload(candidateQris);
      if (qrisCheck.valid) {
        if (staticQrisMode) {
          return {
            mode: 'static_qris' as const,
            payload: qrisCheck.raw,
            merchantName: qrisMerchantName || qrisCheck.merchantName || 'Merchant QRIS Masjid',
            merchantCity: qrisCheck.merchantCity,
            acquirerLabel: qrisCheck.acquirerLabel,
          };
        }
        const dynamicPayload = buildDynamicQris(qrisCheck.raw, nominalAmount);
        if (dynamicPayload) {
          return {
            mode: 'dynamic_qris' as const,
            payload: dynamicPayload,
            merchantName: qrisMerchantName || qrisCheck.merchantName || 'Merchant QRIS Masjid',
            merchantCity: qrisCheck.merchantCity,
            acquirerLabel: qrisCheck.acquirerLabel,
          };
        }
      }
      const detected = detectQrPayloadType(candidateQris);
      if (detected.kind === 'ewallet_url') {
        return {
          mode: 'ewallet_url' as const,
          payload: detected.url,
          provider: detected.provider,
        };
      }
    }

    const cleanLink = ewalletLink.trim();
    if (cleanLink) {
      const detectedLink = detectQrPayloadType(cleanLink);
      if (detectedLink.kind === 'ewallet_url') {
        return {
          mode: 'ewallet_url' as const,
          payload: detectedLink.url,
          provider: detectedLink.provider,
        };
      }
    }

    if (fallbackQrImg) {
      return {
        mode: 'uploaded_image' as const,
        imageUrl: fallbackQrImg,
      };
    }

    return { mode: 'manual_only' as const };
  }, [
    staticQrisMode,
    qrisPayload,
    decodedFallbackPayload,
    nominalAmount,
    qrisMerchantName,
    ewalletLink,
    fallbackQrImg,
  ]);

  // Generate real high-contrast black-on-white QR PNG only for valid EMVCo QRIS or official E-Wallet URLs
  useEffect(() => {
    let active = true;
    if (
      scannableSource.mode !== 'dynamic_qris' &&
      scannableSource.mode !== 'static_qris' &&
      scannableSource.mode !== 'ewallet_url'
    ) {
      setQrDataUrl('');
      return;
    }

    QRCode.toDataURL(scannableSource.payload, {
      width: 260,
      margin: 3,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
      errorCorrectionLevel: 'M',
    })
      .then((url) => {
        if (active) setQrDataUrl(url);
      })
      .catch(() => {
        if (active) setQrDataUrl('');
      });

    return () => {
      active = false;
    };
  }, [scannableSource]);

  // Optional Code128 transaction reference barcode for DKM verification desk
  useEffect(() => {
    if (!transactionNumber) {
      setBarcodeDataUrl('');
      return;
    }
    try {
      const canvas = document.createElement('canvas');
      JsBarcode(canvas, transactionNumber, {
        format: 'CODE128',
        lineColor: '#14221B',
        background: '#FFFFFF',
        width: 2,
        height: 54,
        displayValue: true,
        font: 'monospace',
        fontSize: 12,
        margin: 8,
      });
      setBarcodeDataUrl(canvas.toDataURL('image/png'));
    } catch {
      setBarcodeDataUrl('');
    }
  }, [transactionNumber]);

  const handleCopy = async (text: string, field: 'account' | 'wallet' | 'amount') => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 1800);
    } catch {
      // Clipboard fallback ignored
    }
  };

  const handleDownload = (dataUrl: string, kind: string) => {
    if (!dataUrl) return;
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `${kind}-${programLabel.replace(/\s+/g, '-')}-${transactionNumber}.png`;
    link.click();
  };

  const isBankSelected = selectedMethod === 'bank_transfer';
  const walletPortal =
    ewalletLink.trim() && /^https?:\/\//i.test(ewalletLink.trim())
      ? { label: `Buka Tautan ${ewalletProvider.toUpperCase()}`, url: ewalletLink.trim() }
      : EWALLET_PORTAL_LINKS[selectedMethod] || EWALLET_PORTAL_LINKS[ewalletProvider] || EWALLET_PORTAL_LINKS.dana;

  return (
    <div className="bg-[#FAF9F5] border border-[#E4DFD3] rounded-xl p-5 space-y-5">
      {/* Header info */}
      <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b border-[#E4DFD3]">
        <div className="flex items-start gap-3">
          {mosqueLogoUrl && (
            <img
              src={mosqueLogoUrl}
              alt={mosqueName || 'Logo Masjid'}
              referrerPolicy="no-referrer"
              className="w-10 h-10 rounded-lg object-cover border border-[#E4DFD3] bg-white shrink-0"
            />
          )}
          <div>
            {mosqueName && (
              <div className="text-[11px] font-semibold text-[#5F6F65]">{mosqueName}</div>
            )}
            <div className="text-xs font-semibold text-[#8C6826]">
              {getPaymentMethodLabel(selectedMethod)} · Program {programLabel}
            </div>
            <div className="font-mono text-xl font-bold text-[#064E3B] tabular-nums mt-0.5">
              {formatRupiah(nominalAmount)}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => handleCopy(String(Math.round(nominalAmount)), 'amount')}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white border border-[#E4DFD3] rounded-lg text-[#14221B] hover:border-[#064E3B]"
        >
          {copiedField === 'amount' ? (
            <Check className="w-3.5 h-3.5 text-emerald-700" />
          ) : (
            <Copy className="w-3.5 h-3.5" />
          )}
          <span>{copiedField === 'amount' ? 'Nominal Disalin' : 'Salin Nominal'}</span>
        </button>
      </div>

      {/* SECTION A: E-WALLET / QRIS SCANNABLE CODE */}
      {!isBankSelected && (
        <div className="space-y-4">
          {(scannableSource.mode === 'static_qris' || scannableSource.mode === 'dynamic_qris') && qrDataUrl && (
            <div className="bg-white border border-[#E4DFD3] rounded-xl p-5 flex flex-col items-center text-center space-y-3">
              <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-800">
                <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                <span>
                  QRIS Resmi Masjid · {scannableSource.merchantName}
                </span>
              </div>
              <div className="p-3 bg-white border border-[#E4DFD3] rounded-xl">
                <img
                  src={qrDataUrl}
                  alt={`QRIS Pembayaran ${programLabel} ${formatRupiah(nominalAmount)}`}
                  className="w-56 h-56 object-contain"
                />
              </div>
              <div className="text-xs text-[#14221B] max-w-md leading-relaxed font-medium">
                Silakan scan QRIS menggunakan aplikasi mobile banking atau e-wallet yang mendukung QRIS. Masukkan nominal sesuai jumlah yang tertera:{' '}
                <strong className="font-mono text-[#064E3B]">{formatRupiah(nominalAmount)}</strong>.
              </div>
              <div className="w-full max-w-md bg-[#FAF9F5] border border-[#E4DFD3] rounded-lg p-3 text-left text-[11px] text-[#4A5A51] space-y-1.5">
                <div className="font-semibold text-[#8C6826]">
                  Penting — QRIS Statis (Input Nominal Manual):
                </div>
                <p className="leading-relaxed">
                  Karena menggunakan QRIS statis tanpa payment gateway, QRIS tidak otomatis mengunci nominal pembayaran. Mohon masukkan nominal{' '}
                  <strong className="font-mono text-[#064E3B]">{formatRupiah(nominalAmount)}</strong> secara manual sesuai instruksi.
                </p>
                <ol className="list-decimal list-inside space-y-0.5 pt-1 text-[#5F6F65]">
                  <li>Buka aplikasi Mobile Banking atau E-Wallet Anda, lalu pilih menu Scan / QRIS.</li>
                  <li>Pindai QRIS resmi masjid di atas.</li>
                  <li>Masukkan nominal tepat <strong className="font-mono">{formatRupiah(nominalAmount)}</strong> dan konfirmasi pembayaran.</li>
                  <li>Simpan screenshot bukti berhasil untuk diunggah pada Tahap Konfirmasi Pembayaran di bawah.</li>
                </ol>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => handleDownload(qrDataUrl, 'QRIS-Masjid')}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-[#064E3B] text-white rounded-lg hover:bg-emerald-800"
                >
                  <Download className="w-3.5 h-3.5" />
                  Unduh Gambar QRIS
                </button>
                {walletPortal && selectedMethod !== 'qris' && (
                  <a
                    href={walletPortal.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-[#118EEA] text-white rounded-lg hover:bg-[#0D7AD0]"
                  >
                    <span>{walletPortal.label}</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            </div>
          )}

          {scannableSource.mode === 'ewallet_url' && qrDataUrl && (
            <div className="bg-white border border-[#E4DFD3] rounded-xl p-5 flex flex-col items-center text-center space-y-3">
              <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-800">
                <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                <span>QR Resmi {scannableSource.provider} Terintegrasi</span>
              </div>
              <div className="p-3 bg-white border border-[#E4DFD3] rounded-xl">
                <img
                  src={qrDataUrl}
                  alt={`QR ${scannableSource.provider} ${programLabel}`}
                  className="w-56 h-56 object-contain"
                />
              </div>
              <div className="text-xs text-[#4A5A51] max-w-md leading-relaxed">
                Pindai QR atau klik tombol di bawah untuk membuka pembayaran{' '}
                <strong>{scannableSource.provider}</strong>, lalu masukkan nominal{' '}
                <strong className="font-mono text-[#064E3B]">{formatRupiah(nominalAmount)}</strong>.
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => handleDownload(qrDataUrl, `QR-${scannableSource.provider}`)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold border border-[#E4DFD3] text-[#14221B] rounded-lg hover:border-[#064E3B]"
                >
                  <Download className="w-3.5 h-3.5" />
                  Unduh QR
                </button>
                <a
                  href={scannableSource.payload}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-[#118EEA] text-white rounded-lg hover:bg-[#0D7AD0]"
                >
                  <span>Buka Aplikasi {scannableSource.provider}</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          )}

          {scannableSource.mode === 'uploaded_image' && (
            <div className="bg-white border border-[#E4DFD3] rounded-xl p-5 flex flex-col items-center text-center space-y-3">
              <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#064E3B]">
                <QrCode className="w-4 h-4" />
                <span>
                  {selectedMethod === 'qris'
                    ? 'QRIS Resmi Masjid'
                    : `QR Resmi ${getPaymentMethodLabel(selectedMethod)} Masjid`}
                </span>
              </div>
              <img
                src={scannableSource.imageUrl}
                alt={`QRIS Pembayaran ${programLabel}`}
                referrerPolicy="no-referrer"
                className="w-60 max-h-72 object-contain rounded-lg border border-[#E4DFD3]"
              />
              <div className="text-xs text-[#14221B] max-w-md leading-relaxed font-medium">
                Silakan scan QRIS menggunakan aplikasi mobile banking atau e-wallet yang mendukung QRIS. Masukkan nominal sesuai jumlah yang tertera:{' '}
                <strong className="font-mono text-[#064E3B]">{formatRupiah(nominalAmount)}</strong>.
              </div>
              <div className="w-full max-w-md bg-[#FAF9F5] border border-[#E4DFD3] rounded-lg p-3 text-left text-[11px] text-[#4A5A51] space-y-1.5">
                <div className="font-semibold text-[#8C6826]">
                  Penting — QRIS Statis (Input Nominal Manual):
                </div>
                <p className="leading-relaxed">
                  Karena menggunakan QRIS statis tanpa payment gateway, QRIS tidak otomatis mengunci nominal pembayaran. Harap masukkan nominal{' '}
                  <strong className="font-mono text-[#064E3B]">{formatRupiah(nominalAmount)}</strong> secara manual sesuai instruksi.
                </p>
                <ol className="list-decimal list-inside space-y-0.5 pt-1 text-[#5F6F65]">
                  <li>Buka aplikasi Mobile Banking atau E-Wallet yang mendukung QRIS.</li>
                  <li>Scan gambar QRIS resmi masjid di atas atau unggah dari galeri setelah mengunduhnya.</li>
                  <li>Masukkan nominal tepat <strong className="font-mono">{formatRupiah(nominalAmount)}</strong> lalu selesaikan pembayaran.</li>
                  <li>Unggah bukti pembayaran & isi tanggal pembayaran pada formulir Konfirmasi Pembayaran di bawah.</li>
                </ol>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <a
                  href={scannableSource.imageUrl}
                  download={`QRIS-Masjid-${transactionNumber}.jpg`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-[#064E3B] text-white rounded-lg hover:bg-emerald-800"
                >
                  <Download className="w-3.5 h-3.5" />
                  Buka / Unduh QRIS
                </a>
                {walletPortal && selectedMethod !== 'qris' && (
                  <a
                    href={walletPortal.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-[#118EEA] text-white rounded-lg hover:bg-[#0D7AD0]"
                  >
                    <span>{walletPortal.label}</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Direct E-Wallet Number Card (Always helpful as backup or primary when QRIS isn't uploaded yet) */}
          {cleanWalletAcc ? (
            <div className="bg-white border border-[#E4DFD3] rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="text-xs text-[#5F6F65]">
                  Nomor E-Wallet Tujuan ({ewalletProvider.toUpperCase()})
                </div>
                <div className="font-mono text-lg font-bold text-[#064E3B] select-all">
                  {cleanWalletAcc}
                </div>
                {ewalletHolder && (
                  <div className="text-xs text-[#4A5A51]">a.n. {ewalletHolder}</div>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => handleCopy(cleanWalletAcc, 'wallet')}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-[#FAF9F5] border border-[#E4DFD3] rounded-lg text-[#14221B] hover:border-[#064E3B]"
                >
                  {copiedField === 'wallet' ? (
                    <Check className="w-3.5 h-3.5 text-emerald-700" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  <span>{copiedField === 'wallet' ? 'Disalin' : 'Salin Nomor'}</span>
                </button>
                {scannableSource.mode === 'manual_only' && walletPortal && (
                  <a
                    href={walletPortal.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-[#118EEA] text-white rounded-lg hover:bg-[#0D7AD0]"
                  >
                    <span>{walletPortal.label}</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            </div>
          ) : scannableSource.mode === 'manual_only' ? (
            <div className="bg-white border border-dashed border-[#C7C0B0] rounded-xl p-4 flex items-start gap-2.5 text-xs text-[#5F6F65]">
              <AlertCircle className="w-4 h-4 text-[#8C6826] shrink-0 mt-0.5" />
              <span>
                QRIS maupun Nomor E-Wallet untuk program <strong>{programLabel}</strong> belum dikonfigurasi oleh Ketua DKM. Anda dapat memilih Transfer Bank atau Tunai di Masjid.
              </span>
            </div>
          ) : null}

          {scannableSource.mode === 'manual_only' && cleanWalletAcc && (
            <div className="flex items-start gap-2 text-xs text-[#5F6F65] leading-relaxed">
              <AlertCircle className="w-4 h-4 text-[#8C6826] shrink-0 mt-0.5" />
              <span>
                Admin belum mengunggah QRIS EMVCo/QR resmi untuk program ini, sehingga sistem tidak menampilkan QR buatan agar tidak gagal dipindai di aplikasi e-wallet. Silakan kirim ke nomor <strong>{cleanWalletAcc}</strong> di aplikasi <strong>{ewalletProvider.toUpperCase()}</strong>.
              </span>
            </div>
          )}
        </div>
      )}

      {/* SECTION B: BANK TRANSFER DETAILS */}
      {isBankSelected && (
        <div className="space-y-4">
          <div className="bg-white border border-[#E4DFD3] rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="text-xs font-semibold text-[#8C6826]">{bankName}</div>
              <div className="font-mono text-2xl font-bold text-[#064E3B] select-all tracking-tight">
                {cleanBankAcc || 'Belum diatur oleh Ketua DKM'}
              </div>
              {bankAccountHolder && (
                <div className="text-xs text-[#4A5A51]">a.n. {bankAccountHolder}</div>
              )}
            </div>
            {cleanBankAcc && (
              <button
                type="button"
                onClick={() => handleCopy(cleanBankAcc, 'account')}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-[#064E3B] text-white rounded-lg hover:bg-emerald-800 shrink-0"
              >
                {copiedField === 'account' ? (
                  <Check className="w-3.5 h-3.5" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                <span>{copiedField === 'account' ? 'Rekening Disalin' : 'Salin No. Rekening'}</span>
              </button>
            )}
          </div>

          {scannableSource.mode === 'dynamic_qris' && qrDataUrl && (
            <div className="bg-white border border-[#E4DFD3] rounded-xl p-4 flex flex-col sm:flex-row items-center gap-4">
              <img
                src={qrDataUrl}
                alt={`QRIS Mobile Banking ${programLabel}`}
                className="w-36 h-36 object-contain border border-[#E4DFD3] rounded-lg p-1.5 bg-white shrink-0"
              />
              <div className="space-y-2 text-xs text-[#4A5A51]">
                <div className="font-semibold text-[#064E3B]">
                  Opsi Cepat: Scan QRIS via Mobile Banking
                </div>
                <p className="leading-relaxed">
                  Jika Anda menggunakan BSI Mobile, BCA Mobile, Livin Mandiri, BRImo, atau BNI Mobile, Anda juga bisa langsung scan QRIS dinamis ini (nominal{' '}
                  <strong className="font-mono">{formatRupiah(nominalAmount)}</strong> sudah otomatis terisi).
                </p>
                <button
                  type="button"
                  onClick={() => handleDownload(qrDataUrl, 'QRIS-Mobile-Banking')}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#064E3B] hover:underline"
                >
                  <Download className="w-3.5 h-3.5" />
                  Unduh Gambar QRIS
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Optional Reference Barcode for DKM Secretariat */}
      {barcodeDataUrl && (
        <div className="pt-2 border-t border-[#E4DFD3]">
          <button
            type="button"
            onClick={() => setShowRefBarcode((prev) => !prev)}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#5F6F65] hover:text-[#14221B]"
          >
            <ScanBarcode className="w-3.5 h-3.5" />
            <span>
              {showRefBarcode
                ? 'Sembunyikan Barcode Referensi Transaksi'
                : 'Tampilkan Barcode Referensi Transaksi (Verifikasi DKM)'}
            </span>
          </button>
          {showRefBarcode && (
            <div className="mt-3 bg-white border border-[#E4DFD3] rounded-lg p-3 flex flex-col items-center">
              <img
                src={barcodeDataUrl}
                alt={`Barcode Referensi ${transactionNumber}`}
                className="max-w-full h-auto"
              />
              <span className="text-[11px] text-[#5F6F65] mt-1">
                Barcode Referensi Internal DKM · {transactionNumber}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
