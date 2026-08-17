import { Student } from '../types';

export const mockStudentsData: Student[] = [
  // ==========================================
  // 🏫 ชั้น ม.5/8 (10 คน)
  // ==========================================
  {
    id: 'STU-508-01',
    studentId: '6950801',
    studentCode: '6950801',
    title: 'นาย',
    firstName: 'กิตติศักดิ์',
    lastName: 'เจริญสุข',
    name: 'นายกิตติศักดิ์ เจริญสุข',
    fullName: 'นายกิตติศักดิ์ เจริญสุข',
    nickname: 'กิตติศักดิ์',
    grade: 'ม.5',
    room: '5/8',
    number: 1,
    studentNo: 1,
    status: 'ACTIVE',
    avatar: 'https://api.dicebear.com/9.x/avataaars/svg?seed=6950801',
    photoUrl: 'https://api.dicebear.com/9.x/avataaars/svg?seed=6950801',
    seatIndex: 0,
    homeLocation: {
      address: '12/3 หมู่ 1 ต.ท่าเสา อ.เมือง จ.อุตรดิตถ์',
      coordinates: [17.62514, 100.09315],
      routeImage: 'https://images.unsplash.com/photo-1524661135-423995f22d0b?auto=format&fit=crop&w=800&q=80'
    },
    attendance: {
      morningStatus: 'PRESENT',
      checkInMethod: 'SCAN',
      checkInTime: '07:32 น.'
    }
  },
  {
    id: 'STU-508-02',
    studentId: '6950802',
    studentCode: '6950802',
    title: 'นาย',
    firstName: 'ณัฐวุฒิ',
    lastName: 'สุขประเสริฐ',
    name: 'นายณัฐวุฒิ สุขประเสริฐ',
    fullName: 'นายณัฐวุฒิ สุขประเสริฐ',
    nickname: 'ณัฐวุฒิ',
    grade: 'ม.5',
    room: '5/8',
    number: 2,
    studentNo: 2,
    status: 'ACTIVE',
    avatar: 'https://api.dicebear.com/9.x/avataaars/svg?seed=6950802',
    photoUrl: 'https://api.dicebear.com/9.x/avataaars/svg?seed=6950802',
    seatIndex: 1,
    homeLocation: {
      address: '45/1 หมู่ 3 ต.ในเมือง อ.เมือง จ.อุตรดิตถ์',
      coordinates: [17.62124, 100.09845],
      routeImage: 'https://images.unsplash.com/photo-1524661135-423995f22d0b?auto=format&fit=crop&w=800&q=80'
    },
    attendance: {
      morningStatus: 'PRESENT',
      checkInMethod: 'GEOFENCE',
      checkInTime: '07:35 น.'
    }
  },
  {
    id: 'STU-508-03',
    studentId: '6950803',
    studentCode: '6950803',
    title: 'นาย',
    firstName: 'พีรพงศ์',
    lastName: 'รัตนปัญญา',
    name: 'นายพีรพงศ์ รัตนปัญญา',
    fullName: 'นายพีรพงศ์ รัตนปัญญา',
    nickname: 'พีรพงศ์',
    grade: 'ม.5',
    room: '5/8',
    number: 3,
    studentNo: 3,
    status: 'ACTIVE',
    avatar: 'https://api.dicebear.com/9.x/avataaars/svg?seed=6950803',
    photoUrl: 'https://api.dicebear.com/9.x/avataaars/svg?seed=6950803',
    seatIndex: 2,
    homeLocation: {
      address: '7/2 หมู่ 5 ต.ท่าเสา อ.เมือง จ.อุตรดิตถ์',
      coordinates: [17.62894, 100.09115],
      routeImage: 'https://images.unsplash.com/photo-1524661135-423995f22d0b?auto=format&fit=crop&w=800&q=80'
    },
    attendance: {
      morningStatus: 'PRESENT',
      checkInMethod: 'SCAN',
      checkInTime: '07:38 น.'
    }
  },
  {
    id: 'STU-508-04',
    studentId: '6950804',
    studentCode: '6950804',
    title: 'นาย',
    firstName: 'ธนากร',
    lastName: 'แสงสว่าง',
    name: 'นายธนากร แสงสว่าง',
    fullName: 'นายธนากร แสงสว่าง',
    nickname: 'ธนากร',
    grade: 'ม.5',
    room: '5/8',
    number: 4,
    studentNo: 4,
    status: 'ACTIVE',
    avatar: 'https://api.dicebear.com/9.x/avataaars/svg?seed=6950804',
    photoUrl: 'https://api.dicebear.com/9.x/avataaars/svg?seed=6950804',
    seatIndex: 3,
    homeLocation: {
      address: '109 หมู่ 2 ต.ป่าเซ่า อ.เมือง จ.อุตรดิตถ์',
      coordinates: [17.59514, 100.08315],
      routeImage: 'https://images.unsplash.com/photo-1524661135-423995f22d0b?auto=format&fit=crop&w=800&q=80'
    },
    attendance: {
      morningStatus: 'LATE',
      checkInMethod: 'SCAN',
      checkInTime: '07:46 น.'
    }
  },
  {
    id: 'STU-508-05',
    studentId: '6950805',
    studentCode: '6950805',
    title: 'นางสาว',
    firstName: 'ศิริพร',
    lastName: 'บุญรอด',
    name: 'นางสาวศิริพร บุญรอด',
    fullName: 'นางสาวศิริพร บุญรอด',
    nickname: 'ศิริพร',
    grade: 'ม.5',
    room: '5/8',
    number: 5,
    studentNo: 5,
    status: 'ACTIVE',
    avatar: 'https://api.dicebear.com/9.x/avataaars/svg?seed=6950805',
    photoUrl: 'https://api.dicebear.com/9.x/avataaars/svg?seed=6950805',
    seatIndex: 4,
    homeLocation: {
      address: '22 หมู่ 6 ต.งิ้วงาม อ.เมือง จ.อุตรดิตถ์',
      coordinates: [17.64114, 100.07315],
      routeImage: 'https://images.unsplash.com/photo-1524661135-423995f22d0b?auto=format&fit=crop&w=800&q=80'
    },
    attendance: {
      morningStatus: 'PRESENT',
      checkInMethod: 'SCAN',
      checkInTime: '07:28 น.'
    }
  },
  {
    id: 'STU-508-06',
    studentId: '6950806',
    studentCode: '6950806',
    title: 'นาย',
    firstName: 'อภิสิทธิ์',
    lastName: 'เลิศวิไล',
    name: 'นายอภิสิทธิ์ เลิศวิไล',
    fullName: 'นายอภิสิทธิ์ เลิศวิไล',
    nickname: 'อภิสิทธิ์',
    grade: 'ม.5',
    room: '5/8',
    number: 6,
    studentNo: 6,
    status: 'ACTIVE',
    avatar: 'https://api.dicebear.com/9.x/avataaars/svg?seed=6950806',
    photoUrl: 'https://api.dicebear.com/9.x/avataaars/svg?seed=6950806',
    seatIndex: 5,
    homeLocation: {
      address: '56/2 ต.ท่าเสา อ.เมือง จ.อุตรดิตถ์',
      coordinates: [17.62914, 100.10315],
      routeImage: 'https://images.unsplash.com/photo-1524661135-423995f22d0b?auto=format&fit=crop&w=800&q=80'
    },
    attendance: {
      morningStatus: 'PRESENT',
      checkInMethod: 'MANUAL',
      checkInTime: '07:40 น.'
    }
  },
  {
    id: 'STU-508-07',
    studentId: '6950807',
    studentCode: '6950807',
    title: 'นางสาว',
    firstName: 'พรพิมล',
    lastName: 'ยิ้มสู้',
    name: 'นางสาวพรพิมล ยิ้มสู้',
    fullName: 'นางสาวพรพิมล ยิ้มสู้',
    nickname: 'พรพิมล',
    grade: 'ม.5',
    room: '5/8',
    number: 7,
    studentNo: 7,
    status: 'ACTIVE',
    avatar: 'https://api.dicebear.com/9.x/avataaars/svg?seed=6950807',
    photoUrl: 'https://api.dicebear.com/9.x/avataaars/svg?seed=6950807',
    seatIndex: 6,
    homeLocation: {
      address: '88 หมู่ 8 ต.ทุ่งยั้ง อ.เมือง จ.อุตรดิตถ์',
      coordinates: [17.58514, 100.12315],
      routeImage: 'https://images.unsplash.com/photo-1524661135-423995f22d0b?auto=format&fit=crop&w=800&q=80'
    },
    attendance: {
      morningStatus: 'LEAVE',
      checkInMethod: null,
      checkInTime: null
    }
  },
  {
    id: 'STU-508-08',
    studentId: '6950808',
    studentCode: '6950808',
    title: 'นางสาว',
    firstName: 'ณัฏฐณิชา',
    lastName: 'แก้วคง',
    name: 'นางสาวณัฏฐณิชา แก้วคง',
    fullName: 'นางสาวณัฏฐณิชา แก้วคง',
    nickname: 'ณัฏฐณิชา',
    grade: 'ม.5',
    room: '5/8',
    number: 8,
    studentNo: 8,
    status: 'ACTIVE',
    avatar: 'https://api.dicebear.com/9.x/avataaars/svg?seed=6950808',
    photoUrl: 'https://api.dicebear.com/9.x/avataaars/svg?seed=6950808',
    seatIndex: 7,
    homeLocation: {
      address: '15/4 หมู่ 4 ต.ในเมือง อ.เมือง จ.อุตรดิตถ์',
      coordinates: [17.62314, 100.09515],
      routeImage: 'https://images.unsplash.com/photo-1524661135-423995f22d0b?auto=format&fit=crop&w=800&q=80'
    },
    attendance: {
      morningStatus: 'PRESENT',
      checkInMethod: 'SCAN',
      checkInTime: '07:31 น.'
    }
  },
  {
    id: 'STU-508-09',
    studentId: '6950809',
    studentCode: '6950809',
    title: 'นาย',
    firstName: 'ชัชวาล',
    lastName: 'วงษ์สุวรรณ',
    name: 'นายชัชวาล วงษ์สุวรรณ',
    fullName: 'นายชัชวาล วงษ์สุวรรณ',
    nickname: 'ชัชวาล',
    grade: 'ม.5',
    room: '5/8',
    number: 9,
    studentNo: 9,
    status: 'ACTIVE',
    avatar: 'https://api.dicebear.com/9.x/avataaars/svg?seed=6950809',
    photoUrl: 'https://api.dicebear.com/9.x/avataaars/svg?seed=6950809',
    seatIndex: 8,
    homeLocation: {
      address: '23/1 ต.ป่าเซ่า อ.เมือง จ.อุตรดิตถ์',
      coordinates: [17.60114, 100.08915],
      routeImage: 'https://images.unsplash.com/photo-1524661135-423995f22d0b?auto=format&fit=crop&w=800&q=80'
    },
    attendance: {
      morningStatus: 'ABSENT',
      checkInMethod: null,
      checkInTime: null
    }
  },
  {
    id: 'STU-508-10',
    studentId: '6950810',
    studentCode: '6950810',
    title: 'นาย',
    firstName: 'เกษมศักดิ์',
    lastName: 'มีชัย',
    name: 'นายเกษมศักดิ์ มีชัย',
    fullName: 'นายเกษมศักดิ์ มีชัย',
    nickname: 'เกษมศักดิ์',
    grade: 'ม.5',
    room: '5/8',
    number: 10,
    studentNo: 10,
    status: 'ACTIVE',
    avatar: 'https://api.dicebear.com/9.x/avataaars/svg?seed=6950810',
    photoUrl: 'https://api.dicebear.com/9.x/avataaars/svg?seed=6950810',
    seatIndex: 9,
    homeLocation: {
      address: '5/5 ต.ในเมือง อ.เมือง จ.อุตรดิตถ์',
      coordinates: [17.62564, 100.09355],
      routeImage: 'https://images.unsplash.com/photo-1524661135-423995f22d0b?auto=format&fit=crop&w=800&q=80'
    },
    attendance: {
      morningStatus: 'PRESENT',
      checkInMethod: 'SCAN',
      checkInTime: '07:34 น.'
    }
  },

  // ==========================================
  // 🏫 ชั้น ม.5/9 (10 คน)
  // ==========================================
  {
    id: 'STU-509-01',
    studentId: '6950901',
    studentCode: '6950901',
    title: 'นาย',
    firstName: 'กิตติพงษ์',
    lastName: 'ศรีสุข',
    name: 'นายกิตติพงษ์ ศรีสุข',
    fullName: 'นายกิตติพงษ์ ศรีสุข',
    nickname: 'กิตติพงษ์',
    grade: 'ม.5',
    room: '5/9',
    number: 1,
    studentNo: 1,
    status: 'ACTIVE',
    avatar: 'https://api.dicebear.com/9.x/avataaars/svg?seed=6950901',
    photoUrl: 'https://api.dicebear.com/9.x/avataaars/svg?seed=6950901',
    seatIndex: 0,
    homeLocation: {
      address: '34 หมู่ 2 ต.ท่าเสา อ.เมือง จ.อุตรดิตถ์',
      coordinates: [17.62514, 100.09315],
      routeImage: 'https://images.unsplash.com/photo-1524661135-423995f22d0b?auto=format&fit=crop&w=800&q=80'
    },
    attendance: {
      morningStatus: 'PRESENT',
      checkInMethod: 'SCAN',
      checkInTime: '07:33 น.'
    }
  },
  {
    id: 'STU-509-02',
    studentId: '6950902',
    studentCode: '6950902',
    title: 'นางสาว',
    firstName: 'ณิชารีย์',
    lastName: 'ใจดี',
    name: 'นางสาวณิชารีย์ ใจดี',
    fullName: 'นางสาวณิชารีย์ ใจดี',
    nickname: 'ณิชารีย์',
    grade: 'ม.5',
    room: '5/9',
    number: 2,
    studentNo: 2,
    status: 'ACTIVE',
    avatar: 'https://api.dicebear.com/9.x/avataaars/svg?seed=6950902',
    photoUrl: 'https://api.dicebear.com/9.x/avataaars/svg?seed=6950902',
    seatIndex: 1,
    homeLocation: {
      address: '142 หมู่ 4 ต.ในเมือง อ.เมือง จ.อุตรดิตถ์',
      coordinates: [17.62124, 100.09845],
      routeImage: 'https://images.unsplash.com/photo-1524661135-423995f22d0b?auto=format&fit=crop&w=800&q=80'
    },
    attendance: {
      morningStatus: 'PRESENT',
      checkInMethod: 'GEOFENCE',
      checkInTime: '07:36 น.'
    }
  },
  {
    id: 'STU-509-03',
    studentId: '6950903',
    studentCode: '6950903',
    title: 'นางสาว',
    firstName: 'ปวริศา',
    lastName: 'รุ่งเรือง',
    name: 'นางสาวปวริศา รุ่งเรือง',
    fullName: 'นางสาวปวริศา รุ่งเรือง',
    nickname: 'ปวริศา',
    grade: 'ม.5',
    room: '5/9',
    number: 3,
    studentNo: 3,
    status: 'ACTIVE',
    avatar: 'https://api.dicebear.com/9.x/avataaars/svg?seed=6950903',
    photoUrl: 'https://api.dicebear.com/9.x/avataaars/svg?seed=6950903',
    seatIndex: 2,
    homeLocation: {
      address: '17 หมู่ 5 ต.ท่าเสา อ.เมือง จ.อุตรดิตถ์',
      coordinates: [17.62894, 100.09115],
      routeImage: 'https://images.unsplash.com/photo-1524661135-423995f22d0b?auto=format&fit=crop&w=800&q=80'
    },
    attendance: {
      morningStatus: 'PRESENT',
      checkInMethod: 'SCAN',
      checkInTime: '07:39 น.'
    }
  },
  {
    id: 'STU-509-04',
    studentId: '6950904',
    studentCode: '6950904',
    title: 'นาย',
    firstName: 'ทรงพล',
    lastName: 'อุดมเดช',
    name: 'นายทรงพล อุดมเดช',
    fullName: 'นายทรงพล อุดมเดช',
    nickname: 'ทรงพล',
    grade: 'ม.5',
    room: '5/9',
    number: 4,
    studentNo: 4,
    status: 'ACTIVE',
    avatar: 'https://api.dicebear.com/9.x/avataaars/svg?seed=6950904',
    photoUrl: 'https://api.dicebear.com/9.x/avataaars/svg?seed=6950904',
    seatIndex: 3,
    homeLocation: {
      address: '209 หมู่ 2 ต.ป่าเซ่า อ.เมือง จ.อุตรดิตถ์',
      coordinates: [17.59514, 100.08315],
      routeImage: 'https://images.unsplash.com/photo-1524661135-423995f22d0b?auto=format&fit=crop&w=800&q=80'
    },
    attendance: {
      morningStatus: 'PRESENT',
      checkInMethod: 'SCAN',
      checkInTime: '07:35 น.'
    }
  },
  {
    id: 'STU-509-05',
    studentId: '6950905',
    studentCode: '6950905',
    title: 'นางสาว',
    firstName: 'วรัญญา',
    lastName: 'รักสงบ',
    name: 'นางสาววรัญญา รักสงบ',
    fullName: 'นางสาววรัญญา รักสงบ',
    nickname: 'วรัญญา',
    grade: 'ม.5',
    room: '5/9',
    number: 5,
    studentNo: 5,
    status: 'ACTIVE',
    avatar: 'https://api.dicebear.com/9.x/avataaars/svg?seed=6950905',
    photoUrl: 'https://api.dicebear.com/9.x/avataaars/svg?seed=6950905',
    seatIndex: 4,
    homeLocation: {
      address: '32 หมู่ 6 ต.งิ้วงาม อ.เมือง จ.อุตรดิตถ์',
      coordinates: [17.64114, 100.07315],
      routeImage: 'https://images.unsplash.com/photo-1524661135-423995f22d0b?auto=format&fit=crop&w=800&q=80'
    },
    attendance: {
      morningStatus: 'PRESENT',
      checkInMethod: 'SCAN',
      checkInTime: '07:29 น.'
    }
  },
  {
    id: 'STU-509-06',
    studentId: '6950906',
    studentCode: '6950906',
    title: 'นาย',
    firstName: 'นพรัตน์',
    lastName: 'ปัญญาดี',
    name: 'นายนพรัตน์ ปัญญาดี',
    fullName: 'นายนพรัตน์ ปัญญาดี',
    nickname: 'นพรัตน์',
    grade: 'ม.5',
    room: '5/9',
    number: 6,
    studentNo: 6,
    status: 'ACTIVE',
    avatar: 'https://api.dicebear.com/9.x/avataaars/svg?seed=6950906',
    photoUrl: 'https://api.dicebear.com/9.x/avataaars/svg?seed=6950906',
    seatIndex: 5,
    homeLocation: {
      address: '56 ต.ท่าเสา อ.เมือง จ.อุตรดิตถ์',
      coordinates: [17.62914, 100.10315],
      routeImage: 'https://images.unsplash.com/photo-1524661135-423995f22d0b?auto=format&fit=crop&w=800&q=80'
    },
    attendance: {
      morningStatus: 'PRESENT',
      checkInMethod: 'MANUAL',
      checkInTime: '07:41 น.'
    }
  },
  {
    id: 'STU-509-07',
    studentId: '6950907',
    studentCode: '6950907',
    title: 'นางสาว',
    firstName: 'วลัยลักษณ์',
    lastName: 'แสงทอง',
    name: 'นางสาววลัยลักษณ์ แสงทอง',
    fullName: 'นางสาววลัยลักษณ์ แสงทอง',
    nickname: 'วลัยลักษณ์',
    grade: 'ม.5',
    room: '5/9',
    number: 7,
    studentNo: 7,
    status: 'ACTIVE',
    avatar: 'https://api.dicebear.com/9.x/avataaars/svg?seed=6950907',
    photoUrl: 'https://api.dicebear.com/9.x/avataaars/svg?seed=6950907',
    seatIndex: 6,
    homeLocation: {
      address: '188 หมู่ 8 ต.ทุ่งยั้ง อ.เมือง จ.อุตรดิตถ์',
      coordinates: [17.58514, 100.12315],
      routeImage: 'https://images.unsplash.com/photo-1524661135-423995f22d0b?auto=format&fit=crop&w=800&q=80'
    },
    attendance: {
      morningStatus: 'PRESENT',
      checkInMethod: 'SCAN',
      checkInTime: '07:32 น.'
    }
  },
  {
    id: 'STU-509-08',
    studentId: '6950908',
    studentCode: '6950908',
    title: 'นาย',
    firstName: 'พัทธนันท์',
    lastName: 'โสภาค',
    name: 'นายพัทธนันท์ โสภาค',
    fullName: 'นายพัทธนันท์ โสภาค',
    nickname: 'พัทธนันท์',
    grade: 'ม.5',
    room: '5/9',
    number: 8,
    studentNo: 8,
    status: 'ACTIVE',
    avatar: 'https://api.dicebear.com/9.x/avataaars/svg?seed=6950908',
    photoUrl: 'https://api.dicebear.com/9.x/avataaars/svg?seed=6950908',
    seatIndex: 7,
    homeLocation: {
      address: '15 หมู่ 4 ต.ในเมือง อ.เมือง จ.อุตรดิตถ์',
      coordinates: [17.62314, 100.09515],
      routeImage: 'https://images.unsplash.com/photo-1524661135-423995f22d0b?auto=format&fit=crop&w=800&q=80'
    },
    attendance: {
      morningStatus: 'PRESENT',
      checkInMethod: 'SCAN',
      checkInTime: '07:31 น.'
    }
  },
  {
    id: 'STU-509-09',
    studentId: '6950909',
    studentCode: '6950909',
    title: 'นาย',
    firstName: 'จิรทีปต์',
    lastName: 'รุ่งอรุณ',
    name: 'นายจิรทีปต์ รุ่งอรุณ',
    fullName: 'นายจิรทีปต์ รุ่งอรุณ',
    nickname: 'จิรทีปต์',
    grade: 'ม.5',
    room: '5/9',
    number: 9,
    studentNo: 9,
    status: 'ACTIVE',
    avatar: 'https://api.dicebear.com/9.x/avataaars/svg?seed=6950909',
    photoUrl: 'https://api.dicebear.com/9.x/avataaars/svg?seed=6950909',
    seatIndex: 8,
    homeLocation: {
      address: '23 ต.ป่าเซ่า อ.เมือง จ.อุตรดิตถ์',
      coordinates: [17.60114, 100.08915],
      routeImage: 'https://images.unsplash.com/photo-1524661135-423995f22d0b?auto=format&fit=crop&w=800&q=80'
    },
    attendance: {
      morningStatus: 'PRESENT',
      checkInMethod: 'SCAN',
      checkInTime: '07:38 น.'
    }
  },
  {
    id: 'STU-509-10',
    studentId: '6950910',
    studentCode: '6950910',
    title: 'นางสาว',
    firstName: 'ชลลดา',
    lastName: 'ใจงาม',
    name: 'นางสาวชลลดา ใจงาม',
    fullName: 'นางสาวชลลดา ใจงาม',
    nickname: 'ชลลดา',
    grade: 'ม.5',
    room: '5/9',
    number: 10,
    studentNo: 10,
    status: 'ACTIVE',
    avatar: 'https://api.dicebear.com/9.x/avataaars/svg?seed=6950910',
    photoUrl: 'https://api.dicebear.com/9.x/avataaars/svg?seed=6950910',
    seatIndex: 9,
    homeLocation: {
      address: '5 ต.ในเมือง อ.เมือง จ.อุตรดิตถ์',
      coordinates: [17.62564, 100.09355],
      routeImage: 'https://images.unsplash.com/photo-1524661135-423995f22d0b?auto=format&fit=crop&w=800&q=80'
    },
    attendance: {
      morningStatus: 'PRESENT',
      checkInMethod: 'SCAN',
      checkInTime: '07:34 น.'
    }
  },

  // ==========================================
  // 🏫 ชั้น ม.5/11 (10 คน)
  // ==========================================
  {
    id: 'STU-511-01',
    studentId: '6951101',
    studentCode: '6951101',
    title: 'นาย',
    firstName: 'ธีรดนัย',
    lastName: 'จุลเสวก',
    name: 'นายธีรดนัย จุลเสวก',
    fullName: 'นายธีรดนัย จุลเสวก',
    nickname: 'ธีรดนัย',
    grade: 'ม.5',
    room: '5/11',
    number: 1,
    studentNo: 1,
    status: 'ACTIVE',
    avatar: 'https://api.dicebear.com/9.x/avataaars/svg?seed=6951101',
    photoUrl: 'https://api.dicebear.com/9.x/avataaars/svg?seed=6951101',
    seatIndex: 0,
    homeLocation: {
      address: '56 หมู่ 2 ต.ท่าเสา อ.เมือง จ.อุตรดิตถ์',
      coordinates: [17.62514, 100.09315],
      routeImage: 'https://images.unsplash.com/photo-1524661135-423995f22d0b?auto=format&fit=crop&w=800&q=80'
    },
    attendance: {
      morningStatus: 'PRESENT',
      checkInMethod: 'SCAN',
      checkInTime: '07:30 น.'
    }
  },
  {
    id: 'STU-511-02',
    studentId: '6951102',
    studentCode: '6951102',
    title: 'นาย',
    firstName: 'ธิติวัฒน์',
    lastName: 'เอมเอี่ยม',
    name: 'นายธิติวัฒน์ เอมเอี่ยม',
    fullName: 'นายธิติวัฒน์ เอมเอี่ยม',
    nickname: 'ธิติวัฒน์',
    grade: 'ม.5',
    room: '5/11',
    number: 2,
    studentNo: 2,
    status: 'ACTIVE',
    avatar: 'https://api.dicebear.com/9.x/avataaars/svg?seed=6951102',
    photoUrl: 'https://api.dicebear.com/9.x/avataaars/svg?seed=6951102',
    seatIndex: 1,
    homeLocation: {
      address: '77/1 หมู่ 3 ต.ในเมือง อ.เมือง จ.อุตรดิตถ์',
      coordinates: [17.62124, 100.09845],
      routeImage: 'https://images.unsplash.com/photo-1524661135-423995f22d0b?auto=format&fit=crop&w=800&q=80'
    },
    attendance: {
      morningStatus: 'PRESENT',
      checkInMethod: 'GEOFENCE',
      checkInTime: '07:35 น.'
    }
  },
  {
    id: 'STU-511-03',
    studentId: '6951103',
    studentCode: '6951103',
    title: 'นางสาว',
    firstName: 'ปรียาภัทร์',
    lastName: 'อรุณโรจน์',
    name: 'นางสาวปรียาภัทร์ อรุณโรจน์',
    fullName: 'นางสาวปรียาภัทร์ อรุณโรจน์',
    nickname: 'ปรียาภัทร์',
    grade: 'ม.5',
    room: '5/11',
    number: 3,
    studentNo: 3,
    status: 'ACTIVE',
    avatar: 'https://api.dicebear.com/9.x/avataaars/svg?seed=6951103',
    photoUrl: 'https://api.dicebear.com/9.x/avataaars/svg?seed=6951103',
    seatIndex: 2,
    homeLocation: {
      address: '12 หมู่ 5 ต.ท่าเสา อ.เมือง จ.อุตรดิตถ์',
      coordinates: [17.62894, 100.09115],
      routeImage: 'https://images.unsplash.com/photo-1524661135-423995f22d0b?auto=format&fit=crop&w=800&q=80'
    },
    attendance: {
      morningStatus: 'PRESENT',
      checkInMethod: 'SCAN',
      checkInTime: '07:38 น.'
    }
  },
  {
    id: 'STU-511-04',
    studentId: '6951104',
    studentCode: '6951104',
    title: 'นาย',
    firstName: 'ชนกันต์',
    lastName: 'กาดกอเสริม',
    name: 'นายชนกันต์ กาดกอเสริม',
    fullName: 'นายชนกันต์ กาดกอเสริม',
    nickname: 'ชนกันต์',
    grade: 'ม.5',
    room: '5/11',
    number: 4,
    studentNo: 4,
    status: 'ACTIVE',
    avatar: 'https://api.dicebear.com/9.x/avataaars/svg?seed=6951104',
    photoUrl: 'https://api.dicebear.com/9.x/avataaars/svg?seed=6951104',
    seatIndex: 3,
    homeLocation: {
      address: '302 หมู่ 2 ต.ป่าเซ่า อ.เมือง จ.อุตรดิตถ์',
      coordinates: [17.59514, 100.08315],
      routeImage: 'https://images.unsplash.com/photo-1524661135-423995f22d0b?auto=format&fit=crop&w=800&q=80'
    },
    attendance: {
      morningStatus: 'PRESENT',
      checkInMethod: 'SCAN',
      checkInTime: '07:35 น.'
    }
  },
  {
    id: 'STU-511-05',
    studentId: '6951105',
    studentCode: '6951105',
    title: 'นาย',
    firstName: 'ณัฐวุฒิ',
    lastName: 'โต๊ะสุวรรณ',
    name: 'นายณัฐวุฒิ โต๊ะสุวรรณ',
    fullName: 'นายณัฐวุฒิ โต๊ะสุวรรณ',
    nickname: 'ณัฐวุฒิ',
    grade: 'ม.5',
    room: '5/11',
    number: 5,
    studentNo: 5,
    status: 'ACTIVE',
    avatar: 'https://api.dicebear.com/9.x/avataaars/svg?seed=6951105',
    photoUrl: 'https://api.dicebear.com/9.x/avataaars/svg?seed=6951105',
    seatIndex: 4,
    homeLocation: {
      address: '11 หมู่ 6 ต.งิ้วงาม อ.เมือง จ.อุตรดิตถ์',
      coordinates: [17.64114, 100.07315],
      routeImage: 'https://images.unsplash.com/photo-1524661135-423995f22d0b?auto=format&fit=crop&w=800&q=80'
    },
    attendance: {
      morningStatus: 'PRESENT',
      checkInMethod: 'SCAN',
      checkInTime: '07:25 น.'
    }
  },
  {
    id: 'STU-511-06',
    studentId: '6951106',
    studentCode: '6951106',
    title: 'นางสาว',
    firstName: 'ปภาวรินทร์',
    lastName: 'สุขคำ',
    name: 'นางสาวปภาวรินทร์ สุขคำ',
    fullName: 'นางสาวปภาวรินทร์ สุขคำ',
    nickname: 'ปภาวรินทร์',
    grade: 'ม.5',
    room: '5/11',
    number: 6,
    studentNo: 6,
    status: 'ACTIVE',
    avatar: 'https://api.dicebear.com/9.x/avataaars/svg?seed=6951106',
    photoUrl: 'https://api.dicebear.com/9.x/avataaars/svg?seed=6951106',
    seatIndex: 5,
    homeLocation: {
      address: '15/2 ต.ท่าเสา อ.เมือง จ.อุตรดิตถ์',
      coordinates: [17.62914, 100.10315],
      routeImage: 'https://images.unsplash.com/photo-1524661135-423995f22d0b?auto=format&fit=crop&w=800&q=80'
    },
    attendance: {
      morningStatus: 'PRESENT',
      checkInMethod: 'MANUAL',
      checkInTime: '07:41 น.'
    }
  },
  {
    id: 'STU-511-07',
    studentId: '6951107',
    studentCode: '6951107',
    title: 'นางสาว',
    firstName: 'พลอยไพลิน',
    lastName: 'โภชนจันทร์',
    name: 'นางสาวพลอยไพลิน โภชนจันทร์',
    fullName: 'นางสาวพลอยไพลิน โภชนจันทร์',
    nickname: 'พลอยไพลิน',
    grade: 'ม.5',
    room: '5/11',
    number: 7,
    studentNo: 7,
    status: 'ACTIVE',
    avatar: 'https://api.dicebear.com/9.x/avataaars/svg?seed=6951107',
    photoUrl: 'https://api.dicebear.com/9.x/avataaars/svg?seed=6951107',
    seatIndex: 6,
    homeLocation: {
      address: '288 หมู่ 8 ต.ทุ่งยั้ง อ.เมือง จ.อุตรดิตถ์',
      coordinates: [17.58514, 100.12315],
      routeImage: 'https://images.unsplash.com/photo-1524661135-423995f22d0b?auto=format&fit=crop&w=800&q=80'
    },
    attendance: {
      morningStatus: 'PRESENT',
      checkInMethod: 'SCAN',
      checkInTime: '07:32 น.'
    }
  },
  {
    id: 'STU-511-08',
    studentId: '6951108',
    studentCode: '6951108',
    title: 'นาย',
    firstName: 'กฤษณะ',
    lastName: 'บุญอินเขียว',
    name: 'นายกฤษณะ บุญอินเขียว',
    fullName: 'นายกฤษณะ บุญอินเขียว',
    nickname: 'กฤษณะ',
    grade: 'ม.5',
    room: '5/11',
    number: 8,
    studentNo: 8,
    status: 'ACTIVE',
    avatar: 'https://api.dicebear.com/9.x/avataaars/svg?seed=6951108',
    photoUrl: 'https://api.dicebear.com/9.x/avataaars/svg?seed=6951108',
    seatIndex: 7,
    homeLocation: {
      address: '44 หมู่ 4 ต.ในเมือง อ.เมือง จ.อุตรดิตถ์',
      coordinates: [17.62314, 100.09515],
      routeImage: 'https://images.unsplash.com/photo-1524661135-423995f22d0b?auto=format&fit=crop&w=800&q=80'
    },
    attendance: {
      morningStatus: 'PRESENT',
      checkInMethod: 'SCAN',
      checkInTime: '07:31 น.'
    }
  },
  {
    id: 'STU-511-09',
    studentId: '6951109',
    studentCode: '6951109',
    title: 'นาย',
    firstName: 'จตุพล',
    lastName: 'หมื่นไชย',
    name: 'นายจตุพล หมื่นไชย',
    fullName: 'นายจตุพล หมื่นไชย',
    nickname: 'จตุพล',
    grade: 'ม.5',
    room: '5/11',
    number: 9,
    studentNo: 9,
    status: 'ACTIVE',
    avatar: 'https://api.dicebear.com/9.x/avataaars/svg?seed=6951109',
    photoUrl: 'https://api.dicebear.com/9.x/avataaars/svg?seed=6951109',
    seatIndex: 8,
    homeLocation: {
      address: '21 ต.ป่าเซ่า อ.เมือง จ.อุตรดิตถ์',
      coordinates: [17.60114, 100.08915],
      routeImage: 'https://images.unsplash.com/photo-1524661135-423995f22d0b?auto=format&fit=crop&w=800&q=80'
    },
    attendance: {
      morningStatus: 'PRESENT',
      checkInMethod: 'SCAN',
      checkInTime: '07:38 น.'
    }
  },
  {
    id: 'STU-511-10',
    studentId: '6951110',
    studentCode: '6951110',
    title: 'นาย',
    firstName: 'ชิษณุพงศ์',
    lastName: 'อินทสอน',
    name: 'นายชิษณุพงศ์ อินทสอน',
    fullName: 'นายชิษณุพงศ์ อินทสอน',
    nickname: 'ชิษณุพงศ์',
    grade: 'ม.5',
    room: '5/11',
    number: 10,
    studentNo: 10,
    status: 'ACTIVE',
    avatar: 'https://api.dicebear.com/9.x/avataaars/svg?seed=6951110',
    photoUrl: 'https://api.dicebear.com/9.x/avataaars/svg?seed=6951110',
    seatIndex: 9,
    homeLocation: {
      address: '15 ต.ในเมือง อ.เมือง จ.อุตรดิตถ์',
      coordinates: [17.62564, 100.09355],
      routeImage: 'https://images.unsplash.com/photo-1524661135-423995f22d0b?auto=format&fit=crop&w=800&q=80'
    },
    attendance: {
      morningStatus: 'PRESENT',
      checkInMethod: 'SCAN',
      checkInTime: '07:34 น.'
    }
  }
];

// Helper Functions สำหรับดึงข้อมูลรายห้อง
export const getStudentsByRoom = (room: string) => {
  // รองรับทั้ง "5/8" และ "ม.5/8"
  const normalizedRoom = room.replace(/^ม\./, '');
  return mockStudentsData.filter(student => student.room?.replace(/^ม\./, '') === normalizedRoom);
};
