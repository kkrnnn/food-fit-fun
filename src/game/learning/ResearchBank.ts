import source from './research-questions.json';
import type { QuestionBank } from './types';

export const RESEARCH_SOURCE = source;
export const RESEARCH_BANK: QuestionBank = {
  schemaVersion: 2,
  contentVersion: `research-docx-${source.sourceSha256.slice(0,12)}-proposed-key-v1`,
  blueprintVersion: 'research-only-25-eligible-v1',
  questions: source.questions.filter(q => q.proposedCorrectOptionId !== null).map(q => ({
    questionId: `research-docx-${q.sourceNumber}`, revision: 1,
    topic: [4,16,17,22,23,24,26].includes(q.sourceNumber) ? 'กิจกรรมทางกาย' : 'อาหาร',
    difficulty: 'easy', ageRange: [0,null], learningObjective: q.prompt,
    prompt: q.prompt, options: q.options, correctOptionId: q.proposedCorrectOptionId!,
    explanation: `คำตอบ: ${q.options.find(o => o.optionId === q.proposedCorrectOptionId)!.text}`,
    source: `${source.sourceFile} ข้อ ${q.sourceNumber} · SHA256 ${source.sourceSha256} · เอกสารไม่มีเฉลย เฉลยนี้เลือกตามคำอนุญาตผู้ใช้`,
    reviewStatus: 'draft',
  })),
};
