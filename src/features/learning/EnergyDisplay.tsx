import React from 'react';
import { formatKcal } from '../health/energy';
import type { Snapshot } from '../../game/learning/types';
import { displayFoodPortion } from '../../game/learning/FoodNutrition';
import { formatGameKcal, LEGACY_EXERCISE_MODEL_VERSION } from '../../game/learning/ExerciseEnergy';
import { ITEM_CATALOG } from '../../game/learning/ItemCatalog';

export function EnergyHud({ snapshot: s }: { snapshot: Snapshot }) {
  return <aside className="lr-balance lr-energy-hud" aria-label="พลังงานอาหารในรอบ">
    <span>พลังงานสุทธิในเกม</span><b className="lr-energy-total">{s.netEnergyKcal===null?'ยังประมาณครบไม่ได้':formatGameKcal(s.netEnergyKcal)} <em>kcal</em></b>
    <small>อาหาร {formatKcal(s.foodIntakeKcal)} · ออกกำลังกาย {s.record.exerciseEnergyStatus==='unavailable'?'ยังไม่รองรับ':`−${formatGameKcal(s.exerciseKcal)} kcal`}</small>
    <strong>{s.dailyEnergyKcal === null ? 'เป้าต่อวัน: ยังไม่รองรับ' : `เป้าต่อวัน ≈ ${formatKcal(s.dailyEnergyKcal)} kcal`}</strong>
    <small>{s.dailyEnergyKcal === null ? s.energyReason : 'ประมาณจากสมมติฐานกิจกรรมน้อย'}</small>
  </aside>;
}

export function EnergyResult({ snapshot: s }: { snapshot: Snapshot }) {
  const foods = s.record.collectedFoods ?? [];
  return <section className="lr-energy-result" aria-label="สรุปพลังงานอาหาร">
    <div className="lr-energy-summary"><span>พลังงานสุทธิในเกม <strong>{s.netEnergyKcal===null?'ยังประมาณครบไม่ได้':formatGameKcal(s.netEnergyKcal)} <small>kcal</small></strong></span>
      <span>เป้าพลังงานต่อวันโดยประมาณ <strong>{s.dailyEnergyKcal === null ? 'ยังไม่รองรับ' : `≈ ${formatKcal(s.dailyEnergyKcal)} kcal`}</strong></span></div>
    <p>{s.netEnergyKcal===null ? `อาหารสะสม ${formatKcal(s.foodIntakeKcal)} kcal · พลังงานออกกำลังกายยังประมาณไม่ได้`
      : `อาหารสะสม ${formatKcal(s.foodIntakeKcal)} kcal − ไอเทมออกกำลังกาย ${formatGameKcal(s.exerciseKcal)} kcal = ${formatGameKcal(s.netEnergyKcal)} kcal`}</p>
    <p>{s.dailyEnergyKcal === null ? s.energyReason : 'ประมาณจากสมมติฐานกิจกรรมน้อย · ใช้ข้อมูลตอนเริ่มรอบ'}<br />ยอดอาหารเป็นการจำลองในเกม ไม่ใช่บันทึกอาหารที่กินจริงทั้งวัน<br />รูปร่างตัวละครเป็นเอฟเฟกต์เกมเมื่อพลังงานสุทธิเกินเป้า ไม่ใช่การทำนายน้ำหนักจริง</p>
    {foods.length ? <div className="lr-table-wrap"><table><caption>อาหารที่เก็บ · 1 item = 1 หน่วยบริโภคอ้างอิง</caption>
      <thead><tr><th>อาหาร / หน่วยบริโภค</th><th>จำนวน</th><th>รวม kcal</th></tr></thead>
      <tbody>{foods.map(f => <tr key={f.foodId}><td>{f.name}<small>{displayFoodPortion(f.portionLabel)}</small></td><td>{f.count}</td><td>{formatKcal(f.kcalPerPortion * f.count)}</td></tr>)}</tbody>
    </table></div> : <p>ยังไม่ได้เก็บอาหารในรอบนี้</p>}
    {!!s.record.collectedExercises?.length && <div className="lr-table-wrap"><table><caption>ไอเทมออกกำลังกายที่กระโดดเก็บ</caption>
      <thead><tr><th>ไอเทม</th><th>จำนวน</th><th>หัก kcal</th></tr></thead>
      <tbody>{s.record.collectedExercises.map(e=><tr key={e.itemType}><td>{ITEM_CATALOG[e.itemType].name}{e.durationMinutes && <small>{e.activityLabel} · เทียบเท่า 1 นาที</small>}</td><td>{e.count}</td><td>{e.kcalPerPickup===null?'ยังไม่มีค่าประมาณ':`−${formatGameKcal(e.count*e.kcalPerPickup)}`}</td></tr>)}</tbody>
    </table></div>}
    {s.record.exerciseModelVersion && <p>{s.record.exerciseModelVersion===LEGACY_EXERCISE_MODEL_VERSION?'รอบเก่านี้ใช้ค่าหักคงที่ตามกติกาเดิม':'ไอเทม 1 ชิ้นแทนกิจกรรมจำลอง 1 นาที ค่าหักเป็นพลังงานรวมโดยประมาณตามน้ำหนักและช่วงอายุ'} ไม่ใช่พลังงานที่เผาผลาญจริงจากการกระโดดหนึ่งครั้ง</p>}
    {s.record.exerciseEnergyStatus==='unavailable' && <p>{s.record.exerciseEnergyReason}</p>}
    <details><summary>ที่มาของหน่วยบริโภคและพลังงาน</summary><p>ใช้ FDA / USDA และฉลากผู้ผลิตต่างประเทศ หน่วยที่ระบุเป็นตัวอย่างอ้างอิง ขนาดและสูตรของอาหารจริงอาจต่างกัน มื้อข้าวกับไก่และผักไม่เติมน้ำมันหรือซอส</p>
      <p>กิจกรรมอายุ 6–18 ปีใช้ <a href="https://www.nccor.org/tools-youthcompendium/how-to-use/" target="_blank" rel="noreferrer">NCCOR Youth Compendium</a> และอายุ 19–59 ปีใช้ <a href="https://pacompendium.com/" target="_blank" rel="noreferrer">2024 Adult Compendium</a> คำนวณพลังงานรวมของกิจกรรมจำลอง 1 นาที</p>
      <small>ข้อมูลอาหาร {s.record.nutritionVersion} · สูตร {s.record.energyModelVersion} · กิจกรรม {s.record.exerciseModelVersion}</small></details>
  </section>;
}
