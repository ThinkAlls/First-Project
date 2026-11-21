import { useCallback, useEffect, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { apiRequest } from '../../services/api.ts';
import { formatDateIndo, formatRupiah, getFundLabel, getPaymentMethodLabel } from '../../utils/format.ts';
import { FundBalances } from '../../types/index.ts';

interface TransparencyResponse {
  balances: FundBalances;
  period: { month: number | null; year: number; startDate: string; endDate: string };
  publicIncome: Array<{
    id: number;
    transactionNumber: string;
    transactionDate: string;
    fundType: string;
    categoryName: string;
    amount: string;
    paymentMethod: string;
    description: string;
  }>;
  publicExpenses: Array<{
    id: number;
    transactionNumber: string;
    transactionDate: string;
    categoryName: string;
    amount: string;
    paymentMethod: string;
    description: string;
  }>;
  publicZakatDistributions: Array<{
    id: number;
    transactionNumber: string;
    distributionDate: string;
    zakatType: string;
    asnafCategory: string;
    amount: string;
    description: string;
  }>;
  publicAssets?: Array<{
    id: number;
    assetCode: string;
    assetName: string;
    category: string;
    quantity: number;
    unit: string;
    acquisitionDate: string;
    acquisitionSource: string;
    conditionStatus: string;
    nominalValue: string;
    location: string;
  }>;
  cashChart: Array<{ month: string; pemasukan: number; pengeluaran: number }>;
  zakatChart: Array<{ month: string; zakatFitrah: number; zakatMal: number; penyaluran: number }>;
}

const MONTHS = [
  { val: '', label: 'Semua Bulan' },
  { val: '1', label: 'Januari' },
  { val: '2', label: 'Februari' },
  { val: '3', label: 'Maret' },
  { val: '4', label: 'April' },
  { val: '5', label: 'Mei' },
  { val: '6', label: 'Juni' },
  { val: '7', label: 'Juli' },
  { val: '8', label: 'Agustus' },
  { val: '9', label: 'September' },
  { val: '10', label: 'Oktober' },
  { val: '11', label: 'November' },
  { val: '12', label: 'Desember' },
];

export function TransparencyPage() {
  const currentYear = new Date().getFullYear();
  const [month, setMonth] = useState<string>('');
  const [year, setYear] = useState<number>(currentYear);
  const [activeTab, setActiveTab] = useState<'income' | 'expense' | 'zakat' | 'assets'>('income');
  const [data, setData] = useState<TransparencyResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchTransparency = useCallback(async (m: string, y: number) => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ year: String(y) });
      if (m) params.set('month', m);
      const res = await apiRequest<TransparencyResponse>(
        `/api/public/transparency?${params.toString()}`,
      );
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Gagal memuat transparansi keuangan.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTransparency(month, year);
  }, [fetchTransparency, month, year]);

  const b = data?.balances;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-[#14221B]">
            Transparansi Keuangan Masjid
          </h1>
          <p className="text-sm text-[#5F6F65] mt-1">
            Pembukuan Kas Masjid dan Dana Zakat dipisahkan secara permanen. Identitas pribadi donatur dirahasiakan.
          </p>
        </div>

        <div className="flex items-center gap-3 bg-white border border-[#E4DFD3] rounded-xl p-2.5">
          <select
            aria-label="Filter bulan"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="px-3 py-1.5 text-xs font-medium bg-[#FAF9F5] border border-[#E4DFD3] rounded-lg"
          >
            {MONTHS.map((m) => (
              <option key={m.label} value={m.val}>
                {m.label}
              </option>
            ))}
          </select>
          <select
            aria-label="Filter tahun"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="px-3 py-1.5 text-xs font-medium bg-[#FAF9F5] border border-[#E4DFD3] rounded-lg tabular-nums"
          >
            {[currentYear - 1, currentYear, currentYear + 1].map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 text-sm rounded-xl p-4">
          {error}
        </div>
      )}

      {/* Segregated Book A: Kas Masjid */}
      <section className="space-y-4">
        <h2 className="font-display text-lg font-bold text-[#064E3B]">
          1. Pembukuan Kas Masjid (Infak, Sedekah & Operasional)
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-[#064E3B] text-white rounded-xl p-5">
            <div className="text-xs text-emerald-200">Total Saldo Kas Masjid</div>
            <div className="font-mono text-2xl font-bold tabular-nums mt-1.5">
              {loading ? '...' : formatRupiah(b?.mosqueCash.balance)}
            </div>
          </div>
          <div className="bg-white border border-[#E4DFD3] rounded-xl p-5">
            <div className="text-xs text-[#5F6F65]">Total Pemasukan Kas</div>
            <div className="font-mono text-2xl font-bold text-emerald-800 tabular-nums mt-1.5">
              {loading ? '...' : formatRupiah(b?.mosqueCash.income)}
            </div>
          </div>
          <div className="bg-white border border-[#E4DFD3] rounded-xl p-5">
            <div className="text-xs text-[#5F6F65]">Total Pengeluaran Kas</div>
            <div className="font-mono text-2xl font-bold text-[#8C6826] tabular-nums mt-1.5">
              {loading ? '...' : formatRupiah(b?.mosqueCash.expense)}
            </div>
          </div>
        </div>
      </section>

      {/* Segregated Book B: Dana Zakat */}
      <section className="space-y-4">
        <h2 className="font-display text-lg font-bold text-[#14221B]">
          2. Pembukuan Dana Zakat (Terpisah dari Kas Masjid)
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border border-[#E4DFD3] rounded-xl p-5">
            <div className="text-xs text-[#5F6F65]">Zakat Fitrah Terkumpul</div>
            <div className="font-mono text-xl font-bold text-[#14221B] tabular-nums mt-1.5">
              {loading ? '...' : formatRupiah(b?.zakatFitrah.income)}
            </div>
          </div>
          <div className="bg-white border border-[#E4DFD3] rounded-xl p-5">
            <div className="text-xs text-[#5F6F65]">Zakat Mal Terkumpul</div>
            <div className="font-mono text-xl font-bold text-[#14221B] tabular-nums mt-1.5">
              {loading ? '...' : formatRupiah(b?.zakatMal.income)}
            </div>
          </div>
          <div className="bg-white border border-[#E4DFD3] rounded-xl p-5">
            <div className="text-xs text-[#5F6F65]">Dana Zakat Tersalurkan</div>
            <div className="font-mono text-xl font-bold text-[#8C6826] tabular-nums mt-1.5">
              {loading ? '...' : formatRupiah(b?.totalZakatDistributed)}
            </div>
          </div>
          <div className="bg-[#FAF9F5] border border-[#D4AF63] rounded-xl p-5">
            <div className="text-xs text-[#8C6826] font-semibold">Sisa Dana Zakat</div>
            <div className="font-mono text-xl font-bold text-[#064E3B] tabular-nums mt-1.5">
              {loading ? '...' : formatRupiah(b?.totalZakatRemaining)}
            </div>
          </div>
        </div>
      </section>

      {/* Segregated Book C: Aset & Inventaris Masjid */}
      <section className="space-y-4">
        <h2 className="font-display text-lg font-bold text-[#14221B]">
          3. Pembukuan Aset & Inventaris Masjid (Terpisah dari Kas Tunai)
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-[#FAF9F5] border border-[#D4AF63] rounded-xl p-5">
            <div className="text-xs font-semibold text-[#8C6826]">Total Nominal Nilai Aset</div>
            <div className="font-mono text-2xl font-bold text-[#14221B] tabular-nums mt-1.5">
              {loading ? '...' : formatRupiah(b?.mosqueAssets?.totalNominalValue ?? 0)}
            </div>
          </div>
          <div className="bg-white border border-[#E4DFD3] rounded-xl p-5">
            <div className="text-xs text-[#5F6F65]">Jenis Aset Tercatat</div>
            <div className="font-mono text-2xl font-bold text-[#064E3B] tabular-nums mt-1.5">
              {loading ? '...' : `${b?.mosqueAssets?.totalItems ?? 0} Item`}
            </div>
          </div>
          <div className="bg-white border border-[#E4DFD3] rounded-xl p-5">
            <div className="text-xs text-[#5F6F65]">Total Kuantitas Unit / Bidang</div>
            <div className="font-mono text-2xl font-bold text-[#14221B] tabular-nums mt-1.5">
              {loading ? '...' : `${b?.mosqueAssets?.totalQuantity ?? 0} Unit`}
            </div>
          </div>
        </div>
      </section>

      {/* Charts */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-[#E4DFD3] rounded-2xl p-6">
          <h3 className="font-display text-base font-bold text-[#14221B] mb-4">
            Grafik Pemasukan & Pengeluaran Kas ({year})
          </h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.cashChart || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EFECE4" />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#5F6F65' }} />
                <YAxis
                  tick={{ fontSize: 11, fill: '#5F6F65' }}
                  tickFormatter={(v) => `${Math.round(v / 1000)}rb`}
                />
                <Tooltip formatter={(v: any) => formatRupiah(v)} />
                <Legend />
                <Bar dataKey="pemasukan" name="Pemasukan Kas" fill="#064E3B" radius={[4, 4, 0, 0]} />
                <Bar dataKey="pengeluaran" name="Pengeluaran Kas" fill="#B48A3E" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white border border-[#E4DFD3] rounded-2xl p-6">
          <h3 className="font-display text-base font-bold text-[#14221B] mb-4">
            Grafik Penerimaan & Penyaluran Zakat ({year})
          </h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.zakatChart || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EFECE4" />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#5F6F65' }} />
                <YAxis
                  tick={{ fontSize: 11, fill: '#5F6F65' }}
                  tickFormatter={(v) => `${Math.round(v / 1000)}rb`}
                />
                <Tooltip formatter={(v: any) => formatRupiah(v)} />
                <Legend />
                <Bar dataKey="zakatFitrah" name="Zakat Fitrah" fill="#047857" radius={[4, 4, 0, 0]} />
                <Bar dataKey="zakatMal" name="Zakat Mal" fill="#064E3B" radius={[4, 4, 0, 0]} />
                <Bar dataKey="penyaluran" name="Penyaluran Asnaf" fill="#D4AF63" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* Public Ledger History (Sanitized) */}
      <section className="bg-white border border-[#E4DFD3] rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[#EFECE4] flex flex-wrap items-center justify-between gap-4">
          <h3 className="font-display text-lg font-bold text-[#14221B]">
            Riwayat Transaksi Terverifikasi
          </h3>
          <div className="flex items-center gap-1 p-1 bg-[#FAF9F5] border border-[#E4DFD3] rounded-lg">
            {[
              { id: 'income', label: 'Pemasukan' },
              { id: 'expense', label: 'Pengeluaran Kas' },
              { id: 'zakat', label: 'Penyaluran Zakat' },
              { id: 'assets', label: 'Daftar Aset Masjid' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  activeTab === tab.id
                    ? 'bg-white text-[#064E3B] shadow-sm font-semibold'
                    : 'text-[#5F6F65] hover:text-[#14221B]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          {activeTab === 'income' && (
            <table className="w-full text-sm text-left">
              <thead className="bg-[#FAF9F5] border-b border-[#E4DFD3] text-xs text-[#5F6F65]">
                <tr>
                  <th className="px-4 py-3">No. Transaksi</th>
                  <th className="px-4 py-3">Tanggal</th>
                  <th className="px-4 py-3">Pembukuan</th>
                  <th className="px-4 py-3">Kategori</th>
                  <th className="px-4 py-3">Metode</th>
                  <th className="px-4 py-3">Keterangan</th>
                  <th className="px-4 py-3 text-right">Nominal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EFECE4]">
                {(data?.publicIncome || []).length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-[#5F6F65]">
                      Belum ada transaksi pemasukan terverifikasi pada periode ini.
                    </td>
                  </tr>
                ) : (
                  data!.publicIncome.map((row) => (
                    <tr key={row.id} className="hover:bg-[#FAF9F5]">
                      <td className="px-4 py-3 font-mono text-xs">{row.transactionNumber}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{formatDateIndo(row.transactionDate)}</td>
                      <td className="px-4 py-3">{getFundLabel(row.fundType)}</td>
                      <td className="px-4 py-3">{row.categoryName}</td>
                      <td className="px-4 py-3">{getPaymentMethodLabel(row.paymentMethod)}</td>
                      <td className="px-4 py-3 text-[#4A5A51]">{row.description}</td>
                      <td className="px-4 py-3 text-right font-mono font-semibold text-emerald-800 tabular-nums">
                        {formatRupiah(row.amount)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}

          {activeTab === 'expense' && (
            <table className="w-full text-sm text-left">
              <thead className="bg-[#FAF9F5] border-b border-[#E4DFD3] text-xs text-[#5F6F65]">
                <tr>
                  <th className="px-4 py-3">No. Transaksi</th>
                  <th className="px-4 py-3">Tanggal</th>
                  <th className="px-4 py-3">Kategori</th>
                  <th className="px-4 py-3">Keterangan</th>
                  <th className="px-4 py-3 text-right">Nominal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EFECE4]">
                {(data?.publicExpenses || []).length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-[#5F6F65]">
                      Belum ada pengeluaran kas disetujui pada periode ini.
                    </td>
                  </tr>
                ) : (
                  data!.publicExpenses.map((row) => (
                    <tr key={row.id} className="hover:bg-[#FAF9F5]">
                      <td className="px-4 py-3 font-mono text-xs">{row.transactionNumber}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{formatDateIndo(row.transactionDate)}</td>
                      <td className="px-4 py-3">{row.categoryName}</td>
                      <td className="px-4 py-3 text-[#4A5A51]">{row.description}</td>
                      <td className="px-4 py-3 text-right font-mono font-semibold text-[#8C6826] tabular-nums">
                        {formatRupiah(row.amount)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}

          {activeTab === 'zakat' && (
            <table className="w-full text-sm text-left">
              <thead className="bg-[#FAF9F5] border-b border-[#E4DFD3] text-xs text-[#5F6F65]">
                <tr>
                  <th className="px-4 py-3">No. Transaksi</th>
                  <th className="px-4 py-3">Tanggal</th>
                  <th className="px-4 py-3">Jenis Dana</th>
                  <th className="px-4 py-3">Golongan Asnaf</th>
                  <th className="px-4 py-3">Keterangan</th>
                  <th className="px-4 py-3 text-right">Nominal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EFECE4]">
                {(data?.publicZakatDistributions || []).length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-[#5F6F65]">
                      Belum ada penyaluran zakat tercatat pada periode ini.
                    </td>
                  </tr>
                ) : (
                  data!.publicZakatDistributions.map((row) => (
                    <tr key={row.id} className="hover:bg-[#FAF9F5]">
                      <td className="px-4 py-3 font-mono text-xs">{row.transactionNumber}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{formatDateIndo(row.distributionDate)}</td>
                      <td className="px-4 py-3">
                        {row.zakatType === 'zakat_fitrah' ? 'Zakat Fitrah' : 'Zakat Mal'}
                      </td>
                      <td className="px-4 py-3 font-medium">{row.asnafCategory}</td>
                      <td className="px-4 py-3 text-[#4A5A51]">{row.description}</td>
                      <td className="px-4 py-3 text-right font-mono font-semibold text-[#064E3B] tabular-nums">
                        {formatRupiah(row.amount)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}

          {activeTab === 'assets' && (
            <table className="w-full text-sm text-left">
              <thead className="bg-[#FAF9F5] border-b border-[#E4DFD3] text-xs text-[#5F6F65]">
                <tr>
                  <th className="px-4 py-3">Kode</th>
                  <th className="px-4 py-3">Nama Aset & Lokasi</th>
                  <th className="px-4 py-3">Kategori</th>
                  <th className="px-4 py-3">Sumber</th>
                  <th className="px-4 py-3">Jumlah</th>
                  <th className="px-4 py-3">Kondisi</th>
                  <th className="px-4 py-3 text-right">Nominal Nilai Aset</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EFECE4]">
                {(data?.publicAssets || []).length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-[#5F6F65]">
                      Belum ada daftar aset masjid yang tercatat.
                    </td>
                  </tr>
                ) : (
                  data!.publicAssets!.map((asset) => (
                    <tr key={asset.id} className="hover:bg-[#FAF9F5]">
                      <td className="px-4 py-3 font-mono text-xs">{asset.assetCode}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-[#14221B]">{asset.assetName}</div>
                        <div className="text-xs text-[#5F6F65]">{asset.location}</div>
                      </td>
                      <td className="px-4 py-3">{asset.category}</td>
                      <td className="px-4 py-3 text-xs text-[#4A5A51]">{asset.acquisitionSource}</td>
                      <td className="px-4 py-3 font-mono text-xs tabular-nums">
                        {asset.quantity} {asset.unit}
                      </td>
                      <td className="px-4 py-3 text-xs font-semibold text-[#064E3B]">
                        {asset.conditionStatus}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-semibold text-[#14221B] tabular-nums">
                        {formatRupiah(asset.nominalValue)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}
