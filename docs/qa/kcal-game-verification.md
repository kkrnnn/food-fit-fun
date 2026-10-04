# Food Fit Fun · kcal verification

วันที่ 4 ตุลาคม 2026 · Asia/Bangkok

## ผลที่ดำเนินการแล้ว

- เกมเริ่มอาหารสะสม 0 kcal ใช้ input เพศ น้ำหนัก ส่วนสูง อายุเดิม; ป้ายใหม่ “ชื่อเล่น”, “เพศ”
- EER ตาม DRI 2023 แยกจาก intake และแสดงสมมติฐานกิจกรรมน้อย; ไม่รองรับต่ำกว่า 3 ปีหรือ input ผิด โดยไม่สร้างค่าทดแทน
- อาหารทั้ง 12 ชนิดมีหน่วยบริโภคและ primary source รวมสูตรมื้อข้าว 394 kcal; น้ำ 0 kcal กิจกรรมใช้ค่าประมาณอ้างอิง 1 นาทีตามน้ำหนัก พร้อม source/model snapshots
- ตัวเลข `+N kcal` เป็น sprite ที่หันเข้ากล้องตรงวงเก็บไอเทม ไม่มีกล่องข้อความ pickup ฝั่งซ้าย; narration อาหาร/portion ยังคงผ่าน screen reader
- ตัวละครเริ่มขนาดปกติ ค่อย ๆ ขยายเฉพาะ intake เกิน EER สูงสุด 1.65 เท่าความกว้างเดิม รูปร่างเป็นเอฟเฟกต์เกม ไม่ใช่การทำนายน้ำหนักจริง; EER unavailable ไม่ขยาย
- ปรับกล้วยและจานข้าวอกไก่บรอกโคลี; ดู [ภาพโมเดล](kcal-food-models.jpg) และ [หน้า preview ที่ใช้โมเดลเดียวกับเกม](kcal-collectible-preview.html)
- ยังคง 10 คำถามตาม fixed distance, ไม่มี obstacles, กระโดดหลบ ground food/เก็บ exercise, ผิด 3 ข้อติดกัน Game Over
- คะแนนสูงสุด 1,500 จากคำตอบและระยะทาง ไม่ขึ้นกับ kcal; high score แยก scoring version
- Record schema 2 เก็บ snapshots intake/EER/foods/model/catalog; ไม่ backfill BMI เก่า ไม่ overwrite รอบจบด้วยข้อมูลใหม่

## Automated verification

`npm test -- --maxWorkers=2` ผ่าน **29 files / 156 tests** และ `npm run build` ผ่าน หลังแก้กิจกรรม 1 นาทีและสรุปผลไม่มีแบรนด์ครบ

ครอบคลุมสูตรพร้อมตัวอย่าง/ขอบเขตอายุ, อาหาร 12 ชนิดผ่าน public gameplay commands, น้ำ 0, unavailable state, รูปร่างขยายหลังเกินเป้า/ขนาดสูงสุด/เริ่มรอบใหม่, jump/quiz/คะแนน, reload/snapshot immutable, exports, malformed analytics payload และ queue against API เก่า

`git diff --check` ผ่าน มี warning ขนาด bundle ของ Vite ตามเดิม ไม่ได้เปลี่ยนขอบเขตงานเพื่อ optimize bundle ช่วงแรก default concurrency เคย timeout ใน AmbientBeat/ParkWorld ที่ไม่ได้เปลี่ยน; final full run ใช้ 2 workers ผ่านทั้งหมด

## SQL / live Supabase

ทดสอบ migrations ทั้งหมดและ regression SQL ทั้ง 5 ไฟล์ใน PostgreSQL 15 ชั่วคราวผ่านครบ รวม `supabase/tests/kcal-energy.sql` และ `exercise-energy.sql`; valid kcal/unavailable/idempotent/ownership/invalid sum/BMI/fractional count/nonfood cases ใช้ rollback-only fixture ไม่เหลือแถวทดสอบ PostgreSQL ชั่วคราวปิดแล้ว

Applied `20261004000200_kcal_energy.sql` ไปยัง project เดิม `umsquyyfozhggogfnrak` ผ่าน SQL Editor พร้อมสคริปต์ลงทะเบียน history การอ่าน REST หลัง apply ยืนยันคอลัมน์ใหม่และ count **23 score / 4 feedback** เท่าเดิม การเรียก RPC ด้วย payload ทดลองที่ไม่ผ่าน validation คืน `invalid` และ count คงเดิม ไม่มีข้อมูลทดสอบถาวรเพิ่ม การลงทะเบียน history ถูกส่งในคำสั่ง SQL เดียวกัน แต่ยังไม่ได้อ่านกลับยืนยัน history table โดยตรง

