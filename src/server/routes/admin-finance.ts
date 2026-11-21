import { Router } from 'express';
import { and, desc, eq, gte, ilike, lte, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db/index.ts';
import {
  auditLogs,
  donors,
  expenseTransactions,
  financialCategories,
  incomeTransactions,
  mosqueAssets,
  mosqueSettings,
  transactionApprovals,
  zakatDistributions,
  zakatTransactions,
} from '../../db/schema.ts';
import { type AuthRequest, requireAuth, requireRole } from '../middleware/auth.ts';
import { uploadSingleFile } from '../middleware/upload.ts';
import { logAudit } from '../utils/audit.ts';
import {
  generateTxNumber,
  getFundBalances,
  resolveFundTypeForCategory,
} from '../utils/finance.ts';

const router = Router();

// Strictly Ketua DKM and Bendahara only — Sekretaris gets 403 Forbidden
router.use(requireAuth, requireRole('ketua_dkm', 'bendahara'));

// 1. Finance Dashboard Summary
router.get('/dashboard', async (req: AuthRequest, res) => {
  try {
    const balances = await getFundBalances();
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const monthStart = `${y}-${m}-01`;
    const lastDay = new Date(y, now.getMonth() + 1, 0).getDate();
    const monthEnd = `${y}-${m}-${String(lastDay).padStart(2, '0')}`;

    const monthCashIncome = await db
      .select({ total: sql<string>`COALESCE(SUM(${incomeTransactions.amount}), 0)` })
      .from(incomeTransactions)
      .where(
        and(
          eq(incomeTransactions.transactionStatus, 'verified'),
          eq(incomeTransactions.fundType, 'mosque_cash'),
          gte(incomeTransactions.transactionDate, monthStart),
          lte(incomeTransactions.transactionDate, monthEnd),
        ),
      );

    const monthCashExpense = await db
      .select({ total: sql<string>`COALESCE(SUM(${expenseTransactions.amount}), 0)` })
      .from(expenseTransactions)
      .where(
        and(
          eq(expenseTransactions.transactionStatus, 'approved'),
          gte(expenseTransactions.transactionDate, monthStart),
          lte(expenseTransactions.transactionDate, monthEnd),
        ),
      );

    const pendingZakat = await db
      .select({ count: sql<string>`COUNT(*)` })
      .from(zakatTransactions)
      .where(eq(zakatTransactions.transactionStatus, 'pending'));

    const pendingExpenses = await db
      .select({ count: sql<string>`COUNT(*)` })
      .from(expenseTransactions)
      .where(eq(expenseTransactions.transactionStatus, 'pending_approval'));

    const yearStart = `${y}-01-01`;
    const yearEnd = `${y}-12-31`;

    const monthlyCashInc = await db
      .select({
        month: sql<string>`SUBSTRING(${incomeTransactions.transactionDate}, 1, 7)`,
        total: sql<string>`COALESCE(SUM(${incomeTransactions.amount}), 0)`,
      })
      .from(incomeTransactions)
      .where(
        and(
          eq(incomeTransactions.transactionStatus, 'verified'),
          eq(incomeTransactions.fundType, 'mosque_cash'),
          gte(incomeTransactions.transactionDate, yearStart),
          lte(incomeTransactions.transactionDate, yearEnd),
        ),
      )
      .groupBy(sql`SUBSTRING(${incomeTransactions.transactionDate}, 1, 7)`);

    const monthlyCashExp = await db
      .select({
        month: sql<string>`SUBSTRING(${expenseTransactions.transactionDate}, 1, 7)`,
        total: sql<string>`COALESCE(SUM(${expenseTransactions.amount}), 0)`,
      })
      .from(expenseTransactions)
      .where(
        and(
          eq(expenseTransactions.transactionStatus, 'approved'),
          gte(expenseTransactions.transactionDate, yearStart),
          lte(expenseTransactions.transactionDate, yearEnd),
        ),
      )
      .groupBy(sql`SUBSTRING(${expenseTransactions.transactionDate}, 1, 7)`);

    const monthlyZakatInc = await db
      .select({
        month: sql<string>`SUBSTRING(${incomeTransactions.transactionDate}, 1, 7)`,
        total: sql<string>`COALESCE(SUM(${incomeTransactions.amount}), 0)`,
      })
      .from(incomeTransactions)
      .where(
        and(
          eq(incomeTransactions.transactionStatus, 'verified'),
          sql`${incomeTransactions.fundType} IN ('zakat_fitrah', 'zakat_mal')`,
          gte(incomeTransactions.transactionDate, yearStart),
          lte(incomeTransactions.transactionDate, yearEnd),
        ),
      )
      .groupBy(sql`SUBSTRING(${incomeTransactions.transactionDate}, 1, 7)`);

    const monthlyZakatDist = await db
      .select({
        month: sql<string>`SUBSTRING(${zakatDistributions.distributionDate}, 1, 7)`,
        total: sql<string>`COALESCE(SUM(${zakatDistributions.amount}), 0)`,
      })
      .from(zakatDistributions)
      .where(
        and(
          eq(zakatDistributions.status, 'approved'),
          gte(zakatDistributions.distributionDate, yearStart),
          lte(zakatDistributions.distributionDate, yearEnd),
        ),
      )
      .groupBy(sql`SUBSTRING(${zakatDistributions.distributionDate}, 1, 7)`);

    const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    const cIncMap = new Map(monthlyCashInc.map((r) => [r.month, Number(r.total)]));
    const cExpMap = new Map(monthlyCashExp.map((r) => [r.month, Number(r.total)]));
    const zIncMap = new Map(monthlyZakatInc.map((r) => [r.month, Number(r.total)]));
    const zDistMap = new Map(monthlyZakatDist.map((r) => [r.month, Number(r.total)]));

    const cashChart = monthLabels.map((label, idx) => {
      const key = `${y}-${String(idx + 1).padStart(2, '0')}`;
      return { month: label, pemasukan: cIncMap.get(key) ?? 0, pengeluaran: cExpMap.get(key) ?? 0 };
    });

    const zakatChart = monthLabels.map((label, idx) => {
      const key = `${y}-${String(idx + 1).padStart(2, '0')}`;
      return { month: label, penerimaan: zIncMap.get(key) ?? 0, penyaluran: zDistMap.get(key) ?? 0 };
    });

    const recentIncome = await db
      .select()
      .from(incomeTransactions)
      .orderBy(desc(incomeTransactions.createdAt))
      .limit(6);

    const recentExpenses = await db
      .select()
      .from(expenseTransactions)
      .orderBy(desc(expenseTransactions.createdAt))
      .limit(6);

    const recentActivity = await db
      .select()
      .from(auditLogs)
      .orderBy(desc(auditLogs.createdAt))
      .limit(8);

    return res.json({
      balances,
      monthIncome: Number(monthCashIncome[0]?.total ?? 0),
      monthExpense: Number(monthCashExpense[0]?.total ?? 0),
      pendingZakatCount: Number(pendingZakat[0]?.count ?? 0),
      pendingExpenseCount: Number(pendingExpenses[0]?.count ?? 0),
      cashChart,
      zakatChart,
      recentIncome,
      recentExpenses,
      recentActivity,
    });
  } catch (err) {
    console.error('Finance dashboard error:', err);
    return res.status(500).json({ error: 'Gagal memuat statistik dashboard keuangan.' });
  }
});

// 2. Categories
router.get('/categories', async (_req, res) => {
  try {
    const rows = await db
      .select()
      .from(financialCategories)
      .where(eq(financialCategories.isActive, true))
      .orderBy(financialCategories.id);
    return res.json({ categories: rows });
  } catch (err) {
    console.error('Categories error:', err);
    return res.status(500).json({ error: 'Gagal memuat kategori keuangan.' });
  }
});

// 3. Income Management (Search, Pagination, Date Filter, Strict Fund Routing)
router.get('/income', async (req, res) => {
  try {
    const search = ((req.query.search as string) || '').trim();
    const fundType = (req.query.fundType as string) || '';
    const startDate = (req.query.startDate as string) || '';
    const endDate = (req.query.endDate as string) || '';
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 20)));
    const offset = (page - 1) * limit;

    const conditions: any[] = [];
    if (fundType) conditions.push(eq(incomeTransactions.fundType, fundType));
    if (startDate) conditions.push(gte(incomeTransactions.transactionDate, startDate));
    if (endDate) conditions.push(lte(incomeTransactions.transactionDate, endDate));
    if (search) {
      conditions.push(
        or(
          ilike(incomeTransactions.transactionNumber, `%${search}%`),
          ilike(incomeTransactions.description, `%${search}%`),
          ilike(incomeTransactions.categoryName, `%${search}%`),
          ilike(incomeTransactions.donorName, `%${search}%`),
        ),
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const rows = await db
      .select()
      .from(incomeTransactions)
      .where(whereClause)
      .orderBy(desc(incomeTransactions.transactionDate), desc(incomeTransactions.id))
      .limit(limit)
      .offset(offset);

    const countRes = await db
      .select({ count: sql<string>`COUNT(*)` })
      .from(incomeTransactions)
      .where(whereClause);

    return res.json({
      items: rows,
      total: Number(countRes[0]?.count ?? 0),
      page,
      limit,
    });
  } catch (err) {
    console.error('List income error:', err);
    return res.status(500).json({ error: 'Gagal memuat data pemasukan.' });
  }
});

