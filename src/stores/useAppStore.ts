import { create } from 'zustand';
import {
  readCSV,
  writeCSV,
  ensureDataDir,
} from '../utils/csvStorage';
import { parseMarkdownToQuestions } from '../utils/markdownParser';
import { checkAnswer } from '../utils/answerChecker';
import type {
  Question,
  Progress,
  AnswerStatus,
  QuestionCSVRow,
  ProgressCSVRow,
  MetadataCSVRow,
  ScreenMode,
} from '../types';

interface AppState {
  questions: Question[];
  progressMap: Record<string, Progress>;
  wrongBankIds: string[];
  favoritesIds: string[];

  currentIndex: number;
  currentMode: ScreenMode;
  isInWrongBank: boolean;
  isProgressBoardExpanded: boolean;
  showSummary: boolean;
  toastMessage: string | null;

  loadQuestionsFromMarkdown: (markdown: string) => Promise<void>;
  loadFromCSV: () => Promise<void>;
  saveToCSV: () => Promise<void>;
  selectOption: (questionId: string, label: string) => void;
  submitAnswer: (questionId: string) => void;
  goToPrevious: () => void;
  goToNext: () => void;
  goToQuestion: (index: number) => void;
  toggleExplanation: () => void;
  toggleFavorite: (questionId: string) => void;
  toggleProgressBoard: () => void;
  enterWrongBank: () => void;
  exitWrongBank: () => void;
  resetAll: () => void;
  showToast: (message: string) => void;
  hideToast: () => void;
  setShowSummary: (value: boolean) => void;
  getCurrentQuestions: () => Question[];
}

