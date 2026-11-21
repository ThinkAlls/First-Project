import { Router } from 'express';
import { desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db/index.ts';
import {
  announcements,
  eventPosters,
  islamicEvents,
  mosqueActivities,
} from '../../db/schema.ts';
import { type AuthRequest, requireAuth, requireRole } from '../middleware/auth.ts';
import { uploadSingleFile } from '../middleware/upload.ts';
import { logAudit } from '../utils/audit.ts';

const router = Router();

// Strictly Ketua DKM and Sekretaris only — Bendahara gets 403 Forbidden
router.use(requireAuth, requireRole('ketua_dkm', 'sekretaris'));

// 1. Event Posters CRUD & Status Management (draft | published | archived)
router.get('/posters', async (_req, res) => {
  try {
    const rows = await db
      .select()
      .from(eventPosters)
      .orderBy(desc(eventPosters.updatedAt), desc(eventPosters.id));
    return res.json({ items: rows });
  } catch (err) {
    console.error('Admin posters list error:', err);
    return res.status(500).json({ error: 'Gagal memuat daftar poster.' });
  }
});

const posterSchema = z.object({
  title: z.string().min(3, 'Judul kegiatan minimal 3 karakter').max(160),
  description: z.string().min(5, 'Deskripsi wajib diisi').max(2000),
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Tanggal kegiatan tidak valid'),
  eventTime: z.string().min(2, 'Waktu kegiatan wajib diisi').max(60),
  location: z.string().min(2, 'Lokasi wajib diisi').max(160),
  contactInfo: z.string().min(2, 'Narahubung wajib diisi').max(120),
  status: z.enum(['draft', 'published', 'archived']).optional(),
  imageUrl: z.string().optional(),
});

router.post('/posters', uploadSingleFile.single('image'), async (req: AuthRequest, res) => {
  try {
    const parsed = posterSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Data poster tidak valid.' });
    }

    const imageUrl = req.file
      ? `/uploads/${req.file.filename}`
      : parsed.data.imageUrl || '/src/assets/images/poster_kajian_subuh_1795249573167.jpg';

    const status = parsed.data.status || 'draft';

    const inserted = await db
      .insert(eventPosters)
      .values({
        title: parsed.data.title.trim(),
        description: parsed.data.description.trim(),
        imageUrl,
        eventDate: parsed.data.eventDate,
        eventTime: parsed.data.eventTime.trim(),
        location: parsed.data.location.trim(),
        contactInfo: parsed.data.contactInfo.trim(),
        status,
        createdBy: req.user!.id,
        publishedAt: status === 'published' ? new Date() : null,
      })
      .returning();

    await logAudit({
      userId: req.user!.id,
      userName: req.user!.fullName,
      userRole: req.user!.roleCode,
      action: 'CREATE',
      module: 'posters',
      entityType: 'event_poster',
      entityId: inserted[0].id,
      newValue: inserted[0],
      ipAddress: req.ip || null,
    });

    return res.status(201).json({ item: inserted[0], message: 'Poster kegiatan berhasil disimpan.' });
  } catch (err) {
    console.error('Create poster error:', err);
    return res.status(500).json({ error: 'Gagal menyimpan poster kegiatan.' });
  }
});

router.put('/posters/:id', uploadSingleFile.single('image'), async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'ID tidak valid.' });

    const existingRows = await db.select().from(eventPosters).where(eq(eventPosters.id, id)).limit(1);
    const existing = existingRows[0];
    if (!existing) return res.status(404).json({ error: 'Poster tidak ditemukan.' });

    const parsed = posterSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Data poster tidak valid.' });
    }

    const imageUrl = req.file
      ? `/uploads/${req.file.filename}`
      : parsed.data.imageUrl || existing.imageUrl;
    const status = parsed.data.status || (existing.status as 'draft' | 'published' | 'archived');

    const updated = await db
      .update(eventPosters)
      .set({
        title: parsed.data.title.trim(),
        description: parsed.data.description.trim(),
        imageUrl,
        eventDate: parsed.data.eventDate,
        eventTime: parsed.data.eventTime.trim(),
        location: parsed.data.location.trim(),
        contactInfo: parsed.data.contactInfo.trim(),
        status,
        publishedAt: status === 'published' ? existing.publishedAt || new Date() : existing.publishedAt,
        updatedAt: new Date(),
      })
      .where(eq(eventPosters.id, id))
      .returning();

    await logAudit({
      userId: req.user!.id,
      userName: req.user!.fullName,
      userRole: req.user!.roleCode,
      action: 'UPDATE',
      module: 'posters',
      entityType: 'event_poster',
      entityId: id,
      previousValue: existing,
      newValue: updated[0],
      ipAddress: req.ip || null,
    });

    return res.json({ item: updated[0], message: 'Poster kegiatan berhasil diperbarui.' });
  } catch (err) {
    console.error('Update poster error:', err);
    return res.status(500).json({ error: 'Gagal memperbarui poster.' });
  }
});

