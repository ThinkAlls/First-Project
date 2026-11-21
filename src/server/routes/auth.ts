import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db/index.ts';
import { roles, users } from '../../db/schema.ts';
import { adminAuth } from '../../lib/firebase-admin.ts';
import { type AuthRequest, requireAuth } from '../middleware/auth.ts';
import { logAudit } from '../utils/audit.ts';
import { hashPassword, signJwt, verifyPassword } from '../utils/auth.ts';
import { ensureInitialData } from '../utils/seed.ts';

const router = Router();

const bootstrapSchema = z.object({
  fullName: z.string().min(3, 'Nama lengkap minimal 3 karakter').max(120),
  username: z.string().min(3, 'Username minimal 3 karakter').max(50).regex(/^[a-zA-Z0-9_.-]+$/, 'Username hanya boleh huruf, angka, titik, atau garis bawah'),
  email: z.string().email('Format email tidak valid'),
  password: z.string().min(8, 'Password minimal 8 karakter').max(128),
});

const loginSchema = z.object({
  identifier: z.string().min(2, 'Email atau username wajib diisi'),
  password: z.string().min(1, 'Password wajib diisi'),
});

// Check if initial Ketua DKM setup is still required
router.get('/status', async (_req, res) => {
  try {
    await ensureInitialData();
    const ketuaList = await db
      .select({ id: users.id, passwordHash: users.passwordHash })
      .from(users)
      .where(eq(users.roleCode, 'ketua_dkm'))
      .limit(1);

    const needsBootstrap = ketuaList.length === 0;
    return res.json({ needsBootstrap });
  } catch (err) {
    console.error('Auth status error:', err);
    return res.status(500).json({ error: 'Gagal memeriksa status autentikasi.' });
  }
});

// One-time atomic bootstrap for first Ketua DKM account
router.post('/bootstrap', async (req, res) => {
  try {
    await ensureInitialData();
    const parsed = bootstrapSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Input tidak valid.' });
    }

    const { fullName, username, email, password } = parsed.data;
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedUsername = username.trim().toLowerCase();

    const created = await db.transaction(async (tx) => {
      const existingKetua = await tx
        .select({ id: users.id })
        .from(users)
        .where(eq(users.roleCode, 'ketua_dkm'))
        .limit(1);

      if (existingKetua.length > 0) {
        return null;
      }

      const roleRows = await tx
        .select()
        .from(roles)
        .where(eq(roles.code, 'ketua_dkm'))
        .limit(1);

      const passwordHash = await hashPassword(password);
      const inserted = await tx
        .insert(users)
        .values({
          fullName: fullName.trim(),
          username: normalizedUsername,
          email: normalizedEmail,
          passwordHash,
          roleId: roleRows[0]?.id ?? null,
          roleCode: 'ketua_dkm',
          isActive: true,
          lastLoginAt: new Date(),
        })
        .returning();

      await logAudit(
        {
          userId: inserted[0].id,
          userName: inserted[0].fullName,
          userRole: 'ketua_dkm',
          action: 'BOOTSTRAP',
          module: 'auth',
          entityType: 'user',
          entityId: inserted[0].id,
          newValue: { username: normalizedUsername, email: normalizedEmail, roleCode: 'ketua_dkm' },
          ipAddress: req.ip || null,
        },
        tx,
      );

      return inserted[0];
    });

    if (!created) {
      return res.status(403).json({
        error: 'Akun Ketua DKM sudah pernah diaktifkan. Silakan masuk melalui formulir login.',
      });
    }

    const token = signJwt({
      userId: created.id,
      username: created.username,
      email: created.email,
      roleCode: 'ketua_dkm',
    });

    return res.status(201).json({
      token,
      user: {
        id: created.id,
        fullName: created.fullName,
        username: created.username,
        email: created.email,
        roleCode: created.roleCode,
      },
    });
  } catch (err: any) {
    console.error('Bootstrap error:', err);
    return res.status(500).json({ error: 'Gagal mengaktifkan akun Ketua DKM awal.' });
  }
});

// Standard Email / Username + Password Login
router.post('/login', async (req, res) => {
  try {
    await ensureInitialData();
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Data login tidak valid.' });
    }

    const identifier = parsed.data.identifier.trim().toLowerCase();
    const password = parsed.data.password;

    const rows = identifier.includes('@')
      ? await db.select().from(users).where(eq(users.email, identifier)).limit(1)
      : await db.select().from(users).where(eq(users.username, identifier)).limit(1);

    const user = rows[0];
    if (!user || !user.passwordHash) {
      return res.status(401).json({ error: 'Username/email atau password salah.' });
    }
    if (!user.isActive) {
      return res.status(403).json({ error: 'Akun pengurus ini sedang dinonaktifkan. Hubungi Ketua DKM.' });
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'Username/email atau password salah.' });
    }

    await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));

    await logAudit({
      userId: user.id,
      userName: user.fullName,
      userRole: user.roleCode,
      action: 'LOGIN',
      module: 'auth',
      entityType: 'user',
      entityId: user.id,
      ipAddress: req.ip || null,
    });

    const token = signJwt({
      userId: user.id,
      username: user.username,
      email: user.email,
      roleCode: user.roleCode as 'ketua_dkm' | 'bendahara' | 'sekretaris',
    });

    return res.json({
      token,
      user: {
        id: user.id,
        fullName: user.fullName,
        username: user.username,
        email: user.email,
        roleCode: user.roleCode,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Terjadi kesalahan saat proses login.' });
  }
});

