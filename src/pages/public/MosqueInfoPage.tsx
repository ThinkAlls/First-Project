import { useEffect, useState } from 'react';
import { ExternalLink, Mail, MapPin, Phone, Users } from 'lucide-react';
import { apiRequest } from '../../services/api.ts';
import { formatDateIndo } from '../../utils/format.ts';
import { PublicRoute } from '../../layouts/PublicLayout.tsx';
import { Announcement, MosqueActivity, MosqueSettings } from '../../types/index.ts';

export function MosqueInfoPage({ onNavigate }: { onNavigate: (r: PublicRoute) => void }) {
  const [settings, setSettings] = useState<MosqueSettings | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [activities, setActivities] = useState<MosqueActivity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiRequest<{
      settings: MosqueSettings;
      announcements: Announcement[];
      activities: MosqueActivity[];
    }>('/api/public/mosque-info')
      .then((res) => {
        setSettings(res.settings);
        setAnnouncements(res.announcements || []);
        setActivities(res.activities || []);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading || !settings) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12 space-y-6">
        <div className="h-48 bg-[#EAE5D9] rounded-2xl animate-pulse" />
        <div className="h-64 bg-[#EAE5D9] rounded-2xl animate-pulse" />
      </div>
    );
  }

  const mapsEmbedUrl = `https://maps.google.com/maps?q=${encodeURIComponent(
    `${settings.latitude},${settings.longitude}`,
  )}&z=15&output=embed`;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
      {/* Header */}
      <div className="bg-white border border-[#E4DFD3] rounded-2xl p-6 sm:p-8 flex flex-col md:flex-row gap-6 items-start md:items-center justify-between">
        <div className="flex items-start gap-4">
          <img
            src={settings.logoUrl || '/src/assets/images/mosque_emblem_logo_1795249573681.jpg'}
            alt={settings.mosqueName}
            referrerPolicy="no-referrer"
            className="w-16 h-16 rounded-xl object-cover border border-[#E4DFD3] shrink-0"
          />
          <div>
            <h1 className="font-display text-3xl font-bold text-[#14221B]">{settings.mosqueName}</h1>
            <p className="text-sm text-[#4A5A51] mt-1">{settings.tagline}</p>
            <div className="flex flex-wrap items-center gap-4 text-xs text-[#5F6F65] mt-3">
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-[#064E3B]" />
                {settings.address}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-[#064E3B]" />
                {settings.whatsappNumber}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-[#064E3B]" />
                {settings.email}
              </span>
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onNavigate('activities')}
          className="px-4 py-2.5 text-xs font-semibold bg-[#064E3B] text-white rounded-lg hover:bg-emerald-800 whitespace-nowrap"
        >
          Lihat Poster Kegiatan
        </button>
      </div>

      {/* History, Vision, Mission */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white border border-[#E4DFD3] rounded-2xl p-6">
          <h2 className="font-display text-lg font-bold text-[#14221B] mb-3">Sejarah Masjid</h2>
          <p className="text-sm text-[#4A5A51] leading-relaxed whitespace-pre-line">{settings.history}</p>
        </div>
        <div className="bg-white border border-[#E4DFD3] rounded-2xl p-6">
          <h2 className="font-display text-lg font-bold text-[#14221B] mb-3">Visi</h2>
          <p className="text-sm text-[#4A5A51] leading-relaxed whitespace-pre-line">{settings.vision}</p>
        </div>
        <div className="bg-white border border-[#E4DFD3] rounded-2xl p-6">
          <h2 className="font-display text-lg font-bold text-[#14221B] mb-3">Misi</h2>
          <p className="text-sm text-[#4A5A51] leading-relaxed whitespace-pre-line">{settings.mission}</p>
        </div>
      </div>

      {/* DKM Structure & Location Map */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white border border-[#E4DFD3] rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-5 h-5 text-[#064E3B]" />
            <h2 className="font-display text-lg font-bold text-[#14221B]">Struktur Pengurus DKM</h2>
          </div>
          <div className="divide-y divide-[#EFECE4]">
            {(settings.dkmStructure || []).map((member, idx) => (
              <div key={idx} className="py-3 flex items-center justify-between gap-4">
                <div>
                  <div className="font-semibold text-sm text-[#14221B]">{member.name}</div>
                  <div className="text-xs text-[#5F6F65]">{member.position}</div>
                </div>
                {member.period && (
                  <span className="text-xs font-mono text-[#8C6826]">{member.period}</span>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white border border-[#E4DFD3] rounded-2xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 mb-4">
              <h2 className="font-display text-lg font-bold text-[#14221B]">Lokasi & Google Maps</h2>
              <a
                href={settings.googleMapsUrl || `https://maps.google.com/?q=${settings.latitude},${settings.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#064E3B] hover:underline"
              >
                <span>Buka Google Maps</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
            <div className="rounded-xl overflow-hidden border border-[#E4DFD3] h-56 bg-[#FAF9F5]">
              <iframe
                title="Peta Lokasi Masjid"
                src={mapsEmbedUrl}
                className="w-full h-full border-0"
                loading="lazy"
              />
            </div>
          </div>
          <p className="text-xs text-[#5F6F65] mt-3">
            {settings.address} ({settings.city}, {settings.province})
          </p>
        </div>
      </div>

      {/* Announcements & Activities */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white border border-[#E4DFD3] rounded-2xl p-6">
          <h2 className="font-display text-lg font-bold text-[#14221B] mb-4">Pengumuman Resmi</h2>
          <div className="divide-y divide-[#EFECE4]">
            {announcements.map((a) => (
              <div key={a.id} className="py-3.5 first:pt-0 last:pb-0">
                <div className="text-xs font-medium text-[#8C6826] mb-1">
                  {a.priority === 'penting' ? 'Penting' : 'Informasi'}
                </div>
                <h3 className="font-semibold text-sm text-[#14221B]">{a.title}</h3>
                <p className="text-xs text-[#4A5A51] mt-1 leading-relaxed">{a.content}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white border border-[#E4DFD3] rounded-2xl p-6">
          <h2 className="font-display text-lg font-bold text-[#14221B] mb-4">Jadwal Kegiatan</h2>
          <div className="divide-y divide-[#EFECE4]">
            {activities.map((act) => (
              <div key={act.id} className="py-3.5 first:pt-0 last:pb-0">
                <div className="text-xs text-[#5F6F65]">
                  {formatDateIndo(act.activityDate)} · {act.startTime} · {act.location}
                </div>
                <h3 className="font-semibold text-sm text-[#14221B] mt-0.5">{act.title}</h3>
                <p className="text-xs text-[#4A5A51] mt-1">{act.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
