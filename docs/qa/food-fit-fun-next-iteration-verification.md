# Food Fit Fun — Next iteration verification

วันที่ 2026-10-03 · ขอบเขต: docs/plans/food-fit-fun-next-iteration.md และการแก้บทฝึก/ไม่ฝึกซ้ำที่ผู้ใช้ยืนยัน

## สิ่งที่พัฒนา

- Objective-only modal และ typography สำหรับ manual/camera พร้อม layout จอเตี้ย
- GuidedTutorial แยกจาก RunSession: เดินช้า → หยุด → รอเข้าเลนเป้าหมาย 300ms → เดินต่อ; input ยังทำงานขณะหยุด; สามขั้นเลือกเลน/เก็บแอปเปิล/ประตูทดลอง
- บันทึก completed/skipped ด้วย localStorage ต่อ playerId และมี memory fallback เมื่อ storage ใช้ไม่ได้ บันทึกก่อนรอบจริง; ฝึกอีกครั้งใน Settings ไม่ล้างสถานะเดิม
- Camera hold-start: ลดมือก่อน แล้วค้างมือข้างเดิมเหนือไหล่ 1.5s พร้อม progress ring; reject stale/invalid pose; ไม่ใช้ jump pulse; ถ้าหลุดระหว่าง countdown แรกกลับมารอ gesture อีกครั้ง
- ไอเท็ม 12 แบบ มีโมเดล/ป้ายชื่อและประเภทผล; seeded rows, 2 แถวช่วงต้น/3 แถวช่วงท้าย, มีเลนว่าง และไม่ทับ quiz approach
- BMI จำลอง multiplier .0025, ของเพิ่ม +18/+28, ของคืน 20/30 เข้าศูนย์สองทิศ, เพดาน ±25%, ผล pickup/missed-meal มี delta จริงหลัง clamp ไม่แก้โปรไฟล์
- One-shot event feedback สำหรับ pickup/quiz, 3D burst, เฉลยคำตอบผิด, terminal presentation 1s ก่อนแสดงผลรอบ
- เสียงสังเคราะห์ที่สร้างเอง + ambient chord layer; แยก SFX/ambient slider, mute, reduced motion, จดจำ input mode; unlock จาก tap/click/keypress ระหว่าง setup ก่อน gesture camera
- เปลี่ยน levelVersion เป็น learning-variety-10-gates-v4, scoringVersion เป็น learning-1500-v2, bodyModelVersion เป็น bmi-visual-simulation-v2 เพื่อไม่รวม high score ต่างกติกา

## Automated verification

`npm run test`: **64/64 ผ่าน**, 13 test files

ครอบคลุม hold-start ที่ 8fps/ลดมือ/สลับมือ/เฟรมเก่า/ความมั่นใจต่ำ, tutorial หยุดรอและไม่แตะ real run, ต่อโปรไฟล์และ storage failure, seeded item layout/ระยะก่อน gate/ทางหลบ, BMI recovery และ clamp, event drain ครั้งเดียว, audio unlock failure/mute/cleanup รวมถึง regression กติกา 10 gates, 3 wrong streak, ข้อ 10, duration และ camera fallback เดิม

`npm run build`: **ผ่าน** (TypeScript + Vite); มีคำเตือน bundle >500kB เช่นเดียวกับโครงสร้าง Three/MediaPipe เดิม

`git diff --check`: ผ่าน

## Browser verification — local Chromium / Codex in-app browser