router.patch('/posters/:id/status', async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'ID tidak valid.' });
    const status = req.body?.status;
    if (!['draft', 'published', 'archived'].includes(status)) {
      return res.status(400).json({ error: 'Status publikasi tidak valid.' });
    }

    const updated = await db
      .update(eventPosters)
      .set({
        status,
        publishedAt: status === 'published' ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(eventPosters.id, id))
      .returning();

    if (!updated[0]) return res.status(404).json({ error: 'Poster tidak ditemukan.' });

    await logAudit({
      userId: req.user!.id,
      userName: req.user!.fullName,
      userRole: req.user!.roleCode,
      action: 'UPDATE',
      module: 'posters',
      entityType: 'event_poster',
      entityId: id,
      newValue: { status },
      ipAddress: req.ip || null,
    });

    return res.json({ item: updated[0], message: `Status poster diubah menjadi ${status}.` });
  } catch (err) {
    console.error('Patch poster status error:', err);
    return res.status(500).json({ error: 'Gagal mengubah status poster.' });
  }
});

router.delete('/posters/:id', async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'ID tidak valid.' });

    const rows = await db.select().from(eventPosters).where(eq(eventPosters.id, id)).limit(1);
    const existing = rows[0];
    if (!existing) return res.status(404).json({ error: 'Poster tidak ditemukan.' });
    if (existing.status === 'published' && req.user!.roleCode !== 'ketua_dkm') {
      return res.status(403).json({
        error: 'Poster yang sedang terbit hanya dapat dihapus setelah diarsipkan atau oleh Ketua DKM.',
      });
    }

    await db.delete(eventPosters).where(eq(eventPosters.id, id));
    await logAudit({
      userId: req.user!.id,
      userName: req.user!.fullName,
      userRole: req.user!.roleCode,
      action: 'DELETE',
      module: 'posters',
      entityType: 'event_poster',
      entityId: id,
      previousValue: existing,
      ipAddress: req.ip || null,
    });

    return res.json({ message: 'Poster kegiatan berhasil dihapus.' });
  } catch (err) {
    console.error('Delete poster error:', err);
    return res.status(500).json({ error: 'Gagal menghapus poster.' });
  }
});

// 2. Mosque Activities CRUD
router.get('/activities', async (_req, res) => {
  try {
    const rows = await db.select().from(mosqueActivities).orderBy(desc(mosqueActivities.activityDate));
    return res.json({ items: rows });
  } catch (err) {
    return res.status(500).json({ error: 'Gagal memuat agenda kegiatan.' });
  }
});

const activitySchema = z.object({
  title: z.string().min(3).max(160),
  category: z.string().min(2).max(80),
  description: z.string().min(3).max(1000),
  activityDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().min(2).max(30),
  endTime: z.string().max(30).optional(),
  location: z.string().min(2).max(160),
  speaker: z.string().max(120).optional(),
  contactPerson: z.string().max(120).optional(),
  status: z.enum(['draft', 'published', 'archived']).optional(),
});

router.post('/activities', async (req: AuthRequest, res) => {
  try {
    const parsed = activitySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message });
    const inserted = await db
      .insert(mosqueActivities)
      .values({
        ...parsed.data,
        endTime: parsed.data.endTime || '',
        speaker: parsed.data.speaker || '',
        contactPerson: parsed.data.contactPerson || '',
        status: parsed.data.status || 'published',
        createdBy: req.user!.id,
      })
      .returning();
    return res.status(201).json({ item: inserted[0] });
  } catch (err) {
    return res.status(500).json({ error: 'Gagal menambahkan kegiatan.' });
  }
});