const incomeSchema = z.object({
  transactionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD'),
  categoryName: z.string().min(2, 'Kategori wajib dipilih'),
  fundType: z.enum(['mosque_cash', 'zakat_fitrah', 'zakat_mal']).optional(),
  donorName: z.string().max(120).optional(),
  amount: z.coerce.number().positive('Nominal harus lebih dari 0').max(10000000000),
  paymentMethod: z.string().min(2).max(50),
  description: z.string().min(3, 'Keterangan wajib diisi').max(500),
});

router.post('/income', uploadSingleFile.single('proof'), async (req: AuthRequest, res) => {
  try {
    const parsed = incomeSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Input pemasukan tidak valid.' });
    }

    const { transactionDate, categoryName, fundType, donorName, amount, paymentMethod, description } =
      parsed.data;

    // Enforce strict routing rule: Infak/Sedekah/Donasi Umum -> mosque_cash; Zakat Fitrah -> zakat_fitrah; Zakat Mal -> zakat_mal
    const resolvedFund = resolveFundTypeForCategory(categoryName, fundType);
    const catRows = await db
      .select()
      .from(financialCategories)
      .where(eq(financialCategories.name, categoryName))
      .limit(1);

    const txNumber = generateTxNumber('INC');
    const proofUrl = req.file ? `/uploads/${req.file.filename}` : null;

    const created = await db.transaction(async (tx) => {
      const inserted = await tx
        .insert(incomeTransactions)
        .values({
          transactionNumber: txNumber,
          transactionDate,
          fundType: resolvedFund,
          categoryId: catRows[0]?.id ?? null,
          categoryName,
          donorName: donorName?.trim() || null,
          amount: amount.toFixed(2),
          paymentMethod,
          description: description.trim(),
          proofUrl,
          transactionStatus: 'verified',
          sourceType: 'manual',
          createdBy: req.user!.id,
          approvedBy: req.user!.id,
          approvedAt: new Date(),
        })
        .returning();

      await tx.insert(transactionApprovals).values({
        entityType: 'income',
        entityId: inserted[0].id,
        transactionNumber: txNumber,
        action: 'approved',
        note: 'Input pemasukan manual oleh pengurus',
        actedBy: req.user!.id,
        actedByName: req.user!.fullName,
      });

      await logAudit(
        {
          userId: req.user!.id,
          userName: req.user!.fullName,
          userRole: req.user!.roleCode,
          action: 'CREATE',
          module: 'income',
          entityType: 'income_transaction',
          entityId: inserted[0].id,
          transactionNumber: txNumber,
          newValue: inserted[0],
          ipAddress: req.ip || null,
        },
        tx,
      );

      return inserted[0];
    });

    return res.status(201).json({ item: created, message: 'Pemasukan berhasil dicatat.' });
  } catch (err) {
    console.error('Create income error:', err);
    return res.status(500).json({ error: 'Gagal menyimpan data pemasukan.' });
  }
});

