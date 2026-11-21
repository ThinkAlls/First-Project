import ExcelJS from 'exceljs';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export function formatRupiah(value: number | string | null | undefined): string {
  const num = Number(value ?? 0);
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number.isFinite(num) ? num : 0);
}

export function formatDateIndo(isoDate: string | null | undefined): string {
  if (!isoDate) return '-';
  const d = new Date(isoDate.length === 10 ? `${isoDate}T12:00:00` : isoDate);
  if (Number.isNaN(d.getTime())) return isoDate;
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(d);
}

export function formatDateTimeIndo(isoDate: string | null | undefined): string {
  if (!isoDate) return '-';
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return isoDate;
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

export function getRoleLabel(roleCode: string): string {
  switch (roleCode) {
    case 'ketua_dkm':
      return 'Ketua DKM';
    case 'bendahara':
      return 'Bendahara';
    case 'sekretaris':
      return 'Sekretaris';
    default:
      return roleCode;
  }
}

export function getFundLabel(fundType: string): string {
  switch (fundType) {
    case 'mosque_cash':
      return 'Kas Masjid';
    case 'zakat_fitrah':
      return 'Dana Zakat Fitrah';
    case 'zakat_mal':
      return 'Dana Zakat Mal';
    default:
      return fundType;
  }
}

export function getPaymentMethodLabel(method: string): string {
  switch (method) {
    case 'bank_transfer':
      return 'Transfer Bank';
    case 'dana':
      return 'E-Wallet DANA';
    case 'gopay':
      return 'E-Wallet GoPay';
    case 'ovo':
      return 'E-Wallet OVO';
    case 'shopeepay':
      return 'E-Wallet ShopeePay';
    case 'linkaja':
      return 'E-Wallet LinkAja';
    case 'qris':
      return 'QRIS (Semua E-Wallet & M-Banking)';
    case 'cash':
      return 'Tunai di Masjid';
    default:
      return method;
  }
}

export function getStatusLabel(status: string): string {
  switch (status) {
    case 'waiting_payment':
      return 'Menunggu Pembayaran';
    case 'pending':
      return 'Menunggu Verifikasi';
    case 'pending_approval':
      return 'Menunggu Persetujuan Ketua';
    case 'verified':
      return 'Diterima / Terverifikasi';
    case 'approved':
      return 'Disetujui / Sah';
    case 'rejected':
      return 'Ditolak';
    case 'cancelled':
      return 'Dibatalkan';
    case 'draft':
      return 'Draft';
    case 'published':
      return 'Terbit';
    case 'archived':
      return 'Diarsipkan';
    default:
      return status;
  }
}

export function exportFinancialReportPdf(report: any): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const { mosqueName, period, cashReport, zakatReport } = report;

  doc.setFontSize(16);
  doc.setTextColor(6, 78, 59);
  doc.text(`Laporan Keuangan — ${mosqueName}`, 14, 18);

  doc.setFontSize(10);
  doc.setTextColor(80, 80, 80);
  doc.text(`Periode: ${formatDateIndo(period.startDate)} s/d ${formatDateIndo(period.endDate)}`, 14, 24);
  doc.text(`Dicetak: ${formatDateTimeIndo(new Date().toISOString())}`, 14, 29);

  // Section A: Kas Masjid
  doc.setFontSize(12);
  doc.setTextColor(20, 34, 27);
  doc.text('A. Pembukuan Kas Masjid (Terpisah dari Zakat)', 14, 38);

  autoTable(doc, {
    startY: 41,
    head: [['Komponen Kas Masjid', 'Nominal']],
    body: [
      ['Saldo Awal Periode', formatRupiah(cashReport.openingBalance)],
      ['Total Pemasukan Kas', formatRupiah(cashReport.totalIncome)],
      ['Total Pengeluaran Kas', formatRupiah(cashReport.totalExpense)],
      ['Saldo Akhir Kas (Saldo Awal + Pemasukan - Pengeluaran)', formatRupiah(cashReport.closingBalance)],
    ],
    theme: 'grid',
    headStyles: { fillColor: [6, 78, 59] },
  });

  const afterSummaryY = (doc as any).lastAutoTable.finalY + 8;

  if (cashReport.incomeTransactions.length > 0) {
    doc.setFontSize(11);
    doc.text('Rincian Pemasukan Kas Masjid', 14, afterSummaryY);
    autoTable(doc, {
      startY: afterSummaryY + 3,
      head: [['No. Transaksi', 'Tanggal', 'Kategori', 'Keterangan', 'Nominal']],
      body: cashReport.incomeTransactions.map((tx: any) => [
        tx.transactionNumber,
        tx.transactionDate,
        tx.categoryName,
        tx.description,
        formatRupiah(tx.amount),
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [16, 95, 72] },
    });
  }

  const afterIncomeY = (doc as any).lastAutoTable.finalY + 8;
  if (cashReport.expenseTransactions.length > 0) {
    doc.setFontSize(11);
    doc.text('Rincian Pengeluaran Kas Masjid', 14, afterIncomeY);
    autoTable(doc, {
      startY: afterIncomeY + 3,
      head: [['No. Transaksi', 'Tanggal', 'Kategori', 'Penerima', 'Keterangan', 'Nominal']],
      body: cashReport.expenseTransactions.map((tx: any) => [
        tx.transactionNumber,
        tx.transactionDate,
        tx.categoryName,
        tx.recipientName,
        tx.description,
        formatRupiah(tx.amount),
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [140, 88, 32] },
    });
  }

  // Section B: Dana Zakat on new page
  doc.addPage();
  doc.setFontSize(14);
  doc.setTextColor(6, 78, 59);
  doc.text(`B. Laporan Dana Zakat (Fitrah & Mal) — ${mosqueName}`, 14, 18);

  autoTable(doc, {
    startY: 23,
    head: [['Komponen Dana Zakat', 'Nominal']],
    body: [
      ['Zakat Fitrah Terkumpul (Periode)', formatRupiah(zakatReport.fitrahCollected)],
      ['Zakat Mal Terkumpul (Periode)', formatRupiah(zakatReport.malCollected)],
      ['Total Penyaluran 8 Asnaf (Periode)', formatRupiah(zakatReport.totalDistributed)],
      ['Sisa Saldo Dana Zakat Keseluruhan', formatRupiah(zakatReport.remainingZakatBalance)],
    ],
    theme: 'grid',
    headStyles: { fillColor: [6, 78, 59] },
  });

  const afterZakatY = (doc as any).lastAutoTable.finalY + 8;
  if (zakatReport.distributions.length > 0) {
    doc.setFontSize(11);
    doc.setTextColor(20, 34, 27);
    doc.text('Rincian Penyaluran Zakat (Asnaf)', 14, afterZakatY);
    autoTable(doc, {
      startY: afterZakatY + 3,
      head: [['No. Transaksi', 'Tanggal', 'Jenis Zakat', 'Asnaf', 'Penerima', 'Nominal']],
      body: zakatReport.distributions.map((d: any) => [
        d.transactionNumber,
        d.distributionDate,
        d.zakatType === 'zakat_fitrah' ? 'Zakat Fitrah' : 'Zakat Mal',
        d.asnafCategory,
        d.recipientName,
        formatRupiah(d.amount),
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [6, 78, 59] },
    });
  }

  doc.save(`Laporan-Keuangan-MasjidKu-${period.startDate}_${period.endDate}.pdf`);
}

export async function exportFinancialReportExcel(report: any): Promise<void> {
  const { mosqueName, period, cashReport, zakatReport } = report;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'MasjidKu DKM';

  // Sheet 1: Ringkasan & Kas Masjid
  const sheetKas = wb.addWorksheet('Laporan Kas Masjid');
  sheetKas.addRow([`LAPORAN KAS MASJID — ${mosqueName}`]);
  sheetKas.addRow([`Periode: ${period.startDate} s/d ${period.endDate}`]);
  sheetKas.addRow([]);
  sheetKas.addRow(['Ringkasan Kas Masjid', 'Nominal (IDR)']);
  sheetKas.addRow(['Saldo Awal Periode', Number(cashReport.openingBalance)]);
  sheetKas.addRow(['Total Pemasukan Kas', Number(cashReport.totalIncome)]);
  sheetKas.addRow(['Total Pengeluaran Kas', Number(cashReport.totalExpense)]);
  sheetKas.addRow(['Saldo Akhir Kas', Number(cashReport.closingBalance)]);
  sheetKas.addRow([]);
  sheetKas.addRow(['PEMASUKAN KAS MASJID']);
  sheetKas.addRow(['No. Transaksi', 'Tanggal', 'Kategori', 'Metode', 'Keterangan', 'Nominal']);
  for (const tx of cashReport.incomeTransactions) {
    sheetKas.addRow([
      tx.transactionNumber,
      tx.transactionDate,
      tx.categoryName,
      getPaymentMethodLabel(tx.paymentMethod),
      tx.description,
      Number(tx.amount),
    ]);
  }
  sheetKas.addRow([]);
  sheetKas.addRow(['PENGELUARAN KAS MASJID']);
  sheetKas.addRow(['No. Transaksi', 'Tanggal', 'Kategori', 'Penerima', 'Keterangan', 'Nominal']);
  for (const tx of cashReport.expenseTransactions) {
    sheetKas.addRow([
      tx.transactionNumber,
      tx.transactionDate,
      tx.categoryName,
      tx.recipientName,
      tx.description,
      Number(tx.amount),
    ]);
  }
  sheetKas.columns.forEach((col) => {
    col.width = 22;
  });

  // Sheet 2: Laporan Zakat
  const sheetZakat = wb.addWorksheet('Laporan Dana Zakat');
  sheetZakat.addRow([`LAPORAN DANA ZAKAT — ${mosqueName}`]);
  sheetZakat.addRow([`Periode: ${period.startDate} s/d ${period.endDate}`]);
  sheetZakat.addRow([]);
  sheetZakat.addRow(['Ringkasan Zakat', 'Nominal (IDR)']);
  sheetZakat.addRow(['Zakat Fitrah Terkumpul', Number(zakatReport.fitrahCollected)]);
  sheetZakat.addRow(['Zakat Mal Terkumpul', Number(zakatReport.malCollected)]);
  sheetZakat.addRow(['Total Penyaluran Zakat', Number(zakatReport.totalDistributed)]);
  sheetZakat.addRow(['Sisa Dana Zakat Keseluruhan', Number(zakatReport.remainingZakatBalance)]);
  sheetZakat.addRow([]);
  sheetZakat.addRow(['PENERIMAAN ZAKAT']);
  sheetZakat.addRow(['No. Transaksi', 'Tanggal', 'Jenis', 'Metode', 'Keterangan', 'Nominal']);
  for (const tx of zakatReport.incomeTransactions) {
    sheetZakat.addRow([
      tx.transactionNumber,
      tx.transactionDate,
      getFundLabel(tx.fundType),
      getPaymentMethodLabel(tx.paymentMethod),
      tx.description,
      Number(tx.amount),
    ]);
  }
  sheetZakat.addRow([]);
  sheetZakat.addRow(['PENYALURAN ZAKAT (8 ASNAF)']);
  sheetZakat.addRow(['No. Transaksi', 'Tanggal', 'Jenis Zakat', 'Asnaf', 'Penerima', 'Keterangan', 'Nominal']);
  for (const d of zakatReport.distributions) {
    sheetZakat.addRow([
      d.transactionNumber,
      d.distributionDate,
      d.zakatType === 'zakat_fitrah' ? 'Zakat Fitrah' : 'Zakat Mal',
      d.asnafCategory,
      d.recipientName,
      d.description,
      Number(d.amount),
    ]);
  }
  sheetZakat.columns.forEach((col) => {
    col.width = 22;
  });

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Laporan-Keuangan-MasjidKu-${period.startDate}_${period.endDate}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
