import {
  GateAttendanceRecord,
  DetailedLeaveRequest,
  SemesterHealthRecord,
  ChronicIllness,
  AllergyRecord,
  SpecialCareNeed,
  InfirmaryVisit,
  TwoQuestionScreening,
  PHQ9Screening,
  SDQAssessment,
  GuardianBackground,
  HomeVisitLogRecord,
  EQFHardshipScreening,
  MeritDemeritRecord,
  PortfolioItem,
  DigitalCertificate,
  VolunteerHourRecord,
  ReportCardTerm,
  HomeworkAssignment,
  ExamScheduleItem,
  BillingInvoice,
  ParentTeacherMessage,
  ParentAppointment
} from '../types';

export const INITIAL_GATE_LOGS: GateAttendanceRecord[] = [
  {
    id: 'gate-log-01',
    studentId: '6950801',
    studentName: 'นายกิตติศักดิ์ เจริญสุข',
    type: 'ENTRY',
    timestamp: '07:28 น.',
    date: '2026-08-20',
    gateName: 'ประตู 1 (ประตูใหญ่หน้าโรงเรียน)',
    method: 'NFC_CARD',
    status: 'ON_TIME',
    temperature: 36.4,
    parentNotified: true
  },
  {
    id: 'gate-log-02',
    studentId: '6950802',
    studentName: 'นายณัฐวุฒิ สุขประเสริฐ',
    type: 'ENTRY',
    timestamp: '07:35 น.',
    date: '2026-08-20',
    gateName: 'ประตู 1 (ประตูใหญ่หน้าโรงเรียน)',
    method: 'BIOMETRIC_FACE',
    status: 'ON_TIME',
    temperature: 36.6,
    parentNotified: true
  },
  {
    id: 'gate-log-03',
    studentId: '6950803',
    studentName: 'นายธนกฤต มั่งคั่ง',
    type: 'ENTRY',
    timestamp: '07:58 น.',
    date: '2026-08-20',
    gateName: 'ประตู 2 (ฝั่งโรงอาหาร)',
    method: 'NFC_CARD',
    status: 'ON_TIME',
    temperature: 36.5,
    parentNotified: true
  },
  {
    id: 'gate-log-04',
    studentId: '6950804',
    studentName: 'นายพงศธร สมบูรณ์',
    type: 'ENTRY',
    timestamp: '08:12 น.',
    date: '2026-08-20',
    gateName: 'ประตู 1 (ประตูใหญ่หน้าโรงเรียน)',
    method: 'MANUAL',
    status: 'LATE',
    temperature: 36.7,
    parentNotified: true
  },
  {
    id: 'gate-log-05',
    studentId: '6950801',
    studentName: 'นายกิตติศักดิ์ เจริญสุข',
    type: 'EXIT',
    timestamp: '16:45 น.',
    date: '2026-08-19',
    gateName: 'ประตู 1 (ประตูใหญ่หน้าโรงเรียน)',
    method: 'NFC_CARD',
    status: 'NORMAL',
    parentNotified: true
  }
];

export const INITIAL_DETAILED_LEAVE_REQUESTS: DetailedLeaveRequest[] = [
  {
    id: 'leave-01',
    studentId: '6950801',
    leaveType: 'SICK',
    startDate: '2026-08-22',
    endDate: '2026-08-23',
    totalDays: 2,
    reason: 'มีไข้สูง 38.5°C และอาการไข้หวัดใหญ่ แพทย์แนะนำให้หยุดพักฟื้นที่บ้านเพื่อสังเกตอาการ',
    attachmentUrl: 'https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?auto=format&fit=crop&w=800&q=80',
    attachmentName: 'ใบรับรองแพทย์_รพ.อุตรดิตถ์.pdf',
    status: 'PENDING',
    submittedBy: 'คุณสมชาย เจริญสุข (ผู้ปกครอง)',
    submittedAt: '2026-08-20T07:15:00Z',
    teacherRemarks: 'รับทราบ รอผลการตรวจติดตามอาการเพิ่มเติม'
  },
  {
    id: 'leave-02',
    studentId: '6950802',
    leaveType: 'PERSONAL',
    startDate: '2026-08-15',
    endDate: '2026-08-15',
    totalDays: 1,
    reason: 'เดินทางไปร่วมพิธีทำบุญประจำปีของครอบครัวที่ต่างจังหวัด',
    status: 'APPROVED',
    submittedBy: 'คุณพิมพ์ใจ สุขประเสริฐ (ผู้ปกครอง)',
    submittedAt: '2026-08-14T08:30:00Z',
    teacherRemarks: 'อนุมัติเรียบร้อย ให้นักเรียนตามงานวิชาคณิตศาสตร์และเคมี',
    approvedBy: 'ครูกิตติศักดิ์ (ครูประจำชั้น)'
  },
  {
    id: 'leave-03',
    studentId: '6950805',
    leaveType: 'ACTIVITY',
    startDate: '2026-08-18',
    endDate: '2026-08-19',
    totalDays: 2,
    reason: 'เป็นตัวแทนโรงเรียนเข้าร่วมแข่งขันโครงงานคอมพิวเตอร์ระดับภูมิภาค',
    attachmentName: 'หนังสือขอตัวนักเรียนจากศูนย์โอลิมปิกวิชาการ.pdf',
    status: 'APPROVED',
    submittedBy: 'กลุ่มสาระวิทยาศาสตร์และเทคโนโลยี',
    submittedAt: '2026-08-16T10:00:00Z',
    teacherRemarks: 'อนุมัติเป็นกรณีพิเศษสำหรับการแข่งขันทางวิชาการ',
    approvedBy: 'นายวิชาญ (ผู้อำนวยการ)'
  }
];

