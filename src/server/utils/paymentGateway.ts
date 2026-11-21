import crypto from 'crypto';
import { eq } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import {
  financialCategories,
  incomeTransactions,
  transactionApprovals,
  zakatTransactions,
} from '../../db/schema.ts';
import { logAudit } from './audit.ts';
import { generateTxNumber } from './finance.ts';

export function safeTimingCompare(a: string, b: string): boolean {
  if (!a || !b) return false;
  const ha = crypto.createHash('sha256').update(a, 'utf8').digest();
  const hb = crypto.createHash('sha256').update(b, 'utf8').digest();
  return crypto.timingSafeEqual(ha, hb);
}

export function verifyHmacSha256(rawBody: Buffer | string, signatureHeader: string, secret: string): boolean {
  if (!rawBody || !signatureHeader || !secret) return false;
  const normalizedSig = signatureHeader.replace(/^sha256=/i, '').trim().toLowerCase();
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex').toLowerCase();
  return safeTimingCompare(normalizedSig, expected);
}

export interface GatewayVerifyParams {
  transactionNumber: string;
  gatewayProvider: string;
  gatewayReferenceId?: string;
  gatewayStatus: string;
  paidAmount?: number;
  ipAddress?: string | null;
}

export async function autoVerifyZakatTransaction(params: GatewayVerifyParams) {
  const txNum = params.transactionNumber.trim().toUpperCase();
  const now = new Date();

  return db.transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(zakatTransactions)
      .where(eq(zakatTransactions.transactionNumber, txNum))
      .limit(1);

    const zakatTx = rows[0];
    if (!zakatTx) {
      return { ok: false as const, status: 404, error: 'Transaksi tidak ditemukan.' };
    }

    if (zakatTx.transactionStatus === 'verified') {
      return {
        ok: true as const,
        alreadyVerified: true,
        transaction: zakatTx,
      };
    }

    if (zakatTx.transactionStatus !== 'pending' && zakatTx.transactionStatus !== 'waiting_payment') {
      return {
        ok: false as const,
        status: 409,
        error: `Transaksi tidak dapat diverifikasi karena berstatus ${zakatTx.transactionStatus}.`,
      };
    }

    const expectedAmount = Number(zakatTx.amount);
    if (
      params.paidAmount !== undefined &&
      Number.isFinite(params.paidAmount) &&
      params.paidAmount < expectedAmount
    ) {
      return {
        ok: false as const,
        status: 400,
        error: `Nominal pembayaran dari gateway (${params.paidAmount}) kurang dari tagihan (${expectedAmount}).`,
      };
    }

    // Prevent duplicate ledger recording via sourceZakatId check + UNIQUE constraint
    const existingIncome = await tx
      .select()
      .from(incomeTransactions)
      .where(eq(incomeTransactions.sourceZakatId, zakatTx.id))
      .limit(1);

    let incomeId = existingIncome[0]?.id ?? null;
    if (!incomeId) {
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

      const todayIso = now.toISOString().slice(0, 10);
      const incNumber = generateTxNumber('INC');
      const refSuffix = params.gatewayReferenceId ? ` [Ref: ${params.gatewayReferenceId}]` : '';

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
          description: `Verifikasi otomatis ${params.gatewayProvider} ${catName} (${zakatTx.transactionNumber})${refSuffix}`,
          proofUrl: zakatTx.proofUrl,
          transactionStatus: 'verified',
          sourceType: 'zakat_payment',
          sourceZakatId: zakatTx.id,
          createdBy: null,
          approvedBy: null,
          approvedAt: now,
          approvalNote: `Diverifikasi otomatis via sinyal ${params.gatewayProvider} (${params.gatewayStatus})`,
        })
        .returning();

      incomeId = insertedIncome[0].id;
    }

    const updatedZakat = await tx
      .update(zakatTransactions)
      .set({
        transactionStatus: 'verified',
        verificationNote: `Terverifikasi otomatis via ${params.gatewayProvider}${params.gatewayReferenceId ? ` (Ref: ${params.gatewayReferenceId})` : ''}`,
        verifiedBy: null,
        verifiedAt: now,
        recordedIncomeId: incomeId,
        gatewayProvider: params.gatewayProvider,
        gatewayReferenceId: params.gatewayReferenceId || zakatTx.gatewayReferenceId || null,
        gatewayStatus: params.gatewayStatus,
        gatewayUpdatedAt: now,
        updatedAt: now,
      })
      .where(eq(zakatTransactions.id, zakatTx.id))
      .returning();

    await tx.insert(transactionApprovals).values({
      entityType: 'zakat',
      entityId: zakatTx.id,
      transactionNumber: zakatTx.transactionNumber,
      action: 'approved',
      note: `Verifikasi otomatis gateway ${params.gatewayProvider} (${params.gatewayStatus})`,
      actedBy: null,
      actedByName: `Payment Gateway (${params.gatewayProvider})`,
    });

    await logAudit(
      {
        userId: null,
        userName: `Payment Gateway (${params.gatewayProvider})`,
        userRole: 'system_gateway',
        action: 'VERIFY',
        module: 'payment_gateway_webhook',
        entityType: 'zakat_transaction',
        entityId: zakatTx.id,
        transactionNumber: zakatTx.transactionNumber,
        previousValue: zakatTx,
        newValue: updatedZakat[0],
        ipAddress: params.ipAddress || null,
      },
      tx,
    );

    return {
      ok: true as const,
      alreadyVerified: false,
      transaction: updatedZakat[0],
    };
  });
}

