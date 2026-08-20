import { StudentSelfAssessment } from '../types';

export const mockSelfAssessments: Record<string, StudentSelfAssessment> = {
  '38502': {
    id: 'SSA-38502',
    studentId: '38502',
    studentName: 'สมชาย ใจดี',
    isCompleted: true,
    submittedAt: '2026-07-15T08:30:00.000Z',
    updatedAt: '2026-07-15T08:30:00.000Z',
    basicInfo: {
      titleFullName: 'นายสมชาย ใจดี',
      nickname: 'ชาย',
      gradeRoom: 'ม.5/8',
      studentNo: '1',
      contactChannels: ['เบอร์โทรศัพท์ส่วนตัว', 'LINE ID / Instagram / Facebook'],
      contactDetail: 'เบอร์ 089-123-4567, LINE ID: somchai.utd'
    },
    familyBackground: {
      livingWith: 'บิดาและมารดา',
      transportation: 'รถจักรยานยนต์',
      travelTime: '15-30 นาที',
      responsibilities: ['งานบ้าน', 'ช่วยธุรกิจครอบครัว'],
      consultPerson: 'ผู้ปกครอง'
    },
    identity: {
      threeWords: 'ร่าเริง, ช่างคิด, ชอบทดลอง',
      hobbies: ['เล่นเกม', 'อ่านหนังสือ', 'เขียนโค้ดคอมพิวเตอร์'],
      specialSkills: 'การเขียนโปรแกรม Python เบื้องต้น และทักษะงานซ่อมอุปกรณ์คอมพิวเตอร์',
      groupRole: 'ค้นหาข้อมูลวิเคราะห์'
    },
    learningStyle: {
      preferredStyles: ['ลงมือปฏิบัติจริง', 'ดูคลิป วิดีโอ ภาพ'],
      learningObstacles: ['การบ้านเยอะ', 'บางวิชาตามเนื้อหาไม่ทัน'],
      primaryDevices: ['โน้ตบุ๊ก / PC', 'สมาร์ตโฟน'],
      aiExperience: 'ใช้อยู่ประจำ',
      teacherStyle: 'ชอบครูที่เปิดโอกาสให้ซักถาม ไม่ดุ มีตัวอย่างจริงให้ดู และใช้สื่อเทคโนโลยีร่วมกับการสอน'
    },
    socialAndSafety: {
      topSocialMedia: ['YouTube', 'Discord'],
      schoolBullyingExperience: 'ไม่เคย',
      cyberbullyingExperience: 'ไม่เคย',
      schoolSafetyScore: 5,
      socialComparisonStress: 'เป็นบางครั้ง',
      messageToTeacherSafety: 'ในห้องเรียนเพื่อนๆ รักใคร่กันดี ไม่มีปัญหาความรุนแรงครับ'
    },
    futureGoals: {
      careerGoals: 'คณะวิศวกรรมศาสตร์ สาขาวิศวกรรมคอมพิวเตอร์ / วิศวกรซอฟต์แวร์หรือนักพัฒนา AI',
      selfImprovement: 'อยากพัฒนาภาษาอังกฤษสำหรับการค้นคว้า และการจัดสรรเวลาอ่านหนังสือเตรียมสอบเข้ามหาวิทยาลัย',
      supportNeeded: 'อยากให้โรงเรียนมีกิจกรรมติวเข้มแนวข้อสอบ TPAT3 และแนะนำพอร์ตฟอลิโอสำหรับรอบ Portfolio',
      privateMessageToTeacher: 'ผมตั้งใจจะสอบเข้ามหาวิทยาลัยรัฐชั้นนำให้ได้ครับ ขอบคุณครูที่ให้คำแนะนำเสมอมาครับ'
    }
  },
  '6950801': {
    id: 'SSA-6950801',
    studentId: '6950801',
    studentName: 'นายกิตติศักดิ์ เจริญสุข',
    isCompleted: true,
    submittedAt: '2026-07-16T09:15:00.000Z',
    updatedAt: '2026-07-16T09:15:00.000Z',
    basicInfo: {
      titleFullName: 'นายกิตติศักดิ์ เจริญสุข',
      nickname: 'กิต',
      gradeRoom: 'ม.5/8',
      studentNo: '1',
      contactChannels: ['เบอร์โทรศัพท์ส่วนตัว', 'LINE ID / Instagram / Facebook'],
      contactDetail: 'LINE: kittisak.c, Tel: 081-555-0101'
    },
    familyBackground: {
      livingWith: 'บิดาและมารดา',
      transportation: 'ผู้ปกครองรับ-ส่ง',
      travelTime: 'น้อยกว่า 15 นาที',
      responsibilities: ['งานบ้าน', 'ไม่มีภาระพิเศษ'],
      consultPerson: 'เพื่อนสนิทใน-นอกโรงเรียน'
    },
    identity: {
      threeWords: 'ลุยๆ, ตรงไปตรงมา, มีวินัย',
      hobbies: ['เล่นกีฬา', 'ฟังเพลง', 'ดูหนัง ซีรีส์'],
      specialSkills: 'เล่นกีฬาบาสเกตบอลตัวแทนโรงเรียน และการตัดต่อวิดีโอสั้น',
      groupRole: 'ผู้นำกลุ่ม'
    },
    learningStyle: {
      preferredStyles: ['ฟังบรรยายกระชับ', 'ลงมือปฏิบัติจริง'],
      learningObstacles: ['สมาธิสั้น'],
      primaryDevices: ['แท็บเล็ต iPad', 'สมาร์ตโฟน'],
      aiExperience: 'ใช้อยู่ประจำ',
      teacherStyle: 'ชอบครูที่สอนกระชับ มีเกมหรือแบบฝึกหัดท้าทายในห้อง'
    },
    socialAndSafety: {
      topSocialMedia: ['Instagram', 'TikTok'],
      schoolBullyingExperience: 'ไม่เคย',
      cyberbullyingExperience: 'ไม่เคย',
      schoolSafetyScore: 4,
      socialComparisonStress: 'ไม่เคยเลย',
      messageToTeacherSafety: 'บรรยากาศในโรงเรียนปลอดภัยดีครับ'
    },
    futureGoals: {
      careerGoals: 'คณะวิทยาศาสตร์การกีฬา หรือคณะบริหารธุรกิจ / เจ้าของกิจการกีฬา',
      selfImprovement: 'อยากฝึกทักษะการเป็นผู้นำและการจัดการความเครียดช่วงสอบ',
      supportNeeded: 'การแนะแนวทุนการศึกษาและโครงการช้างเผือกด้านกีฬา',
      privateMessageToTeacher: 'อยากฝึกซ้อมกีฬาควบคู่ไปกับการรักษาเกรดเฉลี่ยให้เกิน 3.50 ครับ'
    }
  },
  '6950802': {
    id: 'SSA-6950802',
    studentId: '6950802',
    studentName: 'นายณัฐวุฒิ สุขประเสริฐ',
    isCompleted: true,
    submittedAt: '2026-07-16T10:00:00.000Z',
    updatedAt: '2026-07-16T10:00:00.000Z',
    basicInfo: {
      titleFullName: 'นายณัฐวุฒิ สุขประเสริฐ',
      nickname: 'ณัฐ',
      gradeRoom: 'ม.5/8',
      studentNo: '2',
      contactChannels: ['LINE ID / Instagram / Facebook'],
      contactDetail: 'IG: nuttwut_sp, Discord: nutt#9982'
    },
    familyBackground: {
      livingWith: 'ปู่ ย่า ตา ยาย หรือญาติผู้ใหญ่',
      transportation: 'รถจักรยานยนต์',
      travelTime: '31-60 นาที',
      responsibilities: ['ดูแลน้อง/ผู้สูงอายุ', 'ช่วยธุรกิจครอบครัว'],
      consultPerson: 'เพื่อนสนิทใน-นอกโรงเรียน'
    },
    identity: {
      threeWords: 'โลกส่วนตัวสูง, ใจเย็น, สุภาพ',
      hobbies: ['งานศิลปะ', 'ฟังเพลง', 'อ่านหนังสือ'],
      specialSkills: 'วาดภาพดิจิทัลอาร์ต และการออกแบบโปสเตอร์กราฟิก',
      groupRole: 'ออกแบบสไลด์/กราฟิก'
    },
    learningStyle: {
      preferredStyles: ['ดูคลิป วิดีโอ ภาพ', 'อ่านเอง'],
      learningObstacles: ['ไม่กล้าถาม', 'อุปกรณ์ไม่พร้อมบางช่วง'],
      primaryDevices: ['แท็บเล็ต iPad', 'สมาร์ตโฟน'],
      aiExperience: 'เคยลองบ้าง',
      teacherStyle: 'ชอบครูที่ใจดี พูดจาไพเราะ คอยสังเกตและให้คำปรึกษารายบุคคล'
    },
    socialAndSafety: {
      topSocialMedia: ['X (Twitter)', 'TikTok'],
      schoolBullyingExperience: 'เคยเห็นเพื่อนโดน',
      cyberbullyingExperience: 'ไม่เคย',
      schoolSafetyScore: 4,
      socialComparisonStress: 'เป็นบางครั้ง',
      messageToTeacherSafety: 'อยากให้ครูช่วยสังเกตกลุ่มเพื่อนที่ชอบล้อเลียนปมด้อยเรื่องรูปร่างของเพื่อนบางคนครับ'
    },
    futureGoals: {
      careerGoals: 'คณะมัณฑนศิลป์ / สถาปัตยกรรมศาสตร์ หรือสาขาแอนิเมชันและเกม',
      selfImprovement: 'เพิ่มความมั่นใจในการพูดต่อหน้าผู้คน และการจัดการเวลาทำงานบ้านกับอ่านหนังสือ',
      supportNeeded: 'แนะแนวทางทำแฟ้มสะสมผลงาน (Portfolio) ด้านศิลปะและการออกแบบ',
      privateMessageToTeacher: 'ผมต้องดูแลคุณยายหลังเลิกเรียน หากบางวันต้องกลับบ้านเร็ว ขอความกรุณาครูด้วยนะครับ'
    }
  },
  '6950803': {
    id: 'SSA-6950803',
    studentId: '6950803',
    studentName: 'นายธีรภัทร วงศ์ษา',
    isCompleted: true,
    submittedAt: '2026-07-17T11:20:00.000Z',
    updatedAt: '2026-07-17T11:20:00.000Z',
    basicInfo: {
      titleFullName: 'นายธีรภัทร วงศ์ษา',
      nickname: 'ภัทร',
      gradeRoom: 'ม.5/8',
      studentNo: '3',
      contactChannels: ['เบอร์โทรศัพท์ส่วนตัว'],
      contactDetail: 'Tel: 082-999-3344'
    },
    familyBackground: {
      livingWith: 'บิดาและมารดา',
      transportation: 'รถสาธารณะ / รถโรงเรียน',
      travelTime: '15-30 นาที',
      responsibilities: ['งานบ้าน'],
      consultPerson: 'คุณครู'
    },
    identity: {
      threeWords: 'ร่าเริง, ช่างพูด, สนุกสนาน',
      hobbies: ['ดูหนัง ซีรีส์', 'เล่นเกม', 'ฟังเพลง'],
      specialSkills: 'การพูดในที่ชุมชน การเป็นพิธีกร และทักษะภาษาอังกฤษสื่อสาร',
      groupRole: 'ผู้นำเสนอ'
    },
    learningStyle: {
      preferredStyles: ['อภิปรายกลุ่ม', 'ดูคลิป วิดีโอ ภาพ'],
      learningObstacles: ['สมาธิสั้น', 'การบ้านเยอะ'],
      primaryDevices: ['สมาร์ตโฟน', 'โน้ตบุ๊ก / PC'],
      aiExperience: 'ใช้อยู่ประจำ',
      teacherStyle: 'ชอบครูที่มีอารมณ์ขัน ไม่น่าเบื่อ และมีกิจกรรมกลุ่มให้แลกเปลี่ยนความคิดเห็น'
    },
    socialAndSafety: {
      topSocialMedia: ['TikTok', 'Instagram'],
      schoolBullyingExperience: 'ไม่เคย',
      cyberbullyingExperience: 'ไม่เคย',
      schoolSafetyScore: 5,
      socialComparisonStress: 'ไม่เคยเลย',
      messageToTeacherSafety: 'โรงเรียนน่าอยู่และคุณครูดูแลดีมากครับ'
    },
    futureGoals: {
      careerGoals: 'คณะนิเทศศาสตร์ สาขาการสื่อสารการตลาด / ครีเอเตอร์หรือผู้ประกาศข่าว',
      selfImprovement: 'การจัดระเบียบความคิดเชิงวิพากษ์ และผลการเรียนวิชาคำนวณ',
      supportNeeded: 'กิจกรรมเวิร์กช็อปฝึกการนำเสนอและค่ายค้นหาตัวเอง',
      privateMessageToTeacher: 'ขอบคุณคุณครูที่ส่งเสริมให้ผมได้เป็นพิธีกรงานโรงเรียนครับ'
    }
  },
  '55001': {
    id: 'SSA-55001',
    studentId: '55001',
    studentName: 'นาย ณัฐภัทร ใจมั่น',
    isCompleted: true,
    submittedAt: '2026-07-18T14:10:00.000Z',
    updatedAt: '2026-07-18T14:10:00.000Z',
    basicInfo: {
      titleFullName: 'นาย ณัฐภัทร ใจมั่น',
      nickname: 'นิว',
      gradeRoom: 'ม.5/8',
      studentNo: '4',
      contactChannels: ['LINE ID / Instagram / Facebook'],
      contactDetail: 'LINE ID: new.natapat'
    },
    familyBackground: {
      livingWith: 'บิดาและมารดา',
      transportation: 'เดิน/ขี่จักรยาน',
      travelTime: 'น้อยกว่า 15 นาที',
      responsibilities: ['ไม่มีภาระพิเศษ'],
      consultPerson: 'ผู้ปกครอง'
    },
    identity: {
      threeWords: 'มุ่งมั่น, ขยัน, มีเป้าหมาย',
      hobbies: ['อ่านหนังสือ', 'งานศิลปะ', 'ฟังเพลง'],
      specialSkills: 'การคิดเลขเร็ว และทักษะการสรุปประเด็นทางวิชาการ',
      groupRole: 'ผู้สนับสนุนคอยทำตามที่ได้รับมอบหมาย'
    },
    learningStyle: {
      preferredStyles: ['ฟังบรรยายกระชับ', 'อ่านเอง'],
      learningObstacles: ['การบ้านเยอะ'],
      primaryDevices: ['โน้ตบุ๊ก / PC', 'แท็บเล็ต iPad'],
      aiExperience: 'ใช้อยู่ประจำ',
      teacherStyle: 'ชอบครูที่สรุปเนื้อหาเป็นแผนภาพ Mind Map และมีแบบฝึกหัดเฉลยละเอียด'
    },
    socialAndSafety: {
      topSocialMedia: ['Facebook', 'YouTube'],
      schoolBullyingExperience: 'ไม่เคย',
      cyberbullyingExperience: 'ไม่เคย',
      schoolSafetyScore: 5,
      socialComparisonStress: 'ไม่เคยเลย',
      messageToTeacherSafety: 'เพื่อนๆ ทุกคนน่ารักมากครับ'
    },
    futureGoals: {
      careerGoals: 'คณะแพทยศาสตร์ หรือคณะทันตแพทยศาสตร์ / แพทย์ประจำโรงพยาบาลศูนย์',
      selfImprovement: 'เตรียมสอบ TPAT1 ความถนัดแพทย์ และรักษาผลการเรียนให้สม่ำเสมอ',
      supportNeeded: 'แนะแนวเส้นทาง กสพท. และแนวทางเตรียมตัวสอบสัมภาษณ์',
      privateMessageToTeacher: 'ผมมุ่งมั่นจะทำให้คุณพ่อคุณแม่และโรงเรียนภาคภูมิใจครับ'
    }
  },
  '55002': {
    id: 'SSA-55002',
    studentId: '55002',
    studentName: 'นางสาว ปิยะธิดา ปิมปา',
    isCompleted: true,
    submittedAt: '2026-07-18T15:30:00.000Z',
    updatedAt: '2026-07-18T15:30:00.000Z',
    basicInfo: {
      titleFullName: 'นางสาว ปิยะธิดา ปิมปา',
      nickname: 'ปิม',
      gradeRoom: 'ม.5/8',
      studentNo: '5',
      contactChannels: ['เบอร์โทรศัพท์ส่วนตัว', 'LINE ID / Instagram / Facebook'],
      contactDetail: 'IG: pim_piyathida, Tel: 086-444-8899'
    },
    familyBackground: {
      livingWith: 'บิดา หรือ มารดา (ฝ่ายใดฝ่ายหนึ่ง)',
      transportation: 'รถจักรยานยนต์',
      travelTime: '15-30 นาที',
      responsibilities: ['งานบ้าน', 'ดูแลน้อง/ผู้สูงอายุ'],
      consultPerson: 'เพื่อนสนิทใน-นอกโรงเรียน'
    },
    identity: {
      threeWords: 'อ่อนโยน, อดทน, ชอบช่วยเหลือ',
      hobbies: ['ทำอาหาร', 'ฟังเพลง', 'ดูหนัง ซีรีส์'],
      specialSkills: 'การทำขนมเบเกอรี่ และงานฝีมือประดิษฐ์',
      groupRole: 'ผู้สนับสนุนคอยทำตามที่ได้รับมอบหมาย'
    },
    learningStyle: {
      preferredStyles: ['ลงมือปฏิบัติจริง', 'ดูคลิป วิดีโอ ภาพ'],
      learningObstacles: ['ตามเนื้อหาไม่ทัน', 'ไม่กล้าถาม'],
      primaryDevices: ['สมาร์ตโฟน'],
      aiExperience: 'เคยลองบ้าง',
      teacherStyle: 'ชอบครูที่ใจเย็น ไม่กดดัน และยินดีอธิบายซ้ำเมื่อไม่เข้าใจ'
    },
    socialAndSafety: {
      topSocialMedia: ['TikTok', 'Instagram'],
      schoolBullyingExperience: 'เคยเห็นเพื่อนโดน',
      cyberbullyingExperience: 'ไม่เคย',
      schoolSafetyScore: 4,
      socialComparisonStress: 'เป็นบางครั้ง',
      messageToTeacherSafety: 'อยากให้ครูช่วยดูแลเรื่องการแซวหรือล้อเลียนในห้องเรียนค่ะ'
    },
    futureGoals: {
      careerGoals: 'คณะพยาบาลศาสตร์ หรือคณะเทคนิคการแพทย์ / พยาบาลวิชาชีพ',
      selfImprovement: 'พัฒนาความมั่นใจในการตอบคำถาม และการจำคำศัพท์ชีววิทยา',
      supportNeeded: 'การติววิชาวิทยาศาสตร์เพิ่มเติม และการแนะนำทุนพยาบาล',
      privateMessageToTeacher: 'หนูอยากเรียนจบพยาบาลเพื่อมาดูแลคุณแม่ค่ะ'
    }
  }
};