export const INITIAL_SEMESTER_HEALTH_LOGS: Record<string, SemesterHealthRecord[]> = {
  '6950801': [
    {
      semester: '1/2567',
      height: 168,
      weight: 58,
      bmi: 20.5,
      bmiCategory: 'NORMAL',
      bloodType: 'O (Rh+)',
      systolicBp: 115,
      diastolicBp: 75,
      recordedAt: '2024-06-15'
    },
    {
      semester: '2/2567',
      height: 170,
      weight: 60,
      bmi: 20.8,
      bmiCategory: 'NORMAL',
      bloodType: 'O (Rh+)',
      systolicBp: 118,
      diastolicBp: 76,
      recordedAt: '2024-11-20'
    },
    {
      semester: '1/2568',
      height: 172,
      weight: 62,
      bmi: 21.0,
      bmiCategory: 'NORMAL',
      bloodType: 'O (Rh+)',
      systolicBp: 120,
      diastolicBp: 78,
      recordedAt: '2025-06-12'
    },
    {
      semester: '2/2568',
      height: 174,
      weight: 64,
      bmi: 21.1,
      bmiCategory: 'NORMAL',
      bloodType: 'O (Rh+)',
      systolicBp: 118,
      diastolicBp: 77,
      recordedAt: '2025-11-18'
    },
    {
      semester: '1/2569',
      height: 175,
      weight: 65,
      bmi: 21.2,
      bmiCategory: 'NORMAL',
      bloodType: 'O (Rh+)',
      systolicBp: 120,
      diastolicBp: 80,
      recordedAt: '2026-06-10'
    }
  ]
};

export const INITIAL_CHRONIC_ILLNESSES: Record<string, ChronicIllness[]> = {
  '6950801': [
    {
      id: 'ci-1',
      name: 'โรคหอบหืดจากสภาพอากาศเย็น (Allergic Asthma)',
      severity: 'MILD',
      treatmentCare: 'มียาพ่นฉุกเฉิน Ventolin พกติดตัวในกระเป๋านักเรียนเสมอ หลีกเลี่ยงฝุ่น PM 2.5'
    }
  ]
};

export const INITIAL_ALLERGIES: Record<string, AllergyRecord[]> = {
  '6950801': [
    {
      id: 'al-1',
      allergen: 'กุ้งและอาหารทะเลมีเปลือก (Shellfish)',
      type: 'FOOD',
      reaction: 'มีผื่นลมพิษขึ้นบริเวณใบหน้าและลำคอ คัน คลื่นไส้'
    },
    {
      id: 'al-2',
      allergen: 'ยาปฏิชีวนะกลุ่มเพนิซิลลิน (Penicillin)',
      type: 'DRUG',
      reaction: 'มีผื่นคัน แน่นหน้าอก'
    }
  ]
};

export const INITIAL_SPECIAL_CARE_NEEDS: Record<string, SpecialCareNeed[]> = {
  '6950801': [
    {
      id: 'scn-1',
      category: 'สายตาและการมองเห็น',
      description: 'สายตาสั้น 250 สวมแว่นสายตาตลอดเวลาที่เรียน',
      actionPlan: 'จัดที่นั่งแถวที่ 1-3 ตรงกลางห้องเรียน เพื่อให้เห็นกระดานชัดเจน'
    }
  ]
};

export const INITIAL_INFIRMARY_VISITS: InfirmaryVisit[] = [
  {
    id: 'inf-01',
    studentId: '6950801',
    visitTime: '2026-08-19 13:45 น.',
    symptoms: 'ปวดศีรษะ วิงเวียน มีไข้ 38.2°C หลังเรียนวิชาพละ',
    temperature: 38.2,
    treatment: 'เช็ดตัวลดไข้ ให้นอนพักผ่อนในห้องพยาบาล 1 คาบ',
    medicationGiven: 'Paracetamol 500mg 1 เม็ด',
    restDurationMinutes: 50,
    nurseName: 'พยาบาลวิไลลักษณ์ มโนรมย์',
    isUrgentAlert: true,
    parentAcknowledged: true,
    acknowledgedAt: '2026-08-19 14:10 น.'
  },
  {
    id: 'inf-02',
    studentId: '6950801',
    visitTime: '2026-07-28 10:20 น.',
    symptoms: 'แผลถลอกที่หัวเข่าด้านขวาจากการสะดุดล้มระหว่างเดินขึ้นบันได',
    temperature: 36.5,
    treatment: 'ล้างแผลด้วยน้ำเกลือ ทาเบตาดีน และปิดผ้าก๊อซสะอาด',
    medicationGiven: 'ไม่มี',
    restDurationMinutes: 15,
    nurseName: 'พยาบาลวิไลลักษณ์ มโนรมย์',
    isUrgentAlert: false,
    parentAcknowledged: true,
    acknowledgedAt: '2026-07-28 10:45 น.'
  }
];

