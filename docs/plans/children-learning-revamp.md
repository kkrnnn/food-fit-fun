# BODY RUSH — Revamp เกมเรียนรู้สำหรับเด็ก

วันที่: 2026-10-02 · ปรับล่าสุด: เร็วขึ้น 2 เท่า / รอบ 3 นาที / คำตอบด้านบน / BMI เริ่มตัวละคร / gate ข้อ 10 เป็นเส้นชัย · สถานะ: implement แล้วใน checkout นี้; คลังจริงและ physical camera playtest ยังรอ

## ข้อกำหนดล่าสุดจากผู้ใช้

เอกสารนี้แทนแผนเดิมที่มีช่วงหยุดอ่าน quiz และช่องอายุเดือน/ระดับกิจกรรม

1. เปิดด้วย modal Introduction + Objective เป็น lorem ipsum; ติ๊กว่าอ่านแล้วจึงกด OK
2. หน้าถัดไปเป็น Title BODY RUSH มี PLAY, SETTINGS และวิธีเล่น
3. PLAY เปิดฟอร์มชื่อเล่น อายุเป็นปี เพศ ส่วนสูง น้ำหนัก และสีตัวละคร; บันทึกแล้วเริ่มรอบ แก้ไขได้ภายหลัง ไม่มีช่องเดือนและกิจกรรม
4. SETTINGS เลือกกล้อง/ปุ่ม คุณภาพภาพ ชุดคำถาม ผู้เล่นที่บันทึกไว้ ผู้เล่นใหม่ และข้อมูลสำหรับผู้ดูแล
5. วิ่งสามเลน เก็บ item ไม่มีสิ่งกีดขวาง ไม่กระโดด ไม่ endless
6. Quiz เป็นประตูที่มีคำตอบบนฉาก 3D พร้อมคำถามและตัวเลือกคำตอบด้านบน ไม่มีเลขหรือชื่อเลนบนตัวเลือก วิ่งต่อเนื่องระหว่างตอบ ไม่มี modal หยุดอ่านหรือปุ่มยืนยันคำตอบ
7. รอบละ 10 ข้อ ตามระยะคงที่ ผิดติดต่อกัน 3 ข้อ Game Over; ตอบถูก reset streak
8. Result มีคะแนน high score สมดุลจำลอง คำตอบถูก/ผิด และเฉลยเฉพาะข้อที่ตอบแล้ว
9. สุ่มคลังเป็นชุดไม่ซ้ำ เก็บประวัติ/คำตอบ/อายุเพื่อ analytics ในเครื่อง

## Flow และ UX

`Intro modal → Title → PLAY → Profile → Countdown → Run / live gates → Finish หรือ Game Over → Result`

- Intro modal ปิดได้หลัง checkbox; ข้อความ Intro/Objective เป็น placeholder ตามคำขอ
- Title ใช้โลก 3D เต็มฉาก โลโก้ใหญ่ ปุ่ม PLAY สีชมพู SETTINGS สีอ่อน
- Profile เป็น draft; ยกเลิกไม่แก้ข้อมูลเดิม; ชื่อเล่น/รหัสผู้เล่นแทนชื่อจริงได้
- ข้อมูลอายุรองรับ 9–12 ปี บันทึก `agePrecision=years`; `ageMonths=years*12` เป็น representation ภายใน ไม่ใช่อายุเดือนที่วัดจริง
- Camera ใช้ไหล่/ลำตัวเลือกเลน ระบบเดิม MediaPipe; เปิด/ตั้งท่ากลางก่อนเริ่ม มีปุ่ม/สัมผัสสำรอง
- Tutorial ทดลองเก็บ item/ตอบประตู ไม่บันทึกคะแนน
- HUD: ระยะทาง ข้อปัจจุบัน ผิดติดกัน; คำถามและคำตอบ 3 ช่องอยู่ในแผงเดียวกันด้านบน ตำแหน่งช่องสอดคล้องเลน และมีข้อความบนประตู 3D
- เฉลยหลังผ่านประตูเป็นข้อความชั่วคราว 2.5 วินาที เกมยังวิ่งต่อ
- Pause เฉพาะผู้เล่นพัก แท็บซ่อน หรือกล้องหลุด; เล่นต่อ countdown 3 วินาที
- มือ/ท่ากระโดดไม่ใช้ใน learning mode
- UI มี focus trap/inert สำหรับ modal, responsive sheets, scroll ในฟอร์มและผลลัพธ์

## กติกาด่าน

