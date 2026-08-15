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

/**
 * 二进制状态编码：收藏正确已答
 * 位2: 是否收藏 (0/1)
 * 位1: 是否正确 (0/1)
 * 位0: 是否已答 (0/1)
 * 
 * 状态值：
 * 000 未答、错误、未收藏
 * 001 答过、错误、未收藏
 * 011 答过、正确、未收藏
 * 101 答过、错误、已收藏
 * 111 答过、正确、已收藏
 */
export function encodeState(answered: boolean, isCorrect: boolean, isFav: boolean): string {
  const bit2 = isFav ? 1 : 0;
  const bit1 = isCorrect ? 1 : 0;
  const bit0 = answered ? 1 : 0;
  return `${bit2}${bit1}${bit0}`;
}

export function decodeState(state: string): { answered: boolean; isCorrect: boolean; isFav: boolean } {
  if (!state || state.length < 3) {
    return { answered: false, isCorrect: false, isFav: false };
  }
  const bit2 = state[0] === '1';
  const bit1 = state[1] === '1';
  const bit0 = state[2] === '1';
  return { answered: bit0, isCorrect: bit1, isFav: bit2 };
}

export function stateToAnswerStatus(state: string): AnswerStatus {
  const { answered, isCorrect } = decodeState(state);
  if (!answered) return 'unanswered';
  return isCorrect ? 'correct' : 'wrong';
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
  状态: string;
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
