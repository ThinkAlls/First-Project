import { Router } from 'express';
import { desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db/index.ts';
import {
  auditLogs,
  mosquePaymentMethods,
  mosqueSettings,
  roles,
  users,
  type PaymentChannelsMap,
} from '../../db/schema.ts';
import { type AuthRequest, requireAuth, requireRole } from '../middleware/auth.ts';
import { uploadSingleFile } from '../middleware/upload.ts';
import { logAudit } from '../utils/audit.ts';
import { hashPassword } from '../utils/auth.ts';

import { validateQrisPayload } from '../../utils/qris.ts';

const channelSchema = z.object({
  bankName: z.string().max(120).default(''),
  accountNumber: z.string().max(80).default(''),
  accountHolder: z.string().max(120).default(''),
  ewalletProvider: z
    .enum(['dana', 'gopay', 'ovo', 'shopeepay', 'linkaja', 'qris'])
    .optional()
    .default('dana'),
  danaNumber: z.string().max(40).default(''),
  danaHolder: z.string().max(120).default(''),
  danaLink: z
    .string()
    .max(400)
    .optional()
    .default('')
    .refine(
      (v) => !v || /^https?:\/\//i.test(v),
      'Tautan e-wallet harus diawali dengan https:// atau http://',
    ),
  qrisPayload: z
    .string()
    .max(1200)
    .optional()
    .default('')
    .refine(
      (v) => !v.trim() || validateQrisPayload(v).valid,
      'Payload QRIS EMVCo tidak valid atau checksum CRC-16 tidak cocok.',
    ),
  qrisMerchantName: z.string().max(120).optional().default(''),
  ewalletQrImageUrl: z
    .string()
    .max(400)
    .optional()
    .default('')
    .refine(
      (v) => !v || v.startsWith('/uploads/') || v.startsWith('/src/assets/') || /^https?:\/\//i.test(v),
      'URL gambar QR e-wallet tidak valid.',
    ),
  preferredCodeFormat: z.enum(['qr', 'barcode', 'both']).default('both'),
});

const paymentChannelsSchema = z.object({
  zakat: channelSchema,
  infak: channelSchema,
  sedekah: channelSchema,
});

const router = Router();

router.use(requireAuth);

// File upload helper for QRIS / Mosque Photo / Logo
router.post('/upload', uploadSingleFile.single('file'), async (req: AuthRequest, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'File tidak ditemukan.' });
  }
  return res.json({ url: `/uploads/${req.file.filename}` });
});

// Audit Logs (Ketua DKM & Bendahara)
router.get('/audit-logs', requireRole('ketua_dkm', 'bendahara'), async (_req, res) => {
  try {
    const rows = await db
      .select()
      .from(auditLogs)
      .orderBy(desc(auditLogs.createdAt))
      .limit(150);
    return res.json({ items: rows });
  } catch (err) {
    return res.status(500).json({ error: 'Gagal memuat audit log.' });
  }
});

// Mosque & Website Settings (Ketua DKM only)
router.get('/settings', requireRole('ketua_dkm'), async (_req, res) => {
  try {
    const rows = await db.select().from(mosqueSettings).limit(1);
    return res.json({ settings: rows[0] });
  } catch (err) {
    return res.status(500).json({ error: 'Gagal memuat pengaturan masjid.' });
  }
});

