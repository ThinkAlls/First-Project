import crypto from 'crypto';
import { Router, type Request } from 'express';
import { z } from 'zod';
import {
  autoVerifyZakatTransaction,
  safeTimingCompare,
  syncGatewayStatusUpdate,
  verifyHmacSha256,
} from '../utils/paymentGateway.ts';

interface RawBodyRequest extends Request {
  rawBody?: Buffer;
}

const router = Router();

// 1. Midtrans Webhook Handler
async function handleMidtransWebhook(req: RawBodyRequest, res: any) {
  const serverKey = (process.env.MIDTRANS_SERVER_KEY || '').trim();
  if (!serverKey) {
    return res.status(503).json({ error: 'MIDTRANS_SERVER_KEY belum dikonfigurasi di server.' });
  }

  const orderId = String(req.body?.order_id || '').trim();
  const statusCode = String(req.body?.status_code || '').trim();
  const grossAmount = String(req.body?.gross_amount || '').trim();
  const signatureKey = String(req.body?.signature_key || '').trim().toLowerCase();
  const txStatus = String(req.body?.transaction_status || '').toLowerCase();
  const fraudStatus = String(req.body?.fraud_status || 'accept').toLowerCase();
  const refId = req.body?.transaction_id ? String(req.body.transaction_id) : undefined;

  if (!orderId || !statusCode || !grossAmount || !signatureKey) {
    return res.status(400).json({ error: 'Payload webhook Midtrans tidak lengkap.' });
  }

  const expectedSig = crypto
    .createHash('sha512')
    .update(`${orderId}${statusCode}${grossAmount}${serverKey}`, 'utf8')
    .digest('hex')
    .toLowerCase();

  if (!safeTimingCompare(signatureKey, expectedSig)) {
    return res.status(401).json({ error: 'Signature Midtrans tidak valid.' });
  }

  if (txStatus === 'settlement' || (txStatus === 'capture' && fraudStatus === 'accept')) {
    const result = await autoVerifyZakatTransaction({
      transactionNumber: orderId,
      gatewayProvider: 'midtrans',
      gatewayReferenceId: refId,
      gatewayStatus: txStatus,
      paidAmount: Number(grossAmount),
      ipAddress: req.ip || null,
    });
    if (!result.ok) {
      return res.status(result.status).json({ error: result.error });
    }
    return res.json({
      received: true,
      transactionNumber: result.transaction.transactionNumber,
      transactionStatus: result.transaction.transactionStatus,
      alreadyVerified: result.alreadyVerified,
    });
  }

  await syncGatewayStatusUpdate({
    transactionNumber: orderId,
    gatewayProvider: 'midtrans',
    gatewayReferenceId: refId,
    gatewayStatus: txStatus || 'pending',
  });

  return res.json({ received: true, transactionStatus: 'pending', gatewayStatus: txStatus });
}

// 2. Xendit Webhook Handler
async function handleXenditWebhook(req: RawBodyRequest, res: any) {
  const callbackToken = (process.env.XENDIT_CALLBACK_TOKEN || '').trim();
  if (!callbackToken) {
    return res.status(503).json({ error: 'XENDIT_CALLBACK_TOKEN belum dikonfigurasi di server.' });
  }

  const headerToken = String(req.headers['x-callback-token'] || '').trim();
  if (!safeTimingCompare(headerToken, callbackToken)) {
    return res.status(401).json({ error: 'Callback token Xendit tidak valid.' });
  }

  const externalId = String(req.body?.external_id || '').trim();
  const invStatus = String(req.body?.status || '').toUpperCase();
  const refId = req.body?.id ? String(req.body.id) : undefined;
  const paidAmt =
    req.body?.paid_amount !== undefined
      ? Number(req.body.paid_amount)
      : req.body?.amount !== undefined
        ? Number(req.body.amount)
        : undefined;

  if (!externalId || !invStatus) {
    return res.status(400).json({ error: 'Payload webhook Xendit tidak lengkap.' });
  }

  if (invStatus === 'PAID' || invStatus === 'SETTLED') {
    const result = await autoVerifyZakatTransaction({
      transactionNumber: externalId,
      gatewayProvider: 'xendit',
      gatewayReferenceId: refId,
      gatewayStatus: invStatus,
      paidAmount: paidAmt,
      ipAddress: req.ip || null,
    });
    if (!result.ok) {
      return res.status(result.status).json({ error: result.error });
    }
    return res.json({
      received: true,
      transactionNumber: result.transaction.transactionNumber,
      transactionStatus: result.transaction.transactionStatus,
      alreadyVerified: result.alreadyVerified,
    });
  }

  await syncGatewayStatusUpdate({
    transactionNumber: externalId,
    gatewayProvider: 'xendit',
    gatewayReferenceId: refId,
    gatewayStatus: invStatus,
  });

  return res.json({ received: true, transactionStatus: 'pending', gatewayStatus: invStatus });
}

