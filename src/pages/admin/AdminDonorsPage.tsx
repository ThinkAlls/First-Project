import { useEffect, useState } from 'react';
import { apiRequest } from '../../services/api.ts';
import { formatDateTimeIndo, formatRupiah, getStatusLabel } from '../../utils/format.ts';

export function AdminDonorsPage() {
  const [donors, setDonors] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiRequest<{ donors: any[]; transactions: any[] }>('/api/admin/finance/donors')
      .then((res) => {
        setDonors(res.donors || []);
        setTransactions(res.transactions || []);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-[#14221B]">
          Manajemen Data Donatur & Muzaki (Privat DKM)
        </h1>
        <p className="text-sm text-[#5F6F65] mt-1">
          Data kontak donatur bersifat rahasia dan hanya dapat diakses oleh Ketua DKM dan Bendahara.
        </p>
      </div>

      <div className="bg-white border border-[#E4DFD3] rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-[#EFECE4] font-semibold text-sm">
          Riwayat Transaksi Donatur ({transactions.length})
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-[#FAF9F5] border-b border-[#E4DFD3] text-xs text-[#5F6F65]">
              <tr>
                <th className="px-4 py-3">Nama Donatur</th>
                <th className="px-4 py-3">WhatsApp</th>
                <th className="px-4 py-3">Jenis Donasi</th>
                <th className="px-4 py-3">No. Transaksi</th>
                <th className="px-4 py-3">Tanggal</th>
                <th className="px-4 py-3 text-right">Nominal</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EFECE4]">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-[#5F6F65]">
                    Memuat data donatur...
                  </td>
                </tr>
              ) : transactions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-[#5F6F65]">
                    Belum ada transaksi donatur tercatat ({donors.length} profil tersimpan).
                  </td>
                </tr>
              ) : (
                transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-[#FAF9F5]">
                    <td className="px-4 py-3 font-medium">{tx.donorName}</td>
                    <td className="px-4 py-3 font-mono text-xs">{tx.whatsappNumber}</td>
                    <td className="px-4 py-3 uppercase text-xs">{tx.paymentType.replace('_', ' ')}</td>
                    <td className="px-4 py-3 font-mono text-xs">{tx.transactionNumber}</td>
                    <td className="px-4 py-3 text-xs">{formatDateTimeIndo(tx.createdAt)}</td>
                    <td className="px-4 py-3 text-right font-mono font-semibold tabular-nums">
                      {formatRupiah(tx.amount)}
                    </td>
                    <td className="px-4 py-3 text-xs font-semibold">
                      {getStatusLabel(tx.transactionStatus)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