router.put('/settings', requireRole('ketua_dkm'), async (req: AuthRequest, res) => {
  try {
    const rows = await db.select().from(mosqueSettings).limit(1);
    const current = rows[0];
    if (!current) return res.status(404).json({ error: 'Pengaturan belum tersedia.' });

    const body = req.body;
    let nextPaymentChannels: PaymentChannelsMap = current.paymentChannels;
    if (body.paymentChannels) {
      const parsedChannels = paymentChannelsSchema.safeParse(body.paymentChannels);
      if (!parsedChannels.success) {
        return res.status(400).json({ error: 'Format konfigurasi rekening/DANA tidak valid.' });
      }
      nextPaymentChannels = parsedChannels.data;
    }

    const updated = await db
      .update(mosqueSettings)
      .set({
        mosqueName: body.mosqueName ?? current.mosqueName,
        tagline: body.tagline ?? current.tagline,
        logoUrl: body.logoUrl ?? current.logoUrl,
        heroImageUrl: body.heroImageUrl ?? current.heroImageUrl,
        address: body.address ?? current.address,
        city: body.city ?? current.city,
        province: body.province ?? current.province,
        latitude: String(body.latitude ?? current.latitude),
        longitude: String(body.longitude ?? current.longitude),
        timezone: body.timezone ?? current.timezone,
        calculationMethod: Number(body.calculationMethod ?? current.calculationMethod),
        whatsappNumber: body.whatsappNumber ?? current.whatsappNumber,
        email: body.email ?? current.email,
        shortDescription: body.shortDescription ?? current.shortDescription,
        history: body.history ?? current.history,
        vision: body.vision ?? current.vision,
        mission: body.mission ?? current.mission,
        dkmStructure: Array.isArray(body.dkmStructure) ? body.dkmStructure : current.dkmStructure,
        googleMapsUrl: body.googleMapsUrl ?? current.googleMapsUrl,
        bankName: body.bankName ?? current.bankName,
        bankAccountNumber: body.bankAccountNumber ?? current.bankAccountNumber,
        bankAccountHolder: body.bankAccountHolder ?? current.bankAccountHolder,
        qrisImageUrl: body.qrisImageUrl ?? current.qrisImageUrl,
        paymentChannels: nextPaymentChannels,
        initialCashBalance: String(Number(body.initialCashBalance ?? current.initialCashBalance).toFixed(2)),
        initialZakatFitrahBalance: String(
          Number(body.initialZakatFitrahBalance ?? current.initialZakatFitrahBalance).toFixed(2),
        ),
        initialZakatMalBalance: String(
          Number(body.initialZakatMalBalance ?? current.initialZakatMalBalance).toFixed(2),
        ),
        zakatFitrahRiceKg: String(Number(body.zakatFitrahRiceKg ?? current.zakatFitrahRiceKg).toFixed(2)),
        zakatFitrahMoneyAmount: String(
          Number(body.zakatFitrahMoneyAmount ?? current.zakatFitrahMoneyAmount).toFixed(2),
        ),
        goldPricePerGram: String(Number(body.goldPricePerGram ?? current.goldPricePerGram).toFixed(2)),
        expenseApprovalThreshold: String(
          Number(body.expenseApprovalThreshold ?? current.expenseApprovalThreshold).toFixed(2),
        ),
        updatedAt: new Date(),
      })
      .where(eq(mosqueSettings.id, current.id))
      .returning();

    await logAudit({
      userId: req.user!.id,
      userName: req.user!.fullName,
      userRole: req.user!.roleCode,
      action: 'UPDATE',
      module: 'settings',
      entityType: 'mosque_settings',
      entityId: current.id,
      previousValue: current,
      newValue: updated[0],
      ipAddress: req.ip || null,
    });

    return res.json({ settings: updated[0], message: 'Pengaturan masjid berhasil disimpan.' });
  } catch (err) {
    console.error('Update settings error:', err);
    return res.status(500).json({ error: 'Gagal menyimpan pengaturan masjid.' });
  }
});

// User / Pengurus Account Management (STRICTLY Ketua DKM only!)
router.get('/users', requireRole('ketua_dkm'), async (_req, res) => {
  try {
    const rows = await db
      .select({
        id: users.id,
        fullName: users.fullName,
        username: users.username,
        email: users.email,
        roleCode: users.roleCode,
        isActive: users.isActive,
        lastLoginAt: users.lastLoginAt,
        createdAt: users.createdAt,
      })
      .from(users)
      .orderBy(users.id);
    return res.json({ items: rows });
  } catch (err) {
    return res.status(500).json({ error: 'Gagal memuat daftar akun pengurus.' });
  }
});

const createUserSchema = z.object({
  fullName: z.string().min(3).max(120),
  username: z.string().min(3).max(50).regex(/^[a-zA-Z0-9_.-]+$/),
  email: z.string().email(),
  password: z.string().min(8).max(128),
  roleCode: z.enum(['ketua_dkm', 'bendahara', 'sekretaris']),
});