router.put('/activities/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const parsed = activitySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message });
    const updated = await db
      .update(mosqueActivities)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(mosqueActivities.id, id))
      .returning();
    return res.json({ item: updated[0] });
  } catch (err) {
    return res.status(500).json({ error: 'Gagal memperbarui kegiatan.' });
  }
});

router.delete('/activities/:id', async (req, res) => {
  try {
    await db.delete(mosqueActivities).where(eq(mosqueActivities.id, Number(req.params.id)));
    return res.json({ message: 'Kegiatan dihapus.' });
  } catch (err) {
    return res.status(500).json({ error: 'Gagal menghapus kegiatan.' });
  }
});

// 3. Announcements CRUD
router.get('/announcements', async (_req, res) => {
  try {
    const rows = await db.select().from(announcements).orderBy(desc(announcements.createdAt));
    return res.json({ items: rows });
  } catch (err) {
    return res.status(500).json({ error: 'Gagal memuat pengumuman.' });
  }
});

router.post('/announcements', async (req: AuthRequest, res) => {
  try {
    const schema = z.object({
      title: z.string().min(3).max(160),
      content: z.string().min(5).max(2000),
      priority: z.enum(['normal', 'penting']).default('normal'),
      isPublished: z.boolean().default(true),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message });
    const inserted = await db
      .insert(announcements)
      .values({ ...parsed.data, createdBy: req.user!.id })
      .returning();
    return res.status(201).json({ item: inserted[0] });
  } catch (err) {
    return res.status(500).json({ error: 'Gagal membuat pengumuman.' });
  }
});

router.put('/announcements/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const updated = await db
      .update(announcements)
      .set({
        title: req.body.title,
        content: req.body.content,
        priority: req.body.priority || 'normal',
        isPublished: Boolean(req.body.isPublished),
        updatedAt: new Date(),
      })
      .where(eq(announcements.id, id))
      .returning();
    return res.json({ item: updated[0] });
  } catch (err) {
    return res.status(500).json({ error: 'Gagal memperbarui pengumuman.' });
  }
});

router.delete('/announcements/:id', async (req, res) => {
  try {
    await db.delete(announcements).where(eq(announcements.id, Number(req.params.id)));
    return res.json({ message: 'Pengumuman dihapus.' });
  } catch (err) {
    return res.status(500).json({ error: 'Gagal menghapus pengumuman.' });
  }
});

// 4. Islamic Calendar Events Adjustment
router.get('/islamic-events', async (_req, res) => {
  try {
    const rows = await db.select().from(islamicEvents).orderBy(islamicEvents.gregorianDate);
    return res.json({ items: rows });
  } catch (err) {
    return res.status(500).json({ error: 'Gagal memuat hari besar Islam.' });
  }
});

const islamicEventSchema = z.object({
  title: z.string().min(3).max(160),
  eventType: z.enum(['hari_besar', 'kegiatan_khusus']),
  hijriDay: z.coerce.number().int().min(1).max(30),
  hijriMonth: z.coerce.number().int().min(1).max(12),
  hijriYear: z.coerce.number().int().min(1400).max(1600),
  gregorianDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  description: z.string().min(3).max(1000),
});

router.post('/islamic-events', async (req: AuthRequest, res) => {
  try {
    const parsed = islamicEventSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message });
    const inserted = await db
      .insert(islamicEvents)
      .values({ ...parsed.data, createdBy: req.user!.id })
      .returning();
    return res.status(201).json({ item: inserted[0] });
  } catch (err) {
    return res.status(500).json({ error: 'Gagal menyimpan agenda hari besar Islam.' });
  }
});

router.put('/islamic-events/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const parsed = islamicEventSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message });
    const updated = await db
      .update(islamicEvents)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(islamicEvents.id, id))
      .returning();
    return res.json({ item: updated[0] });
  } catch (err) {
    return res.status(500).json({ error: 'Gagal memperbarui tanggal hari besar Islam.' });
  }
});

router.delete('/islamic-events/:id', async (req, res) => {
  try {
    await db.delete(islamicEvents).where(eq(islamicEvents.id, Number(req.params.id)));
    return res.json({ message: 'Agenda hari besar dihapus.' });
  } catch (err) {
    return res.status(500).json({ error: 'Gagal menghapus agenda.' });
  }
});

export default router;
