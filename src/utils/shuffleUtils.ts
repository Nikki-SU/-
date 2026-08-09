import type { Option, Question } from '../types';

// Fisher-Yates shuffle algorithm
export function shuffleArray<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function shuffleQuestionOptions(question: Question): Question {
  const indexedOptions = question.options.map((opt, index) => ({
    ...opt,
    originalIndex: opt.originalIndex ?? index,
  }));

  const shuffled = shuffleArray(indexedOptions);

  const relabeledOptions = shuffled.map((opt, newIndex) => ({
    ...opt,
    label: String.fromCharCode(65 + newIndex),
  }));

  return {
    ...question,
    shuffledOptions: relabeledOptions,
  };
}

export function shuffleAllQuestions(questions: Question[]): Question[] {
  return questions.map((q) => shuffleQuestionOptions(q));
}

export function getCurrentDisplayOptions(question: Question | undefined): Option[] {
  if (!question) return [];
  return question.shuffledOptions || question.options;
}

export function mapSelectionToOriginal(
  selectedLabels: string[],
  question: Question
): number[] {
  const options = question.shuffledOptions || question.options;
  return selectedLabels.map((label) => {
    const opt = options.find((o) => o.label === label);
    return opt ? opt.originalIndex : -1;
  }).filter((idx) => idx !== -1);
}

export function mapOriginalIndexesToLabels(
  originalIndexes: number[],
  question: Question
): string[] {
  const options = question.shuffledOptions || question.options;
  return originalIndexes.map((idx) => {
    const opt = options.find((o) => o.originalIndex === idx);
    return opt ? opt.label : '';
  }).filter((label) => label !== '');
}

export function getDisplayAnswer(question: Question): string {
  const options = question.shuffledOptions || question.options;
  const correctIndexes = question.answer.split('').map((c) => {
    const idx = c.charCodeAt(0) - 65;
    return idx;
  });
  return correctIndexes
    .map((idx) => {
      const opt = options.find((o) => o.originalIndex === idx);
      return opt ? opt.label : '';
    })
    .filter((label) => label !== '')
    .join('');
}
