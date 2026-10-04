# หลักฐานอ้างอิง kcal สำหรับ Food Fit Fun

ตรวจแหล่งข้อมูลออนไลน์วันที่ 4 ตุลาคม 2026 เอกสารนี้เป็นแหล่งอ้างอิงของเกมรุ่น kcal ที่ดำเนินการแล้ว ดู [หลักฐานการทดสอบ](../qa/kcal-game-verification.md)

## สูตรจาก input เดิม

ผู้ใช้ยืนยัน: แสดง **เป้าพลังงานต่อวันโดยประมาณ (EER)** แยกจาก **พลังงานอาหารที่เก็บในรอบนี้** ซึ่งเริ่มที่ 0 kcal เพราะยังไม่มีข้อมูลอาหารที่กินก่อนเล่น ไม่ใช้ EER เป็นยอดอาหารเริ่มต้น

ใช้ DRI for Energy ฉบับ NASEM 2023 และเลือกหมวด **Inactive** เป็นสมมติฐานคงที่เพื่อคง input `sex, weight, height, age` ทั้งสี่ตัว ไม่เพิ่มคำถามระดับกิจกรรม ต้องระบุสมมติฐานนี้ในหน้าผลลัพธ์ ไม่อ้างว่าเป็นค่าพลังงานเฉพาะบุคคลที่วัดจริง [NASEM 2023: Development of Prediction Equations](https://www.nationalacademies.org/read/26818/chapter/7), [Health Canada: Equations to estimate energy requirement](https://www.canada.ca/en/health-canada/services/food-nutrition/healthy-eating/dietary-reference-intakes/tables/equations-estimate-energy-requirement.html)

กำหนด `A` = อายุปี, `H` = ส่วนสูงเซนติเมตร, `W` = น้ำหนักกิโลกรัม; ผลลัพธ์ kcal/day:

| กลุ่ม | สูตร Inactive |
| --- | --- |
| ชาย อายุ 3 ถึงก่อน 19 ปี | `-447.51 + 3.68*A + 13.01*H + 13.15*W + G` |
| หญิง อายุ 3 ถึงก่อน 19 ปี | `55.59 - 22.25*A + 8.43*H + 17.07*W + G` |
| ชาย อายุ 19 ปีขึ้นไป | `753.07 - 10.83*A + 6.50*H + 14.10*W` |
| หญิง อายุ 19 ปีขึ้นไป | `584.90 - 7.01*A + 5.72*H + 11.71*W` |

ค่า `G` เผื่อการเติบโต แยกตามอายุ:

| อายุปี | ชาย kcal/day | หญิง kcal/day |
| --- | ---: | ---: |
| 3 | 20 | 15 |
| 4–8 | 15 | 15 |
| 9–13 | 25 | 30 |
| 14–18 | 20 | 20 |

สูตรและค่าเติบโตตรวจตรงกับ [NASEM Summary Tables S-2/S-3](https://www.nationalacademies.org/read/26818/chapter/2) และ [Health Canada](https://www.canada.ca/en/health-canada/services/food-nutrition/healthy-eating/dietary-reference-intakes/tables/equations-estimate-energy-requirement.html)

ขอบเขตที่เสนอ: อายุเป็นจำนวนเต็ม 3 ปีขึ้นไป อายุต่ำกว่า 3 แสดง “ยังไม่รองรับพลังงานอ้างอิงสำหรับช่วงอายุนี้” เพราะสูตรทารกแบ่งตามเดือนและค่าเติบโตต่างกัน ไม่ใช้สูตรเด็กโตแทน ส่วนการตั้งครรภ์/ให้นมมีสูตรเฉพาะและ input เดิมไม่พอ จึงไม่แสดงค่าปกติเป็นคำแนะนำสำหรับกลุ่มนี้ [Health Canada: ช่วงอายุทารกและภาวะตั้งครรภ์/ให้นม](https://www.canada.ca/en/health-canada/services/food-nutrition/healthy-eating/dietary-reference-intakes/tables/equations-estimate-energy-requirement.html)

เหตุผลเชิงผลิตภัณฑ์: เกมมีผู้เล่นเด็ก จึงควรใช้สูตรที่ครอบคลุมการเติบโต ไม่ใช้ BMR ผู้ใหญ่กับทุกอายุ ไม่ตั้งเป้าลดน้ำหนักจากข้อมูลนี้ และไม่ตัดสินว่าร่างกายอ้วน/ผอมจากอาหารในหนึ่งรอบ

## อาหารใน catalog ปัจจุบัน

ตัวเลขเป็นค่าต่อหน่วยบริโภคที่ระบุ ไม่ใช่ค่าตายตัวของชื่ออาหารทุกสูตร/ทุกยี่ห้อ ควรเก็บ `kcal`, `portionLabel`, `sourceUrl`, `sourceCheckedAt`, `referenceRegion`, `referenceVersion` แยกจากคะแนนความเหมาะสมของอาหาร

| Item | หน่วยอ้างอิงที่ตรวจได้ | kcal | แหล่งปฐมภูมิ / สถานะ |
| --- | --- | ---: | --- |
| APPLE | แอปเปิลดิบลูกใหญ่ ส่วนกินได้ 242 g | 130 | [FDA Raw Fruits](https://www.fda.gov/food/nutrition-food-labeling-and-critical-foods/raw-fruits-poster-text-version-accessible-version) |
| ORANGE | ส้มดิบขนาดกลาง ส่วนกินได้ 154 g | 80 | [FDA Raw Fruits](https://www.fda.gov/food/nutrition-food-labeling-and-critical-foods/raw-fruits-poster-text-version-accessible-version) |
| BANANA | กล้วยดิบขนาดกลาง ส่วนกินได้ 126 g | 110 | [FDA Raw Fruits](https://www.fda.gov/food/nutrition-food-labeling-and-critical-foods/raw-fruits-poster-text-version-accessible-version) |
| BROCCOLI | บรอกโคลีดิบ 1 ก้านขนาดกลาง 148 g | 45 | [FDA Raw Vegetables](https://www.fda.gov/food/nutrition-food-labeling-and-critical-foods/nutrition-information-raw-vegetables) |
| CARROT | แครอตดิบ 1 หัว ยาว 7 นิ้ว 78 g | 30 | [FDA Raw Vegetables](https://www.fda.gov/food/nutrition-food-labeling-and-critical-foods/nutrition-information-raw-vegetables) |
| WATER | น้ำเปล่า; ตัวอย่าง smartwater 33.8 fl oz/ขวด | 0 | [ผู้ผลิต smartwater](https://www.coca-cola.com/us/en/brands/smartwater/products/smartwater) ไม่ใช่น้ำหวาน/เครื่องดื่มแต่งรสทุกชนิด |
| MILK | McDonald’s US 1% Low Fat Milk Jug 1 ขวด | 100 | [McDonald’s US](https://www.mcdonalds.com/us/en-us/product/1-low-fat-milk-jug.html) ใช้ได้เมื่อระบุชนิดนี้ ไม่ใช่นมไม่หวานทุกชนิด; หน้าแสดงพลังงานต่อขวด ไม่ได้ยืนยันปริมาตรในข้อความที่อ่าน |
| BURGER | McDonald’s US Hamburger 1 ชิ้น | 250 | [McDonald’s US](https://www.mcdonalds.com/us/en-us/product/hamburger.html) |
| COLA | Coca-Cola Original US 12 fl oz/กระป๋อง | 140 | [Coca-Cola US FAQ](https://www.coca-cola.com/us/en/brands/coca-cola/products/original?redirect=true) ระวังหน้าเดียวกันมี Mexico 355 ml = 150 และขวด US 20 fl oz = 240 |
| DONUT | Krispy Kreme AU Original Glazed 1 ชิ้น น้ำหนักเฉลี่ย 49 g | 183 | [หน้าเมนูผู้ผลิต AU](https://www.krispykreme.com.au/krispy-kreme-original-glazed-doughnut) `SKU D_original-glazed`, อัปเดตตามหน้า `06/01/2026`; ใช้ค่าต่อ serving ไม่ใช่ค่า 373 ต่อ 100 g |
| PIZZA | FRESCHETTA US Naturally Rising Crust Four Cheese 1/5 ถาด 148 g | 370 | [หน้าเมนูและฉลากผู้ผลิต](https://www.freschetta.com/products/freschetta-naturally-rising-crust-four-cheese-pizza) source ID `freschetta-naturally-rising-crust-four-cheese-pizza`; ฉลากยืนยันทั้งหน่วยและ kcal โดยตรง ไม่ต้องรวมแถววัตถุดิบ |
| MEAL | ข้าวสุก 150 g + อกไก่อบไร้หนังสุก 100 g + บรอกโคลีดิบ 100 g ไม่เติมน้ำมัน/ซอส | 394 | คำนวณจาก USDA SR Legacy: ข้าว FDC `168878`, ไก่ FDC `171477`, บรอกโคลี FDC `170379`; สูตรและหลักฐาน API ด้านล่าง |

## สูตร MEAL ที่ล็อกสำหรับเวอร์ชันแรก

ทุกน้ำหนักเป็นน้ำหนักส่วนกินได้ในสภาพที่ระบุ โดยข้าวและไก่ชั่ง **หลังปรุง** ส่วนบรอกโคลีชั่งดิบ ไม่ใส่น้ำมัน ซอส น้ำสลัด หรือเครื่องเคียงอื่น ชื่อที่แสดงควรเป็น “ข้าวอกไก่กับบรอกโคลี” พร้อมดู portion ได้ ไม่ใช้คำว่า “มื้อสมดุล” เพื่ออ้างว่าความต้องการสารอาหารของผู้เล่นทุกคนครบถ้วน

| ส่วนประกอบ USDA exact description | Source ID | kcal/100 g | น้ำหนักใน MEAL | kcal ที่นำมารวม |
| --- | --- | ---: | ---: | ---: |
| Rice, white, long-grain, regular, enriched, cooked | FDC `168878`, NDB `20045` | 130 | 150 g | 195 |
| Chicken, broilers or fryers, breast, meat only, cooked, roasted | FDC `171477`, NDB `5064` | 165 | 100 g | 165 |
| Broccoli, raw | FDC `170379`, NDB `11090` | 34 | 100 g | 34 |

ผลรวม `130*150/100 + 165*100/100 + 34*100/100 = 394 kcal` เป็นการคำนวณจากสูตรที่กำหนด ไม่ใช่ค่าฉลากสำเร็จรูป และไม่รวมพลังงานของน้ำมัน/ซอสที่ไม่ได้อยู่ในสูตร

ตรวจด้วยคำขอ GET จริงจาก USDA FoodData Central API วันที่ 2026-10-04 ทั้งสามรายการตอบ HTTP 200, `dataType=SR Legacy`, `publicationDate=4/1/2019`; อ่าน nutrient `id=1008`, `number=208`, `name=Energy`, `unitName=kcal` ซึ่งเป็นค่าต่อ 100 g ไม่อ่านแถว kJ `1062` ผิดหน่วย [คู่มือ API USDA](https://fdc.nal.usda.gov/api-guide/), [ข้าว: API record](https://api.nal.usda.gov/fdc/v1/food/168878?api_key=DEMO_KEY), [ไก่: API record](https://api.nal.usda.gov/fdc/v1/food/171477?api_key=DEMO_KEY), [บรอกโคลี: API record](https://api.nal.usda.gov/fdc/v1/food/170379?api_key=DEMO_KEY)

`DEMO_KEY` เป็นกุญแจสาธารณะตามตัวอย่าง USDA ใช้เพื่ออ่านตรวจอ้างอิงครั้งนี้ ไม่ควรเรียก API ตอนเล่นเกม ให้เก็บค่าอ้างอิงคงที่พร้อม version/date แทน ค่าบรอกโคลี item เดี่ยว 45 kcal/148 g จาก FDA และส่วนประกอบ MEAL 34 kcal/100 g จาก USDA เป็นคนละแหล่ง/วิธีปัดเศษ ต้องเก็บ provenance แยก ไม่บังคับให้เท่ากันโดยแก้เลขหลักฐาน

## ข้อสรุปสำหรับแผน

- อาหารทุกชนิดที่มีพลังงานต้องเพิ่มยอดอาหาร รวมผลไม้ ผัก นมและมื้อสมดุล น้ำเปล่าเป็น 0 ไม่มีอาหาร “ลบ kcal”
- `collectedFoodKcal` เป็นผลรวมอาหารในเกม; `dailyEnergyReferenceKcal` เป็นค่าประมาณจากโปรไฟล์ ไม่เปลี่ยนเมื่อเก็บอาหาร
- รองเท้า/ดัมเบล/เชือกไม่ควรหัก kcal ด้วยตัวเลขแต่งขึ้น การประมาณการใช้พลังงานต้องมีชนิดกิจกรรม ระยะเวลา และความหนักที่วัดหรือกำหนดชัดเจน; ใน migration นี้คงเอฟเฟกต์และจำนวนที่เก็บตามแผน
- EER ต่อวันไม่ใช่เพดานอาหารสำหรับหนึ่งรอบสั้น ๆ ห้ามตัดสิน “กินเกิน/ขาดของวันนี้” โดยเทียบยอดอาหารในเกมกับ EER เสมือนบันทึกทั้งวัน
- ปิด P0 ข้อมูลทั้งหมดแล้วสำหรับชุดอ้างอิงแรก: MEAL ใช้สูตร 394 kcal ที่ตรวจ USDA API, PIZZA เปลี่ยนเป็น FRESCHETTA US 370 kcal/148 g, DONUT เปลี่ยนเป็น Krispy Kreme AU 183 kcal/49 g; ล็อก catalog version และ portion ที่ระบุ ไม่อ้างว่าเป็นผลิตภัณฑ์สูตรไทย
- แหล่งต่างประเทศ/ยี่ห้อเป็นตัวอย่างอ้างอิง ควรแจ้งหน่วยชัดเจน ถ้าต้องการอาหารไทยทั่วไปให้เปลี่ยนไปแหล่ง Thai Food Composition/ฉลากไทยที่ตรวจได้ก่อนส่งมอบชุดข้อมูล production

การปิดข้อจำกัดเดิม: ฉลาก US donut 190 kcal ดาวน์โหลดและ render ภาพตรวจได้จริง แต่หน้าเมนู US ปัจจุบันถูกจำกัดประเทศ จึงเลือกหน้า AU ที่มี portion และวันอัปเดตตรงหน้าเป็นหลักฐานล็อกค่า 183 แทน; PDF Domino’s ดาวน์โหลดจริงคืน HTML แทน PDF จึงใช้ฉลาก FRESCHETTA HTML โดยตรงและไม่ใช้ค่า 390 ที่เคยเป็น candidate หน้า USDA MyPlate ที่เปิดไม่ได้ไม่มีผลต่อ MEAL เพราะใช้ FDC API โดยตรงแล้ว ห้ามนำตัวเลข candidate เดิมกลับเข้าชุดข้อมูล
