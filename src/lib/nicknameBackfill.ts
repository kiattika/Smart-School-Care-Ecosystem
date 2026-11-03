/** ชื่อเล่นจากแบบประเมินตนเองข้อ 2 → students.nickname (เติมเฉพาะนักเรียนที่ยังไม่มีชื่อเล่น) */
export function cleanNickname(raw: unknown): string {
  return typeof raw === 'string' ? raw.trim().slice(0, 30) : '';
}

export function planNicknameBackfill(
  assessments: Record<string, { basicInfo?: { nickname?: string } } | undefined>,
  students: { studentId: string; nickname?: string }[],
): { studentId: string; nickname: string }[] {
  const out: { studentId: string; nickname: string }[] = [];
  for (const s of students) {
    if (cleanNickname(s.nickname)) continue; // ไม่ทับชื่อเล่นที่มีอยู่แล้ว
    const nick = cleanNickname(assessments[s.studentId]?.basicInfo?.nickname);
    if (nick) out.push({ studentId: s.studentId, nickname: nick });
  }
  return out;
}
