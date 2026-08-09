export interface Option {
  label: string;
  text: string;
  originalIndex?: number;
}

export interface Question {
  id: string;
  index: number;
  title: string;
  content: string;
  options: Option[];
  answer: string;
  answerContent: string;
  explanation: string;
  type: 'single' | 'multi';
}

export type AnswerStatus = 'correct' | 'wrong' | 'partial' | 'unanswered' | 'locked';

export interface Progress {
  questionId: string;
  selected: string[];
  selectedContents: string[];
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
  index: string;
  题干: string;
  选项A: string;
  选项B: string;
  选项C: string;
  选项D: string;
  选项E: string;
  选项F: string;
  正确答案内容: string;
  答案解析: string;
  题型: string;
  是否已答: string;
  答题状态: string;
  轮次: string;
  已选内容: string;
}

export interface ProgressCSVRow {
  questionId: string;
  selected: string;
  selectedContents: string;
  status: string;
  answeredAt: string;
  locked: string;
  round: string;
}

export interface FavoriteCSVRow {
  index: string;
  收藏时间: string;
}

export interface WrongCSVRow {
  index: string;
  用户选择内容: string;
  错误时间: string;
  轮次: string;
}

export interface BankIndexRow {
  id: string;
  name: string;
  created: string;
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