router.post('/users', requireRole('ketua_dkm'), async (req: AuthRequest, res) => {
  try {
    const parsed = createUserSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Data akun tidak valid.' });
    }

    const { fullName, username, email, password, roleCode } = parsed.data;
    const roleRows = await db.select().from(roles).where(eq(roles.code, roleCode)).limit(1);
    const passwordHash = await hashPassword(password);

    const inserted = await db
      .insert(users)
      .values({
        fullName: fullName.trim(),
        username: username.trim().toLowerCase(),
        email: email.trim().toLowerCase(),
        passwordHash,
        roleId: roleRows[0]?.id ?? null,
        roleCode,
        isActive: true,
      })
      .returning({
        id: users.id,
        fullName: users.fullName,
        username: users.username,
        email: users.email,
        roleCode: users.roleCode,
        isActive: users.isActive,
        createdAt: users.createdAt,
      });

    await logAudit({
      userId: req.user!.id,
      userName: req.user!.fullName,
      userRole: req.user!.roleCode,
      action: 'CREATE',
      module: 'users',
      entityType: 'user',
      entityId: inserted[0].id,
      newValue: inserted[0],
      ipAddress: req.ip || null,
    });

    return res.status(201).json({ item: inserted[0], message: 'Akun pengurus berhasil ditambahkan.' });
  } catch (err: any) {
    if (err?.code === '23505') {
      return res.status(409).json({ error: 'Username atau email sudah digunakan.' });
    }
    return res.status(500).json({ error: 'Gagal menambahkan akun pengurus.' });
  }
});

router.put('/users/:id', requireRole('ketua_dkm'), async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const schema = z.object({
      fullName: z.string().min(3).max(120),
      email: z.string().email(),
      roleCode: z.enum(['ketua_dkm', 'bendahara', 'sekretaris']),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message });

    if (id === req.user!.id && parsed.data.roleCode !== 'ketua_dkm') {
      return res.status(400).json({ error: 'Anda tidak dapat menurunkan role akun Anda sendiri.' });
    }

    const roleRows = await db.select().from(roles).where(eq(roles.code, parsed.data.roleCode)).limit(1);
    const updated = await db
      .update(users)
      .set({
        fullName: parsed.data.fullName.trim(),
        email: parsed.data.email.trim().toLowerCase(),
        roleId: roleRows[0]?.id ?? null,
        roleCode: parsed.data.roleCode,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .returning({
        id: users.id,
        fullName: users.fullName,
        username: users.username,
        email: users.email,
        roleCode: users.roleCode,
        isActive: users.isActive,
      });

    await logAudit({
      userId: req.user!.id,
      userName: req.user!.fullName,
      userRole: req.user!.roleCode,
      action: 'UPDATE',
      module: 'users',
      entityType: 'user',
      entityId: id,
      newValue: updated[0],
      ipAddress: req.ip || null,
    });

    return res.json({ item: updated[0], message: 'Data pengurus diperbarui.' });
  } catch (err) {
    return res.status(500).json({ error: 'Gagal memperbarui akun pengurus.' });
  }
});

router.patch('/users/:id/toggle-active', requireRole('ketua_dkm'), async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    if (id === req.user!.id) {
      return res.status(400).json({ error: 'Anda tidak dapat menonaktifkan akun Anda sendiri.' });
    }
    const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
    if (!rows[0]) return res.status(404).json({ error: 'Akun tidak ditemukan.' });

    const nextActive = !rows[0].isActive;
    const updated = await db
      .update(users)
      .set({ isActive: nextActive, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning({
        id: users.id,
        fullName: users.fullName,
        username: users.username,
        email: users.email,
        roleCode: users.roleCode,
        isActive: users.isActive,
      });

    await logAudit({
      userId: req.user!.id,
      userName: req.user!.fullName,
      userRole: req.user!.roleCode,
      action: 'UPDATE',
      module: 'users',
      entityType: 'user_status',
      entityId: id,
      newValue: { isActive: nextActive },
      ipAddress: req.ip || null,
    });

    return res.json({ item: updated[0], message: `Akun ${nextActive ? 'diaktifkan' : 'dinonaktifkan'}.` });
  } catch (err) {
    return res.status(500).json({ error: 'Gagal mengubah status akun.' });
  }
});

router.post('/users/:id/reset-password', requireRole('ketua_dkm'), async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const schema = z.object({ newPassword: z.string().min(8).max(128) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Password baru minimal 8 karakter.' });

    const passwordHash = await hashPassword(parsed.data.newPassword);
    await db.update(users).set({ passwordHash, updatedAt: new Date() }).where(eq(users.id, id));

    await logAudit({
      userId: req.user!.id,
      userName: req.user!.fullName,
      userRole: req.user!.roleCode,
      action: 'UPDATE',
      module: 'users',
      entityType: 'user_password_reset',
      entityId: id,
      ipAddress: req.ip || null,
    });

    return res.json({ message: 'Password pengurus berhasil direset.' });
  } catch (err) {
    return res.status(500).json({ error: 'Gagal mereset password.' });
  }
});