- ระยะทั้งหมด 2880 หน่วยในเกม ความเร็วคงที่ 16 หน่วย/วินาที (เร็วกว่าเดิม 2 เท่า) รวม 180 วินาทีไม่รวม countdown/pause
- ประตูห่างกัน 288 หน่วย ที่ 288,576,…,2880; ประตูคำตอบข้อ 10 เป็นเส้นชัย ไม่มีช่วงวิ่งหลัง quiz อีก
- เปิดคำถาม/ประตูล่วงหน้า 96 หน่วย = 6 วินาที ช่วงนี้ไม่มี item
- ระยะทางเดินหน้าจริงในช่วง quiz; เลนเมื่อผ่านประตูเป็นคำตอบ ไม่ต้องกด OK
- เลนต้องมีข้อมูล valid และนิ่งอย่างน้อย 300 ms; กล้อง invalid ไม่ตัดสินคำตอบ
- การเปลี่ยนเลนในจังหวะเส้นตัดสินรอให้เลนนิ่งก่อน ไม่เลือกข้อมูลเก่า
- Frame ใหญ่ clamp ที่จุดเปิดคำถาม/ประตูแรก ไม่ข้ามหลายคำถามในหนึ่ง update
- ผิด +1, ถูก reset 0, ผิดครบ 3 terminal ทันที; ข้อที่ 10 ผิดครบ 3 ถือ Game Over ก่อนเส้นชัย
- Terminal เกิดครั้งเดียว ไม่มี item/คำตอบเพิ่มหลังจบรอบ
- ยังไม่ถึงคำถามไม่นับว่าผิด; ออกจากรอบ/รีโหลดเป็น abandoned

## Item และความหมายสุขภาพ

แต่ละช่วง 288 หน่วยมีแถว item ที่ +57.6 และ +129.6; เลนมีคู่ good/bad พร้อมช่องว่าง

- APPLE: คืนสมดุลจำลองเข้าหา 0 ไม่ overshoot เป็นผอมกว่าเดิม
- WATER: ตัวเลือกเครื่องดื่ม ไม่เปลี่ยน BMI หรือกิโลกรัมจริง
- BURGER/COLA: เพิ่มค่าสมดุลจำลอง +10 เป็นกติกาการเลือกแต่พอดี
- พลาดแถวอาหารหลัก: -12 เพื่อสื่อเติมให้พอดี ไม่มีการเสียชีวิตจากอาหาร/ความหิว
- ช่วงสมดุล [-20,20]; เก็บสัดส่วนระยะทางที่อยู่ในช่วงนี้
- BMI จากข้อมูลกรอกเป็นฐานสัดส่วนตัวละคร; BMI ตัวละครจำลอง = initialBMI × (1 + balance × 0.0015), จำกัด balance ±100. ความกว้าง torso = clamp(simulatedBMI / 18, 0.75, 1.5). เลข 18 เป็นจุดตั้งต้นด้านภาพ ไม่ใช่ threshold สุขภาพของเด็ก ไม่มีการจัดกลุ่มอ้วน/ผอมตามเกณฑ์ผู้ใหญ่; collider/ความสามารถ/คะแนนไม่เปลี่ยนตาม BMI
- BMI จริงคำนวณจากข้อมูลก่อนเล่น ไม่เปลี่ยนตาม item ไม่ใช้คำว่า BMI หลังเกมกับค่าจำลอง
- ไม่ให้ความผอมเป็นรางวัล และไม่จัดอันดับเด็กตามรูปร่าง

## BMI และ calories

`BMI = weightKg / (heightCm / 100)^2`

สูตร BMI ตัวเลขพร้อมใช้ ตาราง CDC และสมการ EER DRI 2023 อยู่ใน domain module พร้อม source/test vectors ที่ [health reference](learning-health-reference.md)

**ข้อจำกัดของ flow ล่าสุด:** รับอายุเพียงปี จึงแสดง raw BMI และ “ยังไม่แปลผลตามวัย”; ไม่สมมติอายุเดือนเพื่อจัดกลุ่ม BMI-for-age ของเด็ก และไม่มีข้อมูลกิจกรรมจึงไม่แสดงเลข EER ที่เดาไว้ สูตรยังอยู่สำหรับข้อมูลเก่าที่ครบเท่านั้น raw BMI แสดงเป็นฐานตัวละครใน HUD ส่วนการแปลผลสุขภาพอยู่ใน disclosure สำหรับผู้ดูแล ไม่เกี่ยวกับคะแนน

## คลังคำถาม