router.put('/income/:id', async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'ID tidak valid.' });

    const existingRows = await db.select().from(incomeTransactions).where(eq(incomeTransactions.id, id)).limit(1);
    const existing = existingRows[0];
    if (!existing) return res.status(404).json({ error: 'Transaksi tidak ditemukan.' });
    if (existing.transactionStatus === 'cancelled') {
      return res.status(400).json({ error: 'Transaksi yang sudah dibatalkan tidak dapat diubah.' });
    }
    if (existing.sourceType === 'zakat_payment') {
      return res.status(400).json({ error: 'Transaksi dari verifikasi pembayaran zakat tidak dapat diedit secara manual.' });
    }

    const parsed = incomeSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Data tidak valid.' });
    }

    const resolvedFund = resolveFundTypeForCategory(parsed.data.categoryName, parsed.data.fundType);

    const updated = await db.transaction(async (tx) => {
      const rows = await tx
        .update(incomeTransactions)
        .set({
          transactionDate: parsed.data.transactionDate,
          categoryName: parsed.data.categoryName,
          fundType: resolvedFund,
          donorName: parsed.data.donorName?.trim() || null,
          amount: parsed.data.amount.toFixed(2),
          paymentMethod: parsed.data.paymentMethod,
          description: parsed.data.description.trim(),
          updatedAt: new Date(),
        })
        .where(eq(incomeTransactions.id, id))
        .returning();

      await logAudit(
        {
          userId: req.user!.id,
          userName: req.user!.fullName,
          userRole: req.user!.roleCode,
          action: 'UPDATE',
          module: 'income',
          entityType: 'income_transaction',
          entityId: id,
          transactionNumber: existing.transactionNumber,
          previousValue: existing,
          newValue: rows[0],
          ipAddress: req.ip || null,
        },
        tx,
      );

      return rows[0];
    });

    return res.json({ item: updated, message: 'Transaksi pemasukan diperbarui.' });
  } catch (err) {
    console.error('Update income error:', err);
    return res.status(500).json({ error: 'Gagal memperbarui pemasukan.' });
  }
});

// Never permanently delete confirmed financial transactions: use cancellation + audit log
router.post('/income/:id/cancel', async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'ID tidak valid.' });
    const note = ((req.body?.note as string) || 'Dibatalkan oleh pengurus').trim();

    const updated = await db.transaction(async (tx) => {
      const rows = await tx.select().from(incomeTransactions).where(eq(incomeTransactions.id, id)).limit(1);
      const existing = rows[0];
      if (!existing) return null;
      if (existing.transactionStatus === 'cancelled') return existing;

      const upd = await tx
        .update(incomeTransactions)
        .set({
          transactionStatus: 'cancelled',
          approvalNote: note,
          updatedAt: new Date(),
        })
        .where(eq(incomeTransactions.id, id))
        .returning();

      await tx.insert(transactionApprovals).values({
        entityType: 'income',
        entityId: id,
        transactionNumber: existing.transactionNumber,
        action: 'cancelled',
        note,
        actedBy: req.user!.id,
        actedByName: req.user!.fullName,
      });

      await logAudit(
        {
          userId: req.user!.id,
          userName: req.user!.fullName,
          userRole: req.user!.roleCode,
          action: 'CANCEL',
          module: 'income',
          entityType: 'income_transaction',
          entityId: id,
          transactionNumber: existing.transactionNumber,
          previousValue: existing,
          newValue: upd[0],
          ipAddress: req.ip || null,
        },
        tx,
      );

      return upd[0];
    });

    if (!updated) return res.status(404).json({ error: 'Transaksi tidak ditemukan.' });
    return res.json({ item: updated, message: 'Transaksi pemasukan dibatalkan dengan audit log.' });
  } catch (err) {
    console.error('Cancel income error:', err);
    return res.status(500).json({ error: 'Gagal membatalkan transaksi pemasukan.' });
  }
});

// 4. Zakat & Online Payment Verification Queue
router.get('/zakat', async (req, res) => {
  try {
    const status = (req.query.status as string) || '';
    const search = ((req.query.search as string) || '').trim();
    const conditions: any[] = [];
    if (status) conditions.push(eq(zakatTransactions.transactionStatus, status));
    if (search) {
      conditions.push(
        or(
          ilike(zakatTransactions.transactionNumber, `%${search}%`),
          ilike(zakatTransactions.donorName, `%${search}%`),
          ilike(zakatTransactions.whatsappNumber, `%${search}%`),
        ),
      );
    }

    const rows = await db
      .select()
      .from(zakatTransactions)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(zakatTransactions.createdAt));

    return res.json({ items: rows });
  } catch (err) {
    console.error('List zakat payments error:', err);
    return res.status(500).json({ error: 'Gagal memuat antrean verifikasi zakat.' });
  }
});