export const INITIAL_2Q_SCREENINGS: Record<string, TwoQuestionScreening> = {
  '6950801': {
    id: '2q-01',
    studentId: '6950801',
    q1Depressed: false,
    q2Hopeless: false,
    isPositive: false,
    conductedAt: '2026-07-15'
  }
};

export const INITIAL_PHQ9_SCREENINGS: Record<string, PHQ9Screening> = {
  '6950801': {
    id: 'phq-01',
    studentId: '6950801',
    answers: [0, 1, 0, 0, 1, 0, 0, 0, 0],
    totalScore: 2,
    riskLevel: 'NORMAL',
    recommendation: 'สุขภาพจิตอยู่ในเกณฑ์ปกติ มีสภาวะอารมณ์ที่มั่นคง สามารถทำกิจกรรมการเรียนได้ดีตามมาตรฐาน',
    conductedAt: '2026-07-15'
  }
};

export const INITIAL_SDQ_ASSESSMENTS: SDQAssessment[] = [
  {
    id: 'sdq-student-01',
    studentId: '6950801',
    evaluatorType: 'STUDENT',
    evaluatorName: 'นายกิตติศักดิ์ เจริญสุข (นักเรียนประเมินตนเอง)',
    subscaleScores: {
      emotional: 2,
      conduct: 1,
      hyperactivity: 2,
      peerProblems: 1,
      prosocial: 9
    },
    totalDifficultiesScore: 6,
    triagingStatus: 'NORMAL',
    assessmentDate: '2026-07-10',
    recommendations: ['คะแนนปัญหาโดยรวมอยู่ในเกณฑ์ปกติ', 'จุดแข็งด้านสัมพันธภาพทางสังคม (Prosocial) อยู่ในเกณฑ์ดีเยี่ยม']
  },
  {
    id: 'sdq-teacher-01',
    studentId: '6950801',
    evaluatorType: 'TEACHER',
    evaluatorName: 'ครูกิตติศักดิ์ (ครูประจำชั้น ม.5/8)',
    subscaleScores: {
      emotional: 1,
      conduct: 0,
      hyperactivity: 2,
      peerProblems: 1,
      prosocial: 10
    },
    totalDifficultiesScore: 4,
    triagingStatus: 'NORMAL',
    assessmentDate: '2026-07-12',
    recommendations: ['นักเรียนมีความรับผิดชอบสูง ช่วยเหลือเพื่อนในชั้นเรียนสม่ำเสมอ']
  },
  {
    id: 'sdq-parent-01',
    studentId: '6950801',
    evaluatorType: 'PARENT',
    evaluatorName: 'นายสมชาย เจริญสุข (ผู้ปกครอง)',
    subscaleScores: {
      emotional: 2,
      conduct: 1,
      hyperactivity: 3,
      peerProblems: 1,
      prosocial: 9
    },
    totalDifficultiesScore: 7,
    triagingStatus: 'NORMAL',
    assessmentDate: '2026-07-14',
    recommendations: ['มีความสัมพันธ์ที่ดีกับคนในครอบครัว มีสมาธิในการอ่านหนังสือทบทวนบทเรียน']
  }
];

export const INITIAL_GUARDIAN_PROFILES: Record<string, GuardianBackground> = {
  '6950801': {
    relation: 'บิดา',
    fullName: 'นายสมชาย เจริญสุข',
    phone: '081-987-6543',
    lineId: 'somchai.j',
    occupation: 'ข้าราชการครู',
    monthlyIncome: 38000,
    maritalStatus: 'MARRIED_TOGETHER',
    householdMembersCount: 4,
    dependentsCount: 2,
    emergencyContact: {
      name: 'นางสมศรี เจริญสุข (มารดา)',
      phone: '089-123-4567',
      relationship: 'มารดา (พยาบาลวิชาชีพ)'
    }
  }
};

export const INITIAL_HOME_VISIT_LOGS: HomeVisitLogRecord[] = [
  {
    id: 'hv-01',
    studentId: '6950801',
    visitedDate: '2026-07-08',
    teacherName: 'ครูกิตติศักดิ์',
    counselorName: 'ครูแนะแนวพิมพ์ชนก',
    coordinates: [17.62514, 100.09315],
    addressText: '12/3 หมู่ 1 ต.ท่าเสา อ.เมือง จ.อุตรดิตถ์',
    livingConditions: 'บ้านเดี่ยวปูนสองชั้น สภาพแวดล้อมสงบ มีโต๊ะหนังสือและห้องอ่านหนังสือเป็นสัดส่วนชัดเจน',
    photos: [
      {
        url: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=800&q=80',
        caption: 'บริเวณหน้าบ้านและบรรยากาศโดยรอบ'
      },
      {
        url: 'https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd?auto=format&fit=crop&w=800&q=80',
        caption: 'โต๊ะทำงานและพื้นที่อ่านหนังสือของนักเรียน'
      }
    ],
    riskLevel: 'LOW',
    counselorNotes: 'ครอบครัวอบอุ่น ผู้ปกครองส่งเสริมการศึกษาอย่างเต็มที่ นักเรียนมีความพร้อมทั้งด้านอุปกรณ์และการสนับสนุนจากที่บ้าน',
    studentEnvironmentRating: 5
  }
];

