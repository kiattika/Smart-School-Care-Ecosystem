/**
 * รูปเซลฟี่เช็คอิน → ภาพย่อ JPEG (data URL) เล็กพอฝังในเอกสาร Firestore (จำกัด 1 MiB ต่อเอกสาร)
 * เดิมเก็บ data URL ของรูปเต็มจากกล้องมือถือ (หลาย MB) ซึ่งเขียนไม่ได้ — ย่อด้านยาวไม่เกิน MAX_EDGE
 */
export const SELFIE_MAX_EDGE = 240;
export const SELFIE_QUALITY = 0.6;
/** เพดานความยาว data URL (~100 KB) — เกินนี้ไม่แนบรูป (ดีกว่าทำให้เช็คอินทั้งรายการเขียนไม่ได้) */
export const SELFIE_MAX_DATA_URL_LENGTH = 140_000;

export function fitWithin(width: number, height: number, maxEdge: number): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= maxEdge || longest <= 0) return { width, height };
  const scale = maxEdge / longest;
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

export async function selfieThumbnailDataUrl(file: File): Promise<string | null> {
  if (!file.type.startsWith('image/')) return null;
  const url = URL.createObjectURL(file);
  try {
    const img: HTMLImageElement = await new Promise((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('โหลดรูปไม่สำเร็จ'));
      el.src = url;
    });
    const { width, height } = fitWithin(img.naturalWidth || img.width, img.naturalHeight || img.height, SELFIE_MAX_EDGE);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, width, height);
    const dataUrl = canvas.toDataURL('image/jpeg', SELFIE_QUALITY);
    return dataUrl.length <= SELFIE_MAX_DATA_URL_LENGTH ? dataUrl : null;
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}