router.post('/zakat/:id/verify', async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'ID transaksi tidak valid.' });

    const schema = z.object({
      decision: z.enum(['verified', 'rejected']),
      note: z.string().max(500).optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Keputusan verifikasi tidak valid.' });
    }

    const { decision, note } = parsed.data;

    const result = await db.transaction(async (tx) => {
      const rows = await tx
        .select()
        .from(zakatTransactions)
        .where(eq(zakatTransactions.id, id))
        .limit(1);
      const zakatTx = rows[0];
      if (!zakatTx) {
        return { error: 'Transaksi tidak ditemukan.', status: 404 as const };
      }
      if (zakatTx.transactionStatus === 'verified' || zakatTx.recordedIncomeId !== null) {
        return {
          error: 'Transaksi ini sudah diverifikasi sebelumnya dan tidak boleh dicatat ganda.',
          status: 409 as const,
        };
      }
      if (zakatTx.transactionStatus === 'rejected') {
        return {
          error: 'Transaksi ini sudah berstatus ditolak.',
          status: 409 as const,
        };
      }
      if (
        decision === 'verified' &&
        zakatTx.transactionStatus === 'waiting_payment' &&
        zakatTx.paymentMethod !== 'cash'
      ) {
        return {
          error:
            'Transaksi masih berstatus Menunggu Pembayaran (donatur belum mengunggah bukti & konfirmasi pembayaran).',
          status: 400 as const,
        };
      }

      if (decision === 'rejected') {
        const updated = await tx
          .update(zakatTransactions)
          .set({
            transactionStatus: 'rejected',
            verificationNote: note?.trim() || 'Ditolak oleh verifikator DKM',
            verifiedBy: req.user!.id,
            verifiedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(zakatTransactions.id, id))
          .returning();

        await tx.insert(transactionApprovals).values({
          entityType: 'zakat',
          entityId: id,
          transactionNumber: zakatTx.transactionNumber,
          action: 'rejected',
          note: note?.trim() || 'Ditolak',
          actedBy: req.user!.id,
          actedByName: req.user!.fullName,
        });

        await logAudit(
          {
            userId: req.user!.id,
            userName: req.user!.fullName,
            userRole: req.user!.roleCode,
            action: 'REJECT',
            module: 'zakat_verification',
            entityType: 'zakat_transaction',
            entityId: id,
            transactionNumber: zakatTx.transactionNumber,
            previousValue: zakatTx,
            newValue: updated[0],
            ipAddress: req.ip || null,
          },
          tx,
        );

        return { item: updated[0], status: 200 as const };
      }

      // Approved/Verified: map exact ledger fundType & category
      const categoryLabelMap: Record<string, string> = {
        zakat_fitrah: 'Zakat Fitrah',
        zakat_mal: 'Zakat Mal',
        infak: 'Infak',
        sedekah: 'Sedekah',
      };
      const catName = categoryLabelMap[zakatTx.paymentType] || 'Infak';
      const targetFundType =
        zakatTx.paymentType === 'zakat_fitrah'
          ? 'zakat_fitrah'
          : zakatTx.paymentType === 'zakat_mal'
            ? 'zakat_mal'
            : 'mosque_cash';

      const catRows = await tx
        .select()
        .from(financialCategories)
        .where(eq(financialCategories.name, catName))
        .limit(1);

      const todayIso = new Date().toISOString().slice(0, 10);
      const incNumber = generateTxNumber('INC');

      const insertedIncome = await tx
        .insert(incomeTransactions)
        .values({
          transactionNumber: incNumber,
          transactionDate: todayIso,
          fundType: targetFundType,
          categoryId: catRows[0]?.id ?? null,
          categoryName: catName,
          donorId: zakatTx.donorId,
          donorName: zakatTx.donorName,
          amount: zakatTx.amount,
          paymentMethod: zakatTx.paymentMethod,
          description: `Verifikasi pembayaran daring ${catName} (${zakatTx.transactionNumber})`,
          proofUrl: zakatTx.proofUrl,
          transactionStatus: 'verified',
          sourceType: 'zakat_payment',
          sourceZakatId: zakatTx.id, // Unique constraint prevents double recording
          createdBy: req.user!.id,
          approvedBy: req.user!.id,
          approvedAt: new Date(),
          approvalNote: note?.trim() || 'Diverifikasi dan dicatat otomatis ke pembukuan resmi',
        })
        .returning();

      const updatedZakat = await tx
        .update(zakatTransactions)
        .set({
          transactionStatus: 'verified',
          verificationNote: note?.trim() || 'Pembayaran diterima dan tercatat di pembukuan',
          verifiedBy: req.user!.id,
          verifiedAt: new Date(),
          recordedIncomeId: insertedIncome[0].id,
          updatedAt: new Date(),
        })
        .where(eq(zakatTransactions.id, id))
        .returning();

      await tx.insert(transactionApprovals).values({
        entityType: 'zakat',
        entityId: id,
        transactionNumber: zakatTx.transactionNumber,
        action: 'approved',
        note: note?.trim() || `Diverifikasi -> ${incNumber} (${targetFundType})`,
        actedBy: req.user!.id,
        actedByName: req.user!.fullName,
      });

      await logAudit(
        {
          userId: req.user!.id,
          userName: req.user!.fullName,
          userRole: req.user!.roleCode,
          action: 'VERIFY',
          module: 'zakat_verification',
          entityType: 'zakat_transaction',
          entityId: id,
          transactionNumber: zakatTx.transactionNumber,
          previousValue: zakatTx,
          newValue: { zakat: updatedZakat[0], income: insertedIncome[0] },
          ipAddress: req.ip || null,
        },
        tx,
      );

      return { item: updatedZakat[0], income: insertedIncome[0], status: 200 as const };
    });

    if ('error' in result) {
      return res.status(result.status).json({ error: result.error });
    }
    return res.json({
      ...result,
      message:
        decision === 'verified'
          ? 'Pembayaran diverifikasi dan dicatat ke pembukuan sesuai jenis dana.'
          : 'Pembayaran ditolak.',
    });
  } catch (err) {
    console.error('Verify zakat error:', err);
    return res.status(500).json({ error: 'Gagal memverifikasi transaksi zakat/donasi.' });
  }
});

// 5. Expenses Management (Strictly Mosque Cash Only, Approval Workflow + No Negative Balance)
router.get('/expenses', async (req, res) => {
  try {
    const search = ((req.query.search as string) || '').trim();
    const status = (req.query.status as string) || '';
    const startDate = (req.query.startDate as string) || '';
    const endDate = (req.query.endDate as string) || '';
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 20)));
    const offset = (page - 1) * limit;

    const conditions: any[] = [];
    if (status) conditions.push(eq(expenseTransactions.transactionStatus, status));
    if (startDate) conditions.push(gte(expenseTransactions.transactionDate, startDate));
    if (endDate) conditions.push(lte(expenseTransactions.transactionDate, endDate));
    if (search) {
      conditions.push(
        or(
          ilike(expenseTransactions.transactionNumber, `%${search}%`),
          ilike(expenseTransactions.description, `%${search}%`),
          ilike(expenseTransactions.recipientName, `%${search}%`),
          ilike(expenseTransactions.categoryName, `%${search}%`),
        ),
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const rows = await db
      .select()
      .from(expenseTransactions)
      .where(whereClause)
      .orderBy(desc(expenseTransactions.transactionDate), desc(expenseTransactions.id))
      .limit(limit)
      .offset(offset);

    const countRes = await db
      .select({ count: sql<string>`COUNT(*)` })
      .from(expenseTransactions)
      .where(whereClause);

    return res.json({
      items: rows,
      total: Number(countRes[0]?.count ?? 0),
      page,
      limit,
    });
  } catch (err) {
    console.error('List expenses error:', err);
    return res.status(500).json({ error: 'Gagal memuat data pengeluaran.' });
  }
});

const expenseSchema = z.object({
  transactionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD'),
  categoryName: z.string().min(2, 'Kategori pengeluaran wajib dipilih'),
  recipientName: z.string().min(2, 'Penerima pembayaran wajib diisi').max(120),
  amount: z.coerce.number().positive('Nominal harus lebih dari 0').max(10000000000),
  paymentMethod: z.string().min(2).max(50),
  description: z.string().min(3, 'Keterangan wajib diisi').max(500),
});

