import type { Option, Question } from '../types';

export function shuffleArray<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function shuffleQuestionOptions(question: Question): Question {
  const shuffled = shuffleArray(question.options);
  const relabeledOptions = shuffled.map((opt, newIndex) => ({
    ...opt,
    label: String.fromCharCode(65 + newIndex),
  }));

  return {
    ...question,
    options: relabeledOptions,
  };
}

export function shuffleAllQuestions(questions: Question[]): Question[] {
  return questions.map((q) => shuffleQuestionOptions(q));
}

export function getDisplayOptions(question: Question | undefined): Option[] {
  if (!question) return [];
  return question.options;
}

export function getDisplayAnswerLabels(question: Question): string {
  const correctContents = question.answerContent.split('|||').filter(Boolean);
  return correctContents.map((content) => {
    const opt = question.options.find((o) => o.text === content.trim());
    return opt ? opt.label : '';
  }).filter((label) => label !== '').join('');
}

export function checkAnswerByContent(
  userSelectedContents: string[],
  correctAnswerContent: string,
  type: 'single' | 'multi'
): 'correct' | 'wrong' | 'partial' | 'unanswered' {
  if (userSelectedContents.length === 0) return 'unanswered';

  const correctSet = new Set(correctAnswerContent.split('|||').filter(c => c.trim()));
  const userSet = new Set(userSelectedContents);

  if (type === 'single') {
    return userSet.has(correctAnswerContent.trim()) ? 'correct' : 'wrong';
  }

  const hasWrong = [...userSet].some((c) => !correctSet.has(c));
  const isSubset = [...userSet].every((c) => correctSet.has(c));
  const isEqual = userSet.size === correctSet.size && isSubset;

  if (isEqual) return 'correct';
  if (hasWrong) return 'wrong';
  if (isSubset && userSet.size < correctSet.size) return 'partial';
  return 'wrong';
}

export function getUserSelectedLabels(question: Question, selectedContents: string[]): string[] {
  return selectedContents.map((content) => {
    const opt = question.options.find((o) => o.text === content.trim());
    return opt ? opt.label : '';
  }).filter((label) => label !== '');
}

export function getOptionColorBasedOnContent(
  question: Question,
  optionLabel: string,
  selectedContents: string[],
  correctAnswerContent: string,
  status: string
): 'gray' | 'blue' | 'green' | 'red' | 'yellow' {
  if (status === 'unanswered') {
    return selectedContents.some(c => {
      const opt = question.options.find(o => o.label === optionLabel);
      return opt && c === opt.text;
    }) ? 'blue' : 'gray';
  }

  const options = question.options;
  const selectedLabels = getUserSelectedLabels(question, selectedContents);
  const correctLabels = getDisplayAnswerLabels(question);

  const isSelected = selectedLabels.includes(optionLabel);
  const isCorrect = correctLabels.includes(optionLabel);
  const isWrong = !isCorrect;

  if (status === 'correct') {
    return isSelected && isCorrect ? 'green' : 'gray';
  }

  if (status === 'wrong' || status === 'partial') {
    if (isSelected && isCorrect) return 'green';
    if (isSelected && isWrong) return 'red';
    if (!isSelected && isCorrect) return 'yellow';
    return 'gray';
  }

  return 'gray';
}
