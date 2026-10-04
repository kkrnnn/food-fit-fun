import type { ItemType } from './ItemCatalog';

export const NUTRITION_VERSION = 'food-portions-2026-10-04-v1';
export interface FoodPortion {
  name: string;
  portionLabel: string;
  portionGrams?: number;
  portionMl?: number;
  kcalPerPortion: number;
  sourceUrl: string;
  sourceRecordId?: string;
  sourceType: 'government' | 'manufacturer';
  referenceRegion: string;
  verifiedAt: string;
}
const fruitSource = 'https://www.fda.gov/food/nutrition-food-labeling-and-critical-foods/raw-fruits-poster-text-version-accessible-version';
const vegetableSource = 'https://www.fda.gov/food/nutrition-food-labeling-and-critical-foods/nutrition-information-raw-vegetables';
const reference = { verifiedAt: '2026-10-04', referenceRegion: 'US', sourceType: 'government' as const };
/** One pickup is one labelled portion; calories never encode food quality. */
export const FOOD_NUTRITION: Partial<Record<ItemType, FoodPortion>> = {
  APPLE: { ...reference, name: 'แอปเปิล', portionLabel: '1 ผลใหญ่ · ส่วนกินได้ 242 g', portionGrams: 242, kcalPerPortion: 130, sourceUrl: fruitSource },
  ORANGE: { ...reference, name: 'ส้ม', portionLabel: '1 ผลกลาง · ส่วนกินได้ 154 g', portionGrams: 154, kcalPerPortion: 80, sourceUrl: fruitSource },
  BANANA: { ...reference, name: 'กล้วย', portionLabel: '1 ผลกลาง · ส่วนกินได้ 126 g', portionGrams: 126, kcalPerPortion: 110, sourceUrl: fruitSource },
  BROCCOLI: { ...reference, name: 'บรอกโคลีดิบ', portionLabel: '1 ก้านกลาง · 148 g', portionGrams: 148, kcalPerPortion: 45, sourceUrl: vegetableSource },
  CARROT: { ...reference, name: 'แครอตดิบ', portionLabel: '1 หัว · 78 g', portionGrams: 78, kcalPerPortion: 30, sourceUrl: vegetableSource },
  MEAL: { ...reference, name: 'ข้าวกับไก่และผัก', portionLabel: 'ข้าวสุก 150 g + อกไก่อบ 100 g + บรอกโคลีดิบ 100 g · ไม่เติมน้ำมัน/ซอส',
    portionGrams: 350, kcalPerPortion: 394, sourceUrl: 'https://fdc.nal.usda.gov/food-details/168878/nutrients', sourceRecordId: '168878+171477+170379' },
  WATER: { ...reference, sourceType: 'manufacturer', name: 'น้ำเปล่า', portionLabel: '1 ขวด · 500 ml', portionMl: 500, kcalPerPortion: 0,
    sourceUrl: 'https://www.coca-cola.com/us/en/brands/smartwater/products/smartwater' },
  MILK: { ...reference, sourceType: 'manufacturer', name: 'นมจืดไขมัน 1%', portionLabel: '1 ขวด · McDonald’s US', kcalPerPortion: 100,
    sourceUrl: 'https://www.mcdonalds.com/us/en-us/product/1-low-fat-milk-jug.html' },
  BURGER: { ...reference, sourceType: 'manufacturer', name: 'แฮมเบอร์เกอร์', portionLabel: '1 ชิ้น · McDonald’s US Hamburger', kcalPerPortion: 250,
    sourceUrl: 'https://www.mcdonalds.com/us/en-us/product/hamburger.html' },
  PIZZA: { ...reference, sourceType: 'manufacturer', name: 'พิซซ่าชีส', portionLabel: '1/5 ถาด · 148 g · Freschetta Four Cheese US', portionGrams: 148, kcalPerPortion: 370,
    sourceUrl: 'https://www.freschetta.com/products/freschetta-naturally-rising-crust-four-cheese-pizza' },
  COLA: { ...reference, sourceType: 'manufacturer', name: 'โคล่าสูตรมีน้ำตาล', portionLabel: '1 กระป๋อง · 12 fl oz · Coca-Cola US', kcalPerPortion: 140,
    sourceUrl: 'https://www.coca-cola.com/us/en/brands/coca-cola/products/original?redirect=true' },
  DONUT: { ...reference, sourceType: 'manufacturer', referenceRegion: 'AU', name: 'โดนัทเคลือบน้ำตาล', portionLabel: '1 ชิ้น · 49 g · Krispy Kreme Original Glazed AU', portionGrams: 49, kcalPerPortion: 183,
    sourceUrl: 'https://www.krispykreme.com.au/krispy-kreme-original-glazed-doughnut' },
};

export const MEAL_COMPONENTS = [
  { food: 'ข้าวขาวสุก', grams: 150, kcalPer100g: 130, fdcId: '168878' },
  { food: 'อกไก่อบไร้หนัง', grams: 100, kcalPer100g: 165, fdcId: '171477' },
  { food: 'บรอกโคลีดิบ', grams: 100, kcalPer100g: 34, fdcId: '170379' },
] as const;

/** Keep source provenance in records while showing only the portion in results. */
export function displayFoodPortion(portion: string): string {
  return portion.split(' · ').filter(part => !/McDonald|Freschetta|Coca-Cola|Krispy Kreme/.test(part)).join(' · ');
}
