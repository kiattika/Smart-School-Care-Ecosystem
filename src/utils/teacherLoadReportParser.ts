export type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

/**
 * normalizeEmail: ทำให้อีเมลเทียบกันได้จริง โดยลบอักขระที่มองไม่เห็นซึ่ง String.trim() ไม่ลบให้
 * (zero-width U+200B-200D, word joiner U+2060, BOM U+FEFF, no-break space U+00A0,
 *  U+180E, U+061C, directional marks U+200E/200F/202A-202E)
 * ไฟล์ Excel ที่ export จากระบบทะเบียน/HR มักมีอักขระพวกนี้แฝงในเซลล์อีเมล
 * ทำให้อีเมลจากไฟล์ไม่ === อีเมลจาก Firestore ทั้งที่ตาเห็นเหมือนกันทุกตัว
 */
export const INVISIBLE_CHARS_RE = new RegExp('[' + [0x200B,0x200C,0x200D,0x2060,0xFEFF,0x00A0,0x180E,0x061C,0x200E,0x200F,0x202A,0x202B,0x202C,0x202D,0x202E].map(c => String.fromCodePoint(c)).join('') + ']', 'g');

export function normalizeEmail(raw: string | undefined | null): string {
  if (raw === undefined || raw === null) return '';
  return String(raw).replace(INVISIBLE_CHARS_RE, '').trim().toLowerCase();
}

export interface ScheduleSlot {
  dayOfWeek: DayOfWeek;
  periodNumber: number;
}

export interface TeacherLoadCourseRow {
  id: string; // Row index or unique key
  department: string;
  teacherNo: string;
  teacherName: string;
  teacherEmail?: string;
  homeroom: string;
  courseSeq: string;
  subjectCode: string;
  subjectName: string;
  periodAndRoomRaw: string;
  scheduleRaw: string;
  level: string;
  periodSummary: number;
  expectedPeriodCount: number;
  extractedRoomCode: string;
  extractedRoomLabel: string;
  room: string;
  slots: ScheduleSlot[];
  subjectType: 'MAIN' | 'ACTIVITY';
  isValid: boolean;
  errors: string[];
  warnings: string[];
  matchedTeacherId?: string;
  matchedTeacherEmail?: string;
  unlinkedTeacherName?: string;
  unlinkedTeacherEmail?: string;
}

export interface GeneratedScheduleDocument {
  id: string; // e.g. sch_ค32201_943_tuesday_p2
  subjectCode: string;
  subjectName: string;
  room: string;
  level: string;
  credits: number;
  teacherIds: string[];
  teacherId?: string | null;
  teacherEmail?: string | null;
  unlinkedTeacherName: string | null;
  unlinkedTeacherEmail?: string | null;
  subjectType: 'MAIN' | 'ACTIVITY';
  dayOfWeek: DayOfWeek;
  periodNumber: number;
  sourceTeacherName: string;
  department: string;
}

/**
 * Thai day abbreviation dictionary.
 * Real school files use single-character 'ฤ' for Thursday!
 */
export const THAI_DAY_MAP: Record<string, DayOfWeek> = {
  'จ': 'monday',
  'อ': 'tuesday',
  'พ': 'wednesday',
  'ฤ': 'thursday',   // Single-character Thursday from actual school export
  'พฤ': 'thursday',  // Standard 2-character Thursday fallback
  'ศ': 'friday',
  'ส': 'saturday',
  'อา': 'sunday',
};

/**
 * Parses day-period strings such as "อ2, พ4, ฤ1, ศ3" or "อ3-4" or "จ0, อ0, พ0, ฤ0, ศ0"
 */