export const INITIAL_EQF_SCREENINGS: Record<string, EQFHardshipScreening> = {
  '6950801': {
    id: 'eqf-01',
    studentId: '6950801',
    householdIncomePerCapita: 14500,
    electricityBillMonthly: 1200,
    housingConditionRating: 5,
    travelBarrierScore: 1,
    familyBurdenScore: 1,
    overallHardshipIndex: 12,
    isEligibleForGrant: false,
    grantType: 'กลุ่มทั่วไป (ไม่เข้าข่ายยากจนพิเศษ)',
    status: 'APPROVED',
    assessedDate: '2026-06-25'
  },
  '6950804': {
    id: 'eqf-04',
    studentId: '6950804',
    householdIncomePerCapita: 2100,
    electricityBillMonthly: 380,
    housingConditionRating: 2,
    travelBarrierScore: 4,
    familyBurdenScore: 4,
    overallHardshipIndex: 82,
    isEligibleForGrant: true,
    grantType: 'ทุนเสมอภาค (กสศ.) กลุ่มยากจนพิเศษ',
    status: 'APPROVED',
    assessedDate: '2026-06-25'
  }
};

export const INITIAL_MERIT_DEMERIT_LOGS: MeritDemeritRecord[] = [
  {
    id: 'md-01',
    studentId: '6950801',
    type: 'MERIT',
    points: 10,
    category: 'วิชาการและโครงงาน',
    description: 'ได้รับรางวัลเหรียญทอง การแข่งขันตอบปัญหาวิทยาศาสตร์ระดับเขตพื้นที่การศึกษา',
    teacherName: 'ครูกิตติศักดิ์',
    date: '2026-08-10',
    academicYear: '2569'
  },
  {
    id: 'md-02',
    studentId: '6950801',
    type: 'MERIT',
    points: 5,
    category: 'จิตอาสาและบำเพ็ญประโยชน์',
    description: 'ช่วยจัดนิทรรศการวิชาการและเป็นพี่เลี้ยงแนะนำรุ่นน้อง ม.1 ในวันปฐมนิเทศ',
    teacherName: 'ครูสมใจ',
    date: '2026-07-22',
    academicYear: '2569'
  },
  {
    id: 'md-03',
    studentId: '6950801',
    type: 'MERIT',
    points: 5,
    category: 'คุณธรรมและความซื่อสัตย์',
    description: 'เก็บกระเป๋าสตางค์พร้อมเงินสดส่งคืนครูฝ่ายกิจการนักเรียนเพื่อตามหาเจ้าของ',
    teacherName: 'ครูพิเชษฐ์ (ฝ่ายปกครอง)',
    date: '2026-06-30',
    academicYear: '2569'
  }
];

export const INITIAL_PORTFOLIO_ITEMS: PortfolioItem[] = [
  {
    id: 'port-01',
    studentId: '6950801',
    title: 'โครงงาน AI ระบบคัดกรองขยะอัจฉริยะด้วย Computer Vision',
    category: 'STEM',
    awardLevel: 'รางวัลชนะเลิศอันดับ 1 ระดับประเทศ',
    date: '2026-07-18',
    photos: [
      'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=800&q=80'
    ],
    description: 'พัฒนาแบบจำลอง AI ด้วย TensorFlow และ Raspberry Pi เพื่อจำแนกประเภทขยะรีไซเคิลแบบเรียลไทม์ พร้อมเชื่อมต่อแผงโซลาร์เซลล์พลังงานหมุนเวียน',
    skills: ['Python', 'TensorFlow', 'IoT / Embedded Systems', 'Hardware Design', 'Public Speaking'],
    isVerifiedByTeacher: true,
    teacherVerifier: 'ครูกิตติศักดิ์ (ที่ปรึกษาโครงงาน)'
  },
  {
    id: 'port-02',
    studentId: '6950801',
    title: 'ตัวแทนเยาวชนกล่าวสุนทรพจน์วันวิทยาศาสตร์แห่งชาติ',
    category: 'ACADEMIC',
    awardLevel: 'เหรียญทอง ระดับภาคเหนือ',
    date: '2026-06-28',
    photos: [
      'https://images.unsplash.com/photo-1475721027785-f74eccf877e2?auto=format&fit=crop&w=800&q=80'
    ],
    description: 'การนำเสนอสุนทรพจน์ในหัวข้อ "พลังงานสะอาดและเทคโนโลยีควอนตัมเพื่อการพัฒนาเมืองยั่งยืน" ต่อหน้าผู้ว่าราชการจังหวัดและคณาจารย์',
    skills: ['Science Communication', 'Critical Thinking', 'English Proficiency'],
    isVerifiedByTeacher: true,
    teacherVerifier: 'ครูสมใจ (กลุ่มสาระวิทยาศาสตร์)'
  },
  {
    id: 'port-03',
    studentId: '6950801',
    title: 'ประธานชมรมคอมพิวเตอร์และนวัตกรรมเพื่อชุมชน',
    category: 'LEADERSHIP',
    awardLevel: 'ผู้นำกิจกรรมดีเด่น',
    date: '2026-05-30',
    photos: [
      'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=800&q=80'
    ],
    description: 'จัดค่ายสอนเขียนโค้ดและวิทยาการคำนวณเบื้องต้นให้แก่นักเรียนโรงเรียนในชนบท จำนวน 60 คน',
    skills: ['Project Management', 'Team Leadership', 'Community Outreach'],
    isVerifiedByTeacher: true,
    teacherVerifier: 'ครูแนะแนวพิมพ์ชนก'
  }
];

