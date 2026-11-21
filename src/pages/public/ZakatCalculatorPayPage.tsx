import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Calculator,
  CheckCircle2,
  Clock,
  Landmark,
  QrCode,
  RefreshCw,
  Search,
  ShieldCheck,
  Smartphone,
  Upload,
  Wallet,
  XCircle,
} from 'lucide-react';
import { apiRequest } from '../../services/api.ts';
import { useToast } from '../../context/ToastContext.tsx';
import { PaymentCodeCard } from '../../components/PaymentCodeCard.tsx';
import { MosquePaymentMethod, PaymentChannelsMap } from '../../types/index.ts';
import {
  formatDateTimeIndo,
  formatRupiah,
  getPaymentMethodLabel,
  getStatusLabel,
} from '../../utils/format.ts';

interface CalculatorConfig {
  zakatFitrahRiceKg: number;
  zakatFitrahMoneyAmount: number;
  goldPricePerGram: number;
  bankName: string;
  bankAccountNumber: string;
  bankAccountHolder: string;
  qrisImageUrl: string;
  paymentChannels?: PaymentChannelsMap | null;
  paymentMethods?: MosquePaymentMethod[];
  whatsappNumber: string;
  mosqueName: string;
  mosqueLogoUrl?: string;
}

type PaymentType = 'infak' | 'sedekah' | 'zakat_fitrah' | 'zakat_mal';
type MethodCode =
  | 'qris'
  | 'bank_transfer'
  | 'dana'
  | 'gopay'
  | 'ovo'
  | 'shopeepay'
  | 'linkaja'
  | 'cash';

interface ConfiguredChannelOption {
  key: string;
  methodCode: MethodCode;
  paymentMethodId?: number;
  title: string;
  subtitle: string;
  categoryLabel: string;
  displayLabel: string;
}

function mapProviderToMethodCode(
  providerName: string,
): 'dana' | 'gopay' | 'ovo' | 'shopeepay' | 'linkaja' | 'qris' {
  const lower = providerName.toLowerCase();
  if (lower.includes('qris')) return 'qris';
  if (lower.includes('dana')) return 'dana';
  if (lower.includes('gopay')) return 'gopay';
  if (lower.includes('ovo')) return 'ovo';
  if (lower.includes('shopee')) return 'shopeepay';
  if (lower.includes('linkaja')) return 'linkaja';
  return 'qris';
}

function isPlaceholderBank(val: string | undefined | null): boolean {
  if (!val) return true;
  const clean = val.trim().toLowerCase();
  return !clean || clean.includes('0000-0000-0000') || clean.includes('isi rekening') || clean.includes('placeholder');
}

function getPaymentTypeLabel(type: PaymentType | string): string {
  switch (type) {
    case 'infak':
      return 'Infak';
    case 'sedekah':
      return 'Sedekah';
    case 'zakat_fitrah':
      return 'Zakat Fitrah';
    case 'zakat_mal':
      return 'Zakat Mal';
    default:
      return type;
  }
}

const PAYMENT_TYPE_CARDS: Array<{
  id: PaymentType;
  title: string;
  fundTarget: string;
  desc: string;
}> = [
  {
    id: 'infak',
    title: 'Infak',
    fundTarget: 'Kas Masjid',
    desc: 'Infak sukarela untuk operasional, pemeliharaan, dan program kemakmuran masjid.',
  },
  {
    id: 'sedekah',
    title: 'Sedekah',
    fundTarget: 'Kas Masjid',
    desc: 'Sedekah umum untuk kegiatan dakwah, pendidikan, dan pelayanan jamaah masjid.',
  },
  {
    id: 'zakat_fitrah',
    title: 'Zakat Fitrah',
    fundTarget: 'Pembukuan Zakat Fitrah',
    desc: 'Kewajiban zakat per jiwa (beras atau uang) yang disalurkan kepada 8 golongan asnaf.',
  },
  {
    id: 'zakat_mal',
    title: 'Zakat Mal',
    fundTarget: 'Pembukuan Zakat Mal',
    desc: 'Zakat harta 2,5% atas harta bersih yang telah mencapai nisab dan haul 1 tahun Hijriah.',
  },
];

const QUICK_AMOUNTS = [10000, 25000, 50000, 100000, 250000, 500000];

