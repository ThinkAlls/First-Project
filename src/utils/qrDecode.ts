import jsQR from 'jsqr';
import { detectQrPayloadType, type QrInspectionResult } from './qris.ts';

function decodeCanvasImage(img: HTMLImageElement): string | null {
  const maxDim = 1200;
  const scale = Math.min(1, maxDim / Math.max(img.naturalWidth || 1, img.naturalHeight || 1));
  const width = Math.max(1, Math.round((img.naturalWidth || 400) * scale));
  const height = Math.max(1, Math.round((img.naturalHeight || 400) * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);

  const imageData = ctx.getImageData(0, 0, width, height);
  const direct = jsQR(imageData.data, width, height, { inversionAttempts: 'attemptBoth' });
  if (direct?.data) return direct.data.trim();

  // Retry on center square crop in case the uploaded screenshot is a tall phone poster
  if (height > width * 1.15 || width > height * 1.15) {
    const side = Math.min(width, height);
    const sx = Math.round((width - side) / 2);
    const sy = Math.round((height - side) / 2);
    const cropData = ctx.getImageData(sx, sy, side, side);
    const cropped = jsQR(cropData.data, side, side, { inversionAttempts: 'attemptBoth' });
    if (cropped?.data) return cropped.data.trim();
  }

  return null;
}

export async function decodeQrFromFile(file: File): Promise<{
  decodedText: string | null;
  inspection: QrInspectionResult | null;
}> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Gagal membaca gambar QR.'));
      el.src = objectUrl;
    });
    const decodedText = decodeCanvasImage(img);
    if (!decodedText) {
      return { decodedText: null, inspection: null };
    }
    return {
      decodedText,
      inspection: detectQrPayloadType(decodedText),
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export async function decodeQrFromImageUrl(imageUrl: string): Promise<{
  decodedText: string | null;
  inspection: QrInspectionResult | null;
}> {
  if (!imageUrl) return { decodedText: null, inspection: null };
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.crossOrigin = 'anonymous';
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('Gagal memuat gambar QR dari server.'));
    el.src = imageUrl;
  });
  const decodedText = decodeCanvasImage(img);
  if (!decodedText) return { decodedText: null, inspection: null };
  return {
    decodedText,
    inspection: detectQrPayloadType(decodedText),
  };
}
