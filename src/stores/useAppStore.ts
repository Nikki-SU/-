import { create } from 'zustand';
import {
  readCSV,
  writeCSV,
  ensureDataDir,
  stringifyCSV,
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

let _isSaving = false;
let _needsSave = false;

const STORAGE_KEY_PREFIX = 'quiz_app_';

function isWeb(): boolean {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
}

function syncSaveAll(state: ReturnType<typeof useAppStore.getState>) {
  if (!isWeb()) return;

  try {
    const questionRows = state.questions.map((q) => ({
      id: q.id,
      index: q.index,
      title: q.title,
      content: q.content,
      options: q.options.map((o) => ({ label: o.label, text: o.text })),
      answer: q.answer,
      explanation: q.explanation,
      type: q.type,
    }));
    localStorage.setItem(
      STORAGE_KEY_PREFIX + 'questions.json',
      JSON.stringify(questionRows)
    );

    const progressRows = Object.values(state.progressMap).map((p) => ({
      questionId: p.questionId,
      selected: p.selected,
      status: p.status,
      answeredAt: p.answeredAt || null,
    }));
    localStorage.setItem(
      STORAGE_KEY_PREFIX + 'progress.json',
      JSON.stringify(progressRows)
    );

    localStorage.setItem(
      STORAGE_KEY_PREFIX + 'wrong_bank.json',
      JSON.stringify(state.wrongBankIds)
    );

    localStorage.setItem(
      STORAGE_KEY_PREFIX + 'favorites.json',
      JSON.stringify(state.favoritesIds)
    );

    localStorage.setItem(
      STORAGE_KEY_PREFIX + 'metadata.json',
      JSON.stringify({
        currentIndex: state.currentIndex,
        currentMode: state.currentMode,
        isInWrongBank: state.isInWrongBank,
        isProgressBoardExpanded: state.isProgressBoardExpanded,
        totalQuestions: state.questions.length,
        lastOpened: new Date().toISOString(),
      })
    );
  } catch (e) {
    console.warn('Sync save failed:', e);
  }
}

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
  showHome: boolean;
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
  goHome: () => void;
  showToast: (message: string) => void;
  hideToast: () => void;
  setShowSummary: (value: boolean) => void;
  setShowHome: (value: boolean) => void;
  getCurrentQuestions: () => Question[];
}