export function parseScheduleSlots(rawSchedule: string): { slots: ScheduleSlot[]; errors: string[] } {
  const slots: ScheduleSlot[] = [];
  const errors: string[] = [];

  if (!rawSchedule || rawSchedule.trim() === '' || rawSchedule.trim() === '-') {
    return { slots, errors };
  }

  // Split tokens by comma or semicolon or line breaks
  const tokens = rawSchedule
    .split(/[,;\n\r]+/)
    .map(t => t.trim())
    .filter(t => t.length > 0 && t !== '-');

  for (const token of tokens) {
    // Matches prefix: พฤ, อา, จ, อ, พ, ฤ, ศ, ส followed by non-negative integer or range (e.g. 3-4, 0, 10)
    const match = token.match(/^(พฤ|อา|จ|อ|พ|ฤ|ศ|ส)\s*(\d+)(?:\s*-\s*(\d+))?$/);

    if (!match) {
      errors.push(`ไม่สามารถแปลงข้อมูลวัน-คาบ: "${token}"`);
      continue;
    }

    const dayPrefix = match[1];
    const startPeriodStr = match[2];
    const endPeriodStr = match[3];

    const dayOfWeek = THAI_DAY_MAP[dayPrefix];
    if (!dayOfWeek) {
      errors.push(`ไม่พบวันประจำสัญลักษณ์ย่อ: "${dayPrefix}"`);
      continue;
    }

    const startPeriod = parseInt(startPeriodStr, 10);
    const endPeriod = endPeriodStr !== undefined ? parseInt(endPeriodStr, 10) : startPeriod;

    if (isNaN(startPeriod) || startPeriod < 0) {
      errors.push(`หมายเลขคาบไม่ถูกต้องใน "${token}"`);
      continue;
    }

    if (endPeriod < startPeriod) {
      errors.push(`ช่วงคาบเรียนไม่ถูกต้องใน "${token}" (${startPeriod}-${endPeriod})`);
      continue;
    }

    for (let p = startPeriod; p <= endPeriod; p++) {
      slots.push({
        dayOfWeek,
        periodNumber: p,
      });
    }
  }

  return { slots, errors };
}

/**
 * Parses "คาบ/ห้อง" column: e.g. "4 / [943] HR 5/8" or "4 / -" or "2 / [935] HR 5/9"
 */
export function parsePeriodAndRoom(raw: string): {
  expectedPeriodCount: number;
  extractedRoomCode: string;
  extractedRoomLabel: string;
  room: string;
} {
  if (!raw || raw.trim() === '' || raw.trim() === '-') {
    return {
      expectedPeriodCount: 0,
      extractedRoomCode: '',
      extractedRoomLabel: '',
      room: '',
    };
  }

  const parts = raw.split('/');
  const periodPart = parts[0].trim();
  const roomPart = parts.slice(1).join('/').trim();

  const expectedPeriodCount = parseInt(periodPart, 10) || 0;

  if (!roomPart || roomPart === '-') {
    return {
      expectedPeriodCount,
      extractedRoomCode: '',
      extractedRoomLabel: '',
      room: '',
    };
  }

  const bracketMatch = roomPart.match(/\[(.*?)\]/);
  const extractedRoomCode = bracketMatch ? bracketMatch[1].trim() : '';
  const extractedRoomLabel = roomPart.replace(/\[.*?\]/, '').trim();

  const finalRoom = extractedRoomCode || extractedRoomLabel || '';

  return {
    expectedPeriodCount,
    extractedRoomCode,
    extractedRoomLabel,
    room: finalRoom,
  };
}

/**
 * Checks if a subject is an Activity vs Academic Main course
 */
export function detectSubjectType(subjectName: string, subjectCode: string): 'MAIN' | 'ACTIVITY' {
  const cleanName = (subjectName || '').trim();
  const cleanCode = (subjectCode || '').toUpperCase().trim();

  if (
    cleanName.includes('(กิจกรรม)') ||
    /^กิจกรรม/.test(cleanName) ||          // รายงานจริงขึ้นต้นชื่อกิจกรรมด้วย "กิจกรรม..."
    cleanName.toLowerCase().includes('homeroom') ||
    cleanName.includes('โฮมรูม') ||
    cleanName.includes('PLC') ||
    cleanName.includes('ลูกเสือ') ||
    cleanName.includes('เนตรนารี') ||
    cleanName.includes('ยุวกาชาด') ||
    cleanName.includes('ผู้บำเพ็ญประโยชน์') ||
    cleanName.includes('รักษาดินแดน') ||
    cleanName.includes('แนะแนว') ||
    cleanName.includes('ชุมนุม') ||
    cleanName.includes('ชมรม') ||
    cleanName.includes('จิตอาสา') ||
    cleanName.includes('เพื่อสังคม') ||     // กิจกรรมเพื่อสังคมและสาธารณประโยชน์
    cleanName.includes('ลดเวลาเรียน') ||
    cleanName.includes('สาธารณประโยชน์') ||
    cleanCode === 'HR' ||
    cleanCode === 'CZ' ||
    cleanCode === 'PLC'
  ) {
    return 'ACTIVITY';
  }

  return 'MAIN';
}

