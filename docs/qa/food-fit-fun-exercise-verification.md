# Food Fit Fun — ตรวจรับอายุ / ป้ายไอเท็ม / กระโดด

วันที่: 2026-10-03 · Local checkout เท่านั้น ยังไม่ deploy Vercel

## งานที่เปลี่ยน

- ช่องอายุไม่มี min/max รับปีเต็มไม่ติดลบ รวม 0 ปี ไม่ล็อกเด็ก 9–12 ปี; จำกัดเพียงข้อมูลตัวเลขที่คำนวณอย่างปลอดภัยได้
- BMI ตัวเลขยังคำนวณได้ทุกอายุที่ข้อมูลถูกต้อง; ไม่มีตารางอ้างอิงให้ใช้แถบสีกลาง; EER ไม่ใช้สมการ 9–12 ปีนอกช่วง
- Question bank schema 2 รองรับขอบบน null; schema 1 ที่มีช่วงอายุเดิมยังอ่านได้; demo เป็นชุดความรู้ทั่วไปตั้งแต่ 0 ปีแบบ draft โดยไม่มีขอบบน การรับโปรไฟล์ไม่ได้ยืนยันว่าเนื้อหาเหมาะกับทุกวัย คลังจริงยังกรองช่วงอายุที่ผู้ดูแลกำหนด
- ลบ floating plaque ชื่อ/คำอธิบายเหนือไอเท็มและชื่ออาหารใน pickup feedback; ชื่อภายในยังใช้ในผลสรุป
- เพิ่ม SHOES/DUMBBELL/ROPE รอบละ 5 จุด เป็นไอเท็มเลือกเก็บด้วยการกระโดด ลด balance 20 จุดและ BMI จำลอง 5% ของค่าเริ่มต้นก่อนชนขอบ; พลาดไม่มีโทษ
- กระโดดผ่าน Space/↑, swipe ขึ้น หรือปุ่ม; กล้องใช้ torso rise แยกจาก hand hold; landing/cooldown/fresh-frame guard; renderer อ่าน jump progress ไม่เรียก legacy physics ซ้อน
- บทฝึกผู้เล่นใหม่ 4 ขั้น; ผู้เล่นเก่าเรียนเฉพาะ jump ใหม่ครั้งเดียว; ต่อรอบจริงแล้วรีเซ็ตค่าฝึก ไม่ปนคะแนนจริง
- tracking pause/invalidate/input mode change ยกเลิก jump window เก่า; recovery ใช้รอบเดิมตามก่อนหน้า
- level/body/content/tutorial version เปลี่ยนเพื่อแยกประวัติและคะแนนตามกติกา

## Automated

- `npm run test`: 78/78 ผ่าน ใน 16 test files
- `npm run build`: ผ่าน มีคำเตือน bundle >500kB ที่มีอยู่เดิม
- `git diff --check`: ผ่าน
- ครอบคลุม upper/lower age restrictions, EER guard, bank schema/eligibility, jump at 8fps/15fps, wrist hold independence, invalid/stale pose, landing/cooldown, optional exercise miss, pause cancellation, BMI delta/clamp, gesture directions, tutorial upgrade และกติกา 10 ประตู/3 นาที/แพ้ 3 ข้อติดเดิม

## Browser QA ที่ทำจริง

ทดสอบ Chromium ใน Codex in-app browser ที่ `http://127.0.0.1:3000/` ผ่าน UI ปกติ ใช้โปรไฟล์ QA ทดลองในเครื่อง

- ช่องอายุมี min/max เป็น null ทั้งคู่
- กรอก 5 ปี บันทึกและเริ่มชุดทดลองได้ แถบ BMI ใช้สีกลางเพราะไม่มีข้อมูลอ้างอิง
- โปรไฟล์ที่ผ่าน tutorial เก่าเห็นเฉพาะบทกระโดด “ขั้น 1 / 1”; หยุดรอ action
- กด Space แล้วบทฝึกเดินต่อและเข้าสู่รอบจริงได้
- กลับเมนู กรอก 60 ปี เริ่มรอบได้ และข้าม tutorial ที่เรียนใหม่แล้ว เหลือ countdown ก่อนรอบจริง 180 วินาที
- ปุ่มกระโดดวางแยกจากแถบ BMI และคำแนะนำ บทฝึกไม่มีป้ายชื่ออาหาร

ภาพ: [บทฝึกกระโดด](food-fit-fun-jump-practice.png)

## ยังไม่ได้ตรวจจริง

- กล้องบน iPhone/iPad Safari และ Android Chrome, ความแม่นยำขณะกระโดดจริง, มือถือไกลจอ, กล้องสั่น และผู้เล่นหลากหลายส่วนสูง
- Touch swipe บนอุปกรณ์จริงและเสียง browser autoplay บนอุปกรณ์จริง; logic directions ผ่าน unit tests เท่านั้น
- การสั่น/ขยับของกล้องทั้งภาพอาจคล้าย torso translation; detector ปัจจุบันตรวจความสอดคล้องของไหล่/สะโพกและขนาดลำตัว ไม่ยืนยันการแยก camera motion ทุกกรณี

ยังไม่เพิ่ม FPS ของกล้องเพื่อหลีกเลี่ยงการเปลี่ยน performance ของ fallback มือถือโดยไม่มีข้อมูลจริง ต้อง playtest threshold และจังหวะเก็บก่อนยืนยันพร้อมใช้บนมือถือทุกเครื่อง
