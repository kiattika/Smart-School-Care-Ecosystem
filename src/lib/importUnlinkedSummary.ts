/**
 * สรุปแถวตารางสอนที่ "จับคู่ครูไม่ได้" ก่อนยืนยันนำเข้า — นับเฉพาะแถวที่ผ่านการตรวจ (จะถูกเขียนจริง)
 * unlinkedTeacherName มีค่า และไม่มี matchedTeacherId = จะถูกบันทึกเป็น unlinkedTeacher* รอ admin ผูกเอง
 */
export interface UnlinkedSummaryRow {
  isValid: boolean;
  parsedData: { matchedTeacherId?: string | null; unlinkedTeacherName?: string | null; unlinkedTeacherEmail?: string | null };
}

export interface UnlinkedSummary {
  rowCount: number;
  teacherCount: number;
  /** ชื่อครูที่ไม่ถูกผูก (ไม่ซ้ำ) พร้อมอีเมลถ้ามี */
  teachers: string[];
}

export function summarizeUnlinkedTeachers(rows: UnlinkedSummaryRow[]): UnlinkedSummary {
  const teachers = new Set<string>();
  let rowCount = 0;
  for (const r of rows) {
    if (!r.isValid) continue;
    const name = r.parsedData?.unlinkedTeacherName;
    if (!name || r.parsedData.matchedTeacherId) continue;
    rowCount++;
    const email = r.parsedData.unlinkedTeacherEmail;
    teachers.add(email ? `${name} (${email})` : name);
  }
  return { rowCount, teacherCount: teachers.size, teachers: [...teachers] };
}