/**
 * สร้างรหัสวิชาสำรองแบบ deterministic จากชื่อรายวิชา
 * ใช้เมื่อคอลัมน์ "รหัสวิชา" ในไฟล์เป็น "-" หรือว่าง (พบบ่อยในแถวกิจกรรมของรายงานจริง)
 * — ไม่ใช่การ fabricate identity ของคน แต่เป็น key ของ schedule document ที่ stable + traceable
 */
export function deriveSubjectCode(subjectName: string, subjectType: 'MAIN' | 'ACTIVITY'): string {
  const slug = (subjectName || '')
    .trim()
    .replace(/\(.*?\)/g, '')                 // ตัดวงเล็บ เช่น "(จิตอาสา)"
    .replace(/[^\p{L}\p{N}\p{M}]+/gu, '_')   // \p{M} = combining marks — จำเป็นสำหรับสระ/วรรณยุกต์ไทย
    .replace(/^_+|_+$/g, '')
    .slice(0, 60);
  return `${subjectType === 'ACTIVITY' ? 'ACT' : 'GEN'}_${slug || 'UNNAMED'}`;
}

/**
 * Matches a teacher by exact email against existing staff records.
 * ผูกด้วยอีเมลจริงเท่านั้น — ไม่มี special-case/alias ของบุคคลใดบุคคลหนึ่ง
 * (ถ้าอีเมลในไฟล์ไม่ตรงกับ staff ให้ปล่อยเป็น unlinked แล้วให้ admin ผูกเอง)
 */
export function matchTeacherByEmail(
  email: string,
  staffList: Array<{ id: string; email?: string; fullName?: string; displayName?: string }>
): { id: string; email: string } | undefined {
  const targetEmail = normalizeEmail(email);
  if (!targetEmail) return undefined;

  // normalize ทั้งสองฝั่ง — อีเมลจากไฟล์ Excel มักมีอักขระที่มองไม่เห็นแฝง (ดู normalizeEmail)
  const matches = staffList.filter(s => normalizeEmail(s.email) === targetEmail);
  if (matches.length === 0) return undefined;

  // seed/import อาจสร้าง staff ทั้ง doc key = UID จริง และ doc key = อีเมล (alias)
  // ต้องเลือก UID จริงเสมอ — teacherId ใน schedule ต้องเป็น Firebase Auth UID (ดู CLAUDE.md)
  const found = matches.find(s => !String(s.id).includes('@')) || matches[0];
  return { id: found.id, email: normalizeEmail(found.email) || targetEmail };
}

/**
 * Matches teacher name against existing staff records without fabricating IDs.
 * Matches by full name, first name, last name, display name, email prefix, etc.
 */
export function matchTeacherByName(
  teacherName: string,
  staffList: Array<{ id: string; fullName?: string; firstName?: string; lastName?: string; displayName?: string; email?: string; name?: string; prefix?: string }>
): { id: string; email?: string } | undefined {
  if (!teacherName || !teacherName.trim()) return undefined;

  const normalize = (str: string) =>
    str
      .toLowerCase()
      .replace(/^(mr\.|mrs\.|ms\.|miss|dr\.|นาย|นางสาว|นาง|ดร\.|ครู)\s*/i, '')
      .replace(/[\s\.\-_()\[\]]/g, '');

  const queryNorm = normalize(teacherName);
  if (!queryNorm) return undefined;

  for (const staff of staffList) {
    const idNorm = normalize(staff.id || '');
    const fullNorm = normalize(staff.fullName || '');
    const displayNorm = normalize(staff.displayName || '');
    const nameNorm = normalize(staff.name || '');
    const firstLastNorm = normalize(`${staff.firstName || ''}${staff.lastName || ''}`);
    const emailPrefixNorm = normalize((staff.email || '').split('@')[0]);

    if (
      queryNorm === idNorm ||
      queryNorm === fullNorm ||
      queryNorm === displayNorm ||
      queryNorm === nameNorm ||
      queryNorm === firstLastNorm ||
      (queryNorm.length > 2 && emailPrefixNorm === queryNorm) ||
      (fullNorm.length > 2 && (fullNorm.includes(queryNorm) || queryNorm.includes(fullNorm))) ||
      (displayNorm.length > 2 && (displayNorm.includes(queryNorm) || queryNorm.includes(displayNorm)))
    ) {
      return { id: staff.id, email: staff.email };
    }
  }

  return undefined;
}