## Browser verification

ใช้โปรไฟล์สังเคราะห์ QA kcal อายุ 10 ปี ชาย สูง 130 cm หนัก 30 kg ได้ ≈1,700 kcal/วัน ไม่มีการให้ permission กล้อง

- Desktop 1280×800: initial HUD, pickup และ game over ผ่าน ก่อนเปลี่ยนตำแหน่ง pickup ตามคำสั่งเพิ่มเติม [ภาพเริ่มต้น](kcal-desktop.jpg)
- Portrait 390×844: คำถาม/ตัวเลือก/HUD และตารางผลรอบผ่าน [คำถาม](kcal-mobile-question.jpg), [ผลรอบ](kcal-mobile-result.jpg); ภาพเหล่านี้ก่อนคำสั่งเพิ่มเติมเรื่อง sprite/รูปร่าง
- Landscape 844×390: รุ่นสุดท้ายคำถามกับ HUD แยกพื้นที่ ไม่มี popup ฝั่งซ้าย [คำถามรุ่นสุดท้าย](kcal-landscape-question-final.jpg)
- เห็น `+370 kcal` ตรงวงเก็บพิซซ่าในเกมจริง และเมื่อสะสม 3,050 kcal ตัวละครกว้างขึ้นจากเริ่มรอบ [รูปร่างหลังเกินเป้า](kcal-body-latest.jpg)
- หน้า preview โมเดลกล้วย/ข้าวไก่ผักใช้ factory เดียวกับเกม และ console ไม่มี error
- Console ของเกมรุ่นสุดท้ายไม่มี error ในรอบที่ตรวจ

ยังไม่ได้ทดสอบ Android เครื่องจริงและการควบคุมกล้องจริงในงานนี้; regression ของ input/jump ผ่าน automated suite

## Release status

### กิจกรรมจำลอง 1 นาทีและสรุปไม่มีแบรนด์

ผู้ใช้เลือกค่าประมาณตามน้ำหนักแทนค่าคงที่ 30 kcal ใช้ gross energy ของ NCCOR METy/Schofield สำหรับ 6–18 ปี และ Adult Compendium MET×น้ำหนัก/60 สำหรับ 19–59 ปี ไม่ใช้ adult coefficients กับเด็ก ค่าเริ่มรอบคงเดิมเมื่อแก้โปรไฟล์ เก็บเศษทศนิยมเต็มและปัดแสดงสูงสุด 1 ตำแหน่ง ต่ำกว่า 6 หรือ 60+ เก็บ exercise count ได้แต่ไม่สร้าง kcal=0 แทนค่าที่ไม่ทราบ; net เป็น null เมื่อมีการเก็บกิจกรรมที่ยังคำนวณไม่ได้

HUD และขนาดตัวละครใช้ยอดสุทธิ อาหารที่กินไม่ถูกลบออกจาก food tally คะแนนยังไม่ขึ้นกับ kcal ตารางอาหารกรองชื่อผู้ผลิตออกเฉพาะการแสดง แต่เก็บ portion/source snapshots เดิมครบ ตารางกิจกรรมแสดงจำนวน×ค่า 1 นาทีจริงของแต่ละกิจกรรม

Browser QA ใช้ [หน้า fixture](exercise-energy-preview.html) ที่เรียก public RunSession commands ผ่านรายการทั้งหมดและกระโดดเก็บทั้ง 10 exercise โดยเร่งเวลาในโมเดล ไม่มีการแก้ hidden state/สร้างยอดอาหารเอง/บันทึก local หรือ cloud จาก fixture แล้ว render EnergyResult component เดียวกับเกม เด็กชาย 12 ปี 40 kg ได้ exercise 56.8 kcal รวมจาก ROPE3, DUMBBELL3, SHOES4; ตารางไม่แสดง McDonald/Freschetta/Coca-Cola/Krispy Kreme และ console ไม่มี error [ภาพอาหาร](kcal-exercise-result-foods.jpg), [ภาพสรุปกิจกรรม](kcal-exercise-table.jpg)

