import type { AnswerStatus, ColorType } from '../types';

export function checkAnswer(
  selected: string[],
  correctAnswer: string,
  type: 'single' | 'multi'
): AnswerStatus {
  if (selected.length === 0) return 'unanswered';

  const correctSet = new Set(correctAnswer.split(''));
  const selectedSet = new Set(selected);

  if (type === 'single') {
    return selected[0] === correctAnswer ? 'correct' : 'wrong';
  }

  const hasWrong = selected.some((s) => !correctSet.has(s));
  const isSubset = selected.every((s) => correctSet.has(s));
  const isEqual = selected.length === correctSet.size && isSubset;

  if (isEqual) return 'correct';
  if (hasWrong) return 'wrong';
  if (isSubset && selected.length < correctSet.size) return 'partial';
  return 'wrong';
}

export function getOptionColor(
  label: string,
  selected: string[],
  correctAnswer: string,
  status: AnswerStatus
): ColorType {
  if (status === 'unanswered') {
    return selected.includes(label) ? 'blue' : 'gray';
  }

  const isSelected = selected.includes(label);
  const isCorrect = correctAnswer.includes(label);

  if (isSelected && isCorrect) return 'green';
  if (isSelected && !isCorrect) return 'red';
  if (!isSelected && isCorrect && status === 'partial') return 'yellow';
  return 'gray';
}