export const useAppStore = create<AppState>((set, get) => ({
  questions: [],
  progressMap: {},
  wrongBankIds: [],
  favoritesIds: [],
  currentIndex: 0,
  currentMode: 'question',
  isInWrongBank: false,
  isProgressBoardExpanded: false,
  showSummary: false,
  toastMessage: null,

  getCurrentQuestions: () => {
    const { questions, wrongBankIds, isInWrongBank } = get();
    if (isInWrongBank) {
      return wrongBankIds
        .map((id) => questions.find((q) => q.id === id))
        .filter(Boolean) as Question[];
    }
    return questions;
  },

  loadQuestionsFromMarkdown: async (markdown: string) => {
    const questions = parseMarkdownToQuestions(markdown);
    const progressMap: Record<string, Progress> = {};
    questions.forEach((q) => {
      progressMap[q.id] = {
        questionId: q.id,
        selected: [],
        status: 'unanswered',
      };
    });
    set({
      questions,
      progressMap,
      wrongBankIds: [],
      favoritesIds: [],
      currentIndex: 0,
      showSummary: false,
      isInWrongBank: false,
      currentMode: 'question',
    });
    await get().saveToCSV();
    get().showToast(`导入成功，共 ${questions.length} 题`);
  },

  loadFromCSV: async () => {
    await ensureDataDir();

    const questionRows = await readCSV<QuestionCSVRow>('questions.csv');
    const questions: Question[] = questionRows.map((row) => ({
      id: row.id,
      index: parseInt(row.index),
      title: row.title,
      content: row.content,
      options: row.options.split('|').map((opt) => {
        const [label, ...textParts] = opt.split(':');
        return { label, text: textParts.join(':') };
      }),
      answer: row.answer,
      explanation: row.explanation,
      type: row.type as 'single' | 'multi',
    }));

    const progressRows = await readCSV<ProgressCSVRow>('progress.csv');
    const progressMap: Record<string, Progress> = {};
    progressRows.forEach((row) => {
      progressMap[row.questionId] = {
        questionId: row.questionId,
        selected: row.selected ? row.selected.split('|') : [],
        status: row.status as AnswerStatus,
        answeredAt: row.answeredAt ? parseInt(row.answeredAt) : undefined,
      };
    });

    const wrongRows = await readCSV<{ questionId: string }>('wrong_bank.csv');
    const wrongBankIds = wrongRows.map((r) => r.questionId);

    const favRows = await readCSV<{ questionId: string }>('favorites.csv');
    const favoritesIds = favRows.map((r) => r.questionId);

    const metaRows = await readCSV<MetadataCSVRow>('metadata.csv');
    const metaMap: Record<string, string> = {};
    metaRows.forEach((r) => {
      metaMap[r.key] = r.value;
    });

    set({
      questions,
      progressMap,
      wrongBankIds,
      favoritesIds,
      currentIndex: parseInt(metaMap.currentIndex || '0'),
      isInWrongBank: metaMap.isInWrongBank === 'true',
    });
  },

  saveToCSV: async () => {
    await ensureDataDir();
    const state = get();

    const questionRows: QuestionCSVRow[] = state.questions.map((q) => ({
      id: q.id,
      index: String(q.index),
      title: q.title,
      content: q.content,
      options: q.options.map((o) => `${o.label}:${o.text}`).join('|'),
      answer: q.answer,
      explanation: q.explanation,
      type: q.type,
    }));
    await writeCSV('questions.csv', questionRows);

    const progressRows: ProgressCSVRow[] = Object.values(state.progressMap).map(
      (p) => ({
        questionId: p.questionId,
        selected: p.selected.join('|'),
        status: p.status,
        answeredAt: p.answeredAt ? String(p.answeredAt) : '',
      })
    );
    await writeCSV('progress.csv', progressRows);

    const wrongRows = state.wrongBankIds.map((id) => ({ questionId: id }));
    await writeCSV('wrong_bank.csv', wrongRows);

    const favRows = state.favoritesIds.map((id) => ({ questionId: id }));
    await writeCSV('favorites.csv', favRows);

    const metaRows: MetadataCSVRow[] = [
      { key: 'currentIndex', value: String(state.currentIndex) },
      { key: 'isInWrongBank', value: String(state.isInWrongBank) },
      { key: 'totalQuestions', value: String(state.questions.length) },
      { key: 'lastOpened', value: new Date().toISOString() },
    ];
    await writeCSV('metadata.csv', metaRows);
  },

  selectOption: (questionId: string, label: string) => {
    const { progressMap, questions } = get();
    const question = questions.find((q) => q.id === questionId);
    const progress = progressMap[questionId];
    if (!question || !progress || progress.status !== 'unanswered') return;

    let newSelected: string[];
    if (question.type === 'single') {
      newSelected = progress.selected.includes(label) ? [] : [label];
    } else {
      newSelected = progress.selected.includes(label)
        ? progress.selected.filter((s) => s !== label)
        : [...progress.selected, label].sort();
    }

    set({
      progressMap: {
        ...progressMap,
        [questionId]: { ...progress, selected: newSelected },
      },
    });
    get().saveToCSV();
  },

  submitAnswer: (questionId: string) => {
    const { progressMap, questions, wrongBankIds } = get();
    const question = questions.find((q) => q.id === questionId);
    const progress = progressMap[questionId];
    if (!question || !progress) return;
    if (progress.selected.length === 0) {
      get().showToast('请选择一个选项');
      return;
    }

    const status = checkAnswer(
      progress.selected,
      question.answer,
      question.type
    );

    const newProgress = {
      ...progress,
      status,
      answeredAt: Date.now(),
    };

    let newWrongBankIds = [...wrongBankIds];
    if (status === 'wrong' || status === 'partial') {
      if (!newWrongBankIds.includes(questionId)) {
        newWrongBankIds.push(questionId);
      }
    } else if (status === 'correct') {
      newWrongBankIds = newWrongBankIds.filter((id) => id !== questionId);
    }

    set({
      progressMap: {
        ...progressMap,
        [questionId]: newProgress,
      },
      wrongBankIds: newWrongBankIds,
    });
    get().saveToCSV();

    if (status === 'correct') {
      setTimeout(() => get().goToNext(), 800);
    }
  },

  goToPrevious: () => {
    const { currentIndex } = get();
    if (currentIndex > 0) {
      set({ currentIndex: currentIndex - 1, currentMode: 'question' });
      get().saveToCSV();
    }
  },

  goToNext: () => {
    const { currentIndex } = get();
    const list = get().getCurrentQuestions();
    if (currentIndex < list.length - 1) {
      set({ currentIndex: currentIndex + 1, currentMode: 'question' });
      get().saveToCSV();
    } else {
      const allAnswered = get()
        .getCurrentQuestions()
        .every((q) => get().progressMap[q.id]?.status !== 'unanswered');
      if (allAnswered) {
        set({ showSummary: true });
      }
    }
  },

  goToQuestion: (index: number) => {
    const list = get().getCurrentQuestions();
    if (index >= 0 && index < list.length) {
      set({
        currentIndex: index,
        currentMode: 'question',
        isProgressBoardExpanded: false,
      });
      get().saveToCSV();
    }
  },

  toggleExplanation: () => {
    const { currentMode } = get();
    set({ currentMode: currentMode === 'question' ? 'explanation' : 'question' });
  },

  toggleFavorite: (questionId: string) => {
    const { favoritesIds } = get();
    const newFavorites = favoritesIds.includes(questionId)
      ? favoritesIds.filter((id) => id !== questionId)
      : [...favoritesIds, questionId];
    set({ favoritesIds: newFavorites });
    get().saveToCSV();
  },

  toggleProgressBoard: () => {
    const { isProgressBoardExpanded } = get();
    set({ isProgressBoardExpanded: !isProgressBoardExpanded });
  },

  enterWrongBank: () => {
    const { wrongBankIds } = get();
    if (wrongBankIds.length === 0) {
      get().showToast('🎉 错题库已清空！');
      return;
    }
    set({ isInWrongBank: true, currentIndex: 0, currentMode: 'question' });
    get().saveToCSV();
  },

  exitWrongBank: () => {
    set({ isInWrongBank: false, currentIndex: 0, currentMode: 'question' });
    get().saveToCSV();
  },

  resetAll: () => {
    const { questions } = get();
    const progressMap: Record<string, Progress> = {};
    questions.forEach((q) => {
      progressMap[q.id] = {
        questionId: q.id,
        selected: [],
        status: 'unanswered',
      };
    });
    set({
      progressMap,
      wrongBankIds: [],
      favoritesIds: [],
      currentIndex: 0,
      currentMode: 'question',
      isInWrongBank: false,
      showSummary: false,
    });
    get().saveToCSV();
  },

  showToast: (message: string) => {
    set({ toastMessage: message });
    setTimeout(() => {
      set({ toastMessage: null });
    }, 2000);
  },

  hideToast: () => {
    set({ toastMessage: null });
  },

  setShowSummary: (value: boolean) => {
    set({ showSummary: value });
  },
}));