- มี draft demo 20 ข้อสำหรับตรวจระบบ ติดป้ายชุดทดลองและแยกจาก analytics จริง
- ผู้ใช้จะส่งคลังจริงภายหลัง Import JSON ผ่านหน้าผู้ดูแล มี template ดาวน์โหลด
- `QuestionBank`: schemaVersion, contentVersion, blueprintVersion, questions
- `Question`: questionId, revision, topic, difficulty, ageRange [min,max) เดือน, learningObjective, prompt, 3 options พร้อม optionId, correctOptionId, explanation, source, reviewStatus
- คลังจริงใช้เฉพาะ reviewed และอายุที่รองรับ ต้องมีอย่างน้อย 10 ข้อ ไม่เติม draft เมื่อคลังไม่พอ
- สุ่ม seeded แต่ละรอบ 10 ข้อ unique; shuffle options แยกจาก correctOptionId
- เรียง exposure ต่ำสุดก่อน: คำถามยังไม่เคยเห็นมาก่อน จนหมด pool แล้ววนชุดใหม่โดยไม่ซ้ำในรอบ
- Consume exposure เฉพาะข้อที่ปรากฏ ไม่ใช่ทั้งหมดที่วางแผน; game over ก่อนถึงข้อไม่ consume ข้อนั้น
- เพิ่มเนื้อหาหรือแก้คำถามต้องเปลี่ยน contentVersion; import เปลี่ยนเนื้อหาภายใต้ version เดิมถูก reject
- เก็บชุดและ option mapping ลง run snapshot เพื่อ audit/review

## Persistence / Analytics

IndexedDB `body-rush-learning-v1`: profiles, runs, decks, settings; ไม่ส่งข้อมูลขึ้น server

- playerId สุ่มเฉพาะเครื่อง แก้ profile คง ID; ผู้เล่นใหม่ได้ ID ใหม่
- Run snapshot: age precision/age at start, profile/content/blueprint/level/scoring versions, seed, input timeline, outcome, item counts, tracking pauses, answers, balance/distance/score, initialBmi/simulatedBmi/bodyModelVersion (สองค่า BMI ไม่รวมใน analytics export)
- Answer: questionId/revision/topic/options, selected/correct IDs, correctness, selectionMs, wrongStreakAfter, exposureCount/isFirstExposure
- Progress save และ exposure update อยู่ใน transaction เดียว; stale writes ไม่ undo terminal หรือทำคำตอบหาย
- รีโหลด recover เฉพาะ runId ของแท็บนั้นผ่าน sessionStorage เพื่อไม่ abandon เกมที่เล่นในแท็บอื่น
- Save failure แจ้งและ retry; storage ใช้ไม่ได้เล่น session-only โดยแจ้งชัด
- High score แยกผู้เล่น/content/blueprint/level/scoring/input/demo; exclude abandoned
- Score = ถูก×100 + round(ระยะสมดุล/2880×200) + completed×300; สูงสุด1500
- Analytics แยก demo, filter content/blueprint/input และ first exposure; รายงาน unique players/runs/answered/correct ตามอายุปี topic และข้อคำถาม
- Unreached ไม่นับ denominator ความถูกต้อง; ถ้าไม่มีคำตอบแสดง unavailable
- Export JSON + CSV runs/answers (linked runId/playerId), ไม่ export ชื่อ/ส่วนสูง/น้ำหนักหรือ answer keys ข้อที่ยังไม่ถาม; CSV escape formula injection
- ล้างผู้เล่นลบ profile/run/deck/high score ของคนนั้น; ล้างทั้งหมดมี confirmation ใน UI

## Implementation map / งานส่งต่อ

| ส่วน | ไฟล์หลัก | สถานะ |
| --- | --- | --- |
| Domain rules / continuous gates | src/game/learning/RunSession.ts | implemented + tests |
| Question deck / draft bank / import validation | src/game/learning/QuestionDeck.ts | implemented + tests |
| 3D renderer adapter / answer banners | src/game/three/GameEngine3D.ts | implemented; legacy entryไม่ถูก mount |
| Title / modal / gameplay / camera adapters | src/features/learning/LearningGame.tsx | implemented |
| Modern responsive UI | src/features/learning/LearningGame.css | implemented |
| Profile / raw BMI caregiver disclosure | src/features/profile/ProfileForm.tsx | implemented |
| Reference formulas | src/features/health/assessment.ts | implemented + tests; UI data limitations above |
| IndexedDB / high score / analytics export | src/features/analytics/RunRepository.ts | implemented + fake IndexedDB tests |
| Caregiver dashboard/import | src/features/analytics/AnalyticsPanel.tsx | implemented |