router.post('/expenses', uploadSingleFile.single('proof'), async (req: AuthRequest, res) => {
  try {
    const parsed = expenseSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Input pengeluaran tidak valid.' });
    }

    const { transactionDate, categoryName, recipientName, amount, paymentMethod, description } =
      parsed.data;

    const proofUrl = req.file ? `/uploads/${req.file.filename}` : null;
    const txNumber = generateTxNumber('EXP');

    const result = await db.transaction(async (tx) => {
      const balances = await getFundBalances(tx);
      if (amount > balances.mosqueCash.balance) {
        return {
          error: `Saldo Kas Masjid tidak mencukupi (tersedia Rp ${balances.mosqueCash.balance.toLocaleString('id-ID')}). Dana zakat tidak dapat digunakan untuk pengeluaran kas masjid.`,
          status: 400 as const,
        };
      }

      const settingsRows = await tx.select().from(mosqueSettings).limit(1);
      const threshold = Number(settingsRows[0]?.expenseApprovalThreshold ?? 500000);
      const needsChairman = req.user!.roleCode !== 'ketua_dkm' && (amount >= threshold || req.user!.roleCode === 'bendahara');
      const initialStatus = needsChairman ? 'pending_approval' : 'approved';

      const catRows = await tx
        .select()
        .from(financialCategories)
        .where(eq(financialCategories.name, categoryName))
        .limit(1);

      const inserted = await tx
        .insert(expenseTransactions)
        .values({
          transactionNumber: txNumber,
          transactionDate,
          fundType: 'mosque_cash',
          categoryId: catRows[0]?.id ?? null,
          categoryName,
          recipientName: recipientName.trim(),
          amount: amount.toFixed(2),
          paymentMethod,
          description: description.trim(),
          proofUrl,
          transactionStatus: initialStatus,
          requiresChairmanApproval: needsChairman,
          createdBy: req.user!.id,
          approvedBy: initialStatus === 'approved' ? req.user!.id : null,
          approvedAt: initialStatus === 'approved' ? new Date() : null,
          approvalNote:
            initialStatus === 'approved'
              ? 'Disahkan langsung oleh Ketua DKM'
              : 'Menunggu persetujuan Ketua DKM',
        })
        .returning();

      await tx.insert(transactionApprovals).values({
        entityType: 'expense',
        entityId: inserted[0].id,
        transactionNumber: txNumber,
        action: initialStatus === 'approved' ? 'approved' : 'submitted',
        note: inserted[0].approvalNote,
        actedBy: req.user!.id,
        actedByName: req.user!.fullName,
      });

      await logAudit(
        {
          userId: req.user!.id,
          userName: req.user!.fullName,
          userRole: req.user!.roleCode,
          action: 'CREATE',
          module: 'expense',
          entityType: 'expense_transaction',
          entityId: inserted[0].id,
          transactionNumber: txNumber,
          newValue: inserted[0],
          ipAddress: req.ip || null,
        },
        tx,
      );

      return { item: inserted[0], status: 201 as const };
    });

    if ('error' in result) {
      return res.status(result.status).json({ error: result.error });
    }
    return res.status(201).json({
      item: result.item,
      message:
        result.item.transactionStatus === 'pending_approval'
          ? 'Pengeluaran dicatat dan menunggu persetujuan Ketua DKM.'
          : 'Pengeluaran berhasil dicatat dan disahkan.',
    });
  } catch (err) {
    console.error('Create expense error:', err);
    return res.status(500).json({ error: 'Gagal menyimpan data pengeluaran.' });
  }
});

// Edit expense (only while pending_approval)
router.put('/expenses/:id', async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'ID tidak valid.' });

    const rows = await db.select().from(expenseTransactions).where(eq(expenseTransactions.id, id)).limit(1);
    const existing = rows[0];
    if (!existing) return res.status(404).json({ error: 'Pengeluaran tidak ditemukan.' });
    if (existing.transactionStatus !== 'pending_approval') {
      return res.status(400).json({ error: 'Hanya pengeluaran berstatus menunggu persetujuan yang dapat diubah.' });
    }

    const parsed = expenseSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Input tidak valid.' });
    }

    const balances = await getFundBalances();
    if (parsed.data.amount > balances.mosqueCash.balance) {
      return res.status(400).json({ error: 'Nominal melebihi saldo Kas Masjid yang tersedia.' });
    }

    const updated = await db.transaction(async (tx) => {
      const upd = await tx
        .update(expenseTransactions)
        .set({
          transactionDate: parsed.data.transactionDate,
          categoryName: parsed.data.categoryName,
          recipientName: parsed.data.recipientName.trim(),
          amount: parsed.data.amount.toFixed(2),
          paymentMethod: parsed.data.paymentMethod,
          description: parsed.data.description.trim(),
          updatedAt: new Date(),
        })
        .where(eq(expenseTransactions.id, id))
        .returning();

      await logAudit(
        {
          userId: req.user!.id,
          userName: req.user!.fullName,
          userRole: req.user!.roleCode,
          action: 'UPDATE',
          module: 'expense',
          entityType: 'expense_transaction',
          entityId: id,
          transactionNumber: existing.transactionNumber,
          previousValue: existing,
          newValue: upd[0],
          ipAddress: req.ip || null,
        },
        tx,
      );

      return upd[0];
    });

    return res.json({ item: updated, message: 'Pengeluaran berhasil diperbarui.' });
  } catch (err) {
    console.error('Update expense error:', err);
    return res.status(500).json({ error: 'Gagal memperbarui pengeluaran.' });
  }
});

// Chairman Approval/Rejection of Expense (STRICTLY Ketua DKM only!)
router.post('/expenses/:id/approve', requireRole('ketua_dkm'), async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'ID tidak valid.' });

    const schema = z.object({
      decision: z.enum(['approved', 'rejected']),
      note: z.string().max(500).optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Keputusan tidak valid.' });

    const { decision, note } = parsed.data;

    const result = await db.transaction(async (tx) => {
      const rows = await tx
        .select()
        .from(expenseTransactions)
        .where(eq(expenseTransactions.id, id))
        .limit(1);
      const expense = rows[0];
      if (!expense) return { error: 'Transaksi pengeluaran tidak ditemukan.', status: 404 as const };
      if (expense.transactionStatus !== 'pending_approval') {
        return { error: 'Pengeluaran ini sudah diproses sebelumnya.', status: 409 as const };
      }

      if (decision === 'approved') {
        const balances = await getFundBalances(tx);
        if (Number(expense.amount) > balances.mosqueCash.balance) {
          return {
            error: `Persetujuan dibatalkan: saldo Kas Masjid saat ini (Rp ${balances.mosqueCash.balance.toLocaleString('id-ID')}) tidak mencukupi.`,
            status: 400 as const,
          };
        }
      }

      const updated = await tx
        .update(expenseTransactions)
        .set({
          transactionStatus: decision,
          approvedBy: req.user!.id,
          approvedAt: new Date(),
          approvalNote: note?.trim() || (decision === 'approved' ? 'Disetujui Ketua DKM' : 'Ditolak Ketua DKM'),
          updatedAt: new Date(),
        })
        .where(eq(expenseTransactions.id, id))
        .returning();

      await tx.insert(transactionApprovals).values({
        entityType: 'expense',
        entityId: id,
        transactionNumber: expense.transactionNumber,
        action: decision,
        note: note?.trim() || null,
        actedBy: req.user!.id,
        actedByName: req.user!.fullName,
      });

      await logAudit(
        {
          userId: req.user!.id,
          userName: req.user!.fullName,
          userRole: req.user!.roleCode,
          action: decision === 'approved' ? 'APPROVE' : 'REJECT',
          module: 'expense_approval',
          entityType: 'expense_transaction',
          entityId: id,
          transactionNumber: expense.transactionNumber,
          previousValue: expense,
          newValue: updated[0],
          ipAddress: req.ip || null,
        },
        tx,
      );

      return { item: updated[0], status: 200 as const };
    });

    if ('error' in result) return res.status(result.status).json({ error: result.error });
    return res.json({
      item: result.item,
      message:
        decision === 'approved'
          ? 'Pengeluaran disetujui dan resmi mengurangi saldo Kas Masjid.'
          : 'Pengeluaran ditolak dan tidak memengaruhi saldo.',
    });
  } catch (err) {
    console.error('Approve expense error:', err);
    return res.status(500).json({ error: 'Gagal memproses persetujuan pengeluaran.' });
  }
});