- Objective checkbox + OK → title / Play / Settings
- ใช้โปรไฟล์ QA ทดลองเดิม ไม่แก้ข้อมูลผู้เล่นจริง
- เล่นบทฝึกครบด้วย A/D; หยุดรอได้และเดินต่อเมื่อเลนถูก; ใช้ mouse drag เป็น pointer swipe ผ่านขั้นแรกได้
- เข้า real run แล้ว BMI รีเซ็ตจาก 26.8 ในบทฝึกกลับ 25.0 จากโปรไฟล์ สีเริ่มยังเป็นแดงตามช่วงอ้างอิง
- เล่นจน Game Over จาก 3 wrong streak; เห็น feedback เฉลยก่อนหน้าผล และคำถามยังไม่ถึงไม่ถูกนับผิด
- หลัง Game Over → Play อีกครั้ง และหลัง reload → Play: เข้ารอบจริง countdown ทันที ไม่มีบทฝึกซ้ำ
- Settings → ฝึกอีกครั้งเปิดบทฝึกได้; ปรับ SFX จาก 60% เป็น 40% และลองเสียงโดยไม่มี error/UI blockage; หลัง reload ยังจำ SFX 40% และ manual input mode
- จอ 390×844: คำถามไทยและคำตอบ 3 ช่อง wrap ครบ ไม่ตัดข้อความ
- จอ 1024×768: ตรวจ HUD/quiz/BMI; จอ 844×390: แก้ tutorial card ที่ทับ BMI ด้วย BMI แบบย่อใน card และตรวจกรอบไม่ล้นความสูง
- หลัง reload รุ่นสุดท้าย ไม่มี console error ใหม่ใน flow ที่ตรวจ; ระหว่าง Vite hot reload เคยมี instance ของ GuidedTutorial รุ่นเก่าค้างเมื่อเพิ่ม method จึงเกิด TypeError ชั่วคราว แก้ session พัฒนาด้วย full reload และตรวจใหม่

หลักฐาน: [บทฝึก](food-fit-fun-guided-tutorial.png), [Tablet quiz](food-fit-fun-tablet-quiz.png), [บทฝึกแนวนอน](food-fit-fun-tutorial-landscape.png)

## ขอบเขตที่ยังไม่ยืนยัน

- ยังไม่ได้ทดสอบกล้องจริง/hold-start/readability ระยะ 2–3 เมตร บน iPhone/iPad Safari และ Android Chrome
- ยังไม่ได้ยืนยันเสียงที่ได้ยินจริง/การ unlock หลังสลับแอปบนอุปกรณ์มือถือเหล่านั้น; tests ใช้ AudioContext fake และ browser QA ตรวจการทำงานของ UI
- Full finish ที่ข้อ 10 และ active play 180s ยืนยันด้วย RunSession tests; browser รอบนี้ตรวจเส้นทาง Game Over ไม่ได้เล่นครบถึงเส้นชัย
- รอบนี้พัฒนาและตรวจบน local เท่านั้น ยังไม่ได้ deploy การเปลี่ยนแปลงชุดนี้ไป Vercel

Storage ยังอยู่เฉพาะอุปกรณ์; shared database คงเป็น backlog และไม่มีการเปลี่ยน camera detector/fallback ในงานชุดนี้

## Follow-up: camera tracking recovery (2026-10-03)

ผู้ใช้ขอให้กล้องหลุดระหว่างเล่นแล้วใช้ calibration + hand hold เหมือนตอนเริ่ม

- เพิ่ม CameraRecovery ที่ pause/invalidate รอบเดิมและเรียก PoseMapper.recalibrate + HandHoldStart.reset ครั้งเดียวต่อเหตุ
- ใช้หน้า gesture เดิมพร้อมข้อความ “ตั้งท่ากลางใหม่ก่อนเล่นต่อ” / “ยกมือค้างไว้เพื่อเล่นต่อ”
- เก็บ runId, ระยะทาง, คะแนน, คำถาม, answer log และเวลาช่วงเลือกคำตอบเดิมไว้; บทฝึกกลับไปขั้นเดิม
- Hold สำเร็จเริ่ม countdown ก่อน resume; ถ้ากล้องหลุดอีกใน countdown ให้กลับ calibration ใหม่; มี manual fallback
- Tests ล่าสุด **67/67 ผ่าน** (14 files), production build และ diff check ผ่าน
- Tests ใช้ RunSession/PoseMapper/HandHoldStart จริงกับ pose จำลอง: freeze mid-question, recalibrate ไม่ถูก reset ซ้ำ, hold ใหม่, countdown ยังไม่เดินเกม และไม่เปิด terminal run ใหม่
- ยังไม่ได้ยืนยัน recovery กับกล้องบนอุปกรณ์จริง; browser รอบนี้ตรวจหน้า local โหลดได้หลังเปลี่ยนโค้ด
