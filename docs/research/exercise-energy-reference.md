# พลังงานออกกำลังกายจำลอง 1 นาทีใน Food Fit Fun

ตรวจแหล่งปฐมภูมิออนไลน์วันที่ 4 ตุลาคม 2026 เพื่อเปลี่ยนค่าคงที่ต่อ item เป็น **ค่าประมาณสำหรับทำกิจกรรมที่ระบุ 1 นาที** ตามน้ำหนักและช่วงอายุ ไม่ใช่การวัดว่าผู้เล่นเผาผลาญจริงจากการเก็บ item หรือเล่นหน้าจอ

## Mapping และค่าอ้างอิงเด็ก 6–18 ปี

ใช้ **NCCOR Youth Compendium, METy Values (Smoothed)** ซึ่งเป็นชุดข้อมูลที่ NCCOR แนะนำสำหรับประมาณพลังงานของกลุ่มเด็ก ไม่ใช้ adult MET กับเด็ก [NCCOR How to Access & Use These Data](https://www.nccor.org/tools-youthcompendium/how-to-use/)

| Item | กิจกรรมต้นฉบับ / code | อายุ 6–9 | อายุ 10–12 | อายุ 13–15 | อายุ 16–18 |
| --- | --- | ---: | ---: | ---: | ---: |
| SHOES | Jog Self-Paced / `60140X` | 6.8 | 7.4 | 7.9 | 8.4 |
| DUMBBELL | Hand Weights Exercises / `85100X` | 3.0 | 3.0 | 2.9 | 2.9 |
| ROPE | Jump Rope / `10260X` | 6.9 | 7.1 | 7.2 | 7.4 |

ทุกค่าในตารางเป็น METy ตรวจจาก [NCCOR ตาราง smoothed ทั้งหมด](https://www.nccor.org/tools-youthcompendium/met-view-all-categories/)

ชื่อกิจกรรมในเกมควรเป็น “จ็อกกิงตามจังหวะตัวเอง”, “ออกกำลังด้วยดัมเบล”, “กระโดดเชือก” พร้อม “เทียบเท่า 1 นาที” อย่าเรียก DUMBBELL ว่า arm curl เฉพาะท่า เพราะข้อมูลเป็น hand weights exercises โดยรวม อย่าเรียก SHOES ว่า moderate หากเลือก self-paced เพราะแหล่งไม่ได้กำหนดความเร็ว/ระดับ moderate ให้แถวนี้ และไม่ใช้ adult intensity cutoffs ไปแปล METy โดยตรง

## สูตรเด็กที่ตรงกับ NCCOR

กำหนด `W` เป็นน้ำหนัก kg และ `t = 1` นาที:

`grossExerciseKcal = METy * bmrKcalPerMinute * t`

| เพศตามสูตร | ช่วงอายุที่ใช้ในเกม | `bmrKcalPerMinute` |
| --- | --- | --- |
| ชาย | 6–9 | `(22.706*W + 504.3) / 1440` |
| ชาย | 10–18 | `(17.686*W + 658.2) / 1440` |
| หญิง | 6–9 | `(20.315*W + 485.9) / 1440` |
| หญิง | 10–18 | `(13.384*W + 692.6) / 1440` |

นี่คือ Schofield age/sex/weight equations ตาม [NCCOR How to Use](https://www.nccor.org/tools-youthcompendium/how-to-use/) สูตรเดิมครอบคลุมกลุ่ม 3–10 และ 10–18 แต่ METy dataset เริ่มอายุ 6 จึงไม่เสนอค่ากิจกรรมสำหรับต่ำกว่า 6 อายุจำนวนเต็ม 10 ใช้สมการ 10–18; อายุ 18 ใช้กลุ่ม METy 16–18 กับสูตรเยาวชนตามที่ NCCOR ระบุ ไม่ต้องเพิ่ม input ใหม่ ส่วนสูงไม่ได้อยู่ในสมการนี้

งานพัฒนาชุดข้อมูลใช้ข้อมูลเด็กโดยเฉพาะ และมีทั้งค่าที่สังเกตและเติมด้วยโมเดล จึงเรียก “ค่าประมาณอ้างอิง” ไม่เรียกค่าการเผาผลาญจริงที่วัดได้ [Butte et al., A Youth Compendium of Physical Activities, DOI 10.1249/MSS.0000000000001430](https://stacks.cdc.gov/view/cdc/50879/cdc_50879_DS1.pdf)

## ผู้ใหญ่ 19–59 ปี

ใช้ 2024 Adult Compendium แยกจากสูตรเด็ก งานต้นฉบับกำหนดช่วงนี้และตัดข้อมูลอายุ 60 ขึ้นไปออก [Herrmann et al. 2024](https://pmc.ncbi.nlm.nih.gov/articles/PMC10818145/)

| Item | กิจกรรมต้นฉบับ / code | MET | คำอธิบายที่ต้องแสดง |
| --- | --- | ---: | --- |
| SHOES | Jogging, general, self-selected pace / `12020` | 7.5 | จ็อกกิงตามจังหวะตัวเอง [Running](https://pacompendium.com/running/) |
| DUMBBELL | Resistance (weight) training, multiple exercises, 8–15 reps at varied resistance / `02054` | 3.5 | ฝึกเวทหลายท่า 8–15 ครั้งต่อชุด [Conditioning Exercise](https://pacompendium.com/conditioning-exercise/) |
| ROPE | Rope jumping, moderate pace, general, 100 to 120 skips/min, 2 foot skip, plain bounce / `15551` | 11.8 | กระโดดเชือก 100–120 ครั้งต่อนาที [Sports](https://pacompendium.com/sports/) |

ข้อเสนอสูตรผู้ใหญ่ที่ตามนิยามหน่วยของเว็บไซต์โดยตรง:

`grossExerciseKcal = MET * W * (t / 60)`

แหล่งนิยาม `1 MET = 1 kcal/kg/hour` [Compendium Definition of Terms](https://pacompendium.com/) จึงหารนาทีด้วย 60 ไม่ใช้สูตร Schofield ของเด็กกับผู้ใหญ่ และไม่ใช้ค่า EER ต่อวันหาร 1440 มาแทน BMR

สูตร oxygen conversion ที่พบทั่วไป `MET * 3.5 * W / 200 * t` ให้ผลต่างประมาณ 5% จาก `MET*W*t/60` ควรเลือกสูตรเดียวและบันทึก version ชัดเจน ชุดข้อมูลนี้เสนอสูตรตามนิยาม kcal/kg/hour เพื่อให้หลักฐานและผลลัพธ์ตรวจตรงกัน ไม่สลับสูตรโดยเงียบ ๆ

## Total/gross และพลังงานเพิ่มเติม/net

สูตร NCCOR คำนวณ **total/gross** ซึ่งรวมพลังงานพื้นฐานในนาทีนั้นแล้ว ตัวเลขหน้าจอต้องบอกว่าเป็นค่าประมาณของกิจกรรม 1 นาที ถ้าจะเพิ่มการใช้พลังงานจากการออกกำลังเข้าไปในยอดการใช้พลังงานทั้งวันที่มีฐานพักอยู่แล้ว ควรใช้ค่า **เพิ่มเติมจากพัก/net** ตามความหมายดังนี้:

- เด็ก: `netExerciseKcal = (METy - 1) * bmrKcalPerMinute * t`
- ผู้ใหญ่ตามนิยามข้างต้น: `netExerciseKcal = (MET - 1) * W * t/60`

สูตร net เป็น **การอนุมานทางคณิตศาสตร์** โดยหักค่าฐาน 1 MET/METy ออกจาก gross ไม่ใช่แถวข้อมูลกิจกรรมใหม่ใน Compendium อย่าเก็บ gross กับ net ปะปนกัน และอย่าอ้างยอดอาหารในรอบลบ exercise ว่าเป็นสมดุลพลังงานจริงทั้งวัน

สำหรับ mechanic ที่ user เลือก “เทียบเท่าออกกำลัง 1 นาที” สามารถใช้ gross เป็นค่าการใช้พลังงานจำลอง พร้อมเก็บ `exerciseBasis: 'gross'`, `durationMinutes: 1`, `activityCode`, `metKind`, `metValue`, `formulaVersion`, `sourceUrl`, `estimated: true` ให้ตรงกับผลลัพธ์ หากต้องการหักจาก food tally ให้เก็บผล simulation แยกจากยอดอาหารสะสมเดิม ซึ่งไม่ควรลดเมื่อออกกำลัง

## ตัวอย่างตรวจเลขและขอบเขต

เด็กชายอายุ 12 ปี หนัก 40 kg:

`BMR/min = (17.686*40+658.2)/1440 = 0.948361111...`

| กิจกรรม 1 นาที | Gross kcal | Net kcal |
| --- | ---: | ---: |
| จ็อกกิง | 7.017872 | 6.069511 |
| Hand weights | 2.845083 | 1.896722 |
| กระโดดเชือก | 6.733364 | 5.785003 |

ผู้ใหญ่หนัก 70 kg: gross จ็อกกิง `7.5*70/60=8.75`, เวท `3.5*70/60=4.083333`, กระโดดเชือก `11.8*70/60=13.766667` kcal/นาทีตามสูตรที่เสนอ

ข้อกำหนดที่พร้อมใช้:

- อายุจำนวนเต็ม 6–18: youth formula/table; 19–59: adult formula/table
- ต่ำกว่า 6 หรือ 60 ขึ้นไป: `unavailable` จนกว่าจะมี reference แยกที่ตรวจแล้ว ไม่คืน 0 และไม่ fallback ไปสูตรที่ผิดช่วงอายุ
- น้ำหนักไม่เป็นจำนวน finite/ไม่บวก หรือเพศสูตรไม่รองรับ: unavailable ไม่คำนวณด้วยค่าแต่งขึ้น
- เก็บค่าทศนิยมเต็มในการสะสม แล้วปัดเฉพาะตอนแสดง เช่น 1 ตำแหน่ง เพื่อให้พลังงานกิจกรรม 1 นาทีเห็นความต่างและไม่เกิดความคลาดจากการปัดทุกครั้ง
- จำนวน pickup ไม่ใช่จำนวนครั้งที่ร่างกายทำกิจกรรมจริง ต้องแสดงว่าเป็น “กิจกรรมจำลองเทียบเท่า 1 นาที” และคงข้อจำกัดนี้ใน export/analytics ด้วย

สถานะ: mapping ทั้ง 3 item มี youth data ที่ใช้ได้จริง ไม่มี gate ของ DUMBBELL ที่ต้องแทนด้วย adult arm curl; การเลือก gross/net เป็นเรื่องความหมายของ mechanic ที่ต้องกำหนดชัดเจน ไม่ใช่ข้อมูลที่แหล่งบังคับว่าต้องเลือก net เสมอ
