export interface AnchorRect { top: number; bottom: number; left: number; right: number }
export interface Size { width: number; height: number }

/**
 * ตำแหน่งป๊อปอัป (position: fixed) ใต้/เหนือปุ่ม — เปิดลงล่างถ้าที่พอ ไม่พอและด้านบนมีที่มากกว่าให้เปิดขึ้นบน
 * บีบให้อยู่ในจอทั้งแนวนอน/แนวตั้ง (ไม่ถูกตัดขอบจอ) — ใช้กับ DatePicker ที่วาดผ่าน portal เพื่อไม่ถูก overflow ของกล่องแม่ตัด
 */
export function computePopupPosition(anchor: AnchorRect, popup: Size, viewport: Size, gap = 4, margin = 8): { top: number; left: number; placement: 'below' | 'above'; maxHeight: number } {
  const spaceBelow = viewport.height - anchor.bottom - gap - margin;
  const spaceAbove = anchor.top - gap - margin;
  const placement: 'below' | 'above' = popup.height <= spaceBelow || spaceBelow >= spaceAbove ? 'below' : 'above';
  const maxHeight = Math.max(160, placement === 'below' ? spaceBelow : spaceAbove);
  const h = Math.min(popup.height, maxHeight);
  const top = placement === 'below' ? anchor.bottom + gap : anchor.top - gap - h;
  const maxLeft = Math.max(margin, viewport.width - popup.width - margin);
  const left = Math.min(Math.max(margin, anchor.left), maxLeft);
  return { top: Math.max(margin, top), left, placement, maxHeight };
}