export const INITIAL_DIGITAL_CERTIFICATES: DigitalCertificate[] = [
  {
    id: 'cert-01',
    studentId: '6950801',
    title: 'เกียรติบัตรรางวัลชนะเลิศ การแข่งขันหุ่นยนต์อัตโนมัติระดับชาติ',
    issuer: 'สำนักงานคณะกรรมการการศึกษาขั้นพื้นฐาน (สพฐ.)',
    issueDate: '2026-07-20',
    category: 'ACADEMIC',
    certificateUrl: 'https://images.unsplash.com/photo-1589330694653-ded6df03f754?auto=format&fit=crop&w=800&q=80',
    verificationStatus: 'VERIFIED_OFFICIAL',
    credentialId: 'OBEC-STEM-2026-984210'
  },
  {
    id: 'cert-02',
    studentId: '6950801',
    title: 'ผ่านการอบรมหลักสูตร Python for Data Science & AI',
    issuer: 'Chulalongkorn University MOOC',
    issueDate: '2026-05-15',
    category: 'EXTERNAL',
    certificateUrl: 'https://images.unsplash.com/photo-1606326608606-aa0b62935f2b?auto=format&fit=crop&w=800&q=80',
    verificationStatus: 'VERIFIED_EXTERNAL',
    credentialId: 'CU-MOOC-PYAI-883921'
  },
  {
    id: 'cert-03',
    studentId: '6950801',
    title: 'เกียรติบัตรผู้บำเพ็ญประโยชน์และจิตอาสาดีเด่น ประจำปี ๒๕๖๘',
    issuer: 'โรงเรียนอุตรดิตถ์',
    issueDate: '2026-03-31',
    category: 'VOLUNTEER',
    certificateUrl: 'https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=800&q=80',
    verificationStatus: 'VERIFIED_OFFICIAL',
    credentialId: 'UTD-VOL-2568-0042'
  }
];

export const INITIAL_VOLUNTEER_RECORDS: VolunteerHourRecord[] = [
  {
    id: 'vol-01',
    studentId: '6950801',
    activityName: 'กิจกรรมสอนการบ้านและเสริมทักษะวิทยาการคำนวณน้องประถม',
    hours: 15,
    organization: 'มูลนิธิเพื่อการศึกษาเด็กในชนบทอุตรดิตถ์',
    date: '2026-07-25',
    status: 'APPROVED',
    verifierTeacher: 'ครูกิตติศักดิ์'
  },
  {
    id: 'vol-02',
    studentId: '6950801',
    activityName: 'ร่วมปลูกป่าชุมชนและสร้างฝายชะลอน้ำเฉลิมพระเกียรติ',
    hours: 12,
    organization: 'อุทยานแห่งชาติคลองตรอน',
    date: '2026-06-18',
    status: 'APPROVED',
    verifierTeacher: 'ครูสมใจ'
  },
  {
    id: 'vol-03',
    studentId: '6950801',
    activityName: 'จิตอาสาคัดแยกขยะและดูแลความสะอาดงานสัปดาห์วิทยาศาสตร์',
    hours: 8,
    organization: 'กลุ่มงานกิจการนักเรียน โรงเรียนอุตรดิตถ์',
    date: '2026-08-18',
    status: 'APPROVED',
    verifierTeacher: 'ครูพิเชษฐ์'
  },
  {
    id: 'vol-04',
    studentId: '6950801',
    activityName: 'พี่เลี้ยงจัดค่ายดาราศาสตร์และดูดาวสัญจร',
    hours: 10,
    organization: 'หอดูดาวเฉลิมพระเกียรติฯ พิษณุโลก',
    date: '2026-08-10',
    status: 'APPROVED',
    verifierTeacher: 'ครูกิตติศักดิ์'
  }
];

