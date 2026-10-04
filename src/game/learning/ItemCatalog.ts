import type { Lane, SceneItem } from './types';

export const ITEM_CATALOG = {
  SHOES: { name: 'รองเท้ากีฬา', icon: '👟', category: 'exercise', color: 0x55d6ee },
  DUMBBELL: { name: 'ดัมเบล', icon: '🏋️', category: 'exercise', color: 0x9775eb },
  ROPE: { name: 'เชือกกระโดด', icon: '➰', category: 'exercise', color: 0x55d6ee },
  APPLE: { name: 'แอปเปิล', icon: '🍎', category: 'everyday', color: 0xef545e },
  ORANGE: { name: 'ส้ม', icon: '🍊', category: 'everyday', color: 0xffa22f },
  BANANA: { name: 'กล้วย', icon: '🍌', category: 'everyday', color: 0xffd447 },
  BROCCOLI: { name: 'บรอกโคลี', icon: '🥦', category: 'everyday', color: 0x53b869 },
  CARROT: { name: 'แครอต', icon: '🥕', category: 'everyday', color: 0xff8739 },
  MEAL: { name: 'มื้อสมดุล', icon: '🍱', category: 'everyday', color: 0x6ec7b2 },
  WATER: { name: 'น้ำเปล่า', icon: '💧', category: 'drink', color: 0x53c7e9 },
  MILK: { name: 'นมไม่หวาน', icon: '🥛', category: 'drink', color: 0xe5edf8 },
  BURGER: { name: 'เบอร์เกอร์', icon: '🍔', category: 'occasional', color: 0xe8ac54 },
  PIZZA: { name: 'พิซซ่า', icon: '🍕', category: 'occasional', color: 0xffbc53 },
  COLA: { name: 'น้ำอัดลม', icon: '🥤', category: 'occasional', color: 0xe96392 },
  DONUT: { name: 'โดนัท', icon: '🍩', category: 'occasional', color: 0xec83b6 },
} as const;
export type ItemType = keyof typeof ITEM_CATALOG;
export const isExercise = (type: ItemType): boolean => ['SHOES','DUMBBELL','ROPE'].includes(type);
/** Shuffled bags avoid a repeating food sequence; every encounter is a single optional item. */
export function createItemLayout(seed: number, spacing: number): SceneItem[] {
  let state = seed >>> 0;
  const random = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
  const shuffled = <T>(values: T[]): T[] => {
    const bag=[...values];for(let i=bag.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[bag[i],bag[j]]=[bag[j],bag[i]];}return bag;
  };
  const harmful: ItemType[]=['BURGER','PIZZA','COLA','DONUT'];
  const good: ItemType[]=['APPLE','ORANGE','BANANA','BROCCOLI','CARROT','MEAL'];
  const neutral: ItemType[]=['WATER','MILK'];
  const categories=shuffled([...Array(60).fill('harmful'),...Array(24).fill('good'),...Array(6).fill('neutral')]);
  const bags: Record<string,ItemType[]>={harmful:[],good:[],neutral:[]};
  const choices: Record<string,ItemType[]>={harmful,good,neutral};
  const previous: Record<string,ItemType|undefined>={};
  const food=()=>{
    const category=categories.pop()!;
    if(!bags[category].length){const bag=shuffled(choices[category]);if(bag[bag.length-1]===previous[category])[bag[0],bag[bag.length-1]]=[bag[bag.length-1],bag[0]];bags[category]=bag;}
    return previous[category]=bags[category].pop()!;
  };
  const exerciseSegments=new Set(shuffled([1,2,3,4,5,6,7,8]).slice(0,5));
  let exerciseBag=shuffled<ItemType>(['SHOES','DUMBBELL','ROPE']);
  const items: SceneItem[]=[];
  for(let segment=0;segment<10;segment++){
    for(let row=0;row<10;row++){
      const exercise=(row===4 || row===6) && exerciseSegments.has(segment);
      if(exercise && !exerciseBag.length)exerciseBag=shuffled<ItemType>(['SHOES','DUMBBELL','ROPE']);
      const fraction=.06 + row*.06 + random()*.004;
      items.push({id:`single-${segment}-${row}`,type:exercise?exerciseBag.pop()!:food(),lane:Math.floor(random()*3) as Lane,distance:(segment+fraction)*spacing});
    }
  }
  return items;
}