router.post('/expenses/:id/cancel', async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'ID tidak valid.' });
    const note = ((req.body?.note as string) || 'Dibatalkan oleh pengurus').trim();

    const updated = await db.transaction(async (tx) => {
      const rows = await tx.select().from(expenseTransactions).where(eq(expenseTransactions.id, id)).limit(1);
      const existing = rows[0];
      if (!existing) return null;

      const upd = await tx
        .update(expenseTransactions)
        .set({
          transactionStatus: 'cancelled',
          approvalNote: note,
          updatedAt: new Date(),
        })
        .where(eq(expenseTransactions.id, id))
        .returning();

      await logAudit(
        {
          userId: req.user!.id,
          userName: req.user!.fullName,
          userRole: req.user!.roleCode,
          action: 'CANCEL',
          module: 'expense',
          entityType: 'expense_transaction',
          entityId: id,
          transactionNumber: existing.transactionNumber,
          previousValue: existing,
          newValue: upd[0],
          ipAddress: req.ip || null,
        },
        tx,
      );

      return upd[0];
    });

    if (!updated) return res.status(404).json({ error: 'Pengeluaran tidak ditemukan.' });
    return res.json({ item: updated, message: 'Pengeluaran dibatalkan.' });
  } catch (err) {
    console.error('Cancel expense error:', err);
    return res.status(500).json({ error: 'Gagal membatalkan pengeluaran.' });
  }
});

// 6. Zakat Distributions (8 Asnaf, Strictly from zakat_fitrah or zakat_mal balance)
router.get('/zakat-distributions', async (_req, res) => {
  try {
    const rows = await db
      .select()
      .from(zakatDistributions)
      .orderBy(desc(zakatDistributions.distributionDate), desc(zakatDistributions.id));
    return res.json({ items: rows });
  } catch (err) {
    console.error('List zakat distributions error:', err);
    return res.status(500).json({ error: 'Gagal memuat riwayat penyaluran zakat.' });
  }
});

const distSchema = z.object({
  distributionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  zakatType: z.enum(['zakat_fitrah', 'zakat_mal']),
  asnafCategory: z.enum([
    'Fakir',
    'Miskin',
    'Amil',
    'Mualaf',
    'Riqab',
    'Gharim',
    'Fisabilillah',
    'Ibnu Sabil',
  ]),
  recipientName: z.string().min(2).max(120),
  recipientPhone: z.string().max(30).optional(),
  amount: z.coerce.number().positive().max(10000000000),
  description: z.string().min(3).max(500),
});

router.post('/zakat-distributions', uploadSingleFile.single('proof'), async (req: AuthRequest, res) => {
  try {
    const parsed = distSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Data penyaluran zakat tidak valid.' });
    }

    const { distributionDate, zakatType, asnafCategory, recipientName, recipientPhone, amount, description } =
      parsed.data;
    const proofUrl = req.file ? `/uploads/${req.file.filename}` : null;
    const txNumber = generateTxNumber('DST');

    const result = await db.transaction(async (tx) => {
      const balances = await getFundBalances(tx);
      const available =
        zakatType === 'zakat_fitrah' ? balances.zakatFitrah.balance : balances.zakatMal.balance;

      if (amount > available) {
        return {
          error: `Saldo ${
            zakatType === 'zakat_fitrah' ? 'Zakat Fitrah' : 'Zakat Mal'
          } tidak mencukupi (tersedia Rp ${available.toLocaleString('id-ID')}).`,
          status: 400 as const,
        };
      }

      const inserted = await tx
        .insert(zakatDistributions)
        .values({
          transactionNumber: txNumber,
          distributionDate,
          zakatType,
          asnafCategory,
          recipientName: recipientName.trim(),
          recipientPhone: recipientPhone?.trim() || null,
          amount: amount.toFixed(2),
          description: description.trim(),
          proofUrl,
          status: 'approved',
          createdBy: req.user!.id,
          approvedBy: req.user!.id,
        })
        .returning();

      await logAudit(
        {
          userId: req.user!.id,
          userName: req.user!.fullName,
          userRole: req.user!.roleCode,
          action: 'CREATE',
          module: 'zakat_distribution',
          entityType: 'zakat_distribution',
          entityId: inserted[0].id,
          transactionNumber: txNumber,
          newValue: inserted[0],
          ipAddress: req.ip || null,
        },
        tx,
      );

      return { item: inserted[0], status: 201 as const };
    });

    if ('error' in result) return res.status(result.status).json({ error: result.error });
    return res.status(201).json({ item: result.item, message: 'Penyaluran zakat berhasil dicatat.' });
  } catch (err) {
    console.error('Create zakat distribution error:', err);
    return res.status(500).json({ error: 'Gagal mencatat penyaluran zakat.' });
  }
});

// 7. Private Donors Directory (Admin Finance only)
router.get('/donors', async (_req, res) => {
  try {
    const donorList = await db.select().from(donors).orderBy(desc(donors.createdAt));
    const zakatHistory = await db
      .select()
      .from(zakatTransactions)
      .orderBy(desc(zakatTransactions.createdAt));

    return res.json({ donors: donorList, transactions: zakatHistory });
  } catch (err) {
    console.error('Donors error:', err);
    return res.status(500).json({ error: 'Gagal memuat data donatur.' });
  }
});