/**
 * Detects whether the uploaded sheet/data is in the school's Teacher Load Report format
 */
export function isTeacherLoadReportFormat(rawRows: Record<string, any>[]): boolean {
  if (!rawRows || rawRows.length === 0) return false;

  const sampleRow = rawRows[0];
  const allKeys = Object.keys(sampleRow).map(k => k.trim().toLowerCase().replace(/[\s_\-\.\/]+/g, ''));

  // Key distinguishing column: "วัน-คาบที่สอน"
  const hasScheduleCol = allKeys.some(k => 
    k.includes('วันคาบที่สอน') || 
    k.includes('วันคาบ') || 
    k.includes('วันสอน')
  );

  const hasTeacherLoadCol = allKeys.some(k => 
    k.includes('กลุ่มสาระ') || 
    k.includes('สรุปคาบ') || 
    k.includes('คาบห้อง') ||
    k.includes('ลำดับวิชา')
  );

  return hasScheduleCol || (hasTeacherLoadCol && allKeys.length >= 5);
}

/**
 * Main parser function for Teacher Load Report ("รายงานภาระงานสอน")
 */
export function parseTeacherLoadReport(
  rawRows: Record<string, any>[],
  staffList: Array<{ id: string; fullName?: string; firstName?: string; lastName?: string; displayName?: string; email?: string; name?: string }> = []
): {
  courseRows: TeacherLoadCourseRow[];
  totalSlots: number;
} {
  const result: TeacherLoadCourseRow[] = [];

  let currentDept = '';
  let currentTeacherNo = '';
  let currentTeacherName = '';
  let currentTeacherEmail = '';
  let currentHomeroom = '';

  for (let idx = 0; idx < rawRows.length; idx++) {
    const raw = rawRows[idx];

    // Helper to get case-insensitive & whitespace-free fields
    const getVal = (candidates: string[]): string => {
      for (const cand of candidates) {
        const cleanCand = cand.toLowerCase().replace(/[\s_\-\.\/]+/g, '');
        for (const [k, v] of Object.entries(raw)) {
          const cleanK = k.toLowerCase().replace(/[\s_\-\.\/]+/g, '');
          if (cleanK === cleanCand && v !== undefined && v !== null && String(v).trim() !== '') {
            return String(v).trim();
          }
        }
      }
      return '';
    };

    const deptVal = getVal(['กลุ่มสาระ', 'กลุ่มสาระการเรียนรู้', 'department']);
    const teacherNoVal = getVal(['ที่', 'ลำดับ', 'no']);
    const teacherNameVal = getVal(['ชื่อ-สกุล', 'ชื่อสกุล', 'ชื่อนามสกุล', 'teachername', 'name']);
    const teacherEmailVal = getVal(['อีเมล์', 'อีเมล', 'email', 'e-mail', 'mail', 'teacheremail']);
    const homeroomVal = getVal(['ประจำชั้น', 'ครูประจำชั้น', 'homeroom']);

    // TASK 2: Forward-fill teacher identity & email
    if (deptVal) currentDept = deptVal;
    if (teacherNoVal) currentTeacherNo = teacherNoVal;
    if (teacherNameVal) currentTeacherName = teacherNameVal;
    if (teacherEmailVal) currentTeacherEmail = teacherEmailVal;
    if (homeroomVal) currentHomeroom = homeroomVal;

    const courseSeqVal = getVal(['ลำดับวิชา', 'ลำดับที่', 'seq']);
    const subjectCodeVal = getVal(['รหัสวิชา', 'รหัส', 'coursecode', 'subjectcode']);
    const subjectNameVal = getVal(['ชื่อรายวิชา', 'ชื่อวิชา', 'coursename', 'subjectname']);
    const periodAndRoomVal = getVal(['คาบ/ห้อง', 'คาบห้อง', 'periodandroom', 'ห้อง']);
    const scheduleVal = getVal(['วัน-คาบที่สอน', 'วันคาบที่สอน', 'ตารางสอน', 'schedule']);
    const levelVal = getVal(['ระดับ', 'ระดับชั้น', 'level', 'grade']);
    const periodSummaryVal = getVal(['สรุปคาบ', 'รวมคาบ', 'summary']);

    // TASK 3: Skip subtotal rows ("รวมคาบสอน") and empty-load rows ("- ไม่มีภาระงานสอน -")
    if (
      subjectCodeVal.includes('รวมคาบสอน') ||
      subjectNameVal.includes('รวมคาบสอน') ||
      subjectCodeVal.includes('รวมทั้งสิ้น') ||
      subjectNameVal.includes('รวมทั้งสิ้น') ||
      courseSeqVal.includes('รวม')
    ) {
      continue;
    }

    if (
      subjectNameVal.includes('ไม่มีภาระงานสอน') ||
      (subjectCodeVal === '-' && subjectNameVal.includes('ไม่มีภาระงานสอน')) ||
      (subjectCodeVal === '-' && scheduleVal === '-' && levelVal === '-')
    ) {
      continue;
    }

    // Skip empty dummy rows
    if (!subjectCodeVal && !subjectNameVal && !scheduleVal) {
      continue;
    }

    // TASK 4: Parse day/period slots
    const { slots, errors: slotErrors } = parseScheduleSlots(scheduleVal);

    // TASK 5: Parse คาบ/ห้อง
    const { expectedPeriodCount, extractedRoomCode, extractedRoomLabel, room } = parsePeriodAndRoom(periodAndRoomVal);

    // TASK 6: Detect activity
    const subjectType = detectSubjectType(subjectNameVal, subjectCodeVal);
    const hasName = !!subjectNameVal && subjectNameVal !== '-';

    // แถวกิจกรรมในรายงานจริงมักมี "รหัสวิชา" = "-" หรือว่าง แต่มีชื่อรายวิชา + วัน-คาบครบ
    // → สร้างรหัสสำรองจากชื่อ (deterministic) แทนที่จะทิ้งทั้งแถว
    const codeMissing = !subjectCodeVal || subjectCodeVal === '-';
    const subjectCode = (codeMissing && hasName)
      ? deriveSubjectCode(subjectNameVal, subjectType)
      : subjectCodeVal;

    const errors: string[] = [...slotErrors];
    const warnings: string[] = [];

    if (!subjectCode || subjectCode === '-') {
      errors.push('ขาดทั้งรหัสวิชาและชื่อรายวิชา');
    } else if (codeMissing) {
      warnings.push(`ℹ️ ไม่มีรหัสวิชาในไฟล์ — ใช้รหัสสำรอง "${subjectCode}" จากชื่อรายวิชา`);
    }

    if (!hasName) {
      errors.push('ขาดชื่อรายวิชา');
    }

    if (slots.length === 0) {
      errors.push('ไม่พบข้อมูลวัน-คาบที่สอนที่ถูกต้อง');
    }

    // TASK 5 Validation: Period count match verification
    if (expectedPeriodCount > 0 && slots.length > 0 && expectedPeriodCount !== slots.length) {
      warnings.push(`⚠️ จำนวนคาบที่ระบุ (${expectedPeriodCount} คาบ) ไม่ตรงกับวัน-คาบที่สอนที่แยกได้ (${slots.length} คาบ)`);
    }

    // TASK 8 & ISSUE 1: Match teacher by Email first, then fallback to Name matching without fabricating IDs
    const teacherName = currentTeacherName || 'ไม่ระบุครูผู้สอน';
    // normalize ตั้งแต่ต้นทาง — กันอักขระที่มองไม่เห็นจากไฟล์ Excel ไหลเข้า Firestore ต่อ
    const teacherEmail = normalizeEmail(currentTeacherEmail || teacherEmailVal || '');

    let matchedTeacherId: string | undefined = undefined;
    let matchedTeacherEmail: string | undefined = undefined;
    let unlinkedTeacherName: string | undefined = undefined;
    let unlinkedTeacherEmail: string | undefined = undefined;

    // 1. Primary: Match by email column if present
    if (teacherEmail) {
      const emailMatch = matchTeacherByEmail(teacherEmail, staffList);
      if (emailMatch) {
        matchedTeacherId = emailMatch.id;
        matchedTeacherEmail = emailMatch.email;
      }
    }

    // 2. Secondary fallback: Match by name if not matched by email
    if (!matchedTeacherId && teacherName && teacherName !== 'ไม่ระบุครูผู้สอน') {
      const nameMatch = matchTeacherByName(teacherName, staffList);
      if (nameMatch) {
        matchedTeacherId = nameMatch.id;
        matchedTeacherEmail = nameMatch.email;
      }
    }

    // 3. Safety behavior: if still unlinked, do not fabricate ID
    if (!matchedTeacherId) {
      unlinkedTeacherName = teacherName;
      unlinkedTeacherEmail = teacherEmail || undefined;
      if (teacherEmail) {
        warnings.push(`⚠️ ไม่พบบัญชีครูที่มีอีเมล "${teacherEmail}" (${teacherName}) ในระบบ กรุณาผูกข้อมูลหรือนำเข้ารายชื่อครูก่อน`);
      } else {
        warnings.push(`⚠️ ไม่พบครูชื่อ "${teacherName}" ในระบบ กรุณาเชื่อมข้อมูลด้วยตนเองหลังนำเข้า`);
      }
    }

    const periodSummaryNum = parseInt(periodSummaryVal, 10) || slots.length;

    result.push({
      id: String(idx + 1),
      department: currentDept,
      teacherNo: currentTeacherNo,
      teacherName,
      teacherEmail: teacherEmail || undefined,
      homeroom: currentHomeroom,
      courseSeq: courseSeqVal,
      subjectCode,
      subjectName: subjectNameVal,
      periodAndRoomRaw: periodAndRoomVal,
      scheduleRaw: scheduleVal,
      level: levelVal,
      periodSummary: periodSummaryNum,
      expectedPeriodCount,
      extractedRoomCode,
      extractedRoomLabel,
      room,
      slots,
      subjectType,
      isValid: errors.length === 0,
      errors,
      warnings,
      matchedTeacherId,
      matchedTeacherEmail,
      unlinkedTeacherName,
      unlinkedTeacherEmail,
    });
  }

  const totalSlots = result.reduce((sum, r) => sum + r.slots.length, 0);

  return {
    courseRows: result,
    totalSlots,
  };
}

