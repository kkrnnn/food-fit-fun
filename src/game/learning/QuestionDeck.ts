import type { DeckState, PlannedQuestion, Question, QuestionBank } from './types';

export function randomSource(seed: number) {
  let value = seed >>> 0;
  return () => {
    value += 0x6D2B79F5;
    let t = Math.imul(value ^ value >>> 15, 1 | value);
    t ^= t + Math.imul(t ^ t >>> 7, 61 | t);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
export function shuffle<T>(values: readonly T[], random: () => number): T[] {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
export function parseBank(input: unknown): QuestionBank {
  if (!input || typeof input !== 'object') throw new Error('ไฟล์ต้องเป็น QuestionBank JSON');
  const b = input as Partial<QuestionBank>;
  if (![1, 2].includes(b.schemaVersion!) || !b.contentVersion?.trim() || !b.blueprintVersion?.trim() || !Array.isArray(b.questions)) throw new Error('ตรวจ schemaVersion, contentVersion, blueprintVersion และ questions');
  const ids = new Set<string>();
  const text = (v: unknown) => typeof v === 'string' && v.trim().length > 0 && v.length <= 2000;
  for (const q of b.questions) {
    if (!q || !text(q.questionId) || ids.has(q.questionId) || !Number.isInteger(q.revision) || q.revision < 1) throw new Error('questionId ซ้ำหรือ revision ไม่ถูกต้อง');
    ids.add(q.questionId);
    if (![q.topic, q.learningObjective, q.prompt, q.explanation, q.source].every(text)
      || !['easy', 'medium'].includes(q.difficulty) || !['draft', 'reviewed'].includes(q.reviewStatus)
      || !Array.isArray(q.ageRange) || q.ageRange.length !== 2 || !Number.isSafeInteger(q.ageRange[0]) || q.ageRange[0] < 0 || (q.ageRange[1] === null ? b.schemaVersion !== 2 : !Number.isSafeInteger(q.ageRange[1]) || q.ageRange[0] >= q.ageRange[1])) throw new Error(`ตรวจเนื้อหา/ช่วงอายุของ ${q.questionId}`);
    if (!Array.isArray(q.options) || q.options.length !== 3 || q.options.some(o => !o || !text(o.optionId) || !text(o.text))
      || new Set(q.options.map(o => o.optionId)).size !== 3 || !q.options.some(o => o.optionId === q.correctOptionId)) throw new Error(`ตรวจ 3 ตัวเลือกและคำตอบถูกของ ${q.questionId}`);
  }
  if (b.questions.length < 10) throw new Error('ต้องมีอย่างน้อย 10 คำถามไม่ซ้ำ');
  return structuredClone(b as QuestionBank);
}

/** Lowest exposure first, randomized ties; only displayed questions increment counts. */
export function createQuestionSet(bank: QuestionBank, ageMonths: number, deck: DeckState, seed: number, demo = false): PlannedQuestion[] {
  const eligible = bank.questions.filter(q => (demo || q.reviewStatus === 'reviewed') && ageMonths >= q.ageRange[0] && (q.ageRange[1] === null || ageMonths < q.ageRange[1]));
  if (eligible.length < 10) throw new Error('คำถามที่ผ่านตรวจและตรงช่วงอายุมีไม่ครบ 10 ข้อ · เลือกชุดทดลองทั่วไปใน Settings หรือนำเข้าคลังที่ตรงกับอายุ');
  const rng = randomSource(seed);
  const counts = bank.contentVersion === deck.contentVersion ? deck.counts : {};
  const count = (q: Question) => counts[`${q.questionId}@${q.revision}`] ?? 0;
  return shuffle(eligible, rng).sort((a, b) => count(a) - count(b)).slice(0, 10)
    .map(question => ({ question: structuredClone(question), options: shuffle(question.options, rng), exposureCount: count(question) + 1 }));
}

export { RESEARCH_BANK as DEMO_BANK } from './ResearchBank';