// 8. Financial Reports (Separated Cash Report vs Zakat Report)
router.get('/reports', async (req, res) => {
  try {
    const period = (req.query.period as string) || 'monthly';
    const startDateParam = (req.query.startDate as string) || '';
    const endDateParam = (req.query.endDate as string) || '';
    const categoryName = (req.query.categoryName as string) || '';

    const today = new Date();
    let startDate = startDateParam;
    let endDate = endDateParam;

    if (!startDate || !endDate) {
      const y = today.getFullYear();
      const m = today.getMonth() + 1;
      const d = today.getDate();
      const isoToday = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

      if (period === 'daily') {
        startDate = isoToday;
        endDate = isoToday;
      } else if (period === 'weekly') {
        const weekAgo = new Date(today.getTime() - 6 * 86400000);
        startDate = weekAgo.toISOString().slice(0, 10);
        endDate = isoToday;
      } else if (period === 'yearly') {
        startDate = `${y}-01-01`;
        endDate = `${y}-12-31`;
      } else {
        const mStr = String(m).padStart(2, '0');
        const lastDay = new Date(y, m, 0).getDate();
        startDate = `${y}-${mStr}-01`;
        endDate = `${y}-${mStr}-${String(lastDay).padStart(2, '0')}`;
      }
    }

    const settingsRows = await db.select().from(mosqueSettings).limit(1);
    const settings = settingsRows[0];
    const baseOpenCash = Number(settings?.initialCashBalance ?? 0);
    const baseOpenFitrah = Number(settings?.initialZakatFitrahBalance ?? 0);
    const baseOpenMal = Number(settings?.initialZakatMalBalance ?? 0);

    // Opening balance up to startDate (exclusive)
    const priorCashInc = await db
      .select({ total: sql<string>`COALESCE(SUM(${incomeTransactions.amount}), 0)` })
      .from(incomeTransactions)
      .where(
        and(
          eq(incomeTransactions.transactionStatus, 'verified'),
          eq(incomeTransactions.fundType, 'mosque_cash'),
          sql`${incomeTransactions.transactionDate} < ${startDate}`,
        ),
      );
    const priorCashExp = await db
      .select({ total: sql<string>`COALESCE(SUM(${expenseTransactions.amount}), 0)` })
      .from(expenseTransactions)
      .where(
        and(
          eq(expenseTransactions.transactionStatus, 'approved'),
          sql`${expenseTransactions.transactionDate} < ${startDate}`,
        ),
      );

    const openingCashBalance =
      baseOpenCash + Number(priorCashInc[0]?.total ?? 0) - Number(priorCashExp[0]?.total ?? 0);

    // Period Cash Income & Expense
    const cashIncConditions: any[] = [
      eq(incomeTransactions.transactionStatus, 'verified'),
      eq(incomeTransactions.fundType, 'mosque_cash'),
      gte(incomeTransactions.transactionDate, startDate),
      lte(incomeTransactions.transactionDate, endDate),
    ];
    if (categoryName) cashIncConditions.push(eq(incomeTransactions.categoryName, categoryName));

    const cashIncomeRows = await db
      .select()
      .from(incomeTransactions)
      .where(and(...cashIncConditions))
      .orderBy(incomeTransactions.transactionDate);

    const cashExpConditions: any[] = [
      eq(expenseTransactions.transactionStatus, 'approved'),
      gte(expenseTransactions.transactionDate, startDate),
      lte(expenseTransactions.transactionDate, endDate),
    ];
    if (categoryName) cashExpConditions.push(eq(expenseTransactions.categoryName, categoryName));

    const cashExpenseRows = await db
      .select()
      .from(expenseTransactions)
      .where(and(...cashExpConditions))
      .orderBy(expenseTransactions.transactionDate);

    const totalCashIncome = cashIncomeRows.reduce((s, r) => s + Number(r.amount), 0);
    const totalCashExpense = cashExpenseRows.reduce((s, r) => s + Number(r.amount), 0);
    const closingCashBalance = openingCashBalance + totalCashIncome - totalCashExpense;

    // Zakat Report (Fitrah + Mal + Distributions)
    const zakatIncomeRows = await db
      .select()
      .from(incomeTransactions)
      .where(
        and(
          eq(incomeTransactions.transactionStatus, 'verified'),
          sql`${incomeTransactions.fundType} IN ('zakat_fitrah', 'zakat_mal')`,
          gte(incomeTransactions.transactionDate, startDate),
          lte(incomeTransactions.transactionDate, endDate),
        ),
      )
      .orderBy(incomeTransactions.transactionDate);

    const zakatDistRows = await db
      .select()
      .from(zakatDistributions)
      .where(
        and(
          eq(zakatDistributions.status, 'approved'),
          gte(zakatDistributions.distributionDate, startDate),
          lte(zakatDistributions.distributionDate, endDate),
        ),
      )
      .orderBy(zakatDistributions.distributionDate);

    const fitrahCollected = zakatIncomeRows
      .filter((r) => r.fundType === 'zakat_fitrah')
      .reduce((s, r) => s + Number(r.amount), 0);
    const malCollected = zakatIncomeRows
      .filter((r) => r.fundType === 'zakat_mal')
      .reduce((s, r) => s + Number(r.amount), 0);
    const totalZakatDistributed = zakatDistRows.reduce((s, r) => s + Number(r.amount), 0);
    const overallBalances = await getFundBalances();

    return res.json({
      period: { period, startDate, endDate },
      mosqueName: settings?.mosqueName || 'MasjidKu',
      cashReport: {
        openingBalance: openingCashBalance,
        totalIncome: totalCashIncome,
        totalExpense: totalCashExpense,
        closingBalance: closingCashBalance,
        incomeTransactions: cashIncomeRows,
        expenseTransactions: cashExpenseRows,
      },
      zakatReport: {
        openingZakatBalance: baseOpenFitrah + baseOpenMal,
        fitrahCollected,
        malCollected,
        totalDistributed: totalZakatDistributed,
        remainingZakatBalance: overallBalances.totalZakatRemaining,
        incomeTransactions: zakatIncomeRows,
        distributions: zakatDistRows,
      },
    });
  } catch (err) {
    console.error('Financial report error:', err);
    return res.status(500).json({ error: 'Gagal menghasilkan laporan keuangan.' });
  }
});

