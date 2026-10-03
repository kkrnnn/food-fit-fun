> Revised scope: [two-table analytics](two-table-analytics.md). Active baseline creates only score + feedback; the old six-table plan below is historical.

# Food Fit Fun — ดาวความสนุกและ Supabase analytics

วันที่: 2026-10-03 (Asia/Bangkok)
สถานะ: IMPLEMENTED LOCALLY — ยืนยัน 3 รอบ, ข้ามแล้วเว้นอีก 3 รอบ, ดาวอย่างเดียว, ส่งแล้วไม่ถามอีก, เก็บทั้งจริง/ทดลองแยกกลุ่ม, Dashboard + export; ผู้ใช้เลือก Supabase project `umsquyyfozhggogfnrak` แล้ว รอตรวจ schema/server env และยังไม่เชื่อม cloud/deploy จริง

คู่มือตั้งค่า: [Supabase analytics](../setup/supabase-analytics.md). Verification: [ผลตรวจรับ](../qa/feedback-analytics-verification.md).

## เป้าหมาย

ให้ผู้เล่นตอบว่าเกมสนุกไหมด้วย 1–5 ดาวหลังเล่นหลายรอบ แล้วเก็บดาวร่วมกับคะแนนและผลการเล่นสำหรับ analytics รวมหลายเครื่อง คะแนนเกมกับดาวความสนุกเป็นคนละค่า ไม่บวกเข้าหากัน ดาวเป็นความเห็นต่อเกมของผู้เล่นครั้งเดียว ไม่ใช่การให้ดาวทุกรอบ

คำขอครั้งนี้กลับมาเปิดขอบเขต shared analytics ที่พักไว้ใน `shared-database.md` เฉพาะการเก็บผลรอบและ feedback ไม่ได้อนุมัติการซิงก์โปรไฟล์หรือประวัติข้ามเครื่อง

## สิ่งที่ตรวจจากโค้ดปัจจุบัน

- `App.tsx` เปิด `LearningGame` (Food Fit Fun) ไม่ใช่ `ThreeGame` รุ่นเดิม
- `RunRepository` ใช้ IndexedDB มี runId/playerId, คะแนน, outcome, เวลาเล่น, คำตอบรายข้อ, รุ่นเนื้อหา/สูตรคะแนน และวิธีควบคุมอยู่แล้ว
- `AnalyticsPanel` อ่านข้อมูลเฉพาะเครื่องและ export JSON/CSV ไม่มี login สำหรับข้อมูลส่วนกลาง
- Vercel ใช้ Vite static build ยังไม่มี API หรือ Supabase client
- หน้าผลลัพธ์ใน `LearningGame` เป็นจุดเพิ่มดาว; ใช้ข้อมูลรอบจริงที่จบแล้ว ไม่สร้างประวัติหรือคะแนนย้อนหลังขึ้นเอง

## แนวทางแนะนำ

เริ่มด้วย `เกม → Vercel API → Supabase Postgres` และดูรายงานด้วย Supabase Dashboard/SQL/export ก่อน ลดขอบเขตงานหลังบ้านระยะแรก โดยยังเก็บ local เป็นหลักและใช้ outbox ส่งเมื่อออนไลน์

