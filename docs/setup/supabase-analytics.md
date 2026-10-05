# Supabase: feedback + score

สถานะ 2026-10-04: ตารางข้อมูลเกมใน public มี `score` กับ `feedback`. Baseline version `20261003000100`, comment migration `20261003000200` และ migration เก็บ feedback ทุกรอบ `20261004000100` ลงทะเบียนใน `supabase_migrations.schema_migrations` ซึ่งเป็น metadata schema แยกจากข้อมูลเกม

[Supabase project](https://supabase.com/dashboard/project/umsquyyfozhggogfnrak) · [เกม Food Fit Fun](https://food-fit-fun.vercel.app) · [Production deployment](https://vercel.com/dream-league1/food-fit-fun/6KR7iMfbaN4reZyFfN9j2uY1Ju97)

## สองตาราง

`score`: หนึ่งแถวต่อรอบ เก็บ `player_name` ชื่อเล่น, `sex`, `age_years`, `bmi_start` BMI จริงเริ่มต้น, `bmi_end` BMI จำลองของตัวละครตอนจบ, `test_score` ตอบถูกเต็ม 10, `game_score` คะแนนเกม. ID/timestamp/outcome/demo/content_version ช่วยแยกรอบและส่งซ้ำ; token_hash ตรวจสิทธิ์ฝั่ง server ไม่รวมใน export

ชื่อ/เพศ/อายุ snapshot ตอนเริ่มรอบ. BMI ตอนจบไม่ใช่การวัดร่างกายใหม่. ไม่ส่งส่วนสูง น้ำหนัก ภาพกล้อง หรือคำตอบรายข้อไป cloud; คำตอบละเอียดเก็บ local. ข้อมูล local เก่าที่ไม่มี snapshot จะเป็น NULL ไม่คาดเดาจากโปรไฟล์ปัจจุบัน

`feedback`: player_id, score_id, created_at และ JSONB `data` เช่น `{"player_name":"ผู้เล่น A","stars":4,"comment":"อยากได้ด่านเพิ่ม"}`. comment เป็นตัวเลือก จำกัด 1,000 ตัวอักษร ตัดช่องว่างหัวท้ายและไม่เก็บถ้าว่าง. เก็บหนึ่งครั้งต่อรอบที่จบหรือแพ้ ผู้เล่นคนเดิมส่งได้หลายรอบ ไม่มี shown/skip/answer tables หรือ report views เพิ่มเติม

## Migration version

ไฟล์หลัก: `supabase/migrations/20261003000100_create_score_feedback.sql`. รันสร้าง schema จากฐานว่างโดยตรง ไม่มี seed. รุ่นเก่าย้ายเข้า `supabase/archive/` ไม่ถูกรันโดย CLI. เปลี่ยน schema ครั้งต่อไปสร้าง migration timestamp ใหม่ ไม่แก้ไฟล์ที่ applied แล้ว

```sh
npx supabase migration new add_feedback_field
npx supabase migration list
npx supabase db push --dry-run
npx supabase db push
```

CLI ครั้งแรกต้อง `npx supabase init`, `npx supabase login` และ `npx supabase link --project-ref umsquyyfozhggogfnrak`. ไม่ส่ง password/key ในแชต. งานนี้ยังไม่ได้ตั้ง authenticated CLI; ลงทะเบียน baseline ที่สร้างไว้แล้วผ่าน SQL fallback `supabase/register-baseline.sql`. เมื่อเชื่อม CLI แล้ว db push จะข้าม version ที่ applied

Project ว่างที่ใช้ SQL Editor: รัน baseline แล้ว register-baseline.sql เพื่อบันทึก version. ปกติใช้ CLI db push ซึ่งลงทะเบียน history ให้อัตโนมัติ ตาม [Supabase migration docs](https://supabase.com/docs/guides/deployment/database-migrations)

Comment migration: `supabase/migrations/20261003000200_feedback_comment.sql` ปรับ constraint JSONB และ RPC โดยคงแถวเดิมไว้. Applied บน project นี้แล้ว. หากรันผ่าน SQL Editor ให้ตามด้วย `supabase/register-feedback-comment.sql`; CLI db push บันทึก version ให้อัตโนมัติ

Per-run migration: `supabase/migrations/20261004000100_feedback_every_run.sql` เปลี่ยน primary key ของ feedback เป็น `score_id` และเพิ่ม index ที่ `player_id` โดยคงแถวเดิมไว้. Applied บน project นี้แล้ว. หากรันผ่าน SQL Editor ให้ตามด้วย `supabase/register-feedback-every-run.sql`; CLI db push บันทึก version ให้อัตโนมัติ

## Reset แยกไฟล์

`supabase/reset-analytics.sql` ลบตารางและข้อมูลเกม ใช้เฉพาะเมื่อผู้ใช้สั่ง reset ชัดเจน จากนั้นรัน baseline. ไม่อยู่ใน migrations ไม่เรียกตอน deploy ปกติ และไม่แตะ auth/storage/system schemas

## API / env / survey

API เดิม `/api/analytics/runs` และ `/api/analytics/feedback` ใช้ RPC `score_feedback_ingest`. GET runs คืน enabled=true เมื่อพร้อม ไม่คืน dataset. RLS + ถอนสิทธิ์ anon/authenticated, origin checks, credential ownership และ retries ไม่สร้างแถวซ้ำ. จำกัด 60 score ใหม่/นาที/ผู้เล่นจากแถว score ไม่มีตาราง counters/IP telemetry. Compatibility wrapper รองรับ API เดิมระหว่าง cutover

Server env บน Vercel Production/Preview: SUPABASE_URL, SUPABASE_SECRET_KEY, ANALYTICS_HASH_SECRET, ANALYTICS_ORIGINS, ANALYTICS_ENABLED=true. Key/hash เป็น Secret ไม่ใช้ VITE_ prefix. เปลี่ยน env ต้อง redeploy; `.env.local` ถูก gitignore และไม่ sync อัตโนมัติ

ถามดาวและคอมเมนต์หลังจบ/แพ้ทุกรอบรวม demo; ข้ามหรือส่งแล้วไม่ถามซ้ำในรอบเดิม แต่ถามใหม่ในรอบถัดไป. ผลรอบเก่าก่อนอัปเดตถูกทำเครื่องหมาย historical จึงไม่ถามย้อนหลัง. สถานะอยู่ local และยังใช้ได้หลัง cloud reset. Reset cloud ไม่ล้าง profile/history/สถานะ feedback ในเครื่อง

## รายงาน / export

ใช้ SELECT ใน `supabase/analytics-queries.sql` เพื่อ export ข้อมูลผลเล่นโดยไม่รวม token_hash. กรอง demo/content/date ก่อนวิเคราะห์. รายงานดาวนับทั้งจำนวนคำตอบและจำนวนผู้เล่นไม่ซ้ำ. ไม่มี response-rate denominator จาก shown events. ปุ่มล้างในเกมล้างเฉพาะ local; ยังไม่มี automatic retention/delete schedule. ดู [QA](../qa/feedback-every-run-verification.md)

## kcal migration (4 ตุลาคม 2026)

`20261004000200_kcal_energy.sql` เพิ่ม snapshot kcal ใน score โดยคงประวัติ BMI และ feedback ไว้ รอบ schema 2 ส่ง BMI เป็น NULL; รอบ schema 1 อ่าน/ส่งได้และไม่มีการคำนวณ kcal ย้อนหลัง คอลัมน์ใหม่: run_schema_version, daily_energy_kcal, food_intake_kcal, energy_status, energy_reason, energy_model_version, activity_assumption, nutrition_version, scoring_version, collected_foods

RPC ตรวจ catalog/portion counts และยอดรวม; การส่งซ้ำไม่ overwrite รอบเดิม ตารางยังเป็น score/feedback และสิทธิ์ anon/authenticated ไม่เพิ่ม GET API รุ่นใหม่คืน runSchemaVersion=2; client เก็บ kcal ไว้ใน outbox หากพบ API เก่าที่อาจทิ้ง field ใหม่ ปล่อย DB migration ก่อน server/client ใหม่เสมอ

หากใช้ SQL Editor ให้รัน migration แล้ว `supabase/register-kcal-energy.sql` สำหรับลงทะเบียน history ดูหลักฐานการนำขึ้นจริงและ QA ใน [kcal verification](../qa/kcal-game-verification.md)

ตรวจ live schema วันที่ 4 ตุลาคม 2026 หลัง apply kcal migration ผ่าน SQL Editor: มีคอลัมน์ใหม่แล้ว จำนวน score เดิม 23 และ feedback เดิม 4 คงเดิม การเรียก RPC ด้วยยอด kcal ที่ไม่ตรงกับ catalog คืน `invalid` และไม่เพิ่มแถว ผู้ใช้อนุมัติ commit/push/deploy ชัดเจนแล้ววันที่ 4 ตุลาคม 2026

## กิจกรรม 1 นาทีตามน้ำหนัก

Applied `20261004000300_exercise_energy.sql` และ `register-exercise-energy.sql` บน live วันที่ 4 ตุลาคม 2026 ยืนยัน schema/history พร้อมทดสอบ `supabase/tests/exercise-energy.sql` ผ่านและ rollback ข้อมูลทดลองครบ จำนวนข้อมูลเดิมคงที่ 23 score / 4 feedback เพิ่ม exercise_kcal, exercise_model_version, exercise_energy_status/reason, collected_exercises และ generated net_energy_kcal คง food_intake_kcal เป็นยอดอาหารจริงตาม snapshot

ค่ากิจกรรมใช้ NCCOR Youth Compendium + Schofield สำหรับ 6–18 ปี และ 2024 Adult Compendium สำหรับ 19–59 ปี: 1 pickup แทนกิจกรรมจำลอง 1 นาที รองรับ null/unavailable และตรวจ source/code/MET/เวลา/จำนวน/ยอดรวม ไม่ส่งน้ำหนักหรือส่วนสูงโดยตรง ต้องลง migration ก่อน API ที่ประกาศ exerciseEnergyVersion=2 Client จะรอใน outbox จนพร้อม โดยไม่ทิ้งค่าหักของรอบใหม่ ดู [แหล่งอ้างอิง](../research/exercise-energy-reference.md) และ [QA](../qa/kcal-game-verification.md)

## Balance 15 นาที

Applied migration `20261004000400_exercise_game_balance.sql` and registered version on production Supabase on 2026-10-04. It supports `nccor-youth+adult-met-gross-15min-v2` and preserves legacy snapshots; see [plan and validation](../plans/kcal-game-balance.md).

## ลดคอลัมน์ข้อมูลคะแนนเก่า (2026-10-04)

Migration `20261004000500_score_kcal_only.sql` คงสองตาราง `score` และ `feedback` พร้อมแถวเดิมและ feedback เดิมไว้ แต่ลบคอลัมน์ BMI, คะแนนแบบทดสอบ/เกม, `demo` และเวลาเริ่มที่ไม่ได้ใช้ในรายงาน kcal แล้ว `score` ยังเก็บข้อมูลที่จำเป็นต่อการกันส่งซ้ำ/ตรวจสิทธิ์, เชื่อม feedback, ตรวจกิจกรรมจากอายุและเพศ, คัดข้อมูล QA, เวลาเล่นจบ และ snapshot พลังงาน ตั้งแต่ `run_schema_version` กับ kcal เป็นต้นไป ประวัติเดิมที่ไม่มี kcal จะไม่ถูกคำนวณย้อนหลัง; ค่า BMI/คะแนนจาก payload เก่าที่ยังค้างใน outbox จะไม่ถูกเก็บเป็นคอลัมน์

Migration 005 ต่อจาก 004 ซึ่ง apply และลงทะเบียนบน production แล้ว จำนวนก่อนตัดคอลัมน์คือ 30 แถวใน `score` และ 4 แถวใน `feedback`. หากใช้ SQL Editor ให้รัน `20261004000500_score_kcal_only.sql` แล้ว `supabase/register-score-kcal-only.sql`; CLI `db push` ลงทะเบียนให้อัตโนมัติ Regression rollback-only อยู่ที่ `supabase/tests/score-kcal-only.sql` และ export query ถูกปรับให้ไม่อ่านคอลัมน์ที่ถอดออก Migration 005 อยู่ใน repo แต่ยังไม่ได้ apply กับ production เพราะรอการยืนยันหน้าคำเตือนการลบคอลัมน์