// 5. Dedicated Mosque Payment Methods Management (Ketua DKM & Bendahara)
const paymentMethodSchema = z.object({
  accountType: z.enum(['bank_transfer', 'e_wallet']),
  providerName: z.string().trim().min(2, 'Nama penyedia (Bank/E-Wallet) wajib diisi').max(120),
  accountNumber: z.string().trim().max(80).default(''),
  accountHolder: z.string().trim().max(120).default(''),
  programScope: z.enum(['all', 'zakat', 'infak', 'sedekah']).default('all'),
  paymentLink: z
    .string()
    .trim()
    .max(400)
    .optional()
    .default('')
    .refine((v) => !v || /^https?:\/\//i.test(v), 'Tautan pembayaran harus diawali https:// atau http://'),
  qrCodeUrl: z
    .string()
    .trim()
    .max(400)
    .optional()
    .default('')
    .refine(
      (v) => !v || v.startsWith('/uploads/') || v.startsWith('/src/assets/') || /^https?:\/\//i.test(v),
      'URL gambar QR tidak valid.',
    ),
  qrisPayload: z
    .string()
    .trim()
    .max(1200)
    .optional()
    .default('')
    .refine(
      (v) => !v || validateQrisPayload(v).valid,
      'Payload QRIS EMVCo tidak valid atau checksum CRC-16 tidak cocok.',
    ),
  qrisMerchantName: z.string().trim().max(120).optional().default(''),
  notes: z.string().trim().max(400).optional().default(''),
  isActive: z.union([z.boolean(), z.string()]).optional().default(true),
});

function parseBoolField(val: unknown, fallback = true): boolean {
  if (typeof val === 'boolean') return val;
  if (typeof val === 'string') return val.toLowerCase() === 'true' || val === '1';
  return fallback;
}

router.get('/payment-methods', requireRole('ketua_dkm', 'bendahara'), async (_req, res) => {
  try {
    const items = await db
      .select()
      .from(mosquePaymentMethods)
      .orderBy(desc(mosquePaymentMethods.isActive), desc(mosquePaymentMethods.id));
    return res.json({ items });
  } catch (err) {
    console.error('List payment methods error:', err);
    return res.status(500).json({ error: 'Gagal memuat daftar metode pembayaran.' });
  }
});

router.post(
  '/payment-methods',
  requireRole('ketua_dkm', 'bendahara'),
  uploadSingleFile.single('qrCode'),
  async (req: AuthRequest, res) => {
    try {
      const parsed = paymentMethodSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Data metode pembayaran tidak valid.' });
      }
      const d = parsed.data;
      const qrCodeUrl = req.file ? `/uploads/${req.file.filename}` : d.qrCodeUrl;

      if (!d.accountNumber && !qrCodeUrl && !d.qrisPayload) {
        return res.status(400).json({
          error: 'Isi nomor rekening/e-wallet atau unggah kode QR pembayaran.',
        });
      }

      const qrisInfo = d.qrisPayload ? validateQrisPayload(d.qrisPayload) : null;
      const merchantName = d.qrisMerchantName || (qrisInfo?.valid ? qrisInfo.merchantName : '');

      const inserted = await db
        .insert(mosquePaymentMethods)
        .values({
          accountType: d.accountType,
          providerName: d.providerName,
          accountNumber: d.accountNumber,
          accountHolder: d.accountHolder,
          programScope: d.programScope,
          paymentLink: d.paymentLink,
          qrCodeUrl,
          qrisPayload: d.qrisPayload,
          qrisMerchantName: merchantName,
          notes: d.notes,
          isActive: parseBoolField(d.isActive, true),
          createdBy: req.user!.id,
        })
        .returning();

      await logAudit({
        userId: req.user!.id,
        userName: req.user!.fullName,
        userRole: req.user!.roleCode,
        action: 'CREATE',
        module: 'payment_methods',
        entityType: 'mosque_payment_method',
        entityId: inserted[0].id,
        newValue: inserted[0],
        ipAddress: req.ip || null,
      });

      return res.status(201).json({
        item: inserted[0],
        message: 'Metode pembayaran berhasil ditambahkan.',
      });
    } catch (err: any) {
      console.error('Create payment method error:', err);
      return res.status(500).json({ error: err.message || 'Gagal menambahkan metode pembayaran.' });
    }
  },
);

