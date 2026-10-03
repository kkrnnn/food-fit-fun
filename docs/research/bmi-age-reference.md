# BMI meter ตามอายุสำหรับ Food Fit Fun

ตรวจแหล่งต้นทางและไฟล์ใน repository วันที่ 2026-10-03 งานนี้เป็นข้อเสนอ implementation สำหรับ meter ของเกม ไม่ใช่การวินิจฉัยสุขภาพ

## สูตรและช่วงอายุ

BMI = น้ำหนักกิโลกรัม / (ส่วนสูงเมตร × ส่วนสูงเมตร) คำนวณด้วยค่าจริงก่อนปัดเพื่อแสดงผล สูตร BMI เหมือนกัน แต่เกณฑ์แปลผลเด็กต่างจากผู้ใหญ่ ([CDC BMI FAQ](https://www.cdc.gov/bmi/faq/))

| อายุ | ข้อมูลอ้างอิงสำหรับ meter |
| --- | --- |
| 2 ถึงก่อน 20 ปี | CDC BMI-for-age แยกเพศและเดือน: ต่ำกว่า P5, P5 ถึงก่อน P85, P85 ถึงก่อน P95, ตั้งแต่ P95 |
| ตั้งแต่ 20 ปี | ค่าคงที่: ต่ำกว่า 18.5, 18.5 ถึงก่อน 25, 25 ถึงก่อน 30, ตั้งแต่ 30 โดยไม่ขึ้นกับเพศ/อายุ |
| ต่ำกว่า 2 ปี | ไม่ให้สีที่ตีความเป็นช่วงสุขภาพ ใช้ meter สีเป็นกลางพร้อมข้อความว่าอายุนี้ยังไม่รองรับ |

แหล่งเกณฑ์: [CDC เด็กและวัยรุ่น](https://www.cdc.gov/bmi/child-teen-calculator/bmi-categories.html), [CDC ผู้ใหญ่](https://www.cdc.gov/bmi/adult-calculator/bmi-categories.html)

WHO มี BMI-for-age ตั้งแต่แรกเกิดจริง ([WHO BMI tables](https://www.who.int/toolkits/child-growth-standards/standards/body-mass-index-for-age-bmi-for-age)) แต่ CDC ไม่แนะนำ BMI-for-age สำหรับอายุต่ำกว่า 2 ปี และใช้ WHO weight-for-length ในช่วงนี้แทน จึงไม่ควรนำ cutoff ของเด็กโตหรือผู้ใหญ่มาเติมเอง ([CDC Using WHO charts](https://www.cdc.gov/growth-chart-training/hcp/using-growth-charts/who-using.html))

## Static data ที่มีอยู่แล้ว

ตรวจไฟล์ปัจจุบันก่อนแก้ source:

- `src/features/health/cdc-bmi.json` มีเพียง 96 แถว: เพศละ 48 เดือน ตั้งแต่ 108.5 ถึง 155.5 เดือน (อายุ 9 ถึงก่อน 13 ปี)
- `src/features/health/data/bmiagerev.csv` มีข้อมูลต้นฉบับครบ 438 แถว: เพศละ 219 แถว ตั้งแต่ 24 ถึง 240.5 เดือน
- ใช้ half-month bins ตั้งแต่ 24.5 ถึง 239.5 จะได้เพศละ 216 เดือน รวม 432 แถว ครบอายุ 2–19 ปี และแต่ละปีมี 12 แถวต่อเพศ
- SHA256 ของ CSV: `cbeea0e8d500ee15c652f3fdc45bcd02cb9c15d4d1e86f4d8048bbfea8d166e5`

CDC ระบุว่า half-month row เป็นตัวแทนของทั้งเดือน เช่น 24.5 คือช่วง 24 ถึงก่อน 25 เดือน ตารางให้ P5/P85/P95 โดยตรง จึงไม่จำเป็นต้องคำนวณ LMS หรือประมาณ percentile เพื่อวาด meter ([CDC data files](https://www.cdc.gov/growthcharts/cdc-data-files.htm), [ต้นฉบับ CSV](https://www.cdc.gov/growthcharts/data/zscore/bmiagerev.csv))

## ข้อเสนอ implementation

1. สร้าง JSON ใหม่จาก CSV เดิม เก็บ `sex`, `month`, `p5`, `p85`, `p95` ครบ 432 แถว ไม่ต้องใช้ network ขณะเล่น
2. เด็กที่กรอกอายุเป็นปีเต็ม ให้ใช้ envelope ของทั้ง 12 เดือนที่เป็นไปได้ ห้ามสมมติว่าเพิ่งมีวันเกิดหรือเกิดเดือนกลางปี
3. สำหรับ envelope ใช้สีเขียวเมื่อ BMI อยู่ในช่วง P5–ก่อน P85 ของทุกเดือน สีต่ำ/สูงชัดเจนเมื่ออยู่นอกช่วงของทุกเดือน และสีเหลืองใกล้ขอบสำหรับกรณีเดือนจริงอาจให้ผลต่างกัน เป็นกติกา UI ที่ระมัดระวังของผลิตภัณฑ์ ไม่ใช่เกณฑ์ใหม่ของ CDC
4. สำหรับ exact-month profiles เก่า เลือก `ageMonths + 0.5` ตามเดิม
5. ผู้ใหญ่ใช้ threshold 18.5/25/30 โดยไม่ lookup ตารางเด็ก การแบ่งสีเท่ากันทุกอายุผู้ใหญ่ แต่ตำแหน่งเปลี่ยนตามค่า BMI
6. ตำแหน่ง meter ใช้ scale ที่คงที่ต่อ reference ของผู้เล่นตลอดรอบ เช่นเด็กใช้ `min(P5) - 4` ถึง `max(P95) + 8`; ผู้ใหญ่ใช้ขอบ 12 ถึง 40 และ clamp เฉพาะ marker ค่าตัวเลขยังแสดงค่าจริง การเลือก margins เป็นการออกแบบเกม ไม่ใช่มาตรฐานการแพทย์
7. อายุ <2 หรือข้อมูลไม่ครบใช้สีเป็นกลาง และไม่ใช้ adult cutoff เป็น fallback
8. BMI เริ่มต้นจากส่วนสูง/น้ำหนักจริงคงเดิม ค่า BMI จบรอบที่เปลี่ยนจาก item เป็นตัวละครจำลอง ใช้ข้อความสั้นใน meter ว่า “BMI ในเกม” และ “สีอ้างอิงตามวัยโดยประมาณ” สำหรับเด็กกรอกปีเต็ม ไม่บอกว่าเป็นเปอร์เซ็นไทล์ที่แม่นยำ

CDC 2000 เป็นข้อมูลอ้างอิงสหรัฐฯ ไม่ใช่ reference เฉพาะประชากรไทย และค่าปลายสูงของ BMI เด็กไม่ควรถูก extrapolate เป็น percentile แบบแม่นยำ จึงใช้เฉพาะ cutoff P5/P85/P95 และไม่เพิ่ม exact high-tail percentile ([CDC SAS program / limitations](https://www.cdc.gov/growth-chart-training/hcp/computer-programs/sas.html))

## Boundary checks ที่ควรมี

อายุ 2, 8, 9, 12, 13, 19 ของทั้งสองเพศต้องมี reference; อายุ 20 และ 70 ต้องใช้ adult cutoff เดียวกัน; ค่า 18.5/25/30 ต้องเข้าช่วงใหม่ที่ equality; อายุ <2 และ BMI invalid ใช้ neutral; เด็กปีเต็มใกล้ cutoff ต้องไม่ถูกบังคับเป็น category จากเดือนที่เดา
