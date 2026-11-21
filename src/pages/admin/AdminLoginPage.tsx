import React, { useEffect, useState } from 'react';
import { ArrowLeft, Lock, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';
import { useToast } from '../../context/ToastContext.tsx';
import { apiRequest } from '../../services/api.ts';

interface AdminLoginPageProps {
  onSuccess: () => void;
  onBackPublic: () => void;
}

export function AdminLoginPage({ onSuccess, onBackPublic }: AdminLoginPageProps) {
  const { loginWithPassword, loginWithGoogle, bootstrapChairman } = useAuth();
  const { showToast } = useToast();

  const [needsBootstrap, setNeedsBootstrap] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(true);

  // Login form
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');

  // Bootstrap form (only shown if no Ketua DKM exists yet)
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [bootPassword, setBootPassword] = useState('');

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    apiRequest<{ needsBootstrap: boolean }>('/api/auth/status')
      .then((res) => setNeedsBootstrap(res.needsBootstrap))
      .catch(() => {})
      .finally(() => setCheckingStatus(false));
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const user = await loginWithPassword(identifier, password);
      showToast(`Selamat datang, ${user.fullName}.`, 'success');
      onSuccess();
    } catch (err: any) {
      showToast(err.message || 'Login gagal.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBootstrap = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const user = await bootstrapChairman({
        fullName,
        username,
        email,
        password: bootPassword,
      });
      showToast(`Akun Ketua DKM ${user.fullName} berhasil diaktifkan.`, 'success');
      onSuccess();
    } catch (err: any) {
      showToast(err.message || 'Aktivasi gagal.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleLogin = async () => {
    setSubmitting(true);
    try {
      const user = await loginWithGoogle();
      showToast(`Berhasil masuk sebagai ${user.fullName}.`, 'success');
      onSuccess();
    } catch (err: any) {
      showToast(err.message || 'Login Google gagal.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF9F5] islamic-pattern-subtle flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-white border border-[#E4DFD3] rounded-2xl p-6 sm:p-8 shadow-sm">
        <button
          type="button"
          onClick={onBackPublic}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-[#5F6F65] hover:text-[#14221B] mb-6"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Kembali ke Halaman Publik</span>
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-[#064E3B] text-white flex items-center justify-center">
            {needsBootstrap ? <ShieldCheck className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
          </div>
          <div>
            <h1 className="font-display text-xl font-bold text-[#14221B]">
              {needsBootstrap ? 'Aktivasi Akun Ketua DKM Awal' : 'Login Pengurus DKM'}
            </h1>
            <p className="text-xs text-[#5F6F65]">
              {needsBootstrap
                ? 'Buat akun Ketua DKM pertama untuk mengelola sistem MasjidKu.'
                : 'Akses khusus Ketua DKM, Bendahara, dan Sekretaris.'}
            </p>
          </div>
        </div>

        {checkingStatus ? (
          <div className="h-44 bg-[#EFECE4] rounded-xl animate-pulse" />
        ) : needsBootstrap ? (
          <form onSubmit={handleBootstrap} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#4A5A51] mb-1">Nama Lengkap</label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="H. Ahmad Sulaiman"
                className="w-full px-3.5 py-2 text-sm border border-[#E4DFD3] rounded-lg bg-[#FAF9F5]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#4A5A51] mb-1">Username</label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="ketuadkm"
                className="w-full px-3.5 py-2 text-sm border border-[#E4DFD3] rounded-lg bg-[#FAF9F5]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#4A5A51] mb-1">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ketua@masjid.or.id"
                className="w-full px-3.5 py-2 text-sm border border-[#E4DFD3] rounded-lg bg-[#FAF9F5]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#4A5A51] mb-1">
                Password (min. 8 karakter)
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={bootPassword}
                onChange={(e) => setBootPassword(e.target.value)}
                className="w-full px-3.5 py-2 text-sm border border-[#E4DFD3] rounded-lg bg-[#FAF9F5]"
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 px-4 text-sm font-semibold bg-[#064E3B] text-white rounded-lg hover:bg-emerald-800 disabled:opacity-60"
            >
              {submitting ? 'Memproses...' : 'Aktifkan & Masuk Dashboard'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#4A5A51] mb-1">
                Email atau Username
              </label>
              <input
                type="text"
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="username atau email"
                className="w-full px-3.5 py-2 text-sm border border-[#E4DFD3] rounded-lg bg-[#FAF9F5]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#4A5A51] mb-1">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3.5 py-2 text-sm border border-[#E4DFD3] rounded-lg bg-[#FAF9F5]"
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 px-4 text-sm font-semibold bg-[#064E3B] text-white rounded-lg hover:bg-emerald-800 disabled:opacity-60"
            >
              {submitting ? 'Memeriksa...' : 'Masuk Dashboard'}
            </button>
          </form>
        )}

        <div className="my-5 flex items-center gap-3">
          <div className="h-px flex-1 bg-[#E4DFD3]" />
          <span className="text-[11px] text-[#5F6F65]">atau</span>
          <div className="h-px flex-1 bg-[#E4DFD3]" />
        </div>

        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={submitting}
          className="w-full py-2.5 px-4 text-xs font-semibold border border-[#E4DFD3] text-[#14221B] bg-[#FAF9F5] rounded-lg hover:bg-[#F0ECE1] transition-colors"
        >
          Masuk dengan Akun Google Pengurus DKM
        </button>

        <p className="mt-5 text-[11px] text-center text-[#5F6F65]">
          Tidak ada registrasi publik. Akun Bendahara & Sekretaris dibuat langsung oleh Ketua DKM.
        </p>
      </div>
    </div>
  );
}