router.put(
  '/payment-methods/:id',
  requireRole('ketua_dkm', 'bendahara'),
  uploadSingleFile.single('qrCode'),
  async (req: AuthRequest, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) {
        return res.status(400).json({ error: 'ID metode pembayaran tidak valid.' });
      }
      const existingRows = await db
        .select()
        .from(mosquePaymentMethods)
        .where(eq(mosquePaymentMethods.id, id))
        .limit(1);
      const existing = existingRows[0];
      if (!existing) {
        return res.status(404).json({ error: 'Metode pembayaran tidak ditemukan.' });
      }

      const parsed = paymentMethodSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Data tidak valid.' });
      }
      const d = parsed.data;
      const qrCodeUrl = req.file ? `/uploads/${req.file.filename}` : d.qrCodeUrl ?? existing.qrCodeUrl ?? '';

      if (!d.accountNumber && !qrCodeUrl && !d.qrisPayload) {
        return res.status(400).json({
          error: 'Isi nomor rekening/e-wallet atau unggah kode QR pembayaran.',
        });
      }

      const qrisInfo = d.qrisPayload ? validateQrisPayload(d.qrisPayload) : null;
      const merchantName = d.qrisMerchantName || (qrisInfo?.valid ? qrisInfo.merchantName : '');

      const updated = await db
        .update(mosquePaymentMethods)
        .set({
          accountType: d.accountType,
          providerName: d.providerName,
          accountNumber: d.accountNumber,
          accountHolder: d.accountHolder,
          programScope: d.programScope,
          paymentLink: d.paymentLink,
          qrCodeUrl,
          qrisPayload: d.qrisPayload,
          qrisMerchantName: merchantName,
          notes: d.notes,
          isActive: parseBoolField(d.isActive, existing.isActive),
          updatedAt: new Date(),
        })
        .where(eq(mosquePaymentMethods.id, id))
        .returning();

      await logAudit({
        userId: req.user!.id,
        userName: req.user!.fullName,
        userRole: req.user!.roleCode,
        action: 'UPDATE',
        module: 'payment_methods',
        entityType: 'mosque_payment_method',
        entityId: id,
        previousValue: existing,
        newValue: updated[0],
        ipAddress: req.ip || null,
      });

      return res.json({
        item: updated[0],
        message: 'Metode pembayaran berhasil diperbarui.',
      });
    } catch (err: any) {
      console.error('Update payment method error:', err);
      return res.status(500).json({ error: err.message || 'Gagal memperbarui metode pembayaran.' });
    }
  },
);

router.patch('/payment-methods/:id/toggle', requireRole('ketua_dkm', 'bendahara'), async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: 'ID tidak valid.' });
    }
    const rows = await db.select().from(mosquePaymentMethods).where(eq(mosquePaymentMethods.id, id)).limit(1);
    if (!rows[0]) return res.status(404).json({ error: 'Metode pembayaran tidak ditemukan.' });

    const nextActive = !rows[0].isActive;
    const updated = await db
      .update(mosquePaymentMethods)
      .set({ isActive: nextActive, updatedAt: new Date() })
      .where(eq(mosquePaymentMethods.id, id))
      .returning();

    await logAudit({
      userId: req.user!.id,
      userName: req.user!.fullName,
      userRole: req.user!.roleCode,
      action: 'UPDATE',
      module: 'payment_methods',
      entityType: 'mosque_payment_method_status',
      entityId: id,
      newValue: { isActive: nextActive },
      ipAddress: req.ip || null,
    });

    return res.json({
      item: updated[0],
      message: `Metode pembayaran ${nextActive ? 'diaktifkan' : 'dinonaktifkan'}.`,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Gagal mengubah status metode pembayaran.' });
  }
});

router.delete('/payment-methods/:id', requireRole('ketua_dkm', 'bendahara'), async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: 'ID tidak valid.' });
    }
    const rows = await db.select().from(mosquePaymentMethods).where(eq(mosquePaymentMethods.id, id)).limit(1);
    if (!rows[0]) return res.status(404).json({ error: 'Metode pembayaran tidak ditemukan.' });

    await db.delete(mosquePaymentMethods).where(eq(mosquePaymentMethods.id, id));

    await logAudit({
      userId: req.user!.id,
      userName: req.user!.fullName,
      userRole: req.user!.roleCode,
      action: 'DELETE',
      module: 'payment_methods',
      entityType: 'mosque_payment_method',
      entityId: id,
      previousValue: rows[0],
      ipAddress: req.ip || null,
    });

    return res.json({ message: 'Metode pembayaran berhasil dihapus.' });
  } catch (err) {
    return res.status(500).json({ error: 'Gagal menghapus metode pembayaran.' });
  }
});

export default router;