// 3. Generic / Signed Payment Gateway Webhook Handler (HMAC-SHA256 or Bearer secret)
const genericWebhookSchema = z.object({
  transactionNumber: z.string().trim().min(5).max(80),
  status: z.string().trim().min(2).max(40),
  amount: z.coerce.number().nonnegative().optional(),
  referenceId: z.string().trim().max(120).optional(),
  provider: z.string().trim().max(60).optional(),
});

async function handleGenericWebhook(req: RawBodyRequest, res: any) {
  const secret = (process.env.PAYMENT_GATEWAY_WEBHOOK_SECRET || '').trim();
  if (!secret) {
    return res.status(503).json({
      error: 'PAYMENT_GATEWAY_WEBHOOK_SECRET belum dikonfigurasi di server.',
    });
  }

  const sigHeader = String(req.headers['x-webhook-signature'] || '').trim();
  const authHeader = String(req.headers.authorization || '').trim();
  const bearerSecret = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

  const sigOk = sigHeader && req.rawBody ? verifyHmacSha256(req.rawBody, sigHeader, secret) : false;
  const bearerOk = bearerSecret ? safeTimingCompare(bearerSecret, secret) : false;

  if (!sigOk && !bearerOk) {
    return res.status(401).json({ error: 'Signature atau token webhook payment gateway tidak valid.' });
  }

  const parsed = genericWebhookSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Payload webhook tidak valid.' });
  }

  const { transactionNumber, status, amount, referenceId, provider } = parsed.data;
  const normalizedStatus = status.toUpperCase();
  const gatewayName = provider || 'payment_gateway';

  if (['PAID', 'SETTLED', 'SUCCESS', 'VERIFIED', 'SETTLEMENT'].includes(normalizedStatus)) {
    const result = await autoVerifyZakatTransaction({
      transactionNumber,
      gatewayProvider: gatewayName,
      gatewayReferenceId: referenceId,
      gatewayStatus: normalizedStatus,
      paidAmount: amount,
      ipAddress: req.ip || null,
    });
    if (!result.ok) {
      return res.status(result.status).json({ error: result.error });
    }
    return res.json({
      received: true,
      transactionNumber: result.transaction.transactionNumber,
      transactionStatus: result.transaction.transactionStatus,
      alreadyVerified: result.alreadyVerified,
    });
  }

  await syncGatewayStatusUpdate({
    transactionNumber,
    gatewayProvider: gatewayName,
    gatewayReferenceId: referenceId,
    gatewayStatus: normalizedStatus,
  });

  return res.json({
    received: true,
    transactionStatus: 'pending',
    gatewayStatus: normalizedStatus,
  });
}

router.post('/midtrans', handleMidtransWebhook);
router.post('/xendit', handleXenditWebhook);
router.post('/payment-gateway', async (req: RawBodyRequest, res) => {
  // Auto-detect Midtrans or Xendit format if sent to unified endpoint
  if (req.body?.signature_key && req.body?.order_id) {
    return handleMidtransWebhook(req, res);
  }
  if (req.headers['x-callback-token'] && req.body?.external_id) {
    return handleXenditWebhook(req, res);
  }
  return handleGenericWebhook(req, res);
});

export default router;