Vite บน Vercel รองรับ Functions ใน `api/` ตาม [Vercel docs](https://vercel.com/docs/frameworks/frontend/vite). เก็บ Supabase secret key ใน server environment เท่านั้น เพราะ key นี้ข้าม RLS ได้ตาม [Supabase API keys](https://supabase.com/docs/guides/getting-started/api-keys). หากเพิ่มหน้ารายงานในเว็บ ต้องมีผู้ดูแลที่ยืนยันตัวตนและตรวจสิทธิ์ตาม [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).

## พฤติกรรมที่ยืนยันและค่าที่ยังเสนอ

- ยืนยัน: ถามหลังเล่นหลายรอบ ใช้ดาวอย่างเดียว เมื่อส่งแล้วไม่ถามผู้เล่นนั้นอีก
- ยืนยัน threshold 3 รอบ completed/game_over ต่อผู้เล่นในเครื่อง รวมจริง/ทดลอง; abandoned/interrupted และบทฝึกไม่เพิ่มตัวนับ เริ่มนับรอบใหม่หลังเพิ่ม feature
- เมื่อครบ threshold แสดง “เล่นมาหลายรอบแล้ว เกมนี้สนุกไหม?” กับ 5 ดาว: 1 = ไม่สนุกเลย, 5 = สนุกมาก
- เริ่มโดยไม่มีดาวที่เลือก ไม่ใช้ค่า default; เลือกดาวแล้วกด “ส่งความคิดเห็น” หรือ “ข้าม”
- ข้ามได้และเล่นต่อได้ทันที ถามอีกเมื่อเล่นเพิ่ม 3 รอบ การข้ามไม่ใช่ 0 ดาว
- บันทึกสถานะส่งแล้วใน local transaction เดียวกับ feedback/outbox และหยุดถามทันที แม้กำลังรอส่ง cloud; บันทึก local ไม่สำเร็จให้แจ้งและลองใหม่ได้
- 1 feedback ต่อ analyticsPlayerId ผูก contextRunId และจำนวนรอบก่อนตอบ; retry ไม่เปลี่ยนดาวหรือเพิ่มแถว
- ไม่ถามซ้ำรับประกันใน browser/origin ที่ยังเก็บข้อมูล local อยู่เท่านั้น เปลี่ยนเครื่องหรือล้างข้อมูลจำไม่ได้ เพราะไม่มีบัญชีข้ามเครื่อง
- เก็บ shown/skipped เป็น events แยกจากดาว เพื่อคำนวณ response rate ต่อผู้เล่นที่เห็นคำถาม; รอบไม่แสดงไม่เป็นตัวหาร
- ดาวใช้ปุ่ม/radio ที่มีชื่ออ่านได้ ใช้ touch/keyboard ได้ ตรวจหน้าจอมือถือและหน้าผลที่เนื้อหายาว
- แจ้งสถานะตามจริง: “บันทึกในเครื่องแล้ว · รอส่ง”, “ส่งแล้ว”, “ส่งไม่สำเร็จ · ลองใหม่”; ไม่มี config ต้องไม่แสดงว่าส่งแล้ว
- กรณี session-only/storage ใช้ไม่ได้ แจ้งว่า feedback ยังไม่ถูกบันทึกถาวรและ retry หลังปิดหน้าไม่ได้

## ข้อมูลส่วนกลางที่เสนอ

| ตาราง | คีย์ | ข้อมูลหลัก |
| --- | --- | --- |
| analytics_runs | runId | pseudonymous analyticsPlayerId, outcome/reason, score, distance, activePlayMs, correct/incorrect/unreached, startedAt/endedAt, ageYearsAtStart, demo, content/blueprint/level/scoringVersion, inputModeGroup, trackingPauseCount/Ms, receivedAt |
| analytics_answers | runId + index | questionId/revision/topic/difficulty, ตัวเลือกและคำตอบ snapshot, selected/correct option, isCorrect, exposure/firstExposure, readMs/selectionMs |
| player_feedback | analyticsPlayerId (หนึ่งความเห็นต่อผู้เล่น) | contextRunId, surveyVersion, rating (1–5), eligibleRunCount, submittedAt, receivedAt |
| feedback_events | eventId | analyticsPlayerId, contextRunId, surveyVersion, shown/skipped, occurredAt, receivedAt |

ใช้ ID สุ่มที่ผูกกับ playerId ในเครื่องเพื่อวิเคราะห์การเล่นซ้ำ; ID นี้ไม่ใช่บัญชีและไม่ใช้อนุญาตให้อ่านข้อมูล ไม่รับประกันว่าเป็นคนเดียวกันข้ามเครื่อง เก็บ mapping นี้ในเครื่องเท่านั้น ไม่ส่งชื่อเล่น วันเกิด น้ำหนัก ส่วนสูง BMI หรือภาพ/วิดีโอกล้อง

เพิ่มข้อบังคับฐานข้อมูล: unique runId, foreign keys, unique answer index ในรอบ, unique feedback ต่อ analyticsPlayerId, rating integer 1–5, version fields ไม่ว่าง. เก็บเวอร์ชันเกม/แบบสอบถามเพื่อแยกก่อนและหลังปรับเกม

## API และการส่งข้อมูล

- เสนอ `POST /api/analytics/runs` รับ terminal snapshot กับคำตอบ; `POST /api/analytics/feedback` รับดาวต่อผู้เล่นพร้อม contextRunId และ events; ใช้ runId/analyticsPlayerId/eventId เป็น idempotency keys ตามชนิดข้อมูล
- บันทึก run/answers ใน transaction; feedback ที่มาทีหลังไม่เขียนทับคะแนนหรือคำตอบ ส่ง outbox ตามลำดับ run ก่อน feedback และรองรับ retry/reload
- สร้าง outbox พร้อม local write ใน IndexedDB transaction เดียวกันและเพิ่ม database version อย่างปลอดภัย; เก็บเฉพาะรายการใหม่หลังเปิดใช้ ไม่ bulk upload ประวัติเก่า
- ไม่ enqueue progress ticks. รองรับ completed/game_over/abandoned รวมการ recover interrupted ตาม policy ของ demo ที่ยืนยัน
- retry แบบ backoff พร้อม jitter และจำกัดความถี่; validation 4xx ต้องให้แก้หรือแสดง error ไม่วนส่งตลอด; network/5xx ค้าง pending แล้วส่งใหม่
- ใช้ token สุ่ม 256 บิตต่อ local player ฝั่ง server hash ด้วย secret แล้วผูก analyticsPlayerId เมื่อส่งครั้งแรก; RPC ตรวจ hash และ ownership ทั้ง run/event/feedback. runId ไม่ใช่ credential; ไม่จำเป็นต้องมี signed receipt เพิ่ม
- server ตรวจ schema, payload size, bounds, versions, identity และ rate limit; บัญชีผู้เล่นไม่อ่าน dataset รวมผ่าน API. Public endpoint ยังมีความเสี่ยงต่อข้อมูลที่ปลอมจาก client จึงระบุแหล่งข้อมูลว่า client-reported ไม่ใช้เป็นคะแนนแข่งขันที่ยืนยันแล้ว
- เปิด RLS และไม่ให้ browser role อ่าน/เขียนตาราง analytics โดยตรง; secret ที่ server ใช้ข้าม RLS จึงต้องตรวจสิทธิ์ใน handler ด้วย ไม่อาศัย RLS ป้องกัน server endpoint
- ล้างข้อมูลในเครื่องไม่ลบข้อมูลส่วนกลางโดยอัตโนมัติ; ระบุ retention และวิธีลบข้อมูลส่วนกลางก่อน production

## Analytics ระยะแรก

- จำนวนรอบและผู้เล่นในขอบเขตข้อมูลที่เลือก, completion/game-over rate
- คะแนนและความถูกต้อง แยก content/scoring/blueprint version และวิธีควบคุม
- ดาวเฉลี่ย, การกระจาย 1–5 ดาว, จำนวนผู้เล่นตอบ/เคยข้าม/เห็นแล้วแต่ยังไม่ตอบ (กลุ่มอาจทับกัน), จำนวน skip events; response rate = ผู้เล่นที่ตอบ / ผู้เล่นที่เห็นคำถาม
- เทียบดาวกับ score, outcome, เวลาเล่น และวิธีควบคุม; แสดง sample size ไม่สรุปเหตุและผลจากความสัมพันธ์
- ดาวมีครั้งเดียวต่อผู้เล่น: เทียบ contextRunId และประสบการณ์ก่อนตอบ เช่น จำนวนรอบ/คะแนนเฉลี่ยก่อนตอบ; ห้าม join ดาวซ้ำทุกรอบแล้วเฉลี่ยจนผู้เล่นซ้ำครอบงำผล
- แยก demo จากรอบจริง; อายุใช้ปี ไม่ส่งอายุเดือนละเอียด. ข้อมูลมาจากหลายเครื่องไม่เท่ากับจำนวนคนจริงข้ามเครื่อง
- เวลารายงานต้องกำหนดช่วงวันที่และ timezone ให้ชัดเจน (Asia/Bangkok สำหรับหน้ารายงานนี้)

## ลำดับงานและ dependencies

1. **FB-01: ยืนยัน contract** — ตอบคำถามด้านล่าง, กำหนด metric/retention/permission และ submission identity ก่อนลงโค้ด
2. **FB-02: Local feedback + outbox** — ขึ้นกับ FB-01; เพิ่ม schema/repository, ดาวบนหน้าผลและสถานะการส่ง โดย local ยังใช้ได้เมื่อ cloud ล่ม
3. **FB-03: Supabase migration + ingestion API** — ขึ้นกับ FB-01; SQL tables/indexes/RLS, transaction, validation/idempotency และ env template (ไม่มี secret จริง)
4. **FB-04: เชื่อมส่งและ retry** — ขึ้นกับ FB-02/03; terminal runs และ feedback ส่งแยกได้, recover หลัง reload และแสดงข้อผิดพลาดจริง
5. **FB-05: SQL views + export** — ขึ้นกับ FB-03/04; metrics ข้างต้นพร้อม filters และ sample size
6. **FB-06: ตรวจรับ** — สอง browser profiles ส่งเข้าฐานเดียวกัน, ตรวจ offline/duplicate/auth/invalid payload, tests/build และ browser QA
7. **ทางเลือก: Admin UI** — เพิ่มเฉพาะเมื่อเลือก; Supabase Auth + allowlist ผู้ดูแล, private report API, filters/export. ต้องไม่เปลี่ยน AnalyticsPanel local เป็นหน้าข้อมูลรวมสาธารณะ

## ตรวจรับ

- ก่อนครบ threshold ไม่ถาม; นับ completed/game_over ครั้งเดียวต่อ runId; abandoned ไม่นับ; ครบแล้วแสดงและข้ามแล้วเว้นตามกำหนด; ส่งดาวแล้วไม่ถามอีกหลัง reload แม้ cloud pending; ข้ามไม่มี rating และไม่กระทบคะแนน
- ส่ง feedback ก่อน run upload สำเร็จ, offline แล้ว reload, กดซ้ำ และ network response หาย ยังได้หนึ่ง run/answer set/feedback
- ดึงฐานจริงยืนยันว่ามี score และคำตอบครบเมื่อ run สำเร็จ แม้ไม่ส่งดาว; ไม่มี health/profile/camera fields
- ไม่มีสิทธิ์อ่านรายงานรวม, token ปลอม, การส่ง feedback ให้ run ของอีก identity ถูกปฏิเสธ; ค่าดาวผิดและ payload เกินขนาดไม่เข้าฐาน
- ทดลอง API ใน local ผ่าน Vercel development runtime หรือ test harness เพราะ Vite dev อย่างเดียวไม่เปิด Functions
- ตรวจ tests/build, export รวม/ตัวหาร/filters, มือถือและ keyboard; live cloud QA ต้องมี project และ env จริงจึงจะยืนยันได้

## คำตอบที่ยืนยัน

- เล่นหลายรอบค่อยถาม ส่งแล้วไม่ถามอีก
- ดาวอย่างเดียว
- Supabase Dashboard + export ก่อน
- ยังไม่มี Supabase project: เตรียม migration/env/setup instructions และตั้ง project ก่อน live QA

## คำตอบเพิ่มเติมที่ยืนยัน

- หลังครบ 3 รอบ ข้ามแล้วเว้นอีก 3 รอบ
- เก็บทั้งจริงและทดลองแยกกลุ่ม รวมรอบทดลองในการนับ threshold

รายละเอียด follow-up ก่อน production: ใครอ่านรายงานได้, อายุการเก็บข้อมูล, วิธีขอลบข้อมูล และข้อความแจ้งผู้เล่น/ผู้ดูแลเรื่องการส่งผลรวมหลายเครื่อง

## Delivery — 2026-10-03

ผู้ใช้ให้ Supabase project และยืนยันรัน migration/ส่ง server key ไป Vercel/deploy. ดำเนินการบน `umsquyyfozhggogfnrak` และ Vercel `dream-league1/food-fit-fun` แล้ว. ทั้งสอง production aliases เปิดใช้ analytics; scores/answer rows/ratings เข้า Supabase จริง, retry ไม่ซ้ำ, RLS/public-read denial ผ่าน. เพิ่ม regression test สำหรับ native browser fetch และยืนยัน pending browser run ส่งหลัง reload. [Setup](../setup/supabase-analytics.md) และ [verification](../qa/feedback-analytics-verification.md) ระบุ deployment, dataset QA และขอบเขตการตรวจจริง