export async function syncGatewayStatusUpdate(params: {
  transactionNumber: string;
  gatewayProvider: string;
  gatewayReferenceId?: string;
  gatewayStatus: string;
}) {
  const txNum = params.transactionNumber.trim().toUpperCase();
  const now = new Date();
  await db
    .update(zakatTransactions)
    .set({
      gatewayProvider: params.gatewayProvider,
      gatewayReferenceId: params.gatewayReferenceId || undefined,
      gatewayStatus: params.gatewayStatus,
      gatewayUpdatedAt: now,
      updatedAt: now,
    })
    .where(eq(zakatTransactions.transactionNumber, txNum));
}

export interface GatewayPollResult {
  configured: boolean;
  provider: string | null;
  checked: boolean;
  verified: boolean;
  gatewayStatus: string | null;
}

/**
 * Polls configured payment gateway APIs (Midtrans or Xendit) using strict fixed hostnames
 * and server-side credentials from process.env (zero SSRF).
 */
export async function pollGatewayTransactionStatus(txNumber: string): Promise<GatewayPollResult> {
  const cleanTxNum = txNumber.trim().toUpperCase();
  const midtransKey = (process.env.MIDTRANS_SERVER_KEY || '').trim();
  const xenditKey = (process.env.XENDIT_SECRET_KEY || '').trim();

  if (midtransKey) {
    const isProd = process.env.MIDTRANS_IS_PRODUCTION === 'true';
    const baseUrl = isProd ? 'https://api.midtrans.com' : 'https://api.sandbox.midtrans.com';
    const url = `${baseUrl}/v2/${encodeURIComponent(cleanTxNum)}/status`;
    const auth = Buffer.from(`${midtransKey}:`).toString('base64');

    try {
      const resp = await fetch(url, {
        headers: {
          Accept: 'application/json',
          Authorization: `Basic ${auth}`,
        },
        signal: AbortSignal.timeout(6000),
      });

      if (resp.ok) {
        const data = (await resp.json()) as any;
        const txStatus = String(data?.transaction_status || '').toLowerCase();
        const fraudStatus = String(data?.fraud_status || 'accept').toLowerCase();
        const grossAmount = data?.gross_amount !== undefined ? Number(data.gross_amount) : undefined;
        const refId = data?.transaction_id ? String(data.transaction_id) : undefined;

        if (txStatus === 'settlement' || (txStatus === 'capture' && fraudStatus === 'accept')) {
          const verifiedRes = await autoVerifyZakatTransaction({
            transactionNumber: cleanTxNum,
            gatewayProvider: 'midtrans',
            gatewayReferenceId: refId,
            gatewayStatus: txStatus,
            paidAmount: grossAmount,
          });
          return {
            configured: true,
            provider: 'midtrans',
            checked: true,
            verified: verifiedRes.ok,
            gatewayStatus: txStatus,
          };
        }

        if (txStatus) {
          await syncGatewayStatusUpdate({
            transactionNumber: cleanTxNum,
            gatewayProvider: 'midtrans',
            gatewayReferenceId: refId,
            gatewayStatus: txStatus,
          });
        }

        return {
          configured: true,
          provider: 'midtrans',
          checked: true,
          verified: false,
          gatewayStatus: txStatus || null,
        };
      }
    } catch (err) {
      console.warn('Midtrans status poll error:', err);
    }
    return {
      configured: true,
      provider: 'midtrans',
      checked: false,
      verified: false,
      gatewayStatus: null,
    };
  }

  if (xenditKey) {
    const url = `https://api.xendit.co/v2/invoices?external_id=${encodeURIComponent(cleanTxNum)}`;
    const auth = Buffer.from(`${xenditKey}:`).toString('base64');

    try {
      const resp = await fetch(url, {
        headers: {
          Accept: 'application/json',
          Authorization: `Basic ${auth}`,
        },
        signal: AbortSignal.timeout(6000),
      });

      if (resp.ok) {
        const list = (await resp.json()) as any[];
        const invoice = Array.isArray(list) ? list[0] : null;
        if (invoice) {
          const invStatus = String(invoice.status || '').toUpperCase();
          const paidAmt =
            invoice.paid_amount !== undefined
              ? Number(invoice.paid_amount)
              : invoice.amount !== undefined
                ? Number(invoice.amount)
                : undefined;
          const refId = invoice.id ? String(invoice.id) : undefined;

          if (invStatus === 'PAID' || invStatus === 'SETTLED') {
            const verifiedRes = await autoVerifyZakatTransaction({
              transactionNumber: cleanTxNum,
              gatewayProvider: 'xendit',
              gatewayReferenceId: refId,
              gatewayStatus: invStatus,
              paidAmount: paidAmt,
            });
            return {
              configured: true,
              provider: 'xendit',
              checked: true,
              verified: verifiedRes.ok,
              gatewayStatus: invStatus,
            };
          }

          await syncGatewayStatusUpdate({
            transactionNumber: cleanTxNum,
            gatewayProvider: 'xendit',
            gatewayReferenceId: refId,
            gatewayStatus: invStatus,
          });

          return {
            configured: true,
            provider: 'xendit',
            checked: true,
            verified: false,
            gatewayStatus: invStatus,
          };
        }
      }
    } catch (err) {
      console.warn('Xendit status poll error:', err);
    }
    return {
      configured: true,
      provider: 'xendit',
      checked: false,
      verified: false,
      gatewayStatus: null,
    };
  }

  const webhookConfigured = Boolean((process.env.PAYMENT_GATEWAY_WEBHOOK_SECRET || '').trim());
  return {
    configured: webhookConfigured,
    provider: webhookConfigured ? 'webhook' : null,
    checked: false,
    verified: false,
    gatewayStatus: null,
  };
}