export const INITIAL_REPORT_CARDS: Record<string, ReportCardTerm[]> = {
  '6950801': [
    {
      term: '1/2568',
      year: '2568',
      gpa: 3.92,
      gpax: 3.92,
      creditsEarned: 15.5,
      totalCredits: 15.5,
      subjects: [
        { code: 'ค31101', name: 'คณิตศาสตร์พื้นฐาน 1', credit: 1.5, preMidterm: 28, midterm: 19, postMidterm: 29, final: 19, totalScore: 95, grade: '4.0', evaluation: 'ผ่านเกณฑ์ดีเยี่ยม' },
        { code: 'ค31201', name: 'คณิตศาสตร์เพิ่มเติม 1', credit: 2.0, preMidterm: 27, midterm: 18, postMidterm: 28, final: 19, totalScore: 92, grade: '4.0', evaluation: 'ผ่านเกณฑ์ดีเยี่ยม' },
        { code: 'ว31101', name: 'วิทยาศาสตร์กายภาพ (ฟิสิกส์)', credit: 1.5, preMidterm: 26, midterm: 19, postMidterm: 27, final: 18, totalScore: 90, grade: '4.0', evaluation: 'ผ่านเกณฑ์ดีเยี่ยม' },
        { code: 'ว31281', name: 'วิทยาการคำนวณและ AI', credit: 1.5, preMidterm: 30, midterm: 20, postMidterm: 30, final: 20, totalScore: 100, grade: '4.0', evaluation: 'ผ่านเกณฑ์ดีเยี่ยม' },
        { code: 'ท31101', name: 'ภาษาไทยพื้นฐาน 1', credit: 1.0, preMidterm: 25, midterm: 16, postMidterm: 26, final: 17, totalScore: 84, grade: '4.0', evaluation: 'ผ่านเกณฑ์ดีเยี่ยม' },
        { code: 'อ31101', name: 'ภาษาอังกฤษพื้นฐาน 1', credit: 1.0, preMidterm: 24, midterm: 17, postMidterm: 25, final: 16, totalScore: 82, grade: '4.0', evaluation: 'ผ่านเกณฑ์ดีเยี่ยม' },
        { code: 'ส31101', name: 'สังคมศึกษา 1', credit: 1.0, preMidterm: 23, midterm: 15, postMidterm: 24, final: 16, totalScore: 78, grade: '3.5', evaluation: 'ผ่านเกณฑ์ดีเยี่ยม' }
      ]
    },
    {
      term: '2/2568',
      year: '2568',
      gpa: 3.95,
      gpax: 3.935,
      creditsEarned: 16.0,
      totalCredits: 16.0,
      subjects: [
        { code: 'ค31102', name: 'คณิตศาสตร์พื้นฐาน 2', credit: 1.5, preMidterm: 29, midterm: 20, postMidterm: 29, final: 20, totalScore: 98, grade: '4.0', evaluation: 'ผ่านเกณฑ์ดีเยี่ยม' },
        { code: 'ค31202', name: 'คณิตศาสตร์เพิ่มเติม 2', credit: 2.0, preMidterm: 28, midterm: 19, postMidterm: 28, final: 19, totalScore: 94, grade: '4.0', evaluation: 'ผ่านเกณฑ์ดีเยี่ยม' },
        { code: 'ว31201', name: 'ฟิสิกส์ 1', credit: 2.0, preMidterm: 28, midterm: 18, postMidterm: 28, final: 18, totalScore: 92, grade: '4.0', evaluation: 'ผ่านเกณฑ์ดีเยี่ยม' },
        { code: 'ว31221', name: 'เคมี 1', credit: 1.5, preMidterm: 26, midterm: 17, postMidterm: 27, final: 18, totalScore: 88, grade: '4.0', evaluation: 'ผ่านเกณฑ์ดีเยี่ยม' },
        { code: 'อ31102', name: 'ภาษาอังกฤษพื้นฐาน 2', credit: 1.0, preMidterm: 26, midterm: 18, postMidterm: 26, final: 18, totalScore: 88, grade: '4.0', evaluation: 'ผ่านเกณฑ์ดีเยี่ยม' },
        { code: 'ท31102', name: 'ภาษาไทยพื้นฐาน 2', credit: 1.0, preMidterm: 25, midterm: 17, postMidterm: 25, final: 17, totalScore: 84, grade: '4.0', evaluation: 'ผ่านเกณฑ์ดีเยี่ยม' }
      ]
    },
    {
      term: '1/2569',
      year: '2569',
      gpa: 3.96,
      gpax: 3.943,
      creditsEarned: 16.5,
      totalCredits: 16.5,
      subjects: [
        { code: 'ค32101', name: 'คณิตศาสตร์พื้นฐาน 3', credit: 1.5, preMidterm: 29, midterm: 19, postMidterm: 29, final: 20, totalScore: 97, grade: '4.0', evaluation: 'ผ่านเกณฑ์ดีเยี่ยม' },
        { code: 'ค32201', name: 'คณิตศาสตร์เพิ่มเติม 3', credit: 2.0, preMidterm: 28, midterm: 19, postMidterm: 29, final: 19, totalScore: 95, grade: '4.0', evaluation: 'ผ่านเกณฑ์ดีเยี่ยม' },
        { code: 'ว32202', name: 'ฟิสิกส์ 2 (คลื่นและแสง)', credit: 2.0, preMidterm: 27, midterm: 18, postMidterm: 28, final: 18, totalScore: 91, grade: '4.0', evaluation: 'ผ่านเกณฑ์ดีเยี่ยม' },
        { code: 'ว32222', name: 'เคมี 2 (สารละลายและจลนพลศาสตร์)', credit: 1.5, preMidterm: 28, midterm: 19, postMidterm: 27, final: 18, totalScore: 92, grade: '4.0', evaluation: 'ผ่านเกณฑ์ดีเยี่ยม' },
        { code: 'ว32242', name: 'ชีววิทยา 2', credit: 1.5, preMidterm: 26, midterm: 17, postMidterm: 27, final: 17, totalScore: 87, grade: '4.0', evaluation: 'ผ่านเกณฑ์ดีเยี่ยม' },
        { code: 'อ32101', name: 'ภาษาอังกฤษเพื่อการสื่อสาร', credit: 1.0, preMidterm: 27, midterm: 18, postMidterm: 27, final: 18, totalScore: 90, grade: '4.0', evaluation: 'ผ่านเกณฑ์ดีเยี่ยม' }
      ]
    }
  ]
};

