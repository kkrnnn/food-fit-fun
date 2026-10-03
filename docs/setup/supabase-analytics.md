# Supabase: feedback + score

สถานะ 2026-10-03: ลบตารางเดิมและข้อมูลเดิมตามที่ผู้ใช้สั่งแล้ว ตารางข้อมูลเกมใน public เหลือ `score` กับ `feedback`. Baseline version `20261003000100` และ comment migration `20261003000200` ลงทะเบียนใน `supabase_migrations.schema_migrations` ซึ่งเป็น metadata schema แยกจากข้อมูลเกม

[Supabase project](https://supabase.com/dashboard/project/umsquyyfozhggogfnrak) · [เกม Food Fit Fun](https://food-fit-fun.vercel.app) · [Production deployment](https://vercel.com/dream-league1/food-fit-fun/6938HZbGKYKYCqFGEt1yMY6UkejM)

## สองตาราง

`score`: หนึ่งแถวต่อรอบ เก็บ `player_name` ชื่อเล่น, `sex`, `age_years`, `bmi_start` BMI จริงเริ่มต้น, `bmi_end` BMI จำลองของตัวละครตอนจบ, `test_score` ตอบถูกเต็ม 10, `game_score` คะแนนเกม. ID/timestamp/outcome/demo/content_version ช่วยแยกรอบและส่งซ้ำ; token_hash ตรวจสิทธิ์ฝั่ง server ไม่รวมใน export

ชื่อ/เพศ/อายุ snapshot ตอนเริ่มรอบ. BMI ตอนจบไม่ใช่การวัดร่างกายใหม่. ไม่ส่งส่วนสูง น้ำหนัก ภาพกล้อง หรือคำตอบรายข้อไป cloud; คำตอบละเอียดเก็บ local. ข้อมูล local เก่าที่ไม่มี snapshot จะเป็น NULL ไม่คาดเดาจากโปรไฟล์ปัจจุบัน

`feedback`: player_id, score_id, created_at และ JSONB `data` เช่น `{"player_name":"ผู้เล่น A","stars":4,"comment":"อยากได้ด่านเพิ่ม"}`. comment เป็นตัวเลือก จำกัด 1,000 ตัวอักษร ตัดช่องว่างหัวท้ายและไม่เก็บถ้าว่าง. คนละหนึ่งครั้ง เก็บเฉพาะคนส่งดาว ไม่มี shown/skip/answer tables หรือ report views เพิ่มเติม

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

## Reset แยกไฟล์

`supabase/reset-analytics.sql` ลบตารางและข้อมูลเกม ใช้เฉพาะเมื่อผู้ใช้สั่ง reset ชัดเจน จากนั้นรัน baseline. ไม่อยู่ใน migrations ไม่เรียกตอน deploy ปกติ และไม่แตะ auth/storage/system schemas

## API / env / survey

API เดิม `/api/analytics/runs` และ `/api/analytics/feedback` ใช้ RPC `score_feedback_ingest`. GET runs คืน enabled=true เมื่อพร้อม ไม่คืน dataset. RLS + ถอนสิทธิ์ anon/authenticated, origin checks, credential ownership และ retries ไม่สร้างแถวซ้ำ. จำกัด 60 score ใหม่/นาที/ผู้เล่นจากแถว score ไม่มีตาราง counters/IP telemetry. Compatibility wrapper รองรับ API เดิมระหว่าง cutover

Server env บน Vercel Production/Preview: SUPABASE_URL, SUPABASE_SECRET_KEY, ANALYTICS_HASH_SECRET, ANALYTICS_ORIGINS, ANALYTICS_ENABLED=true. Key/hash เป็น Secret ไม่ใช้ VITE_ prefix. เปลี่ยน env ต้อง redeploy; `.env.local` ถูก gitignore และไม่ sync อัตโนมัติ

ถามดาวหลังจบ/แพ้ในเครื่องครบ 3 รอบรวม demo; skip เว้นอีก 3; submitted แล้วไม่ถามอีก. กฎอยู่ local และยังใช้ได้หลัง cloud reset จึงไม่บังคับให้ cloud มี 3 รอบย้อนหลัง. Reset cloud ไม่ล้าง profile/history/สถานะดาวในเครื่อง

## รายงาน / export

ใช้ SELECT ใน `supabase/analytics-queries.sql` เพื่อ export ข้อมูลผลเล่นโดยไม่รวม token_hash. กรอง demo/content/date ก่อนวิเคราะห์. ไม่มี response-rate denominator จาก shown events. ปุ่มล้างในเกมล้างเฉพาะ local; ยังไม่มี automatic retention/delete schedule. ดู [QA](../qa/two-table-analytics-verification.md)