// Firebase Google Sign-In verification & session link
router.post('/firebase', async (req, res) => {
  try {
    await ensureInitialData();
    const { idToken } = req.body as { idToken?: string };
    if (!idToken) {
      return res.status(400).json({ error: 'Token Firebase tidak ditemukan.' });
    }

    const decoded = await adminAuth.verifyIdToken(idToken);
    const email = decoded.email?.toLowerCase();
    if (!email) {
      return res.status(400).json({ error: 'Email akun Google tidak tersedia.' });
    }

    // Check existing user by email or uid
    let rows = await db.select().from(users).where(eq(users.email, email)).limit(1);
    let user = rows[0];

    if (!user) {
      // If no Ketua DKM exists yet, allow the first Google Sign-In user to become Ketua DKM
      const existingKetua = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.roleCode, 'ketua_dkm'))
        .limit(1);

      if (existingKetua.length === 0) {
        const roleRows = await db.select().from(roles).where(eq(roles.code, 'ketua_dkm')).limit(1);
        const baseUsername = email.split('@')[0].replace(/[^a-zA-Z0-9_.-]/g, '').slice(0, 30) || 'ketuadkm';
        const inserted = await db
          .insert(users)
          .values({
            uid: decoded.uid,
            fullName: decoded.name || 'Ketua DKM',
            username: baseUsername,
            email,
            roleId: roleRows[0]?.id ?? null,
            roleCode: 'ketua_dkm',
            isActive: true,
            lastLoginAt: new Date(),
          })
          .onConflictDoUpdate({
            target: users.email,
            set: { uid: decoded.uid, lastLoginAt: new Date() },
          })
          .returning();
        user = inserted[0];
      } else {
        return res.status(403).json({
          error: 'Email Google Anda belum terdaftar sebagai pengurus DKM. Hubungi Ketua DKM untuk mendaftarkan akun Anda.',
        });
      }
    } else {
      if (!user.isActive) {
        return res.status(403).json({ error: 'Akun pengurus Anda sedang dinonaktifkan.' });
      }
      await db
        .update(users)
        .set({ uid: decoded.uid, lastLoginAt: new Date(), updatedAt: new Date() })
        .where(eq(users.id, user.id));
    }

    await logAudit({
      userId: user.id,
      userName: user.fullName,
      userRole: user.roleCode,
      action: 'LOGIN',
      module: 'auth',
      entityType: 'user',
      entityId: user.id,
      newValue: { provider: 'firebase_google' },
      ipAddress: req.ip || null,
    });

    const token = signJwt({
      userId: user.id,
      username: user.username,
      email: user.email,
      roleCode: user.roleCode as 'ketua_dkm' | 'bendahara' | 'sekretaris',
    });

    return res.json({
      token,
      user: {
        id: user.id,
        fullName: user.fullName,
        username: user.username,
        email: user.email,
        roleCode: user.roleCode,
      },
    });
  } catch (err) {
    console.error('Firebase auth error:', err);
    return res.status(401).json({ error: 'Verifikasi akun Google gagal.' });
  }
});

router.get('/me', requireAuth, async (req: AuthRequest, res) => {
  return res.json({ user: req.user });
});

router.put('/profile', requireAuth, async (req: AuthRequest, res) => {
  try {
    const schema = z.object({
      fullName: z.string().min(3).max(120),
      email: z.string().email(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Data profil tidak valid.' });
    }

    const updated = await db
      .update(users)
      .set({
        fullName: parsed.data.fullName.trim(),
        email: parsed.data.email.trim().toLowerCase(),
        updatedAt: new Date(),
      })
      .where(eq(users.id, req.user!.id))
      .returning();

    return res.json({
      user: {
        id: updated[0].id,
        fullName: updated[0].fullName,
        username: updated[0].username,
        email: updated[0].email,
        roleCode: updated[0].roleCode,
      },
    });
  } catch (err) {
    console.error('Update profile error:', err);
    return res.status(500).json({ error: 'Gagal memperbarui profil.' });
  }
});

router.post('/change-password', requireAuth, async (req: AuthRequest, res) => {
  try {
    const schema = z.object({
      currentPassword: z.string().optional(),
      newPassword: z.string().min(8, 'Password baru minimal 8 karakter').max(128),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Password tidak valid.' });
    }

    const rows = await db.select().from(users).where(eq(users.id, req.user!.id)).limit(1);
    const user = rows[0];
    if (!user) return res.status(404).json({ error: 'Pengguna tidak ditemukan.' });

    if (user.passwordHash) {
      if (!parsed.data.currentPassword) {
        return res.status(400).json({ error: 'Password saat ini wajib diisi.' });
      }
      const ok = await verifyPassword(parsed.data.currentPassword, user.passwordHash);
      if (!ok) {
        return res.status(400).json({ error: 'Password saat ini tidak sesuai.' });
      }
    }

    const newHash = await hashPassword(parsed.data.newPassword);
    await db
      .update(users)
      .set({ passwordHash: newHash, updatedAt: new Date() })
      .where(eq(users.id, user.id));

    await logAudit({
      userId: user.id,
      userName: user.fullName,
      userRole: user.roleCode,
      action: 'UPDATE',
      module: 'auth',
      entityType: 'user_password',
      entityId: user.id,
      ipAddress: req.ip || null,
    });

    return res.json({ message: 'Password berhasil diperbarui.' });
  } catch (err) {
    console.error('Change password error:', err);
    return res.status(500).json({ error: 'Gagal mengganti password.' });
  }
});

export default router;