export const INITIAL_HOMEWORK_ASSIGNMENTS: HomeworkAssignment[] = [
  {
    id: 'hw-01',
    courseCode: 'ค32201',
    courseName: 'คณิตศาสตร์เพิ่มเติม',
    title: 'แบบฝึกหัดเรื่องเมทริกซ์และดีเทอร์มิแนนต์ (Matrix & Determinants)',
    description: 'ทำแบบฝึกหัดข้อ 1-15 ในหนังสือเรียนหน้า 88-92 พร้อมแสดงวิธีทำอย่างละเอียดในสมุดและสแกนส่ง',
    dueDate: '2026-08-23 23:59 น.',
    assignedDate: '2026-08-18',
    maxScore: 10,
    status: 'SUBMITTED',
    submittedFile: 'การบ้านเมทริกซ์_กิตติศักดิ์_6950801.pdf',
    submittedAt: '2026-08-19 20:30 น.',
    scoreReceived: 10,
    teacherFeedback: 'แสดงวิธีหาอินเวอร์สการคูณได้ถูกต้องเรียบร้อยมาก'
  },
  {
    id: 'hw-02',
    courseCode: 'ว32202',
    courseName: 'ฟิสิกส์ 2 (คลื่นและแสง)',
    title: 'รายงานการทดลองการแทรกสอดและการเลี้ยวเบนของแสงเลเซอร์',
    description: 'สรุปผลการทดลองในห้องปฏิบัติการ คำนวณความยาวคลื่นแสงเลเซอร์ พร้อมวิเคราะห์ข้อผิดพลาดของการทดลอง',
    dueDate: '2026-08-25 16:30 น.',
    assignedDate: '2026-08-19',
    maxScore: 20,
    status: 'ASSIGNED'
  },
  {
    id: 'hw-03',
    courseCode: 'อ32101',
    courseName: 'ภาษาอังกฤษเพื่อการสื่อสาร',
    title: 'Essay Writing: Technological Impact on Climate Change',
    description: 'Write a 350-word persuasive essay discussing modern technological solutions to environmental crises.',
    dueDate: '2026-08-28 23:59 น.',
    assignedDate: '2026-08-20',
    maxScore: 15,
    status: 'ASSIGNED'
  }
];

export const INITIAL_EXAM_SCHEDULES: ExamScheduleItem[] = [
  {
    id: 'exam-01',
    subjectCode: 'ค32201',
    subjectName: 'คณิตศาสตร์เพิ่มเติม (กลางภาค 1/2569)',
    examType: 'MIDTERM',
    date: 'วันอังคารที่ 8 กันยายน 2569',
    time: '08:30 - 10:30 น. (120 นาที)',
    room: 'อาคาร 4 ชั้น 3 ห้อง 432',
    seatNumber: 'โต๊ะที่ 14 (แถว C)'
  },
  {
    id: 'exam-02',
    subjectCode: 'ว32202',
    subjectName: 'ฟิสิกส์ 2 (กลางภาค 1/2569)',
    examType: 'MIDTERM',
    date: 'วันพุธที่ 9 กันยายน 2569',
    time: '08:30 - 10:00 น. (90 นาที)',
    room: 'อาคาร 4 ชั้น 3 ห้อง 432',
    seatNumber: 'โต๊ะที่ 14 (แถว C)'
  },
  {
    id: 'exam-03',
    subjectCode: 'ว32222',
    subjectName: 'เคมี 2 (กลางภาค 1/2569)',
    examType: 'MIDTERM',
    date: 'วันพุธที่ 9 กันยายน 2569',
    time: '10:30 - 12:00 น. (90 นาที)',
    room: 'อาคาร 4 ชั้น 3 ห้อง 432',
    seatNumber: 'โต๊ะที่ 14 (แถว C)'
  },
  {
    id: 'exam-04',
    subjectCode: 'อ32101',
    subjectName: 'ภาษาอังกฤษเพื่อการสื่อสาร (กลางภาค 1/2569)',
    examType: 'MIDTERM',
    date: 'วันพฤหัสบดีที่ 10 กันยายน 2569',
    time: '13:00 - 14:30 น. (90 นาที)',
    room: 'อาคาร 4 ชั้น 3 ห้อง 432',
    seatNumber: 'โต๊ะที่ 14 (แถว C)'
  }
];