Applied migration `20261004000300_exercise_energy.sql` และลงทะเบียน history บน live Supabase แล้วก่อน deploy API/client ที่ประกาศ `exerciseEnergyVersion=2` ยืนยัน schema/history เป็น true ทั้งคู่; regression SQL บน live ผ่านและ rollback ข้อมูลทดลองครบ จำนวนข้อมูลเดิมคงที่ **23 score / 4 feedback** Client เก็บรอบใหม่และ feedback ใน outbox เมื่อพบ API ที่ยังไม่รองรับ เพื่อป้องกันการทิ้ง deductions แบบเงียบ ๆ Migration รองรับ fixed30 snapshots ที่เคยเกิดระหว่าง QA โดยไม่คำนวณประวัติใหม่

### แก้เอฟเฟกต์ตามตัวละครและลดขนาดข้อความ

ผู้ใช้พบว่าย้ายเลนแล้วเอฟเฟกต์ค้างอยู่ที่เดิม สาเหตุคือ burst จดตำแหน่งตัวละครตอนสร้างเท่านั้น เพิ่ม offset สำหรับ pickup burst และอัปเดตจากตำแหน่งตัวละครทุกเฟรม ทั้งวงหลัก ตัวเลข และวง exercise รองรับ reduced motion โดยคงตำแหน่ง burst ของโหมดเดิมที่ไม่ได้ผูกกับผู้เล่นไว้

ลด sprite ของ kcal จาก 3.8×0.95 เป็น 2.85×0.7125 (เล็กลง 25%) โดยยังใช้ texture เดิมที่คมชัด

Regression `npm test -- src/game/three/PickupFollowing.test.ts --maxWorkers=2` เรียก learningPickup จริง เปลี่ยนตำแหน่ง runner แล้วเรียก frame updater จริง ก่อนแก้ล้มทั้ง 3 tests เพราะ burst.x ยังคง 0 เมื่อ runner.x เปลี่ยนเป็น ±2.4 หลังแก้ผ่านครบ รวมแนวตั้งและ reduced motion; full suite/build ผ่านตามจำนวนล่าสุดข้างต้น ตรวจเกมด้วยปุ่ม Right/Left และเห็นวงพร้อม `+80 kcal` อยู่ที่ตัวละครหลังย้ายกลับกลาง [ภาพล่าสุด](kcal-following-smaller.jpg)

ผู้ใช้อนุมัติ commit, push และ deploy Vercel production ชัดเจนวันที่ 4 ตุลาคม 2026 ตรวจซ้ำ full suite 29 files / 156 tests, build และ diff check ผ่าน พร้อม migration บน live ก่อน deploy

Production รุ่นสุดท้ายจาก commit `dff59d5` (ต่อจาก feature `b88c3ad`) ขึ้น **Ready** และ alias [food-fit-fun.vercel.app](https://food-fit-fun.vercel.app) แล้ว [Deployment](https://vercel.com/dream-league1/food-fit-fun/6KR7iMfbaN4reZyFfN9j2uY1Ju97). `git ls-remote` ยืนยันทั้งสอง commits บน origin/master. GET `/api/analytics/runs` บนโดเมนจริงตอบ 200 พร้อม `enabled=true`, `runSchemaVersion=2`, `exerciseEnergyVersion=2`. Native Node smoke check ผ่านทั้ง runs/feedback entry points. Browser เปิดหน้า production หลัง deploy รอบแก้ไขได้ และแสดงประกาศข้อมูลพลังงานรุ่นใหม่ [ภาพ production](kcal-vercel-production.jpg). ไม่สร้างผลเล่นผู้ใช้ใหม่ระหว่าง release QA; Android เครื่องจริงและกล้องจริงยังต้องทดสอบแยก

### Native Node API regression

Commit `b88c3ad` push ไป origin/master แล้ว deployment แรกขึ้น Ready แต่ GET `/api/analytics/runs` คืน 500 (`FUNCTION_INVOCATION_FAILED`). Runtime log ระบุ `ERR_MODULE_NOT_FOUND` จาก extensionless assessment import ของ energy.js. เพิ่ม `npm run test:runtime` ให้ compile entry points จริงและโหลดด้วย native Node ซึ่งล้มด้วยข้อความเดียวกันก่อนแก้ และผ่านหลังแก้. แยก profileValidation ที่ไม่มี BMI JSON, คง re-export เดิมของ assessment และใช้ `.js` สำหรับ runtime imports ใน energy/ExerciseEnergy. Full suite 156 tests และ production build ผ่านหลังแก้.