// 9. Mosque Assets Management (Strictly separated from Cash & Zakat balances)
const assetSchema = z.object({
  assetName: z.string().min(2, 'Nama aset wajib diisi').max(150),
  category: z.enum([
    'Tanah & Bangunan',
    'Elektronik & Audio',
    'Perlengkapan Ibadah',
    'Kendaraan Operasional',
    'Furnitur & Sarana',
    'Lainnya',
  ]),
  quantity: z.coerce.number().int().min(1).max(1000000),
  unit: z.string().min(1).max(40).default('Unit'),
  acquisitionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal tidak valid (YYYY-MM-DD)'),
  acquisitionSource: z.string().min(2).max(100).default('Pembelian Kas Masjid'),
  conditionStatus: z.enum(['Baik', 'Perlu Perawatan', 'Rusak Ringan', 'Rusak Berat']).default('Baik'),
  nominalValue: z.coerce.number().min(0, 'Nominal aset tidak boleh negatif').max(1000000000000),
  location: z.string().min(1).max(150).default('Area Utama Masjid'),
  notes: z.string().max(1000).optional(),
  isActive: z.coerce.boolean().optional(),
});

router.get('/assets', async (req, res) => {
  try {
    const q = ((req.query.q as string) || '').trim();
    const category = ((req.query.category as string) || '').trim();
    const condition = ((req.query.condition as string) || '').trim();
    const includeInactive = req.query.includeInactive === 'true';

    const conditions: any[] = [];
    if (!includeInactive) conditions.push(eq(mosqueAssets.isActive, true));
    if (category) conditions.push(eq(mosqueAssets.category, category));
    if (condition) conditions.push(eq(mosqueAssets.conditionStatus, condition));
    if (q) {
      conditions.push(
        or(
          ilike(mosqueAssets.assetName, `%${q}%`),
          ilike(mosqueAssets.assetCode, `%${q}%`),
          ilike(mosqueAssets.location, `%${q}%`),
        ),
      );
    }

    const items = await db
      .select()
      .from(mosqueAssets)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(mosqueAssets.id));

    const balances = await getFundBalances();

    return res.json({
      items,
      summary: balances.mosqueAssets,
      mosqueCashBalance: balances.mosqueCash.balance,
    });
  } catch (err) {
    console.error('Get assets error:', err);
    return res.status(500).json({ error: 'Gagal memuat data aset masjid.' });
  }
});

router.post('/assets', uploadSingleFile.single('photo'), async (req: AuthRequest, res) => {
  try {
    const parsed = assetSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Data aset tidak valid.' });
    }

    const data = parsed.data;
    const assetCode = generateTxNumber('AST');
    const photoUrl = req.file ? `/uploads/${req.file.filename}` : null;

    const inserted = await db
      .insert(mosqueAssets)
      .values({
        assetCode,
        assetName: data.assetName.trim(),
        category: data.category,
        quantity: data.quantity,
        unit: data.unit.trim(),
        acquisitionDate: data.acquisitionDate,
        acquisitionSource: data.acquisitionSource.trim(),
        conditionStatus: data.conditionStatus,
        nominalValue: data.nominalValue.toFixed(2),
        location: data.location.trim(),
        notes: data.notes?.trim() || '',
        photoUrl,
        isActive: true,
        createdBy: req.user!.id,
      })
      .returning();

    await logAudit({
      userId: req.user!.id,
      userName: req.user!.fullName,
      userRole: req.user!.roleCode,
      action: 'CREATE',
      module: 'assets',
      entityType: 'mosque_asset',
      entityId: inserted[0].id,
      transactionNumber: assetCode,
      newValue: inserted[0],
      ipAddress: req.ip || null,
    });

    return res.status(201).json({
      item: inserted[0],
      message: 'Aset masjid berhasil dicatat (terpisah dari saldo Kas Masjid).',
    });
  } catch (err) {
    console.error('Create asset error:', err);
    return res.status(500).json({ error: 'Gagal menyimpan data aset masjid.' });
  }
});

router.put('/assets/:id', uploadSingleFile.single('photo'), async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: 'ID aset tidak valid.' });
    }

    const existingRows = await db.select().from(mosqueAssets).where(eq(mosqueAssets.id, id)).limit(1);
    const existing = existingRows[0];
    if (!existing) return res.status(404).json({ error: 'Data aset tidak ditemukan.' });

    const parsed = assetSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Data aset tidak valid.' });
    }

    const data = parsed.data;
    const photoUrl = req.file ? `/uploads/${req.file.filename}` : existing.photoUrl;

    const updated = await db
      .update(mosqueAssets)
      .set({
        assetName: data.assetName.trim(),
        category: data.category,
        quantity: data.quantity,
        unit: data.unit.trim(),
        acquisitionDate: data.acquisitionDate,
        acquisitionSource: data.acquisitionSource.trim(),
        conditionStatus: data.conditionStatus,
        nominalValue: data.nominalValue.toFixed(2),
        location: data.location.trim(),
        notes: data.notes?.trim() ?? existing.notes,
        photoUrl,
        isActive: data.isActive ?? existing.isActive,
        updatedAt: new Date(),
      })
      .where(eq(mosqueAssets.id, id))
      .returning();

    await logAudit({
      userId: req.user!.id,
      userName: req.user!.fullName,
      userRole: req.user!.roleCode,
      action: 'UPDATE',
      module: 'assets',
      entityType: 'mosque_asset',
      entityId: id,
      transactionNumber: existing.assetCode,
      previousValue: existing,
      newValue: updated[0],
      ipAddress: req.ip || null,
    });

    return res.json({ item: updated[0], message: 'Data aset masjid berhasil diperbarui.' });
  } catch (err) {
    console.error('Update asset error:', err);
    return res.status(500).json({ error: 'Gagal memperbarui data aset masjid.' });
  }
});

router.delete('/assets/:id', async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: 'ID aset tidak valid.' });
    }

    const existingRows = await db.select().from(mosqueAssets).where(eq(mosqueAssets.id, id)).limit(1);
    const existing = existingRows[0];
    if (!existing) return res.status(404).json({ error: 'Data aset tidak ditemukan.' });

    await db
      .update(mosqueAssets)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(mosqueAssets.id, id));

    await logAudit({
      userId: req.user!.id,
      userName: req.user!.fullName,
      userRole: req.user!.roleCode,
      action: 'DELETE',
      module: 'assets',
      entityType: 'mosque_asset',
      entityId: id,
      transactionNumber: existing.assetCode,
      previousValue: existing,
      ipAddress: req.ip || null,
    });

    return res.json({ message: 'Aset masjid berhasil dinonaktifkan dari daftar aktif.' });
  } catch (err) {
    console.error('Delete asset error:', err);
    return res.status(500).json({ error: 'Gagal menghapus data aset masjid.' });
  }
});

export default router;
