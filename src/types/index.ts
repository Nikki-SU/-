export interface Option {
  label: string;
  text: string;
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
}

export type AnswerStatus = 'correct' | 'wrong' | 'partial' | 'unanswered';

export interface Progress {
  questionId: string;
  selected: string[];
  status: AnswerStatus;
  answeredAt?: number;
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
  status: string;
  answeredAt: string;
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

export type ColorType = 'gray' | 'blue' | 'green' | 'red' | 'yellow';

export type ScreenMode = 'question' | 'explanation' | 'summary';