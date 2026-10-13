# คู่มือตั้งค่า LINE Login สำหรับผู้ปกครอง (แอดมิน)

ผู้ปกครองเข้าระบบผ่าน LINE (LIFF) → เซิร์ฟเวอร์ตรวจ LINE ID token → ยืนยันตัวตนครั้งแรกด้วย **รหัสนักเรียน + เลขบัตรประชาชนผู้ปกครอง** (เทียบกับทะเบียนที่นำเข้า) → ระบบออกสิทธิ์ `PARENT` ให้

## 1) ตั้งค่าฝั่ง LINE (https://developers.line.biz)
1. สร้าง **Provider** (เช่น "โรงเรียนอุตรดิตถ์")
2. สร้าง channel ชนิด **LINE Login** (ประเภท Web app) แล้ว **Publish** channel (สถานะ Developing ใช้ได้เฉพาะผู้ดูแล/ผู้ทดสอบ)
3. ในแท็บ **LIFF** → Add: ตั้ง *Endpoint URL* = โดเมนของระบบ (https, เช่น `https://<โดเมนระบบ>/`), *Scopes* = `openid` และ `profile`, *Size* = Full → ได้ **LIFF ID**
4. (แนะนำ) สร้าง **LINE Official Account** + Messaging API channel ใน Provider เดียวกัน เพื่อให้ผู้ปกครองเพิ่มเพื่อนและรับแจ้งเตือน (ยังไม่ผูกกับระบบนี้)
5. จด **Channel ID** ของ LINE Login channel (หน้า Basic settings)

## 2) ตั้งค่า secrets ฝั่ง Firebase (อย่าแปะค่าจริงในแชท/โค้ด)
```powershell
firebase functions:secrets:set LINE_CHANNEL_ID      # วาง Channel ID ของ LINE Login
firebase functions:secrets:set PARENT_ID_PEPPER     # สตริงสุ่มยาว ≥ 32 ตัว เก็บสำรองไว้ในที่ปลอดภัย
```
⚠️ ถ้า `PARENT_ID_PEPPER` หาย/เปลี่ยน ทะเบียนผู้ปกครองทั้งหมดจะเทียบไม่ตรง ต้องนำเข้าใหม่ทั้งไฟล์

## 3) ตั้งค่าฝั่งเว็บ
- ตั้ง `VITE_LINE_LIFF_ID=<LIFF ID>` ในไฟล์ env ตอน build แล้ว `npm run build`
- ใน Firebase Console → Authentication → Settings → Authorized domains ต้องมีโดเมนของระบบ

## 4) ลำดับ deploy
`npm --prefix functions run deploy` (functions) → `firebase deploy --only firestore:rules` → build + `firebase deploy --only hosting`

## 5) ลำดับการใช้งานจริง
1. นำเข้า **นักเรียน** ก่อน → 2. นำเข้า **ผู้ปกครอง** (เมนูนำเข้า; เซิร์ฟเวอร์เก็บเลขบัตรเป็น HMAC ไม่เก็บค่าดิบ)
3. ผู้ปกครองเปิดลิงก์ระบบใน LINE → กด "เข้าสู่ระบบสำหรับผู้ปกครอง (LINE)" → กรอกรหัสนักเรียน + เลขบัตร (ครั้งแรกครั้งเดียว)
- กรอกผิด 5 ครั้งติด ระบบล็อกบัญชี LINE นั้น 30 นาที
- บัญชี LINE เดียวเชื่อมได้หลายนักเรียน (พี่น้อง) แต่นักเรียน 1 คนเชื่อมได้ 1 บัญชี LINE — ถ้าเปลี่ยนผู้ปกครองให้นำเข้าใหม่ (เลขบัตรเปลี่ยน = ยกเลิกการเชื่อมเดิมอัตโนมัติ) หรือเรียก `unlinkParentLine`
- ระเบียนเก่าที่ใช้ SHA-256 (`parentNationalIdHash`) ใช้ไม่ได้อีก ต้องนำเข้าผู้ปกครองใหม่

## หมายเหตุ
- การทดสอบ LINE จริงต้องทำบนมือถือ/โดเมนจริง (ใน emulator ไม่มี LINE)
- endpoint ตรวจ token: `POST https://api.line.me/oauth2/v2.1/verify` (id_token + client_id) — ตรวจเทียบเอกสาร LINE ก่อนขึ้นระบบจริง
