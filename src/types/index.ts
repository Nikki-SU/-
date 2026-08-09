export interface Option {
  label: string;
  text: string;
  originalIndex: number;
}

export interface Question {
  id: string;
  index: number;
  title: string;
  content: string;
  options: Option[];
  answer: string;
  explanation: string;
  type: 'single' | 'multi';
  shuffledOptions?: Option[];
}

export type AnswerStatus = 'correct' | 'wrong' | 'partial' | 'unanswered' | 'locked';

export interface Progress {
  questionId: string;
  selected: string[];
  selectedOriginalIndexes: number[];
  status: AnswerStatus;
  locked: boolean;
  answeredAt?: number;
  round?: number;
}

export interface Bank {
  id: string;
  name: string;
  questions: Question[];
  progressMap: Record<string, Progress>;
  wrongBankIds: string[];
  favoritesIds: string[];
  wrongBankRound: number;
  wrongBankCompletedIds: string[];
  shuffledVersion: number;
  created: number;
}

export interface QuestionCSVRow {
  id: string;
  index: string;
  title: string;
  content: string;
  options: string;
  answer: string;
  explanation: string;
  type: string;
}

export interface ProgressCSVRow {
  questionId: string;
  selected: string;
  selectedOriginalIndexes: string;
  status: string;
  answeredAt: string;
  locked: string;
  round: string;
}

export interface WrongBankCSVRow {
  questionId: string;
}

export interface FavoritesCSVRow {
  questionId: string;
}

export interface MetadataCSVRow {
  key: string;
  value: string;
}

export interface BankBranch {
  bankId: string;
  bankName: string;
  questionIds: string[];
}

export interface ExportOptions {
  mode: 'branch' | 'all';
  sourceBankId?: string;
  type: 'wrong' | 'favorite' | 'bank';
  questionIds?: string[];
}

export type ColorType = 'gray' | 'blue' | 'green' | 'red' | 'yellow';

export type ScreenMode = 'question' | 'explanation' | 'summary';

export type QuestionPhase = 'answer' | 'feedback' | 'explanation';