export function ZakatCalculatorPayPage() {
  const { showToast } = useToast();
  const confirmSectionRef = useRef<HTMLFormElement | null>(null);

  const [config, setConfig] = useState<CalculatorConfig | null>(null);
  const [viewMode, setViewMode] = useState<'wizard' | 'status'>('wizard');
  // 1: Pilih Jenis Pembayaran, 2: Input Data & Nominal, 3: Pilih Metode Pembayaran, 4: Ringkasan & Submit, 5: Instruksi & Konfirmasi
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);

  // Tahap 1 & 2 state
  const [paymentType, setPaymentType] = useState<PaymentType>('infak');
  const [donorName, setDonorName] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [paymentAmount, setPaymentAmount] = useState<number>(50000);
  const [notes, setNotes] = useState('');

  // Zakat Fitrah state
  const [soulCount, setSoulCount] = useState<number>(1);
  const [fitrahForm, setFitrahForm] = useState<'uang' | 'beras'>('uang');

  // Zakat Mal calculator state
  const [savings, setSavings] = useState<number>(0);
  const [cashOnHand, setCashOnHand] = useState<number>(0);
  const [goldValue, setGoldValue] = useState<number>(0);
  const [investments, setInvestments] = useState<number>(0);
  const [tradeAssets, setTradeAssets] = useState<number>(0);
  const [otherAssets, setOtherAssets] = useState<number>(0);
  const [dueDebts, setDueDebts] = useState<number>(0);
  const [hasReachedHaul, setHasReachedHaul] = useState<boolean>(true);

  // Tahap 3 state
  const [selectedOptionKey, setSelectedOptionKey] = useState<string>('');

  // Tahap 4 & 5 state
  const [submitting, setSubmitting] = useState(false);
  const [receipt, setReceipt] = useState<any>(null);
  const [destination, setDestination] = useState<any>(null);
  const [mosqueBrand, setMosqueBrand] = useState<{ mosqueName: string; logoUrl: string } | null>(null);
  const [lastSubmittedWa, setLastSubmittedWa] = useState('');

  // Tahap 5 Confirmation (proof + paymentDate)
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [paymentDate, setPaymentDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [confirmingPayment, setConfirmingPayment] = useState(false);

  // Polling state
  const [pollingStatus, setPollingStatus] = useState(false);
  const [lastCheckedAt, setLastCheckedAt] = useState<string | null>(null);
  const [gatewayInfo, setGatewayInfo] = useState<{
    configured?: boolean;
    provider?: string | null;
    checked?: boolean;
    verified?: boolean;
    gatewayStatus?: string | null;
  } | null>(null);
  const receiptStatusRef = useRef<string | null>(null);

  // Status Checker tab state
  const [checkTxNum, setCheckTxNum] = useState('');
  const [checkWa, setCheckWa] = useState('');
  const [checkResult, setCheckResult] = useState<any>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    apiRequest<CalculatorConfig>('/api/public/calculator-config')
      .then(setConfig)
      .catch((err) => showToast(err.message || 'Gagal memuat konfigurasi pembayaran.', 'error'));
  }, [showToast]);

  const fitrahPerSoul = config?.zakatFitrahMoneyAmount ?? 45000;
  const fitrahRiceKg = config?.zakatFitrahRiceKg ?? 2.5;
  const totalFitrahMoney = soulCount * fitrahPerSoul;
  const totalFitrahRice = soulCount * fitrahRiceKg;

  const malCalculation = useMemo(() => {
    const grossAssets =
      savings + cashOnHand + goldValue + investments + tradeAssets + otherAssets;
    const netWealth = Math.max(0, grossAssets - dueDebts);
    const goldPrice = config?.goldPricePerGram ?? 1450000;
    const nisabValue = 85 * goldPrice;
    const meetsNisab = netWealth >= nisabValue;
    const isObligatory = meetsNisab && hasReachedHaul;
    const estimatedZakat = isObligatory ? Math.round(netWealth * 0.025) : 0;
    return {
      grossAssets,
      dueDebts,
      netWealth,
      nisabValue,
      meetsNisab,
      isObligatory,
      estimatedZakat,
    };
  }, [savings, cashOnHand, goldValue, investments, tradeAssets, otherAssets, dueDebts, hasReachedHaul, config]);

  // Keep Zakat Fitrah / Zakat Mal nominal automatically synced when editing their inputs
  useEffect(() => {
    if (paymentType === 'zakat_fitrah') {
      setPaymentAmount(Math.max(1000, soulCount * fitrahPerSoul));
    }
  }, [paymentType, soulCount, fitrahPerSoul]);

  useEffect(() => {
    if (paymentType === 'zakat_mal') {
      setPaymentAmount(malCalculation.estimatedZakat);
    }
  }, [paymentType, malCalculation.estimatedZakat]);

  const activeProgramKey: 'zakat' | 'infak' | 'sedekah' =
    paymentType === 'zakat_fitrah' || paymentType === 'zakat_mal'
      ? 'zakat'
      : paymentType === 'infak'
        ? 'infak'
        : 'sedekah';

  // Tahap 3: Only build methods that are explicitly enabled & configured by Ketua DKM
  // NEVER reveal QRIS images or bank account numbers before Submit!
  const configuredOptions = useMemo<ConfiguredChannelOption[]>(() => {
    if (!config) return [];
    const options: ConfiguredChannelOption[] = [];
    const activeMethods = (config.paymentMethods || []).filter(
      (m) => m.isActive && (m.programScope === 'all' || m.programScope === activeProgramKey),
    );

    const hasDedicatedQris = activeMethods.some(
      (m) => m.accountType === 'e_wallet' && m.providerName.toLowerCase().includes('qris'),
    );
    const hasDedicatedBank = activeMethods.some((m) => m.accountType === 'bank_transfer');

    // 1. Dedicated active rows from mosque_payment_methods
    for (const m of activeMethods) {
      if (m.accountType === 'bank_transfer') {
        options.push({
          key: `pm_${m.id}`,
          methodCode: 'bank_transfer',
          paymentMethodId: m.id,
          title: `Transfer Bank — ${m.providerName}`,
          subtitle: 'Transfer manual ke rekening bank resmi masjid',
          categoryLabel: 'Transfer Bank',
          displayLabel: `Transfer Bank — ${m.providerName}`,
        });
      } else {
        const code = mapProviderToMethodCode(m.providerName);
        options.push({
          key: `pm_${m.id}`,
          methodCode: code,
          paymentMethodId: m.id,
          title: code === 'qris' ? `QRIS — ${m.providerName}` : m.providerName,
          subtitle:
            code === 'qris'
              ? 'Scan QRIS via semua aplikasi Mobile Banking & E-Wallet'
              : `Pembayaran melalui akun ${m.providerName} resmi masjid`,
          categoryLabel: code === 'qris' ? 'QRIS' : 'E-Wallet',
          displayLabel: m.providerName,
        });
      }
    }

    // 2. Fallback configured channels from mosqueSettings / paymentChannels[activeProgramKey]
    const ch = config.paymentChannels?.[activeProgramKey];
    const hasLegacyQris = Boolean(ch?.qrisPayload || ch?.ewalletQrImageUrl || config.qrisImageUrl);
    if (!hasDedicatedQris && hasLegacyQris) {
      options.push({
        key: 'legacy_qris',
        methodCode: 'qris',
        title: 'QRIS Resmi Masjid',
        subtitle: 'Scan QRIS via Mobile Banking, DANA, GoPay, OVO, ShopeePay, atau LinkAja',
        categoryLabel: 'QRIS',
        displayLabel: 'QRIS Resmi Masjid',
      });
    }

    const legacyBankAcc = ch?.accountNumber || config.bankAccountNumber;
    const legacyBankName = (ch?.bankName || config.bankName || 'Bank Resmi Masjid').trim();
    if (!hasDedicatedBank && !isPlaceholderBank(legacyBankAcc)) {
      options.push({
        key: 'legacy_bank',
        methodCode: 'bank_transfer',
        title: `Transfer Bank — ${legacyBankName}`,
        subtitle: 'Transfer langsung ke rekening bank resmi masjid',
        categoryLabel: 'Transfer Bank',
        displayLabel: `Transfer Bank — ${legacyBankName}`,
      });
    }

    const legacyWalletProvider = (ch?.ewalletProvider || 'dana').toLowerCase() as
      | 'dana'
      | 'gopay'
      | 'ovo'
      | 'shopeepay'
      | 'linkaja'
      | 'qris';
    const hasLegacyWallet = Boolean(ch?.danaNumber || ch?.danaLink || ch?.ewalletQrImageUrl);
    const hasDedicatedSameWallet = activeMethods.some(
      (m) => m.accountType === 'e_wallet' && mapProviderToMethodCode(m.providerName) === legacyWalletProvider,
    );
    if (legacyWalletProvider !== 'qris' && hasLegacyWallet && !hasDedicatedSameWallet) {
      const upperName =
        legacyWalletProvider === 'gopay'
          ? 'GoPay'
          : legacyWalletProvider === 'shopeepay'
            ? 'ShopeePay'
            : legacyWalletProvider === 'linkaja'
              ? 'LinkAja'
              : legacyWalletProvider.toUpperCase();
      options.push({
        key: `legacy_${legacyWalletProvider}`,
        methodCode: legacyWalletProvider,
        title: upperName,
        subtitle: `Pembayaran via aplikasi ${upperName} resmi masjid`,
        categoryLabel: 'E-Wallet',
        displayLabel: `E-Wallet ${upperName}`,
      });
    }

    // 3. Physical handover option specifically when Zakat Fitrah is chosen in Beras form
    if (paymentType === 'zakat_fitrah' && fitrahForm === 'beras') {
      options.push({
        key: 'cash_beras',
        methodCode: 'cash',
        title: 'Serah Beras / Tunai di Sekretariat Masjid',
        subtitle: `Penyerahan langsung ${totalFitrahRice.toFixed(2)} kg beras ke petugas amil masjid`,
        categoryLabel: 'Langsung di Masjid',
        displayLabel: 'Serah Beras / Tunai di Masjid',
      });
    }

    return options;
  }, [config, activeProgramKey, paymentType, fitrahForm, totalFitrahRice]);

  useEffect(() => {
    if (configuredOptions.length === 0) {
      setSelectedOptionKey('');
      return;
    }
    if (!configuredOptions.some((o) => o.key === selectedOptionKey)) {
      setSelectedOptionKey(configuredOptions[0].key);
    }
  }, [configuredOptions, selectedOptionKey]);

  const selectedOption = useMemo(
    () => configuredOptions.find((o) => o.key === selectedOptionKey) || null,
    [configuredOptions, selectedOptionKey],
  );

  // Polling status callback
  const refreshReceiptStatus = useCallback(
    async (silent = false) => {
      const txNum = receipt?.transactionNumber;
      const wa = (lastSubmittedWa || receipt?.whatsappNumber || '').trim();
      if (!txNum || !wa) return;

      setPollingStatus(true);
      try {
        const res = await apiRequest<{
          transaction: any;
          gateway?: {
            configured?: boolean;
            provider?: string | null;
            checked?: boolean;
            verified?: boolean;
            gatewayStatus?: string | null;
          };
        }>(
          `/api/public/zakat-payments/${encodeURIComponent(txNum)}/status?whatsappNumber=${encodeURIComponent(wa)}`,
        );

        const prevStatus = receiptStatusRef.current;
        const nextStatus = res.transaction?.transactionStatus;
        receiptStatusRef.current = nextStatus || null;

        setReceipt((prev: any) => (prev ? { ...prev, ...res.transaction } : res.transaction));
        setGatewayInfo(res.gateway || null);
        setLastCheckedAt(new Date().toISOString());

        if (prevStatus !== 'verified' && nextStatus === 'verified') {
          showToast(
            'Pembayaran berhasil terverifikasi dan tercatat ke pembukuan resmi masjid.',
            'success',
          );
        } else if (prevStatus !== 'rejected' && nextStatus === 'rejected') {
          showToast(
            res.transaction?.verificationNote || 'Pembayaran ditolak oleh pengurus DKM.',
            'error',
          );
        } else if (!silent) {
          showToast(`Status saat ini: ${getStatusLabel(nextStatus)}.`, 'info');
        }
      } catch (err: any) {
        if (!silent) {
          showToast(err.message || 'Gagal memeriksa status pembayaran.', 'error');
        }
      } finally {
        setPollingStatus(false);
      }
    },
    [receipt?.transactionNumber, receipt?.whatsappNumber, lastSubmittedWa, showToast],
  );

  useEffect(() => {
    receiptStatusRef.current = receipt?.transactionStatus || null;
  }, [receipt?.transactionStatus]);

  // Auto-poll every 5 seconds while waiting_payment or pending on Step 5
  useEffect(() => {
    const txNum = receipt?.transactionNumber;
    const status = receipt?.transactionStatus;
    const wa = (lastSubmittedWa || receipt?.whatsappNumber || '').trim();
    if (
      viewMode !== 'wizard' ||
      step !== 5 ||
      !txNum ||
      (status !== 'pending' && status !== 'waiting_payment') ||
      !wa
    ) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      void refreshReceiptStatus(true);
    }, 5000);

    return () => window.clearInterval(timer);
  }, [
    viewMode,
    step,
    receipt?.transactionNumber,
    receipt?.transactionStatus,
    receipt?.whatsappNumber,
    lastSubmittedWa,
    refreshReceiptStatus,
  ]);

  const validateStep2 = (): boolean => {
    if (donorName.trim().length < 2) {
      showToast('Nama lengkap wajib diisi (minimal 2 karakter).', 'error');
      return false;
    }
    const waDigits = whatsappNumber.replace(/\D/g, '');
    if (waDigits.length < 8) {
      showToast('Masukkan nomor WhatsApp yang valid (minimal 8 digit angka).', 'error');
      return false;
    }
    if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
      if (paymentType === 'zakat_mal' && !malCalculation.isObligatory) {
        showToast(
          'Harta belum mencapai nisab/haul sehingga zakat mal Rp 0. Anda dapat memilih Infak atau Sedekah.',
          'error',
        );
      } else {
        showToast('Nominal pembayaran harus lebih besar dari nol.', 'error');
      }
      return false;
    }
    return true;
  };

  const goToStep = (target: 1 | 2 | 3 | 4) => {
    if (target >= 3 && !validateStep2()) return;
    if (target === 4 && !selectedOption) {
      showToast('Pilih salah satu metode pembayaran yang tersedia.', 'error');
      return;
    }
    setStep(target);
  };

  // Tahap 4: Submit Payment -> status waiting_payment -> reveals Step 5 QRIS/Bank/E-Wallet instructions
  const handleSubmitPayment = async () => {
    if (!validateStep2()) {
      setStep(2);
      return;
    }
    if (!selectedOption) {
      showToast('Metode pembayaran wajib dipilih.', 'error');
      setStep(3);
      return;
    }

    setSubmitting(true);
    try {
      const combinedNotes =
        paymentType === 'zakat_fitrah' && fitrahForm === 'beras'
          ? `[Zakat Fitrah Beras: ${totalFitrahRice.toFixed(2)} kg / ${soulCount} jiwa]${notes.trim() ? ` ${notes.trim()}` : ''}`
          : notes.trim();

      const payload: Record<string, any> = {
        donorName: donorName.trim(),
        whatsappNumber: whatsappNumber.trim(),
        paymentType,
        amount: paymentAmount,
        paymentMethod: selectedOption.methodCode,
        paymentMethodLabel: selectedOption.displayLabel,
      };
      if (selectedOption.paymentMethodId) {
        payload.paymentMethodId = selectedOption.paymentMethodId;
      }
      if (paymentType === 'zakat_fitrah') {
        payload.soulCount = soulCount;
        payload.fitrahForm = fitrahForm;
      }
      if (combinedNotes) payload.notes = combinedNotes;

      const res = await apiRequest<{
        transaction: any;
        destination: any;
        mosque?: { mosqueName: string; logoUrl: string };
        message: string;
      }>('/api/public/zakat-payments', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setReceipt(res.transaction);
      receiptStatusRef.current = res.transaction?.transactionStatus || 'waiting_payment';
      setDestination(res.destination);
      setMosqueBrand(
        res.mosque || {
          mosqueName: config?.mosqueName || 'MasjidKu',
          logoUrl: config?.mosqueLogoUrl || '',
        },
      );
      setLastSubmittedWa(whatsappNumber.trim());
      setCheckTxNum(res.transaction.transactionNumber);
      setCheckWa(whatsappNumber.trim());
      setProofFile(null);
      setPaymentDate(new Date().toISOString().slice(0, 10));
      setLastCheckedAt(new Date().toISOString());
      setGatewayInfo(null);
      setStep(5);
      showToast(res.message, 'success');
    } catch (err: any) {
      showToast(err.message || 'Gagal mengirim formulir pembayaran.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Tahap 5: Upload payment proof + paymentDate -> KONFIRMASI PEMBAYARAN -> pending (Menunggu Verifikasi)
  const handleConfirmPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!receipt) return;
    if (!proofFile) {
      showToast('Silakan unggah file bukti pembayaran terlebih dahulu.', 'error');
      return;
    }
    if (!paymentDate) {
      showToast('Silakan pilih tanggal pembayaran.', 'error');
      return;
    }

    setConfirmingPayment(true);
    try {
      const fd = new FormData();
      fd.append('whatsappNumber', lastSubmittedWa || receipt.whatsappNumber || '');
      fd.append('paymentDate', paymentDate);
      fd.append('proof', proofFile);

      const res = await apiRequest<{ transaction: any; message: string }>(
        `/api/public/zakat-payments/${encodeURIComponent(receipt.transactionNumber)}/confirm`,
        { method: 'POST', body: fd },
      );

      receiptStatusRef.current = res.transaction.transactionStatus;
      setReceipt((prev: any) =>
        prev
          ? {
              ...prev,
              proofUrl: res.transaction.proofUrl,
              paymentDate: res.transaction.paymentDate,
              transactionStatus: res.transaction.transactionStatus,
            }
          : prev,
      );
      setProofFile(null);
      showToast(res.message, 'success');
    } catch (err: any) {
      showToast(err.message || 'Gagal mengonfirmasi pembayaran.', 'error');
    } finally {
      setConfirmingPayment(false);
    }
  };

  const resetForNewPayment = () => {
    setReceipt(null);
    setDestination(null);
    setProofFile(null);
    setLastCheckedAt(null);
    setGatewayInfo(null);
    receiptStatusRef.current = null;
    setNotes('');
    setStep(1);
  };

  // Status Checker tab callbacks
  const fetchCheckedTransaction = useCallback(
    async (txNum: string, wa: string, silent = false) => {
      if (!silent) setChecking(true);
      try {
        const res = await apiRequest<{ transaction: any }>(
          `/api/public/zakat-payments/check?transactionNumber=${encodeURIComponent(
            txNum,
          )}&whatsappNumber=${encodeURIComponent(wa)}`,
        );
        setCheckResult((prev: any) => {
          if (
            silent &&
            prev?.transactionStatus !== 'verified' &&
            res.transaction?.transactionStatus === 'verified'
          ) {
            showToast('Status transaksi telah terverifikasi.', 'success');
          }
          return res.transaction;
        });
      } catch (err: any) {
        if (!silent) {
          setCheckResult(null);
          showToast(err.message, 'error');
        }
      } finally {
        if (!silent) setChecking(false);
      }
    },
    [showToast],
  );

  const handleCheckStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetchCheckedTransaction(checkTxNum.trim(), checkWa.trim(), false);
  };

  useEffect(() => {
    if (
      viewMode !== 'status' ||
      !checkResult ||
      (checkResult.transactionStatus !== 'pending' &&
        checkResult.transactionStatus !== 'waiting_payment') ||
      !checkTxNum.trim() ||
      !checkWa.trim()
    ) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      void fetchCheckedTransaction(checkTxNum.trim(), checkWa.trim(), true);
    }, 5000);

    return () => window.clearInterval(timer);
  }, [viewMode, checkResult, checkTxNum, checkWa, fetchCheckedTransaction]);

  const statusTone = (status: string) => {
    if (status === 'verified') return 'text-emerald-700';
    if (status === 'rejected') return 'text-red-700';
    if (status === 'waiting_payment') return 'text-[#5F6F65]';
    return 'text-[#8C6826]';
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Header + Top Mode Switch */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-[#14221B]">
            Pembayaran Zakat, Infak & Sedekah
          </h1>
          <p className="text-sm text-[#5F6F65] mt-1">
            Lengkapi data, nominal, dan metode pembayaran terlebih dahulu. Instruksi QRIS atau nomor rekening ditampilkan setelah formulir dikirim.
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-white border border-[#E4DFD3] rounded-xl shrink-0">
          <button
            type="button"
            onClick={() => setViewMode('wizard')}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
              viewMode === 'wizard'
                ? 'bg-[#064E3B] text-white'
                : 'text-[#4A5A51] hover:text-[#14221B]'
            }`}
          >
            Formulir Pembayaran
          </button>
          <button
            type="button"
            onClick={() => setViewMode('status')}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
              viewMode === 'status'
                ? 'bg-[#064E3B] text-white'
                : 'text-[#4A5A51] hover:text-[#14221B]'
            }`}
          >
            Cek Status Transaksi
          </button>
        </div>
      </div>

      {/* MAIN WIZARD VIEW */}
      {viewMode === 'wizard' && (
        <div className="space-y-6">
          {/* 5-Stage Progress Indicator */}
          <div className="bg-white border border-[#E4DFD3] rounded-2xl p-4">
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {[
                { num: 1, label: '1. Jenis Pembayaran' },
                { num: 2, label: '2. Data & Nominal' },
                { num: 3, label: '3. Metode Bayar' },
                { num: 4, label: '4. Ringkasan' },
                { num: 5, label: '5. Bayar & Konfirmasi' },
              ].map((s) => {
                const active = step === s.num;
                const completed = step > s.num;
                const clickable = s.num <= 4 && step < 5 && s.num < step;
                return (
                  <button
                    key={s.num}
                    type="button"
                    disabled={!clickable}
                    onClick={() => clickable && setStep(s.num as any)}
                    className={`px-3 py-2.5 rounded-xl border text-left text-xs font-semibold transition-colors ${
                      active
                        ? 'bg-[#064E3B] text-white border-[#064E3B]'
                        : completed
                          ? 'bg-[#FAF9F5] text-[#064E3B] border-[#064E3B]/40'
                          : 'bg-[#FAF9F5] text-[#5F6F65] border-[#E4DFD3]'
                    } ${clickable ? 'cursor-pointer hover:border-[#064E3B]' : 'cursor-default'}`}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 bg-white border border-[#E4DFD3] rounded-2xl p-6 sm:p-8">
              {/* TAHAP 1: PILIH JENIS PEMBAYARAN */}
              {step === 1 && (
                <div className="space-y-6">
                  <div>
                    <div className="text-xs font-semibold text-[#8C6826] uppercase tracking-wide">
                      Tahap 1 dari 5
                    </div>
                    <h2 className="font-display text-xl font-bold text-[#14221B] mt-0.5">
                      Pilih Jenis Pembayaran
                    </h2>
                    <p className="text-xs text-[#5F6F65] mt-1">
                      Tentukan program dana yang ingin Anda salurkan. Pembukuan Kas Masjid dan Dana Zakat dipisahkan secara ketat.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {PAYMENT_TYPE_CARDS.map((card) => {
                      const selected = paymentType === card.id;
                      return (
                        <button
                          key={card.id}
                          type="button"
                          onClick={() => {
                            setPaymentType(card.id);
                            if (card.id === 'infak') setPaymentAmount(50000);
                            if (card.id === 'sedekah') setPaymentAmount(25000);
                          }}
                          className={`p-5 text-left rounded-xl border transition-colors flex flex-col justify-between gap-3 ${
                            selected
                              ? 'bg-[#064E3B] text-white border-[#064E3B]'
                              : 'bg-[#FAF9F5] text-[#14221B] border-[#E4DFD3] hover:border-[#064E3B]'
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-display text-lg font-bold">{card.title}</span>
                              <span
                                className={`text-[11px] font-semibold ${
                                  selected ? 'text-emerald-200' : 'text-[#8C6826]'
                                }`}
                              >
                                {card.fundTarget}
                              </span>
                            </div>
                            <p
                              className={`text-xs mt-2 leading-relaxed ${
                                selected ? 'text-emerald-100' : 'text-[#5F6F65]'
                              }`}
                            >
                              {card.desc}
                            </p>
                          </div>
                          <div
                            className={`text-xs font-semibold ${
                              selected ? 'text-white' : 'text-[#064E3B]'
                            }`}
                          >
                            {selected ? 'Terpilih' : 'Pilih Program'}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      type="button"
                      onClick={() => setStep(2)}
                      className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold bg-[#064E3B] text-white rounded-lg hover:bg-emerald-800"
                    >
                      <span>Lanjut ke Input Data & Nominal</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* TAHAP 2: INPUT DATA DAN NOMINAL */}
              {step === 2 && (
                <div className="space-y-6">
                  <div>
                    <div className="text-xs font-semibold text-[#8C6826] uppercase tracking-wide">
                      Tahap 2 dari 5 · {getPaymentTypeLabel(paymentType)}
                    </div>
                    <h2 className="font-display text-xl font-bold text-[#14221B] mt-0.5">
                      Input Data Donatur & Nominal Pembayaran
                    </h2>
                    <p className="text-xs text-[#5F6F65] mt-1">
                      Lengkapi identitas donatur dan hitung atau tentukan nominal pembayaran Anda sebelum memilih metode bayar.
                    </p>
                  </div>

                  {/* Common Fields */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-[#4A5A51] mb-1">
                        Nama Lengkap *
                      </label>
                      <input
                        type="text"
                        required
                        value={donorName}
                        onChange={(e) => setDonorName(e.target.value)}
                        placeholder="Contoh: Ahmad Hidayat"
                        className="w-full px-3.5 py-2.5 text-sm border border-[#E4DFD3] rounded-lg bg-[#FAF9F5]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#4A5A51] mb-1">
                        Nomor WhatsApp *
                      </label>
                      <input
                        type="text"
                        required
                        value={whatsappNumber}
                        onChange={(e) => setWhatsappNumber(e.target.value)}
                        placeholder="081234567890"
                        className="w-full px-3.5 py-2.5 text-sm font-mono border border-[#E4DFD3] rounded-lg bg-[#FAF9F5]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#4A5A51] mb-1">
                      Jenis Pembayaran *
                    </label>
                    <select
                      value={paymentType}
                      onChange={(e) => {
                        const next = e.target.value as PaymentType;
                        setPaymentType(next);
                        if (next === 'infak') setPaymentAmount(50000);
                        if (next === 'sedekah') setPaymentAmount(25000);
                      }}
                      className="w-full px-3.5 py-2.5 text-sm border border-[#E4DFD3] rounded-lg bg-[#FAF9F5]"
                    >
                      <option value="infak">Infak (Kas Masjid)</option>
                      <option value="sedekah">Sedekah (Kas Masjid)</option>
                      <option value="zakat_fitrah">Zakat Fitrah (Dana Zakat Fitrah)</option>
                      <option value="zakat_mal">Zakat Mal (Dana Zakat Mal)</option>
                    </select>
                  </div>

                  {/* A. INFAK / SEDEKAH */}
                  {(paymentType === 'infak' || paymentType === 'sedekah') && (
                    <div className="bg-[#FAF9F5] border border-[#E4DFD3] rounded-xl p-5 space-y-4">
                      <div>
                        <label className="block text-xs font-semibold text-[#4A5A51] mb-2">
                          Pilihan Nominal Cepat
                        </label>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                          {QUICK_AMOUNTS.map((amt) => (
                            <button
                              key={amt}
                              type="button"
                              onClick={() => setPaymentAmount(amt)}
                              className={`py-2.5 px-3 text-xs font-mono font-semibold rounded-lg border tabular-nums transition-colors ${
                                paymentAmount === amt
                                  ? 'bg-[#064E3B] text-white border-[#064E3B]'
                                  : 'bg-white text-[#14221B] border-[#E4DFD3] hover:border-[#064E3B]'
                              }`}
                            >
                              {formatRupiah(amt)}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-[#4A5A51] mb-1">
                          Nominal {getPaymentTypeLabel(paymentType)} (IDR) *
                        </label>
                        <input
                          type="number"
                          min={1000}
                          required
                          value={paymentAmount || ''}
                          onChange={(e) => setPaymentAmount(Math.max(0, Number(e.target.value)))}
                          className="w-full px-4 py-2.5 text-base font-mono font-bold border border-[#E4DFD3] rounded-lg bg-white tabular-nums"
                        />
                      </div>
                    </div>
                  )}

                  {/* B. ZAKAT FITRAH */}
                  {paymentType === 'zakat_fitrah' && (
                    <div className="bg-[#FAF9F5] border border-[#E4DFD3] rounded-xl p-5 space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-[#4A5A51] mb-1">
                            Jumlah Jiwa *
                          </label>
                          <input
                            type="number"
                            min={1}
                            max={100}
                            value={soulCount}
                            onChange={(e) => setSoulCount(Math.max(1, Number(e.target.value) || 1))}
                            className="w-full px-3.5 py-2.5 text-base font-mono font-bold border border-[#E4DFD3] rounded-lg bg-white tabular-nums"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-[#4A5A51] mb-1">
                            Bentuk Pembayaran Zakat Fitrah *
                          </label>
                          <div className="grid grid-cols-2 gap-2">
                            {[
                              { id: 'uang', label: 'Uang Tunai / Transfer' },
                              { id: 'beras', label: 'Beras' },
                            ].map((opt) => (
                              <button
                                key={opt.id}
                                type="button"
                                onClick={() => setFitrahForm(opt.id as 'uang' | 'beras')}
                                className={`py-2.5 px-3 text-xs font-semibold rounded-lg border transition-colors ${
                                  fitrahForm === opt.id
                                    ? 'bg-[#064E3B] text-white border-[#064E3B]'
                                    : 'bg-white text-[#14221B] border-[#E4DFD3] hover:border-[#064E3B]'
                                }`}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 bg-white border border-[#E4DFD3] rounded-lg p-3.5 text-xs">
                        <div>
                          <div className="text-[#5F6F65]">Standar Beras / Jiwa</div>
                          <div className="font-mono font-bold text-[#14221B] mt-0.5">
                            {fitrahRiceKg} kg
                          </div>
                        </div>
                        <div>
                          <div className="text-[#5F6F65]">Nominal Zakat / Jiwa</div>
                          <div className="font-mono font-bold text-[#064E3B] mt-0.5">
                            {formatRupiah(fitrahPerSoul)}
                          </div>
                        </div>
                      </div>

                      <div className="bg-white border border-[#064E3B]/30 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <div className="text-xs font-semibold text-[#4A5A51]">
                            Total Zakat Fitrah yang Harus Dibayarkan ({soulCount} jiwa)
                          </div>
                          {fitrahForm === 'beras' && (
                            <div className="text-xs text-[#8C6826] font-medium mt-0.5">
                              Setara {totalFitrahRice.toFixed(2)} kg beras (atau nilai nominal setara di bawah)
                            </div>
                          )}
                        </div>
                        <div className="font-mono text-2xl font-bold text-[#064E3B] tabular-nums">
                          {fitrahForm === 'beras'
                            ? `${totalFitrahRice.toFixed(2)} kg (${formatRupiah(totalFitrahMoney)})`
                            : formatRupiah(totalFitrahMoney)}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* C. ZAKAT MAL CALCULATOR */}
                  {paymentType === 'zakat_mal' && (
                    <div className="bg-[#FAF9F5] border border-[#E4DFD3] rounded-xl p-5 space-y-5">
                      <div className="flex items-start gap-2.5">
                        <Calculator className="w-5 h-5 text-[#064E3B] shrink-0 mt-0.5" />
                        <div>
                          <h3 className="font-display text-base font-bold text-[#14221B]">
                            Kalkulator Zakat Mal (2,5%)
                          </h3>
                          <p className="text-xs text-[#5F6F65] mt-0.5">
                            Batas nisab setara 85 gram emas ({formatRupiah(malCalculation.nisabValue)} pada harga {formatRupiah(config?.goldPricePerGram ?? 1450000)}/gram).
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {[
                          { label: 'Tabungan / Rekening Bank (IDR)', val: savings, set: setSavings },
                          { label: 'Uang Tunai (IDR)', val: cashOnHand, set: setCashOnHand },
                          { label: 'Nilai Emas / Perak Dimiliki (IDR)', val: goldValue, set: setGoldValue },
                          { label: 'Investasi / Saham / Reksa Dana (IDR)', val: investments, set: setInvestments },
                          { label: 'Aset Perdagangan / Usaha (IDR)', val: tradeAssets, set: setTradeAssets },
                          { label: 'Harta Lainnya Wajib Zakat (IDR)', val: otherAssets, set: setOtherAssets },
                          { label: 'Utang Jatuh Tempo Pengurang (IDR)', val: dueDebts, set: setDueDebts },
                        ].map((f) => (
                          <div key={f.label}>
                            <label className="block text-[11px] font-medium text-[#4A5A51] mb-1">
                              {f.label}
                            </label>
                            <input
                              type="number"
                              min={0}
                              value={f.val || ''}
                              placeholder="0"
                              onChange={(e) => f.set(Math.max(0, Number(e.target.value) || 0))}
                              className="w-full px-3 py-2 text-sm font-mono border border-[#E4DFD3] rounded-lg bg-white tabular-nums"
                            />
                          </div>
                        ))}
                      </div>

                      <label className="flex items-start gap-2.5 text-xs text-[#14221B] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={hasReachedHaul}
                          onChange={(e) => setHasReachedHaul(e.target.checked)}
                          className="mt-0.5 rounded border-[#E4DFD3]"
                        />
                        <span>Harta bersih di atas telah dimiliki penuh selama 1 tahun Hijriah (Haul).</span>
                      </label>

                      <div className="bg-white border border-[#E4DFD3] rounded-lg p-4 space-y-2 text-xs">
                        <div className="flex justify-between">
                          <span className="text-[#5F6F65]">Total Harta Bersih Wajib Zakat</span>
                          <span className="font-mono font-bold tabular-nums">
                            {formatRupiah(malCalculation.netWealth)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[#5F6F65]">Status Nisab (85g Emas)</span>
                          <span className={malCalculation.meetsNisab ? 'font-semibold text-emerald-700' : 'text-[#8C6826]'}>
                            {malCalculation.meetsNisab ? 'Mencapai Nisab' : 'Belum Mencapai Nisab'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[#5F6F65]">Status Haul</span>
                          <span className={hasReachedHaul ? 'font-semibold text-emerald-700' : 'text-[#8C6826]'}>
                            {hasReachedHaul ? 'Terpenuhi (1 Tahun Hijriah)' : 'Belum Terpenuhi'}
                          </span>
                        </div>
                        <div className="flex justify-between pt-2 border-t border-[#E4DFD3] items-center">
                          <span className="font-bold text-[#14221B]">Nominal Zakat Mal (2,5%)</span>
                          <span className="font-mono text-xl font-bold text-[#064E3B] tabular-nums">
                            {formatRupiah(malCalculation.estimatedZakat)}
                          </span>
                        </div>
                      </div>

                      {!malCalculation.isObligatory && (
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-900">
                          <span>
                            Total harta bersih Anda belum memenuhi ketentuan wajib zakat mal (nisab/haul). Anda dapat tetap menyalurkan donasi sebagai Infak atau Sedekah.
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setPaymentType('infak');
                              setPaymentAmount(50000);
                            }}
                            className="px-3 py-1.5 bg-[#064E3B] text-white font-semibold rounded-lg shrink-0"
                          >
                            Ubah ke Infak
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-[#4A5A51] mb-1">
                      Catatan Tambahan / Doa (Opsional)
                    </label>
                    <textarea
                      rows={2}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Contoh: Semoga menjadi amal jariyah untuk keluarga..."
                      className="w-full px-3.5 py-2 text-sm border border-[#E4DFD3] rounded-lg bg-[#FAF9F5]"
                    />
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold border border-[#E4DFD3] text-[#14221B] rounded-lg hover:border-[#064E3B]"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      <span>Kembali</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => goToStep(3)}
                      className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold bg-[#064E3B] text-white rounded-lg hover:bg-emerald-800"
                    >
                      <span>Lanjut ke Pilih Metode Pembayaran</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* TAHAP 3: PILIH METODE PEMBAYARAN (ONLY ENABLED & CONFIGURED BY KETUA DKM; NO QRIS/REKENING SHOWN YET) */}
              {step === 3 && (
                <div className="space-y-6">
                  <div>
                    <div className="text-xs font-semibold text-[#8C6826] uppercase tracking-wide">
                      Tahap 3 dari 5
                    </div>
                    <h2 className="font-display text-xl font-bold text-[#14221B] mt-0.5">
                      Pilih Metode Pembayaran
                    </h2>
                    <p className="text-xs text-[#5F6F65] mt-1">
                      Hanya metode pembayaran yang telah diaktifkan dan dikonfigurasi oleh Ketua DKM yang ditampilkan. Kode QRIS atau nomor rekening akan ditampilkan setelah Anda menekan tombol SUBMIT di tahap berikutnya.
                    </p>
                  </div>

                  {configuredOptions.length === 0 ? (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-sm text-amber-900">
                      Belum ada metode pembayaran yang diaktifkan oleh Ketua DKM untuk program{' '}
                      <strong>{getPaymentTypeLabel(paymentType)}</strong>. Silakan hubungi pengurus DKM untuk mengaktifkan rekening atau QRIS di dashboard admin.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {configuredOptions.map((opt) => {
                        const selected = selectedOptionKey === opt.key;
                        return (
                          <button
                            key={opt.key}
                            type="button"
                            onClick={() => setSelectedOptionKey(opt.key)}
                            className={`w-full p-4 rounded-xl border text-left transition-colors flex items-start justify-between gap-4 ${
                              selected
                                ? 'bg-[#064E3B] text-white border-[#064E3B]'
                                : 'bg-[#FAF9F5] text-[#14221B] border-[#E4DFD3] hover:border-[#064E3B]'
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <div
                                className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                                  selected
                                    ? 'bg-white/15 text-white'
                                    : 'bg-white border border-[#E4DFD3] text-[#064E3B]'
                                }`}
                              >
                                {opt.methodCode === 'qris' ? (
                                  <QrCode className="w-4 h-4" />
                                ) : opt.methodCode === 'bank_transfer' ? (
                                  <Landmark className="w-4 h-4" />
                                ) : opt.methodCode === 'cash' ? (
                                  <Building2 className="w-4 h-4" />
                                ) : (
                                  <Smartphone className="w-4 h-4" />
                                )}
                              </div>
                              <div>
                                <div className="text-sm font-bold">{opt.title}</div>
                                <div
                                  className={`text-xs mt-0.5 ${
                                    selected ? 'text-emerald-100' : 'text-[#5F6F65]'
                                  }`}
                                >
                                  {opt.subtitle}
                                </div>
                              </div>
                            </div>
                            <span
                              className={`text-[11px] font-semibold shrink-0 ${
                                selected ? 'text-emerald-200' : 'text-[#8C6826]'
                              }`}
                            >
                              {opt.categoryLabel}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-2">
                    <button
                      type="button"
                      onClick={() => setStep(2)}
                      className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold border border-[#E4DFD3] text-[#14221B] rounded-lg hover:border-[#064E3B]"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      <span>Kembali</span>
                    </button>
                    <button
                      type="button"
                      disabled={!selectedOption}
                      onClick={() => goToStep(4)}
                      className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold bg-[#064E3B] text-white rounded-lg hover:bg-emerald-800 disabled:opacity-50"
                    >
                      <span>Lihat Ringkasan Pembayaran</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* TAHAP 4: RINGKASAN & SUBMIT PEMBAYARAN (BELUM ADA QRIS/REKENING SEBELUM SUBMIT) */}
              {step === 4 && (
                <div className="space-y-6">
                  <div>
                    <div className="text-xs font-semibold text-[#8C6826] uppercase tracking-wide">
                      Tahap 4 dari 5
                    </div>
                    <h2 className="font-display text-xl font-bold text-[#14221B] mt-0.5">
                      Ringkasan Pembayaran Sebelum Submit
                    </h2>
                    <p className="text-xs text-[#5F6F65] mt-1">
                      Periksa kembali data dan nominal pembayaran Anda. Setelah menekan tombol SUBMIT, nomor transaksi akan dibuat dan QRIS / informasi rekening masjid akan ditampilkan.
                    </p>
                  </div>

                  <div className="bg-[#FAF9F5] border border-[#E4DFD3] rounded-xl p-5 space-y-3 text-sm">
                    <div className="flex justify-between gap-4">
                      <span className="text-[#5F6F65]">Nama Pembayar</span>
                      <span className="font-semibold text-[#14221B] text-right">{donorName}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-[#5F6F65]">Nomor WhatsApp</span>
                      <span className="font-mono text-[#14221B]">{whatsappNumber}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-[#5F6F65]">Jenis Pembayaran</span>
                      <span className="font-semibold text-[#14221B]">
                        {getPaymentTypeLabel(paymentType)}
                        {paymentType === 'zakat_fitrah'
                          ? ` (${soulCount} jiwa · ${fitrahForm === 'beras' ? `Beras ${totalFitrahRice.toFixed(2)} kg` : 'Uang'})`
                          : ''}
                      </span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-[#5F6F65]">Metode Pembayaran</span>
                      <span className="font-semibold text-[#14221B] text-right">
                        {selectedOption?.displayLabel || '-'}
                      </span>
                    </div>
                    {notes.trim() && (
                      <div className="flex justify-between gap-4 pt-2 border-t border-[#E4DFD3] text-xs">
                        <span className="text-[#5F6F65]">Catatan</span>
                        <span className="text-[#4A5A51] text-right max-w-xs">{notes.trim()}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center pt-3 border-t border-[#E4DFD3]">
                      <span className="font-bold text-[#14221B]">Nominal yang Akan Dibayarkan</span>
                      <span className="font-mono text-2xl font-bold text-[#064E3B] tabular-nums">
                        {formatRupiah(paymentAmount)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <button
                      type="button"
                      onClick={() => setStep(3)}
                      disabled={submitting}
                      className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold border border-[#E4DFD3] text-[#14221B] rounded-lg hover:border-[#064E3B]"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      <span>Ubah Metode</span>
                    </button>
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => void handleSubmitPayment()}
                      className="inline-flex items-center gap-2 px-7 py-3 text-sm font-bold bg-[#064E3B] text-white rounded-lg hover:bg-emerald-800 disabled:opacity-60"
                    >
                      <Wallet className="w-4 h-4" />
                      <span>{submitting ? 'Membuat Transaksi...' : 'SUBMIT PEMBAYARAN'}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* TAHAP 5: INSTRUKSI PEMBAYARAN (QRIS / BANK / E-WALLET) + KONFIRMASI PEMBAYARAN */}
              {step === 5 && receipt && (
                <div className="space-y-6">
                  {/* Header with Mosque Logo & Name + Status */}
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b border-[#EFECE4]">
                    <div className="flex items-start gap-3">
                      {(mosqueBrand?.logoUrl || config?.mosqueLogoUrl) && (
                        <img
                          src={mosqueBrand?.logoUrl || config?.mosqueLogoUrl}
                          alt={mosqueBrand?.mosqueName || config?.mosqueName || 'Logo Masjid'}
                          referrerPolicy="no-referrer"
                          className="w-12 h-12 rounded-xl object-cover border border-[#E4DFD3] shrink-0"
                        />
                      )}
                      <div>
                        <div className="text-xs font-semibold text-[#8C6826] uppercase tracking-wide">
                          {mosqueBrand?.mosqueName || config?.mosqueName || 'MasjidKu'} · Instruksi Pembayaran
                        </div>
                        <h2 className="font-display text-xl font-bold text-[#14221B] mt-0.5">
                          {receipt.transactionStatus === 'verified'
                            ? 'Pembayaran Diterima & Terverifikasi'
                            : receipt.transactionStatus === 'pending'
                              ? 'Konfirmasi Pembayaran Diterima'
                              : receipt.transactionStatus === 'rejected'
                                ? 'Transaksi Ditolak'
                                : 'Selesaikan Pembayaran Anda'}
                        </h2>
                        <p className="text-xs text-[#5F6F65] mt-1">
                          {receipt.transactionStatus === 'waiting_payment'
                            ? 'Lakukan pembayaran sesuai nominal di bawah, lalu unggah bukti dan isi tanggal pembayaran pada formulir Konfirmasi Pembayaran.'
                            : receipt.transactionStatus === 'pending'
                              ? 'Terima kasih telah berkontribusi untuk masjid. Pembayaran Anda sedang menunggu pemeriksaan pengurus DKM.'
                              : receipt.transactionStatus === 'verified'
                                ? 'Dana telah diverifikasi dan tercatat otomatis ke pembukuan resmi masjid.'
                                : receipt.verificationNote || 'Silakan hubungi pengurus DKM.'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Confirmation Thank You Banner when pending */}
                  {receipt.transactionStatus === 'pending' && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
                      <div className="text-xs text-emerald-950 space-y-1">
                        <div className="font-bold">
                          Terima kasih telah berkontribusi untuk masjid. Pembayaran Anda sedang menunggu pemeriksaan pengurus DKM.
                        </div>
                        {receipt.paymentDate && (
                          <div className="text-emerald-800">
                            Bukti pembayaran telah dikirim untuk tanggal pembayaran{' '}
                            <strong className="font-mono">{receipt.paymentDate}</strong>.
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Transaction Identity Card */}
                  <div className="bg-[#FAF9F5] border border-[#E4DFD3] rounded-xl p-5 space-y-2.5 text-sm">
                    <div className="flex justify-between gap-4">
                      <span className="text-[#5F6F65]">Nomor Transaksi</span>
                      <span className="font-mono font-bold text-[#064E3B]">{receipt.transactionNumber}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-[#5F6F65]">Nama Pembayar</span>
                      <span className="font-medium text-[#14221B]">{receipt.donorName}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-[#5F6F65]">Jenis Pembayaran</span>
                      <span className="font-medium text-[#14221B]">
                        {getPaymentTypeLabel(receipt.paymentType)}
                        {receipt.paymentType === 'zakat_fitrah' && receipt.fitrahForm
                          ? ` (${receipt.fitrahForm === 'beras' ? 'Beras' : 'Uang'})`
                          : ''}
                      </span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-[#5F6F65]">Metode Pembayaran</span>
                      <span className="font-semibold text-[#14221B]">
                        {receipt.paymentMethodLabel || getPaymentMethodLabel(receipt.paymentMethod)}
                      </span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-[#5F6F65]">Nominal yang Harus Dibayar</span>
                      <span className="font-mono text-lg font-bold text-[#064E3B] tabular-nums">
                        {formatRupiah(receipt.amount)}
                      </span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-[#5F6F65]">Status Transaksi</span>
                      <span className={`font-bold ${statusTone(receipt.transactionStatus)}`}>
                        {getStatusLabel(receipt.transactionStatus)}
                      </span>
                    </div>
                  </div>

                  {/* QRIS / Bank Transfer / E-Wallet Payment Instructions (Strictly revealed AFTER Submit!) */}
                  {receipt.paymentMethod !== 'cash' &&
                    (receipt.transactionStatus === 'waiting_payment' ||
                      receipt.transactionStatus === 'pending') && (
                      <PaymentCodeCard
                        programLabel={destination?.programLabel || getPaymentTypeLabel(receipt.paymentType)}
                        mosqueName={mosqueBrand?.mosqueName || config?.mosqueName || ''}
                        mosqueLogoUrl={mosqueBrand?.logoUrl || config?.mosqueLogoUrl || ''}
                        selectedMethod={receipt.paymentMethod}
                        bankName={destination?.bankName || config?.bankName || 'Rekening Resmi Masjid'}
                        bankAccountNumber={destination?.accountNumber || config?.bankAccountNumber || ''}
                        bankAccountHolder={destination?.accountHolder || config?.bankAccountHolder || ''}
                        ewalletProvider={destination?.ewalletProvider || receipt.paymentMethod}
                        ewalletNumber={destination?.danaNumber || ''}
                        ewalletHolder={destination?.danaHolder || 'Akun E-Wallet Masjid'}
                        ewalletLink={destination?.danaLink || ''}
                        qrisPayload={destination?.qrisPayload || ''}
                        qrisMerchantName={destination?.qrisMerchantName || ''}
                        ewalletQrImageUrl={destination?.ewalletQrImageUrl || ''}
                        globalQrisImageUrl={destination?.qrisImageUrl || config?.qrisImageUrl || ''}
                        nominalAmount={Number(receipt.amount)}
                        transactionNumber={receipt.transactionNumber}
                        staticQrisMode={true}
                      />
                    )}

                  {receipt.paymentMethod === 'cash' &&
                    receipt.transactionStatus === 'waiting_payment' && (
                      <div className="bg-[#FAF9F5] border border-[#E4DFD3] rounded-xl p-5 text-sm text-[#4A5A51] leading-relaxed">
                        Silakan serahkan Zakat Fitrah ({receipt.fitrahForm === 'beras' ? `${totalFitrahRice.toFixed(2)} kg beras` : formatRupiah(receipt.amount)}) langsung ke sekretariat masjid dan tunjukkan nomor transaksi{' '}
                        <strong className="font-mono text-[#064E3B]">{receipt.transactionNumber}</strong> kepada petugas amil / bendahara.
                      </div>
                    )}

                  {/* Quick Jump Buttons: Upload Proof & Cek Status */}
                  <div className="flex flex-wrap gap-3">
                    {(receipt.transactionStatus === 'waiting_payment' ||
                      receipt.transactionStatus === 'pending') && (
                      <button
                        type="button"
                        onClick={() =>
                          confirmSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                        }
                        className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold bg-[#064E3B] text-white rounded-lg hover:bg-emerald-800"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>Upload Bukti Pembayaran</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setViewMode('status')}
                      className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border border-[#E4DFD3] text-[#14221B] rounded-lg hover:border-[#064E3B]"
                    >
                      <Search className="w-3.5 h-3.5" />
                      <span>Cek Status Transaksi</span>
                    </button>
                  </div>

                  {/* TAHAP 5: KONFIRMASI PEMBAYARAN (Upload Proof + Payment Date + Submit -> status pending) */}
                  {(receipt.transactionStatus === 'waiting_payment' ||
                    receipt.transactionStatus === 'pending') && (
                    <form
                      ref={confirmSectionRef}
                      onSubmit={handleConfirmPayment}
                      className="bg-white border border-[#064E3B]/30 rounded-xl p-5 space-y-4"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <div className="text-[11px] font-semibold text-[#8C6826] uppercase tracking-wide">
                            Tahap 5 · Konfirmasi Pembayaran
                          </div>
                          <h3 className="font-display text-base font-bold text-[#14221B]">
                            Unggah Bukti & Tanggal Pembayaran
                          </h3>
                        </div>
                        {receipt.proofUrl && (
                          <span className="text-xs font-semibold text-emerald-700">
                            Bukti telah terunggah
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-[#4A5A51] mb-1">
                            Tanggal Pembayaran *
                          </label>
                          <input
                            type="date"
                            required
                            value={paymentDate}
                            onChange={(e) => setPaymentDate(e.target.value)}
                            className="w-full px-3.5 py-2 text-sm font-mono border border-[#E4DFD3] rounded-lg bg-[#FAF9F5]"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-[#4A5A51] mb-1">
                            Bukti Pembayaran (JPG/PNG/WebP/PDF) *
                          </label>
                          <label className="flex items-center gap-2.5 px-3.5 py-2 border border-dashed border-[#C7C0B0] rounded-lg bg-[#FAF9F5] cursor-pointer hover:border-[#064E3B]">
                            <Upload className="w-4 h-4 text-[#064E3B] shrink-0" />
                            <span className="text-xs text-[#4A5A51] truncate">
                              {proofFile ? proofFile.name : 'Pilih file bukti transfer / QRIS...'}
                            </span>
                            <input
                              type="file"
                              accept=".jpg,.jpeg,.png,.webp,.pdf"
                              className="hidden"
                              onChange={(e) => setProofFile(e.target.files?.[0] || null)}
                            />
                          </label>
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={!proofFile || !paymentDate || confirmingPayment}
                        className="w-full py-3 px-5 text-xs font-bold bg-[#064E3B] text-white rounded-lg hover:bg-emerald-800 disabled:opacity-50"
                      >
                        {confirmingPayment
                          ? 'Mengirim Konfirmasi...'
                          : receipt.transactionStatus === 'pending'
                            ? 'PERBARUI BUKTI & KONFIRMASI PEMBAYARAN'
                            : 'KONFIRMASI PEMBAYARAN'}
                      </button>
                    </form>
                  )}

                  {/* Real-time Status Polling Box */}
                  <div
                    className={`rounded-xl border p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                      receipt.transactionStatus === 'verified'
                        ? 'bg-emerald-50 border-emerald-200'
                        : receipt.transactionStatus === 'rejected'
                          ? 'bg-red-50 border-red-200'
                          : 'bg-[#FAF9F5] border-[#E4DFD3]'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {receipt.transactionStatus === 'verified' ? (
                        <ShieldCheck className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
                      ) : receipt.transactionStatus === 'rejected' ? (
                        <XCircle className="w-5 h-5 text-red-700 shrink-0 mt-0.5" />
                      ) : (
                        <Clock className="w-5 h-5 text-[#8C6826] shrink-0 mt-0.5" />
                      )}
                      <div className="space-y-1 text-xs">
                        <div className="font-bold text-[#14221B]">
                          Status Verifikasi: {getStatusLabel(receipt.transactionStatus)}
                        </div>
                        <div className="text-[#4A5A51]">
                          {receipt.transactionStatus === 'waiting_payment' ||
                          receipt.transactionStatus === 'pending'
                            ? 'Pemantauan status otomatis aktif setiap 5 detik.'
                            : receipt.verifiedAt
                              ? `Diverifikasi pada ${formatDateTimeIndo(receipt.verifiedAt)}.`
                              : 'Pemeriksaan selesai.'}
                        </div>
                        {(receipt.gatewayProvider || gatewayInfo?.provider) && (
                          <div className="text-[#5F6F65] font-mono text-[11px]">
                            Gateway: {receipt.gatewayProvider || gatewayInfo?.provider}
                            {receipt.gatewayStatus ? ` (${receipt.gatewayStatus})` : ''}
                          </div>
                        )}
                        {lastCheckedAt && (
                          <div className="text-[11px] text-[#5F6F65]">
                            Terakhir diperiksa: {formatDateTimeIndo(lastCheckedAt)}
                          </div>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => void refreshReceiptStatus(false)}
                      disabled={pollingStatus}
                      className="inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold bg-white border border-[#E4DFD3] text-[#14221B] rounded-lg hover:border-[#064E3B] disabled:opacity-60 shrink-0"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${pollingStatus ? 'animate-spin' : ''}`} />
                      <span>{pollingStatus ? 'Memeriksa...' : 'Periksa Status'}</span>
                    </button>
                  </div>

                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={resetForNewPayment}
                      className="px-5 py-2.5 text-xs font-semibold border border-[#E4DFD3] text-[#14221B] rounded-lg hover:border-[#064E3B]"
                    >
                      Buat Pembayaran Baru
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Right Sidebar Summary */}
            <div className="bg-white border border-[#E4DFD3] rounded-2xl p-6 space-y-5 h-fit">
              <h3 className="font-display text-base font-bold text-[#14221B]">
                {step === 5 && receipt ? 'Nomor Transaksi Anda' : 'Alur Pembayaran Resmi'}
              </h3>

              {step === 5 && receipt ? (
                <div className="bg-[#FAF9F5] border border-[#E4DFD3] rounded-xl p-4 space-y-2 text-xs">
                  <div className="text-[#5F6F65]">Simpan nomor transaksi berikut:</div>
                  <div className="font-mono text-base font-bold text-[#064E3B]">
                    {receipt.transactionNumber}
                  </div>
                  <div className="text-[#4A5A51]">
                    Status: <strong className={statusTone(receipt.transactionStatus)}>{getStatusLabel(receipt.transactionStatus)}</strong>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 text-xs text-[#4A5A51]">
                  {[
                    {
                      n: '1. Pilih Jenis Pembayaran',
                      d: 'Infak, Sedekah, Zakat Fitrah (beras/uang), atau Zakat Mal.',
                    },
                    {
                      n: '2. Isi Data & Hitung Nominal',
                      d: 'Masukkan nama, WhatsApp, dan tentukan nominal sesuai kalkulator.',
                    },
                    {
                      n: '3. Pilih Metode Pembayaran',
                      d: 'Pilih saluran QRIS, Bank, atau E-Wallet yang telah diaktifkan Ketua DKM.',
                    },
                    {
                      n: '4. Submit & Tampilkan QRIS',
                      d: 'Setelah Submit, nomor transaksi dibuat (Menunggu Pembayaran) dan QRIS/Rekening tampil.',
                    },
                    {
                      n: '5. Konfirmasi Bukti Pembayaran',
                      d: 'Unggah bukti & tanggal bayar agar Bendahara DKM memverifikasi dan mencatat ke kas.',
                    },
                  ].map((item) => (
                    <div key={item.n} className="bg-[#FAF9F5] border border-[#E4DFD3] rounded-xl p-3.5">
                      <div className="font-semibold text-[#064E3B]">{item.n}</div>
                      <p className="mt-1 leading-relaxed text-[#5F6F65]">{item.d}</p>
                    </div>
                  ))}
                </div>
              )}

              <p className="text-xs text-[#5F6F65] leading-relaxed">
                Transaksi dengan status <strong>Menunggu Pembayaran</strong>, <strong>Menunggu Verifikasi</strong>, atau <strong>Ditolak</strong> tidak akan menambah saldo pembukuan hingga disahkan oleh Bendahara / Ketua DKM.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: STATUS CHECKER */}
      {viewMode === 'status' && (
        <div className="max-w-xl bg-white border border-[#E4DFD3] rounded-2xl p-6 sm:p-8 space-y-6">
          <div>
            <h2 className="font-display text-xl font-bold text-[#14221B]">
              Cek Status Transaksi Zakat & Donasi
            </h2>
            <p className="text-sm text-[#5F6F65] mt-1">
              Masukkan nomor transaksi dan nomor WhatsApp yang digunakan saat pengajuan pembayaran. Status menunggu diperiksa ulang otomatis setiap 5 detik.
            </p>
          </div>

          <form onSubmit={handleCheckStatus} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#4A5A51] mb-1">
                Nomor Transaksi
              </label>
              <input
                type="text"
                required
                value={checkTxNum}
                onChange={(e) => setCheckTxNum(e.target.value)}
                placeholder="Contoh: ZKT-20261121-1234ABCD"
                className="w-full px-3.5 py-2 text-sm font-mono border border-[#E4DFD3] rounded-lg bg-[#FAF9F5]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#4A5A51] mb-1">
                Nomor WhatsApp
              </label>
              <input
                type="text"
                required
                value={checkWa}
                onChange={(e) => setCheckWa(e.target.value)}
                placeholder="081234567890"
                className="w-full px-3.5 py-2 text-sm font-mono border border-[#E4DFD3] rounded-lg bg-[#FAF9F5]"
              />
            </div>
            <button
              type="submit"
              disabled={checking}
              className="inline-flex items-center justify-center gap-2 w-full py-2.5 px-5 text-sm font-semibold bg-[#064E3B] text-white rounded-lg hover:bg-emerald-800 disabled:opacity-60"
            >
              <Search className="w-4 h-4" />
              <span>{checking ? 'Memeriksa...' : 'Periksa Status'}</span>
            </button>
          </form>

          {checkResult && (
            <div className="bg-[#FAF9F5] border border-[#E4DFD3] rounded-xl p-5 space-y-2.5 text-sm">
              <div className="flex justify-between">
                <span className="text-[#5F6F65]">Nomor Transaksi</span>
                <span className="font-mono font-bold">{checkResult.transactionNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#5F6F65]">Nama</span>
                <span className="font-medium">{checkResult.donorName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#5F6F65]">Jenis Pembayaran</span>
                <span className="font-medium">{getPaymentTypeLabel(checkResult.paymentType)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#5F6F65]">Metode Pembayaran</span>
                <span className="font-medium">
                  {checkResult.paymentMethodLabel || getPaymentMethodLabel(checkResult.paymentMethod)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#5F6F65]">Nominal</span>
                <span className="font-mono font-semibold tabular-nums">
                  {formatRupiah(checkResult.amount)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#5F6F65]">Status Transaksi</span>
                <span className={`font-bold ${statusTone(checkResult.transactionStatus)}`}>
                  {getStatusLabel(checkResult.transactionStatus)}
                </span>
              </div>
              {checkResult.paymentDate && (
                <div className="flex justify-between text-xs">
                  <span className="text-[#5F6F65]">Tanggal Pembayaran</span>
                  <span className="font-mono">{checkResult.paymentDate}</span>
                </div>
              )}
              {checkResult.gatewayProvider && (
                <div className="flex justify-between text-xs">
                  <span className="text-[#5F6F65]">Payment Gateway</span>
                  <span className="font-mono">
                    {checkResult.gatewayProvider}
                    {checkResult.gatewayReferenceId ? ` · ${checkResult.gatewayReferenceId}` : ''}
                  </span>
                </div>
              )}
              {checkResult.verificationNote && (
                <div className="pt-2 border-t border-[#E4DFD3] text-xs text-[#4A5A51]">
                  Catatan Verifikasi: {checkResult.verificationNote}
                </div>
              )}
              <div className="text-xs text-[#5F6F65]">
                Diajukan: {formatDateTimeIndo(checkResult.createdAt)}
              </div>
              {checkResult.verifiedAt && (
                <div className="text-xs text-emerald-700 font-medium">
                  Terverifikasi: {formatDateTimeIndo(checkResult.verifiedAt)}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
