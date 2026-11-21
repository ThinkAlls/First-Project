import { type Request, type Response, type NextFunction } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import { users } from '../../db/schema.ts';
import { adminAuth } from '../../lib/firebase-admin.ts';
import { verifyJwt } from '../utils/auth.ts';

export type RoleCode = 'ketua_dkm' | 'bendahara' | 'sekretaris';

export interface AuthenticatedUser {
  id: number;
  uid: string | null;
  fullName: string;
  username: string;
  email: string;
  roleCode: RoleCode;
  isActive: boolean;
}

export interface AuthRequest extends Request {
  user?: AuthenticatedUser;
}

export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Akses ditolak: Token autentikasi tidak ditemukan.' });
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    return res.status(401).json({ error: 'Akses ditolak: Token kosong.' });
  }

  try {
    // 1. Try internal JWT first
    try {
      const payload = verifyJwt(token);
      const rows = await db.select().from(users).where(eq(users.id, payload.userId)).limit(1);
      const dbUser = rows[0];
      if (!dbUser || !dbUser.isActive) {
        return res.status(401).json({ error: 'Akun pengurus tidak aktif atau tidak ditemukan.' });
      }
      req.user = {
        id: dbUser.id,
        uid: dbUser.uid,
        fullName: dbUser.fullName,
        username: dbUser.username,
        email: dbUser.email,
        roleCode: dbUser.roleCode as RoleCode,
        isActive: dbUser.isActive,
      };
      return next();
    } catch {
      // Fallback: check Firebase ID token
    }

    const decoded = await adminAuth.verifyIdToken(token);
    const rows = decoded.email
      ? await db.select().from(users).where(eq(users.email, decoded.email)).limit(1)
      : await db.select().from(users).where(eq(users.uid, decoded.uid)).limit(1);

    const dbUser = rows[0];
    if (!dbUser || !dbUser.isActive) {
      return res.status(403).json({
        error: 'Akun Google Anda belum terdaftar sebagai pengurus DKM aktif.',
      });
    }

    req.user = {
      id: dbUser.id,
      uid: dbUser.uid,
      fullName: dbUser.fullName,
      username: dbUser.username,
      email: dbUser.email,
      roleCode: dbUser.roleCode as RoleCode,
      isActive: dbUser.isActive,
    };
    return next();
  } catch (err) {
    console.error('Auth verification failed:', err);
    return res.status(401).json({ error: 'Sesi tidak valid atau telah berakhir. Silakan masuk kembali.' });
  }
}

export function requireRole(...allowedRoles: RoleCode[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Autentikasi diperlukan.' });
    }
    if (!allowedRoles.includes(req.user.roleCode)) {
      return res.status(403).json({
        error: 'Anda tidak memiliki hak akses untuk fitur ini.',
      });
    }
    return next();
  };
}