async function performSave(state: ReturnType<typeof useAppStore.getState>) {
  // Web环境使用JSON存储，避免CSV解析问题
  if (isWeb()) {
    console.log('[DEBUG] performSave: web env, using JSON');
    syncSaveAll(state);
    return;
  }

  console.log('[DEBUG] performSave: native env, using CSV');
  await ensureDataDir();

  const questionRows: QuestionCSVRow[] = state.questions.map((q) => ({
    id: q.id,
    index: String(q.index),
    title: q.title,
    content: q.content,
    options: JSON.stringify(q.options.map((o) => ({ label: o.label, text: o.text }))),
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
}

function serializeSave() {
  if (_isSaving) {
    _needsSave = true;
    return;
  }
  _isSaving = true;
  performSave(useAppStore.getState())
    .then(() => {
      if (_needsSave) {
        _needsSave = false;
        return performSave(useAppStore.getState());
      }
    })
    .catch((e) => console.error('CSV save failed:', e))
    .finally(() => {
      _isSaving = false;
    });
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
  showHome: false,
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
    if (questions.length === 0) {
      get().showToast('题库为空，请检查格式');
      return;
    }
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
      showHome: false,
      isInWrongBank: false,
      currentMode: 'question',
    });
    // 直接构造保存数据，避免state更新延迟
    try {
      const questionRows = questions.map((q) => ({
        id: q.id,
        index: q.index,
        title: q.title,
        content: q.content,
        options: q.options.map((o) => ({ label: o.label, text: o.text })),
        answer: q.answer,
        explanation: q.explanation,
        type: q.type,
      }));
      localStorage.setItem(
        STORAGE_KEY_PREFIX + 'questions.json',
        JSON.stringify(questionRows)
      );

      const progressRows = Object.values(progressMap).map((p) => ({
        questionId: p.questionId,
        selected: p.selected,
        status: p.status,
        answeredAt: p.answeredAt || null,
      }));
      localStorage.setItem(
        STORAGE_KEY_PREFIX + 'progress.json',
        JSON.stringify(progressRows)
      );

      localStorage.setItem(
        STORAGE_KEY_PREFIX + 'wrong_bank.json',
        JSON.stringify([])
      );
      localStorage.setItem(
        STORAGE_KEY_PREFIX + 'favorites.json',
        JSON.stringify([])
      );
      localStorage.setItem(
        STORAGE_KEY_PREFIX + 'metadata.json',
        JSON.stringify({
          currentIndex: 0,
          currentMode: 'question',
          isInWrongBank: false,
          isProgressBoardExpanded: false,
          totalQuestions: questions.length,
          lastOpened: new Date().toISOString(),
        })
      );
      console.log('[DEBUG] JSON save successful');
    } catch (e) {
      console.warn('JSON save failed:', e);
    }
    serializeSave();
    get().showToast(`导入成功，共 ${questions.length} 题`);
  },

  loadFromCSV: async () => {
    // Web环境优先从JSON读取（避免CSV解析问题）
    if (isWeb()) {
      try {
        const questionsRaw = localStorage.getItem(STORAGE_KEY_PREFIX + 'questions.json');
        const progressRaw = localStorage.getItem(STORAGE_KEY_PREFIX + 'progress.json');
        const wrongRaw = localStorage.getItem(STORAGE_KEY_PREFIX + 'wrong_bank.json');
        const favRaw = localStorage.getItem(STORAGE_KEY_PREFIX + 'favorites.json');
        const metaRaw = localStorage.getItem(STORAGE_KEY_PREFIX + 'metadata.json');

        if (!questionsRaw) {
          // 尝试从旧CSV格式加载
          const csvQuestions = localStorage.getItem(STORAGE_KEY_PREFIX + 'questions.csv');
          if (!csvQuestions) return;
        }

        const questions: Question[] = questionsRaw
          ? JSON.parse(questionsRaw).map((q: any) => ({
              id: q.id,
              index: q.index,
              title: q.title,
              content: q.content,
              options: q.options,
              answer: q.answer,
              explanation: q.explanation,
              type: q.type,
            }))
          : [];

        const progressMap: Record<string, Progress> = {};
        if (progressRaw) {
          JSON.parse(progressRaw).forEach((p: any) => {
            progressMap[p.questionId] = {
              questionId: p.questionId,
              selected: p.selected || [],
              status: p.status as AnswerStatus,
              answeredAt: p.answeredAt || undefined,
            };
          });
        }

        const wrongBankIds = wrongRaw ? JSON.parse(wrongRaw) : [];
        const favoritesIds = favRaw ? JSON.parse(favRaw) : [];

        let currentIndex = 0;
        if (metaRaw) {
          const meta = JSON.parse(metaRaw);
          currentIndex = meta.currentIndex || 0;
        }

        set({
          questions,
          progressMap,
          wrongBankIds,
          favoritesIds,
          currentIndex,
          showHome: false,
        });
        return;
      } catch (e) {
        console.warn('JSON load failed, trying CSV:', e);
      }
    }

    // Native环境使用CSV
    await ensureDataDir();

    const questionRows = await readCSV<QuestionCSVRow>('questions.csv');
    const questions: Question[] = questionRows.map((row) => {
      let options: { label: string; text: string }[];
      try {
        const parsed = JSON.parse(row.options);
        if (Array.isArray(parsed)) {
          options = parsed;
        } else {
          throw new Error('Not an array');
        }
      } catch {
        options = row.options.split('|').map((opt) => {
          const [label, ...textParts] = opt.split(':');
          return { label, text: textParts.join(':') };
        });
      }
      return {
        id: row.id,
        index: parseInt(row.index),
        title: row.title,
        content: row.content,
        options,
        answer: row.answer,
        explanation: row.explanation,
        type: row.type as 'single' | 'multi',
      };
    });

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
    serializeSave();
  },

  selectOption: (questionId: string, label: string) => {
    const { progressMap, questions } = get();
    const question = questions.find((q) => q.id === questionId);
    const progress = progressMap[questionId];
    if (!question || !progress) return;
    
    // 允许在任何状态下选择答案（用于修复错误状态）
    if (progress.status !== 'unanswered' && progress.status !== 'wrong' && progress.status !== 'partial') {
      return;
    }

    let newSelected: string[];
    if (question.type === 'single') {
      newSelected = progress.selected.includes(label) ? [] : [label];
    } else {
      newSelected = progress.selected.includes(label)
        ? progress.selected.filter((s) => s !== label)
        : [...progress.selected, label].sort();
    }

    const newProgress = { ...progress, selected: newSelected };
    set({
      progressMap: {
        ...progressMap,
        [questionId]: newProgress,
      },
    });
    // 立即同步保存
    syncSaveAll(useAppStore.getState());
    serializeSave();
    console.log('[DEBUG selectOption]', questionId, 'selected:', newSelected, 'status:', progress.status);
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

    console.log('[DEBUG submitAnswer]', questionId, 'selected:', progress.selected, 'correct:', question.answer, 'status:', status);
    
    set({
      progressMap: {
        ...progressMap,
        [questionId]: newProgress,
      },
      wrongBankIds: newWrongBankIds,
      currentMode: 'explanation',
    });
    // 立即同步保存
    syncSaveAll(useAppStore.getState());
    serializeSave();
  },

  goToPrevious: () => {
    const { currentIndex } = get();
    if (currentIndex > 0) {
      set({ currentIndex: currentIndex - 1, currentMode: 'question' });
      syncSaveAll(useAppStore.getState());
      serializeSave();
    }
  },

  goToNext: () => {
    const { currentIndex } = get();
    const list = get().getCurrentQuestions();
    if (currentIndex < list.length - 1) {
      set({ currentIndex: currentIndex + 1, currentMode: 'question' });
      syncSaveAll(useAppStore.getState());
      serializeSave();
    } else {
      const allAnswered = list.every(
        (q) => get().progressMap[q.id]?.status !== 'unanswered'
      );
      console.log('[DEBUG goToNext] currentIndex:', currentIndex, 'list.length:', list.length, 'allAnswered:', allAnswered);
      
      // 调试：检查每道题的状态
      list.forEach((q, i) => {
        const status = get().progressMap[q.id]?.status;
        console.log(`[DEBUG] 题${i+1}(${q.id}): status=${status}`);
      });
      
      if (allAnswered) {
        set({ showSummary: true });
        syncSaveAll(useAppStore.getState());
        console.log('[DEBUG] showSummary set to true');
      } else {
        get().showToast('还有题目未完成');
        console.log('[DEBUG] Some questions unanswered');
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
      syncSaveAll(useAppStore.getState());
      serializeSave();
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
    syncSaveAll(useAppStore.getState());
    serializeSave();
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
    syncSaveAll(useAppStore.getState());
    serializeSave();
  },

  exitWrongBank: () => {
    set({ isInWrongBank: false, currentIndex: 0, currentMode: 'question' });
    syncSaveAll(useAppStore.getState());
    serializeSave();
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
      showHome: false,
    });
    syncSaveAll(useAppStore.getState());
    serializeSave();
  },

  goHome: () => {
    set({ showHome: true, showSummary: false });
    syncSaveAll(useAppStore.getState());
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

  setShowHome: (value: boolean) => {
    set({ showHome: value });
  },
}));

// 开发模式下暴露 store 到 window 对象，便于调试
if (typeof window !== 'undefined') {
  Object.defineProperty(window, '__quizStore', {
    get: () => useAppStore,
    configurable: true,
  });
}