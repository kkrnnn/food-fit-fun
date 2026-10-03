import { expect, it } from 'vitest';
import { RESEARCH_BANK, RESEARCH_SOURCE } from './ResearchBank';
import { createQuestionSet, parseBank } from './QuestionDeck';

it('retains the 26 authored questions, with only source content in the playable bank',()=>{
  expect(RESEARCH_SOURCE.questions).toHaveLength(26);
  expect(RESEARCH_SOURCE.answerKeyInSource).toBe(false);
  expect(RESEARCH_BANK.questions).toHaveLength(25);
  expect(parseBank(RESEARCH_BANK)).toEqual(RESEARCH_BANK);
  for(const q of RESEARCH_BANK.questions){
    const original=RESEARCH_SOURCE.questions.find(v=>q.questionId===`research-docx-${v.sourceNumber}`)!;
    expect(q.prompt).toBe(original.prompt);expect(q.options).toEqual(original.options);
    expect(q.correctOptionId).toBe(original.proposedCorrectOptionId);expect(q.reviewStatus).toBe('draft');
  }
  expect(RESEARCH_SOURCE.questions[4].proposedCorrectOptionId).toBeNull();
  expect(RESEARCH_BANK.questions.some(q=>q.questionId==='research-docx-5')).toBe(false);
});
it('draws ten distinct questions solely from the research source and varies each seed',()=>{
  const deck={contentVersion:RESEARCH_BANK.contentVersion,counts:{}};
  const drawn=new Set<string>(),sets=new Set<string>();
  for(let seed=0;seed<50;seed++){
    const questions=createQuestionSet(RESEARCH_BANK,120,deck,seed,true);
    expect(questions).toHaveLength(10);expect(new Set(questions.map(q=>q.question.questionId)).size).toBe(10);
    questions.forEach(q=>drawn.add(q.question.questionId));sets.add(questions.map(q=>q.question.questionId).join(','));
  }
  expect(drawn.size).toBe(25);expect(sets.size).toBeGreaterThan(1);
});