งานต่อไปตามลำดับ:

1. นำเข้าคลังคำถามจริงที่ผู้ดูแลตรวจเนื้อหาแล้ว พร้อม source/objective/difficulty และ version
2. Playtest เด็ก 9–12 ปีด้วยกล้องจริง ทบทวนเวลาอ่าน 6 วินาที ขนาดข้อความประตู และระยะ item; ปรับ tuning แล้ว bump levelVersion
3. เปลี่ยน lorem ipsum Intro/Objective เป็นเนื้อหาจริง
4. หากต้องการแปลผล BMI/EER จริงอีกครั้ง ให้กำหนดข้อมูลที่เพียงพอกับผู้ใช้ก่อน ไม่เติมเดือนหรือกิจกรรมเอง
5. ตรวจแหล่งอ้างอิงไทย/WHO กับผู้ดูแลเนื้อหาก่อนใช้กลุ่มสุขภาพในงานจริง

## Verification

- `npm test`: behavior tests streak/reset/end-on-ten, continuous distance/pause/control validity, item once/balance bounded, deck rollout/import, profile references, repository/exposure/recovery/exports, existing camera mapper
- `npm run build`: TypeScript + Vite production build
- Browser QA: modal/Title/profile/Settings, live gates while distance changes, early Game Over, finish/replay/reload and caregiver analytics; desktop + narrow viewport
- Physical camera playtest แยกจาก automated mapper tests ไม่อ้างว่าเทสต์ด้วยเด็กหรือกล้องจริงจนกว่าจะทำ

### BMI meter and character follow-up
- Meter position and color use current simulated BMI with age/sex reference; high initial BMI is red immediately. Whole-year uncertain boundaries remain amber (see health reference).
- Replace box torso and backpack with a smooth lathed jersey, rounded head/hair, oval day pack, capsule limbs and rounded running shoes. Shoulder and hip positions follow body width to keep limbs attached across BMI shapes.
- Running animation bends knees, swings bent arms, and adds a small body bounce; keep the pose while paused and reset it for the title preview.

### Runner pose, shadows and keyboard follow-up
- Correct knees to fold heels toward +Z (the runner faces -Z); bend elbows toward the front. Reduce hip/arm swing and body bounce.
- Use one feathered contact shadow; runner meshes do not cast a second directional silhouette. Keep scenery shadows.
- Remove the running HUD arrow buttons. In keyboard mode, physical A/D moves one lane exactly like left/right arrow keys, even when the keyboard layout is Thai; arrow and number keys remain supported. Camera mode keeps camera authority.

### Food Fit Fun name and mobile gestures
- Public name is Food Fit Fun in browser title, introduction, title screen, gameplay HUD and analytics download filenames. Keep existing internal storage keys so local profiles and runs survive the rename on the same origin.
- Manual mode supports keyboard and pointer swipes: horizontal movement >=40 CSS px, more horizontal than vertical (1.5x), within 800 ms, changes one lane. Pointer capture tracks release outside the starting area; cancelled gestures and secondary pointers clear the gesture.
- Swipes do not begin on controls/dialogs or during pause/countdown. Camera mode keeps camera authority. Mobile shows a small swipe hint; mouse drag shares the same handler for browser verification.
- Vercel project renamed in place from body-rush to food-fit-fun, keeping the same project ID.

### Backlog: shared database / cross-device history (2026-10-03)
- User decision: keep each player's data local for now; defer the shared database.
- Current persistence stays IndexedDB for profiles/runs/decks and localStorage for preferences/active player, partitioned by playerId. Different devices/browsers/origins do not share history.
- Future scope and acceptance criteria: [shared-database.md](shared-database.md). No database provisioning or sync deployment is part of the current release.

### Mobile camera loading fallback
- Camera permission is independent of worker support. Request the front camera and set muted/inline attributes before starting video.
- iPhone/iPad, missing Worker/bitmap/offscreen support, worker initialization errors, stalled worker loading (15s), and bitmap failures use a lazy DOM-backed MediaPipe detector with explicit HTML canvas.
- Fallback samples at 8fps to reduce main-thread work; pause/stop/visibility guards remain. A 30s fallback timeout shows an actionable error rather than loading forever.
- Dispose workers and detectors on switch/cancel and close late-created detectors after cancellation. Classic SIMD and no-SIMD WASM assets match the installed MediaPipe version and are self-hosted.
