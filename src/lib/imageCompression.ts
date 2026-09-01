/**
 * บีบอัด/ลดขนาดรูปภาพฝั่ง browser ก่อนอัปโหลดขึ้น Firebase Storage
 * (ไม่เพิ่ม npm package — ใช้ Canvas API ของ browser เอง)
 *
 * รูปใช้ประกอบเอกสารเยี่ยมบ้านเท่านั้น ไม่ต้องความละเอียดสูง:
 *  - ย่อด้านที่ยาวที่สุดไม่เกิน MAX_EDGE (1280px) คงสัดส่วนเดิม
 *  - บันทึกเป็น JPEG คุณภาพ QUALITY (0.72)
 *  - เป้าหมาย ~300-500KB ต่อรูป (จากกล้องมือถือ 3-8MB)
 */

const MAX_EDGE = 1280;
const QUALITY = 0.72;

export interface CompressedImage {
  blob: Blob;
  previewUrl: string;   // object URL สำหรับ preview (ต้อง URL.revokeObjectURL เองเมื่อเลิกใช้)
  width: number;
  height: number;
  bytesBefore: number;
  bytesAfter: number;
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('โหลดรูปไม่สำเร็จ')); };
    img.src = url;
  });
}

export async function compressImage(file: File): Promise<CompressedImage> {
  if (!file.type.startsWith('image/')) {
    throw new Error('ไฟล์ที่เลือกไม่ใช่รูปภาพ');
  }
  const img = await loadImage(file);

  let { width, height } = img;
  if (width > MAX_EDGE || height > MAX_EDGE) {
    const scale = MAX_EDGE / Math.max(width, height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('เบราว์เซอร์ไม่รองรับการประมวลผลรูปภาพ');
  ctx.drawImage(img, 0, 0, width, height);

  const blob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('บีบอัดรูปไม่สำเร็จ'))),
      'image/jpeg',
      QUALITY,
    );
  });

  return {
    blob,
    previewUrl: URL.createObjectURL(blob),
    width,
    height,
    bytesBefore: file.size,
    bytesAfter: blob.size,
  };
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