export const INITIAL_BILLING_INVOICES: BillingInvoice[] = [
  {
    id: 'inv-01',
    studentId: '6950801',
    invoiceNo: 'INV-2569-1-0492',
    title: 'ใบแจ้งยอดค่าบำรุงการศึกษาและบริการ ภาคเรียนที่ 1/2569',
    items: [
      { description: 'เงินบำรุงการศึกษาโครงการจัดการเรียนการสอนห้องเรียนพิเศษ (SMTE)', amount: 2000 },
      { description: 'ค่าประกันอุบัติเหตุหมู่นักเรียนประจำปีการศึกษา', amount: 350 },
      { description: 'ค่าบำรุงระบบอินเทอร์เน็ตความเร็วสูงและการเรียนการสอนออนไลน์', amount: 400 },
      { description: 'ค่าตรวจสุขภาพและตรวจสารชีวเคมีประจำปี', amount: 250 }
    ],
    totalAmount: 3000,
    dueDate: '2026-08-31',
    status: 'UNPAID',
    promptPayQr: 'https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=00020101021229370016A000000677010111011300668198765435802TH530376454073000.006304D1B8'
  },
  {
    id: 'inv-02',
    studentId: '6950801',
    invoiceNo: 'INV-2568-2-0881',
    title: 'ใบแจ้งยอดค่ากิจกรรมทัศนศึกษาและการเรียนรู้นอกสถานที่ ภาคเรียนที่ 2/2568',
    items: [
      { description: 'ค่าพาหนะและกิจกรรมศึกษาดูงานศูนย์วิทยาศาสตร์และเทคโนโลยีแห่งชาติ', amount: 1200 },
      { description: 'ค่าอาหารและเครื่องดื่ม', amount: 600 }
    ],
    totalAmount: 1800,
    dueDate: '2025-12-15',
    status: 'PAID',
    promptPayQr: 'https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=00020101021229370016A000000677010111011300668198765435802TH530376454071800.006304A4C2',
    paidAt: '2025-12-10 14:22 น.',
    receiptNo: 'REC-2568-09148'
  }
];

export const INITIAL_PARENT_TEACHER_MESSAGES: ParentTeacherMessage[] = [
  {
    id: 'msg-01',
    studentId: '6950801',
    senderRole: 'TEACHER',
    senderName: 'ครูกิตติศักดิ์ (ครูประจำชั้น ม.5/8)',
    message: 'สวัสดีครับคุณพ่อคุณแม่น้องกิตติศักดิ์ ขอแจ้งผลการประเมินโครงงาน AI ชนะเลิศระดับประเทศ และสถิติการเรียนของน้องยอดเยี่ยมมากครับ',
    timestamp: '2026-08-18 16:30 น.',
    read: true
  },
  {
    id: 'msg-02',
    studentId: '6950801',
    senderRole: 'PARENT',
    senderName: 'นายสมชาย เจริญสุข (ผู้ปกครอง)',
    message: 'ขอบพระคุณอาจารย์กิตติศักดิ์และทางโรงเรียนมากๆ ครับที่คอยชี้แนะและผลักดันน้องอย่างเต็มที่ครับ',
    timestamp: '2026-08-18 16:45 น.',
    read: true
  },
  {
    id: 'msg-03',
    studentId: '6950801',
    senderRole: 'TEACHER',
    senderName: 'ครูแนะแนวพิมพ์ชนก',
    message: 'น้องมีเป้าหมายเข้าศึกษาต่อคณะวิศวกรรมคอมพิวเตอร์ จุฬาลงกรณ์มหาวิทยาลัย ผ่านระบบ TCAS รอบ 1 แฟ้มสะสมผลงาน (Portfolio) พอร์ตของน้องมีผลงานตรงเกณฑ์มากค่ะ',
    timestamp: '2026-08-19 11:20 น.',
    read: true
  }
];

export const INITIAL_PARENT_APPOINTMENTS: ParentAppointment[] = [
  {
    id: 'apt-01',
    studentId: '6950801',
    parentName: 'นายสมชาย เจริญสุข',
    teacherName: 'ครูกิตติศักดิ์ & ครูแนะแนวพิมพ์ชนก',
    teacherRole: 'ครูประจำชั้นและครูแนะแนว',
    topic: 'ปรึกษาแนวทางการยื่นขอโควตาโอลิมปิกวิชาการและ TCAS รอบ Portfolio',
    preferredDate: '2026-08-26',
    timeSlot: '15:30 - 16:15 น.',
    meetingType: 'ONSITE',
    status: 'CONFIRMED',
    counselorNotes: 'นัดพบที่ห้องแนะแนว อาคาร 2 ชั้น 1 เตรียมเอกสารสรุปคะแนน GPAX และเกียรติบัตร'
  }
];