/**
 * TASK 7: Generates Firestore schedule documents (1 document per parsed day/period slot)
 */
export function generateScheduleDocuments(
  courseRows: TeacherLoadCourseRow[]
): GeneratedScheduleDocument[] {
  const documents: GeneratedScheduleDocument[] = [];

  for (const row of courseRows) {
    if (!row.isValid || row.slots.length === 0) continue;

    const cleanRoom = (row.room || row.level || 'all').replace(/[^a-zA-Z0-9]/g, '_');

    for (const slot of row.slots) {
      const scheduleDocId = `sch_${row.subjectCode}_${cleanRoom}_${slot.dayOfWeek}_p${slot.periodNumber}`;

      documents.push({
        id: scheduleDocId,
        subjectCode: row.subjectCode,
        subjectName: row.subjectName,
        room: row.room || '',
        level: row.level || '',
        credits: 1.5,
        teacherIds: row.matchedTeacherId ? [row.matchedTeacherId] : [],
        teacherId: row.matchedTeacherId || null,
        teacherEmail: row.matchedTeacherEmail || row.teacherEmail || null,
        unlinkedTeacherName: row.matchedTeacherId ? null : (row.unlinkedTeacherName || row.teacherName || null),
        unlinkedTeacherEmail: row.matchedTeacherId ? null : (row.unlinkedTeacherEmail || row.teacherEmail || null),
        subjectType: row.subjectType,
        dayOfWeek: slot.dayOfWeek,
        periodNumber: slot.periodNumber,
        sourceTeacherName: row.teacherName,
        department: row.department,
      });
    }
  }

  return documents;
}
