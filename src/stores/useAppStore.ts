import { create } from 'zustand';
import {
  readCSV,
  writeCSV,
  exportCSV,
  exportMarkdown,
  stringifyCSV,
} from '../utils/csvStorage';
import {
  writeFile,
  readFile,
  removeBankFiles,
  getDataPath,
  setDataPath,
  selectWebDirectory,
  isFileSystemAccessSupported,
  readUploadedFile,
  downloadFile,
  ensureDataDir,
  listAllFiles,
} from '../utils/fileStorage';
import {
  createZipFromFiles,
  downloadZipBlob,
  extractZipFiles,
} from '../utils/zipUtils';
import { parseMarkdownWithValidation, parseMarkdownToQuestions, type ParseError } from '../utils/markdownParser';
import { shuffleQuestionOptions, shuffleAllQuestions, shuffleArray, mapSelectionToOriginal, getDisplayAnswer } from '../utils/shuffleUtils';
import { exportBothFiles } from '../utils/exportUtils';
import type {
  Question,
  Progress,
  AnswerStatus,
  QuestionCSVRow,
  ProgressCSVRow,
  ScreenMode,
  QuestionPhase,
  Bank,
  BankBranch,
  ExportOptions,
  MetadataCSVRow,
} from '../types';

export interface ImportFileResult {
  fileName: string;
  bankName: string;
  success: boolean;
  questionsCount: number;
  errors: ParseError[];
  skippedErrors: ParseError[];
}

export interface BatchImportResult {
  results: ImportFileResult[];
  totalFiles: number;
  successCount: number;
  failCount: number;
}

let _isSaving = false;
let _needsSave = false;

function isWeb(): boolean {
  return typeof window !== 'undefined';
}

function generateId(): string {
  return 'bank_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
}

interface BankIndexRow {
  id: string;
  name: string;
  created: string;
}

function initQuestionWithShuffled(q: Question): Question {
  const indexed = q.options.map((opt, idx) => ({
    ...opt,
    originalIndex: opt.originalIndex ?? idx,
  }));
  const shuffled = shuffleArray(indexed);
  const relabeled = shuffled.map((opt, newIdx) => ({
    ...opt,
    label: String.fromCharCode(65 + newIdx),
  }));
  return {
    ...q,
    options: relabeled,
    shuffledOptions: relabeled,
  };
}

async function loadBanksFromFiles(): Promise<{ banks: Bank[]; currentBankId: string | null }> {
  try {
    const indexRows = await readCSV<BankIndexRow>('banks_index.csv');
    if (indexRows.length === 0) {
      return { banks: [], currentBankId: null };
    }

    const banks: Bank[] = [];
    for (const row of indexRows) {
      const questions = await readCSV<QuestionCSVRow>(`bank_${row.id}_questions.csv`);
      const progressRows = await readCSV<ProgressCSVRow>(`bank_${row.id}_progress.csv`);
      const wrongRows = await readCSV<{ questionId: string }>(`bank_${row.id}_wrong.csv`);
      const favRows = await readCSV<{ questionId: string }>(`bank_${row.id}_favorites.csv`);

      const parsedQuestions: Question[] = questions.map((q) => {
        let options: { label: string; text: string; originalIndex: number }[];
        try {
          const parsed = JSON.parse(q.options);
          if (Array.isArray(parsed)) {
            options = parsed.map((opt, idx) => ({ ...opt, originalIndex: opt.originalIndex ?? idx }));
          } else {
            throw new Error('Not an array');
          }
        } catch {
          options = q.options.split('|').map((opt, idx) => {
            const parts = opt.split(':');
            let label: string;
            let text: string;
            let originalIndex: number;
            if (parts.length >= 3) {
              label = parts[0];
              originalIndex = parseInt(parts[parts.length - 1], 10);
              text = parts.slice(1, -1).join(':');
              if (isNaN(originalIndex)) {
                text = parts.slice(1).join(':');
                originalIndex = idx;
              }
            } else {
              const colonIdx = opt.indexOf(':');
              label = opt.substring(0, colonIdx);
              text = opt.substring(colonIdx + 1);
              originalIndex = idx;
            }
            return { label, text, originalIndex };
          });
        }
        const question: Question = {
          id: q.id,
          index: parseInt(q.index) || 0,
          title: q.title,
          content: q.content,
          options,
          answer: q.answer,
          explanation: q.explanation,
          type: q.type as 'single' | 'multi',
        };
        return initQuestionWithShuffled(question);
      });

      const progressMap: Record<string, Progress> = {};
      let maxRound = 0;
      progressRows.forEach((p) => {
        const roundVal = p.round ? parseInt(p.round) : undefined;
        if (roundVal !== undefined && roundVal > maxRound) {
          maxRound = roundVal;
        }
        progressMap[p.questionId] = {
          questionId: p.questionId,
          selected: p.selected ? p.selected.split('|') : [],
          selectedOriginalIndexes: p.selectedOriginalIndexes ? p.selectedOriginalIndexes.split('|').map(Number) : [],
          status: p.status as AnswerStatus,
          locked: p.locked === 'true',
          answeredAt: p.answeredAt ? parseInt(p.answeredAt) : undefined,
          round: roundVal,
        };
      });

      const completedRows = await readCSV<{ questionId: string }>(`bank_${row.id}_completed.csv`);
      
      const bank: Bank = {
        id: row.id,
        name: row.name,
        questions: parsedQuestions,
        progressMap,
        wrongBankIds: wrongRows.map((r) => r.questionId),
        favoritesIds: favRows.map((r) => r.questionId),
        wrongBankRound: maxRound,
        wrongBankCompletedIds: completedRows.map((r) => r.questionId),
        shuffledVersion: 0,
        created: parseInt(row.created) || Date.now(),
      };
      banks.push(bank);
    }

    const metaContent = await readFile('app_meta.csv');
    let currentBankId: string | null = null;
    if (metaContent) {
      const meta = parseCSV<{ key: string; value: string }>(metaContent);
      const found = meta.find((m) => m.key === 'currentBankId');
      if (found && banks.some((b) => b.id === found.value)) {
        currentBankId = found.value;
      }
    }

    if (!currentBankId && banks.length > 0) {
      currentBankId = banks[0].id;
    }

    return { banks, currentBankId };
  } catch (e) {
    console.warn('Failed to load banks from files:', e);
    return { banks: [], currentBankId: null };
  }
}

function parseCSV<T>(csvString: string): T[] {
  const lines = csvString.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;
    for (const char of line) {
      if (char === '"') inQuotes = !inQuotes;
      else if (char === ',' && !inQuotes) { values.push(current); current = ''; }
      else current += char;
    }
    values.push(current);
    const obj: any = {};
    headers.forEach((h, i) => {
      let val = values[i] || '';
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1).replace(/""/g, '"');
      obj[h] = val.replace(/\\\|/g, '|');
    });
    return obj as T;
  });
}

async function persistBanksToFiles(banks: Bank[], currentBankId: string | null) {
  try {
    const indexRows: BankIndexRow[] = banks.map((b) => ({
      id: b.id,
      name: b.name,
      created: String(b.created),
    }));
    await writeCSV('banks_index.csv', indexRows);

    if (currentBankId) {
      await writeCSV('app_meta.csv', [{ key: 'currentBankId', value: currentBankId }]);
    } else {
      await writeCSV('app_meta.csv', [{ key: 'currentBankId', value: '' }]);
    }
  } catch (e) {
    console.warn('Failed to persist banks index:', e);
  }
}

async function fileSyncSaveAll(state: ReturnType<typeof useAppStore.getState>) {
  if (isWeb() && !isFileSystemAccessSupported()) {
    return;
  }

  try {
    const { banks, currentBankId, questions, progressMap, wrongBankIds, favoritesIds, wrongBankRound, wrongBankCompletedIds } = state;

    const updatedBanks = banks.map(bank => {
      if (bank.id === currentBankId) {
        return {
          ...bank,
          questions,
          progressMap,
          wrongBankIds,
          favoritesIds,
          wrongBankRound,
          wrongBankCompletedIds,
        };
      }
      return bank;
    });

    await persistBanksToFiles(updatedBanks, currentBankId);
    useAppStore.setState({ banks: updatedBanks });

    if (currentBankId) {
      const questionRows: QuestionCSVRow[] = questions.map((q) => ({
        id: q.id,
        index: String(q.index),
        title: q.title,
        content: q.content,
        options: JSON.stringify(q.options),
        answer: q.answer,
        explanation: q.explanation,
        type: q.type,
      }));
      await writeCSV(`bank_${currentBankId}_questions.csv`, questionRows);

      const progressRows: ProgressCSVRow[] = Object.values(progressMap).map((p) => ({
        questionId: p.questionId,
        selected: p.selected.join('|'),
        selectedOriginalIndexes: p.selectedOriginalIndexes ? p.selectedOriginalIndexes.join('|') : '',
        status: p.status,
        answeredAt: p.answeredAt ? String(p.answeredAt) : '',
        locked: String(p.locked),
        round: p.round ? String(p.round) : '',
      }));
      await writeCSV(`bank_${currentBankId}_progress.csv`, progressRows);

      await writeCSV(`bank_${currentBankId}_wrong.csv`, wrongBankIds.map((id) => ({ questionId: id })));
      await writeCSV(`bank_${currentBankId}_favorites.csv`, favoritesIds.map((id) => ({ questionId: id })));
      await writeCSV(`bank_${currentBankId}_completed.csv`, wrongBankCompletedIds.map((id) => ({ questionId: id })));
    }
  } catch (e) {
    if (e instanceof Error && e.message === 'NO_DIRECTORY') {
      if (isFileSystemAccessSupported()) {
        useAppStore.getState().showToast('请先设置数据存储路径');
      }
    } else {
      console.warn('File sync save failed:', e);
    }
  }
}

interface AppState {
  banks: Bank[];
  currentBankId: string | null;

  questions: Question[];
  progressMap: Record<string, Progress>;
  wrongBankIds: string[];
  favoritesIds: string[];
  wrongBankRound: number;
  wrongBankCompletedIds: string[];

  currentIndex: number;
  currentMode: ScreenMode;
  phase: QuestionPhase;
  isInWrongBank: boolean;
  isInFavoritesBank: boolean;
  isProgressBoardExpanded: boolean;
  showSummary: boolean;
  showHome: boolean;
  toastMessage: string | null;
  dataPath: string | null;
  isLoading: boolean;

  addBank: (name: string, markdown: string) => Promise<boolean>;
  importMarkdownFiles: (files: { name: string; content: string }[]) => Promise<BatchImportResult>;
  switchBank: (bankId: string) => Promise<void>;
  deleteBank: (bankId: string) => Promise<void>;
  renameBank: (bankId: string, name: string) => Promise<void>;
  getCurrentBank: () => Bank | undefined;

  loadQuestionsFromMarkdown: (markdown: string) => Promise<void>;
  loadFromCSV: () => Promise<void>;
  saveToCSV: () => Promise<void>;
  selectOption: (questionId: string, label: string) => void;
  submitAnswer: (questionId: string) => void;
  markDontKnow: (questionId: string) => void;
  advanceToNextQuestion: () => void;
  goToQuestion: (index: number) => void;
  toggleFavorite: (questionId: string) => void;
  clearAllFavorites: () => void;
  enterFavoritesBank: () => void;
  exitFavoritesBank: () => void;
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
  setCustomDataPath: (path: string) => Promise<void>;
  selectDataDirectory: () => Promise<string | null>;
  initializeDataPath: () => Promise<void>;
  exportAllData: () => Promise<void>;
  importAllData: (file: any) => Promise<boolean>;
  checkWrongBankRoundComplete: () => void;
  resetWrongBankLocked: () => void;
  shuffleQuestionsInBank: () => void;

  getWrongBankBranches: () => BankBranch[];
  getFavoriteBranches: () => BankBranch[];
  enterWrongBankBranch: (bankId: string) => void;
  enterFavoriteBranch: (bankId: string) => void;
  clearWrongBranchProgress: (bankId: string) => void;
  clearFavoriteBranchProgress: (bankId: string) => void;

  exportWrongBranch: (bankId: string) => void;
  exportWrongAll: () => void;
  exportFavoriteBranch: (bankId: string) => void;
  exportFavoriteAll: () => void;
}

async function performSave(state: ReturnType<typeof useAppStore.getState>) {
  if (isWeb()) {
    await fileSyncSaveAll(state);
    return;
  }

  await ensureDataDir();

  const { questions, progressMap, wrongBankIds, favoritesIds, wrongBankCompletedIds } = state;

  const questionRows: QuestionCSVRow[] = questions.map((q) => ({
    id: q.id,
    index: String(q.index),
    title: q.title,
    content: q.content,
    options: JSON.stringify(q.options),
    answer: q.answer,
    explanation: q.explanation,
    type: q.type,
  }));
  await writeCSV('questions.csv', questionRows);

  const progressRows: ProgressCSVRow[] = Object.values(progressMap).map(
    (p) => ({
      questionId: p.questionId,
      selected: p.selected.join('|'),
      selectedOriginalIndexes: p.selectedOriginalIndexes ? p.selectedOriginalIndexes.join('|') : '',
      status: p.status,
      answeredAt: p.answeredAt ? String(p.answeredAt) : '',
      locked: String(p.locked),
      round: p.round ? String(p.round) : '',
    })
  );
  await writeCSV('progress.csv', progressRows);

  const wrongRows = wrongBankIds.map((id) => ({ questionId: id }));
  await writeCSV('wrong_bank.csv', wrongRows);

  const favRows = favoritesIds.map((id) => ({ questionId: id }));
  await writeCSV('favorites.csv', favRows);

  const completedRows = wrongBankCompletedIds.map((id) => ({ questionId: id }));
  await writeCSV('wrong_bank_completed.csv', completedRows);

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
    .catch((e) => console.error('Save failed:', e))
    .finally(() => {
      _isSaving = false;
    });
}

export const useAppStore = create<AppState>((set, get) => ({
  banks: [],
  currentBankId: null,
  questions: [],
  progressMap: {},
  wrongBankIds: [],
  favoritesIds: [],
  wrongBankRound: 0,
  wrongBankCompletedIds: [],
  currentIndex: 0,
  currentMode: 'question',
  phase: 'answer',
  isInWrongBank: false,
  isInFavoritesBank: false,
  isProgressBoardExpanded: false,
  showSummary: false,
  showHome: true,
  toastMessage: null,
  dataPath: null,
  isLoading: true,

  initializeDataPath: async () => {
    const existingPath = getDataPath();
    set({ dataPath: existingPath });
  },

  setCustomDataPath: async (path: string) => {
    if (isWeb() && isFileSystemAccessSupported()) {
      get().showToast('请使用「选择本地文件夹」按钮');
      return;
    }
    setDataPath(path);
    set({ dataPath: path });
    get().showToast('数据路径已设置');
    await get().loadFromCSV();
  },

  selectDataDirectory: async () => {
    if (!isFileSystemAccessSupported()) {
      get().showToast('当前浏览器不支持选择目录，请使用 Chrome/Edge (HTTPS)');
      return null;
    }
    const path = await selectWebDirectory();
    if (path) {
      set({ dataPath: path });
      get().showToast('目录已选择: ' + path);
      await get().loadFromCSV();
    }
    return path;
  },

  getCurrentBank: () => {
    const { banks, currentBankId } = get();
    return banks.find((b) => b.id === currentBankId);
  },

  getCurrentQuestions: () => {
    const { questions, wrongBankIds, favoritesIds, isInWrongBank, isInFavoritesBank } = get();
    if (isInFavoritesBank) {
      return favoritesIds
        .map((id) => questions.find((q) => q.id === id))
        .filter(Boolean) as Question[];
    }
    if (isInWrongBank) {
      return wrongBankIds
        .map((id) => questions.find((q) => q.id === id))
        .filter(Boolean) as Question[];
    }
    return questions;
  },

  addBank: async (name: string, markdown: string) => {
    const rawQuestions = parseMarkdownToQuestions(markdown);
    if (rawQuestions.length === 0) {
      get().showToast('题库为空，请检查格式');
      return false;
    }

    const questions = rawQuestions.map(initQuestionWithShuffled);

    const progressMap: Record<string, Progress> = {};
    questions.forEach((q) => {
      progressMap[q.id] = {
        questionId: q.id,
        selected: [],
        selectedOriginalIndexes: [],
        status: 'unanswered',
        locked: false,
      };
    });

    const newBank: Bank = {
      id: generateId(),
      name: name || `题库 ${get().banks.length + 1}`,
      questions,
      progressMap,
      wrongBankIds: [],
      favoritesIds: [],
      wrongBankRound: 0,
      wrongBankCompletedIds: [],
      shuffledVersion: 0,
      created: Date.now(),
    };

    const { banks } = get();
    const newBanks = [...banks, newBank];

    set({
      banks: newBanks,
      currentBankId: newBank.id,
      questions,
      progressMap,
      wrongBankIds: [],
      favoritesIds: [],
      wrongBankRound: 0,
      wrongBankCompletedIds: [],
      currentIndex: 0,
      currentMode: 'question',
      phase: 'answer',
      isInWrongBank: false,
      showSummary: false,
      showHome: false,
    });

    await persistBanksToFiles(newBanks, newBank.id);
    get().showToast(`导入成功，共 ${questions.length} 题`);
    return true;
  },

  importMarkdownFiles: async (files: { name: string; content: string }[]) => {
    const results: ImportFileResult[] = [];
    const newBanksToAdd: Bank[] = [];

    for (const file of files) {
      const bankName = file.name.replace(/\.md$/i, '').replace(/\.markdown$/i, '');
      const parseResult = parseMarkdownWithValidation(file.content);

      if (parseResult.questions.length === 0) {
        results.push({
          fileName: file.name,
          bankName,
          success: false,
          questionsCount: 0,
          errors: parseResult.errors,
          skippedErrors: parseResult.errors,
        });
        continue;
      }

      const { questions: rawQuestions } = parseResult;
      const questions = rawQuestions.map(initQuestionWithShuffled);
      const progressMap: Record<string, Progress> = {};
      questions.forEach((q) => {
        progressMap[q.id] = {
          questionId: q.id,
          selected: [],
          selectedOriginalIndexes: [],
          status: 'unanswered',
          locked: false,
        };
      });

      const bank: Bank = {
        id: generateId(),
        name: bankName,
        questions,
        progressMap,
        wrongBankIds: [],
        favoritesIds: [],
        wrongBankRound: 0,
        wrongBankCompletedIds: [],
        shuffledVersion: 0,
        created: Date.now(),
      };
      newBanksToAdd.push(bank);

      results.push({
        fileName: file.name,
        bankName,
        success: parseResult.errors.length === 0,
        questionsCount: questions.length,
        errors: parseResult.errors,
        skippedErrors: parseResult.errors.filter(e => e.message.includes('缺少') || e.message.includes('至少')),
      });
    }

    if (newBanksToAdd.length > 0) {
      const { banks, currentBankId } = get();
      const newBanks = [...banks, ...newBanksToAdd];

      set({
        banks: newBanks,
        currentBankId: newBanksToAdd[0].id,
        questions: newBanksToAdd[0].questions,
        progressMap: newBanksToAdd[0].progressMap,
        wrongBankIds: newBanksToAdd[0].wrongBankIds,
        favoritesIds: newBanksToAdd[0].favoritesIds,
        wrongBankRound: 0,
        wrongBankCompletedIds: [],
        currentIndex: 0,
        currentMode: 'question',
        phase: 'answer',
        isInWrongBank: false,
        showSummary: false,
        showHome: false,
      });

      const activeBankId = newBanksToAdd[0].id;
      await persistBanksToFiles(newBanks, activeBankId);
    }

    const successCount = results.filter(r => r.questionsCount > 0).length;
    const failCount = results.filter(r => r.questionsCount === 0).length;

    return {
      results,
      totalFiles: files.length,
      successCount,
      failCount,
    };
  },

  switchBank: async (bankId: string) => {
    const { banks } = get();
    const bank = banks.find((b) => b.id === bankId);
    if (!bank) return;

    set({
      currentBankId: bank.id,
      questions: bank.questions,
      progressMap: bank.progressMap,
      wrongBankIds: bank.wrongBankIds,
      favoritesIds: bank.favoritesIds,
      wrongBankRound: bank.wrongBankRound,
      wrongBankCompletedIds: bank.wrongBankCompletedIds,
      currentIndex: 0,
      currentMode: 'question',
      phase: 'answer',
      isInWrongBank: false,
      isInFavoritesBank: false,
      showSummary: false,
      showHome: false,
    });

    await persistBanksToFiles(banks, bank.id);
  },

  deleteBank: async (bankId: string) => {
    const { banks, currentBankId } = get();
    const bankToDelete = banks.find((b) => b.id === bankId);
    const newBanks = banks.filter((b) => b.id !== bankId);
    const wasCurrent = bankId === currentBankId;

    if (wasCurrent) {
      set({
        banks: newBanks,
        currentBankId: null,
        questions: [],
        progressMap: {},
        wrongBankIds: [],
        favoritesIds: [],
        wrongBankRound: 0,
        wrongBankCompletedIds: [],
        currentIndex: 0,
        currentMode: 'question',
        phase: 'answer',
        isInWrongBank: false,
        isInFavoritesBank: false,
        showSummary: false,
        showHome: true,
      });
    } else {
      set({ banks: newBanks });
    }

    if (bankToDelete) {
      await removeBankFiles(bankToDelete.id);
    }
    await persistBanksToFiles(newBanks, wasCurrent ? null : currentBankId);
    get().showToast('已删除题库');
  },

  renameBank: async (bankId: string, name: string) => {
    const { banks, currentBankId } = get();
    const newBanks = banks.map(bank => {
      if (bank.id === bankId) {
        return { ...bank, name };
      }
      return bank;
    });
    set({ banks: newBanks });
    await persistBanksToFiles(newBanks, currentBankId);
  },

  loadQuestionsFromMarkdown: async (markdown: string) => {
    await get().addBank(`题库 ${get().banks.length + 1}`, markdown);
  },

  loadFromCSV: async () => {
    set({ isLoading: true });

    if (isWeb()) {
      try {
        const { banks, currentBankId } = await loadBanksFromFiles();

        if (banks.length === 0) {
          set({ showHome: true, isLoading: false });
          return;
        }

        const activeBank = currentBankId
          ? banks.find((b) => b.id === currentBankId) || banks[0]
          : banks[0];

        set({
          banks,
          currentBankId: activeBank.id,
          questions: activeBank.questions,
          progressMap: activeBank.progressMap,
          wrongBankIds: activeBank.wrongBankIds,
          favoritesIds: activeBank.favoritesIds,
          wrongBankRound: activeBank.wrongBankRound,
          wrongBankCompletedIds: activeBank.wrongBankCompletedIds,
          currentIndex: 0,
          showHome: true,
          isInFavoritesBank: false,
          isLoading: false,
        });
        return;
      } catch (e) {
        console.warn('File load failed:', e);
      }
    }

    await ensureDataDir();
    const questionRows = await readCSV<QuestionCSVRow>('questions.csv');
    const questions: Question[] = questionRows.map((row) => {
      let options: { label: string; text: string; originalIndex: number }[];
      try {
        const parsed = JSON.parse(row.options);
        if (Array.isArray(parsed)) {
          options = parsed.map((opt, idx) => ({ ...opt, originalIndex: opt.originalIndex ?? idx }));
        } else {
          throw new Error('Not an array');
        }
      } catch {
        options = row.options.split('|').map((opt, idx) => {
          const parts = opt.split(':');
          let label: string;
          let text: string;
          let originalIndex: number;
          if (parts.length >= 3) {
            label = parts[0];
            originalIndex = parseInt(parts[parts.length - 1], 10);
            text = parts.slice(1, -1).join(':');
            if (isNaN(originalIndex)) {
              text = parts.slice(1).join(':');
              originalIndex = idx;
            }
          } else {
            const colonIdx = opt.indexOf(':');
            label = opt.substring(0, colonIdx);
            text = opt.substring(colonIdx + 1);
            originalIndex = idx;
          }
          return { label, text, originalIndex };
        });
      }
      const question: Question = {
        id: row.id,
        index: parseInt(row.index),
        title: row.title,
        content: row.content,
        options,
        answer: row.answer,
        explanation: row.explanation,
        type: row.type as 'single' | 'multi',
      };
      return initQuestionWithShuffled(question);
    });

    const progressRows = await readCSV<ProgressCSVRow>('progress.csv');
    const progressMap: Record<string, Progress> = {};
    progressRows.forEach((row) => {
      progressMap[row.questionId] = {
        questionId: row.questionId,
        selected: row.selected ? row.selected.split('|') : [],
        selectedOriginalIndexes: row.selectedOriginalIndexes ? row.selectedOriginalIndexes.split('|').map(Number) : [],
        status: row.status as AnswerStatus,
        locked: row.locked === 'true',
        answeredAt: row.answeredAt ? parseInt(row.answeredAt) : undefined,
        round: row.round ? parseInt(row.round) : undefined,
      };
    });

    const wrongRows = await readCSV<{ questionId: string }>('wrong_bank.csv');
    const wrongBankIds = wrongRows.map((r) => r.questionId);

    const favRows = await readCSV<{ questionId: string }>('favorites.csv');
    const favoritesIds = favRows.map((r) => r.questionId);

    const completedRows = await readCSV<{ questionId: string }>('wrong_bank_completed.csv');
    const wrongBankCompletedIds = completedRows.map((r) => r.questionId);

    const metaRows = await readCSV<MetadataCSVRow>('metadata.csv');
    const metaMap: Record<string, string> = {};
    metaRows.forEach((r) => {
      metaMap[r.key] = r.value;
    });

    const bank: Bank = {
      id: generateId(),
      name: '我的题库',
      questions,
      progressMap,
      wrongBankIds,
      favoritesIds,
      wrongBankRound: 0,
      wrongBankCompletedIds,
      shuffledVersion: 0,
      created: Date.now(),
    };

    set({
      banks: [bank],
      currentBankId: bank.id,
      questions,
      progressMap,
      wrongBankIds,
      favoritesIds,
      wrongBankRound: 0,
      wrongBankCompletedIds,
      currentIndex: parseInt(metaMap.currentIndex || '0'),
      isInWrongBank: metaMap.isInWrongBank === 'true',
      isInFavoritesBank: metaMap.isInFavoritesBank === 'true',
      showHome: true,
      isLoading: false,
    });
  },

  saveToCSV: async () => {
    serializeSave();
  },

  selectOption: (questionId: string, label: string) => {
    const { progressMap, questions, isInWrongBank, wrongBankRound } = get();
    const question = questions.find((q) => q.id === questionId);
    const progress = progressMap[questionId];
    if (!question || !progress) return;

    if (progress.locked) {
      return;
    }

    if (isInWrongBank) {
      if (progress.round !== wrongBankRound) {
        return;
      }
      if (progress.status === 'locked') {
        return;
      }
    }

    let newSelected: string[];
    let newSelectedOriginalIndexes: number[];

    const displayOptions = question.shuffledOptions || question.options;
    const clickedOption = displayOptions.find((o) => o.label === label);
    const originalIndex = clickedOption ? clickedOption.originalIndex : -1;

    if (question.type === 'single') {
      if (progress.selected.includes(label)) {
        newSelected = [];
        newSelectedOriginalIndexes = [];
      } else {
        newSelected = [label];
        newSelectedOriginalIndexes = originalIndex >= 0 ? [originalIndex] : [];
      }
    } else {
      if (progress.selected.includes(label)) {
        newSelected = progress.selected.filter((s) => s !== label);
        newSelectedOriginalIndexes = progress.selectedOriginalIndexes.filter((idx) => idx !== originalIndex);
      } else {
        newSelected = [...progress.selected, label].sort();
        newSelectedOriginalIndexes = [...progress.selectedOriginalIndexes, originalIndex].filter((idx) => idx >= 0).sort((a, b) => a - b);
      }
    }

    const newProgress = { ...progress, selected: newSelected, selectedOriginalIndexes: newSelectedOriginalIndexes };
    set({
      progressMap: {
        ...progressMap,
        [questionId]: newProgress,
      },
    });

    if (question.type === 'single' && newSelected.length > 0) {
      get().submitAnswer(questionId);
    }

    serializeSave();
  },

  markDontKnow: (questionId: string) => {
    const { progressMap, questions, wrongBankIds, isInWrongBank, wrongBankRound } = get();
    const question = questions.find((q) => q.id === questionId);
    const progress = progressMap[questionId];
    if (!question || !progress) return;
    
    if (progress.locked) return;
    
    if (isInWrongBank) {
      if (progress.round !== wrongBankRound) return;
      if (progress.status === 'locked') return;
    }

    const newProgress = {
      ...progress,
      status: 'wrong' as AnswerStatus,
      locked: true,
      selectedOriginalIndexes: [],
      answeredAt: Date.now(),
      round: isInWrongBank ? wrongBankRound : undefined,
    };

    let newWrongBankIds = [...wrongBankIds];
    if (!newWrongBankIds.includes(questionId)) {
      newWrongBankIds.push(questionId);
    }

    set({
      progressMap: {
        ...progressMap,
        [questionId]: newProgress,
      },
      wrongBankIds: newWrongBankIds,
      phase: 'feedback',
    });

    get().showToast('已标记为不会，加入错题本');
    setTimeout(() => {
      const currentPhase = get().phase;
      if (currentPhase !== 'feedback') return;
      set({ phase: 'explanation' });
    }, 1000);
    serializeSave();
  },

  submitAnswer: (questionId: string) => {
    const { progressMap, questions, wrongBankIds, wrongBankCompletedIds, wrongBankRound } = get();
    const question = questions.find((q) => q.id === questionId);
    const progress = progressMap[questionId];
    if (!question || !progress) return;
    
    if (progress.locked) return;
    if (progress.selected.length === 0) {
      get().showToast('请选择一个选项');
      return;
    }

    const isInWrongBank = get().isInWrongBank;
    if (isInWrongBank) {
      if (progress.round !== undefined && progress.round !== wrongBankRound) {
        return;
      }
      if (progress.status === 'locked') return;
    }

    const correctIndexes = question.answer.split('').map((c) => c.charCodeAt(0) - 65);
    const selectedIndexes = progress.selectedOriginalIndexes.length > 0
      ? progress.selectedOriginalIndexes
      : mapSelectionToOriginal(progress.selected, question);

    const displayAnswer = getDisplayAnswer(question);
    const correctLabels = displayAnswer.split('');
    const selectedLabels = progress.selected;

    let status: AnswerStatus;
    if (selectedLabels.length === 0) {
      status = 'unanswered';
    } else if (question.type === 'single') {
      status = selectedLabels[0] === correctLabels[0] ? 'correct' : 'wrong';
    } else {
      const correctSet = new Set(correctLabels);
      const hasWrong = selectedLabels.some((s) => !correctSet.has(s));
      const isSubset = selectedLabels.every((s) => correctSet.has(s));
      const isEqual = selectedLabels.length === correctLabels.length && isSubset;
      if (isEqual) status = 'correct';
      else if (hasWrong) status = 'wrong';
      else if (isSubset && selectedLabels.length < correctLabels.length) status = 'partial';
      else status = 'wrong';
    }

    const newProgress: Progress = {
      ...progress,
      status,
      locked: true,
      answeredAt: Date.now(),
      round: isInWrongBank ? wrongBankRound : undefined,
    };

    let newWrongBankIds = [...wrongBankIds];
    let newCompletedIds = [...wrongBankCompletedIds];
    
    if (isInWrongBank) {
      if (status === 'correct') {
        newWrongBankIds = newWrongBankIds.filter((id) => id !== questionId);
        newCompletedIds.push(questionId);
        set({
          progressMap: {
            ...progressMap,
            [questionId]: newProgress,
          },
          wrongBankIds: newWrongBankIds,
          wrongBankCompletedIds: newCompletedIds,
          phase: 'feedback',
        });

        setTimeout(() => {
          const currentPhase = get().phase;
          if (currentPhase !== 'feedback') return;
          get().advanceToNextQuestion();
        }, 1000);

        serializeSave();
        return;
      } else {
        newProgress.status = 'locked';
        set({
          progressMap: {
            ...progressMap,
            [questionId]: newProgress,
          },
          phase: 'feedback',
        });

        setTimeout(() => {
          const currentPhase = get().phase;
          if (currentPhase !== 'feedback') return;
          set({ phase: 'explanation' });
          get().checkWrongBankRoundComplete();
        }, 1000);

        serializeSave();
        return;
      }
    }

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
      phase: 'feedback',
    });

    setTimeout(() => {
      const currentPhase = get().phase;
      if (currentPhase !== 'feedback') return;
      if (status === 'correct') {
        get().advanceToNextQuestion();
      } else {
        set({ phase: 'explanation' });
      }
    }, 1000);
    serializeSave();
  },

  checkWrongBankRoundComplete: () => {
    const { wrongBankIds, progressMap, wrongBankRound } = get();
    
    const allAnsweredInRound = wrongBankIds.every((id) => {
      const p = progressMap[id];
      return p && p.round === wrongBankRound && p.status === 'locked';
    });

    if (allAnsweredInRound && wrongBankIds.length > 0) {
      get().resetWrongBankLocked();
    }
  },

  resetWrongBankLocked: () => {
    const { wrongBankIds, progressMap, wrongBankRound } = get();
    const nextRound = wrongBankRound + 1;
    const newProgressMap = { ...progressMap };

    wrongBankIds.forEach((id) => {
      const p = newProgressMap[id];
      if (p && p.status === 'locked') {
        newProgressMap[id] = {
          ...p,
          status: 'unanswered',
          locked: false,
          selected: [],
          selectedOriginalIndexes: [],
          round: nextRound,
        };
      }
    });

    set({
      progressMap: newProgressMap,
      wrongBankRound: nextRound,
    });
    
    get().showToast('新一轮错题挑战开始！');
    serializeSave();
  },

  shuffleQuestionsInBank: () => {
    const { questions, currentBankId, banks } = get();
    const shuffledQuestions = shuffleAllQuestions(questions);
    const shuffledVersion = (banks.find((b) => b.id === currentBankId)?.shuffledVersion ?? 0) + 1;

    const updatedBanks = banks.map((b) => {
      if (b.id === currentBankId) {
        return { ...b, questions: shuffledQuestions, shuffledVersion };
      }
      return b;
    });

    set({
      banks: updatedBanks,
      questions: shuffledQuestions,
    });
    serializeSave();
  },

  getWrongBankBranches: () => {
    const { banks } = get();
    const map = new Map<string, string[]>();
    banks.forEach((bank) => {
      bank.wrongBankIds.forEach((qid) => {
        if (!map.has(bank.id)) map.set(bank.id, []);
        map.get(bank.id)!.push(qid);
      });
    });
    return Array.from(map.entries())
      .filter(([_, ids]) => ids.length > 0)
      .map(([bankId, questionIds]) => {
        const bank = banks.find((b) => b.id === bankId);
        return { bankId, bankName: bank?.name || '未知题库', questionIds };
      });
  },

  getFavoriteBranches: () => {
    const { banks } = get();
    const map = new Map<string, string[]>();
    banks.forEach((bank) => {
      bank.favoritesIds.forEach((qid) => {
        if (!map.has(bank.id)) map.set(bank.id, []);
        map.get(bank.id)!.push(qid);
      });
    });
    return Array.from(map.entries())
      .filter(([_, ids]) => ids.length > 0)
      .map(([bankId, questionIds]) => {
        const bank = banks.find((b) => b.id === bankId);
        return { bankId, bankName: bank?.name || '未知题库', questionIds };
      });
  },

  enterWrongBankBranch: (bankId: string) => {
    const { banks } = get();
    const bank = banks.find((b) => b.id === bankId);
    if (!bank || bank.wrongBankIds.length === 0) return;

    const newProgressMap = { ...bank.progressMap };
    const nextRound = bank.wrongBankRound + 1;
    bank.wrongBankIds.forEach((qid) => {
      newProgressMap[qid] = {
        ...newProgressMap[qid],
        status: 'unanswered',
        locked: false,
        selected: [],
        selectedOriginalIndexes: [],
        round: nextRound,
      };
    });

    const shuffledQuestions = bank.questions.map(shuffleQuestionOptions);
    const newQuestions = bank.questions.map((q) => {
      const sq = shuffledQuestions.find((sq) => sq.id === q.id);
      return sq || q;
    });

    const updatedBanks = banks.map((b) => {
      if (b.id === bankId) {
        return {
          ...b,
          questions: newQuestions,
          progressMap: newProgressMap,
          wrongBankRound: nextRound,
        };
      }
      return b;
    });

    set({
      banks: updatedBanks,
      currentBankId: bank.id,
      questions: newQuestions,
      progressMap: newProgressMap,
      wrongBankIds: bank.wrongBankIds,
      favoritesIds: bank.favoritesIds,
      wrongBankRound: nextRound,
      wrongBankCompletedIds: bank.wrongBankCompletedIds,
      isInWrongBank: true,
      isInFavoritesBank: false,
      currentIndex: 0,
      currentMode: 'question',
      phase: 'answer',
      showHome: false,
    });
    serializeSave();
  },

  enterFavoriteBranch: (bankId: string) => {
    const { banks } = get();
    const bank = banks.find((b) => b.id === bankId);
    if (!bank || bank.favoritesIds.length === 0) return;

    const newProgressMap = { ...bank.progressMap };
    bank.favoritesIds.forEach((qid) => {
      newProgressMap[qid] = {
        ...newProgressMap[qid],
        status: 'unanswered',
        locked: false,
        selected: [],
        selectedOriginalIndexes: [],
      };
    });

    const shuffledQuestions = bank.questions.map(shuffleQuestionOptions);
    const newQuestions = bank.questions.map((q) => {
      const sq = shuffledQuestions.find((sq) => sq.id === q.id);
      return sq || q;
    });

    const updatedBanks = banks.map((b) => {
      if (b.id === bankId) {
        return {
          ...b,
          questions: newQuestions,
          progressMap: newProgressMap,
        };
      }
      return b;
    });

    set({
      banks: updatedBanks,
      currentBankId: bank.id,
      questions: newQuestions,
      progressMap: newProgressMap,
      wrongBankIds: bank.wrongBankIds,
      favoritesIds: bank.favoritesIds,
      wrongBankRound: bank.wrongBankRound,
      wrongBankCompletedIds: bank.wrongBankCompletedIds,
      isInWrongBank: false,
      isInFavoritesBank: true,
      currentIndex: 0,
      currentMode: 'question',
      phase: 'answer',
      showHome: false,
    });
    serializeSave();
  },

  clearWrongBranchProgress: (bankId: string) => {
    const { banks } = get();
    const bank = banks.find((b) => b.id === bankId);
    if (!bank) return;

    const newProgressMap = { ...bank.progressMap };
    bank.wrongBankIds.forEach((qid) => {
      newProgressMap[qid] = {
        ...newProgressMap[qid],
        status: 'unanswered',
        locked: false,
        selected: [],
        selectedOriginalIndexes: [],
        round: undefined,
      };
    });

    const updatedBanks = banks.map((b) => {
      if (b.id === bankId) {
        return { ...b, progressMap: newProgressMap };
      }
      return b;
    });

    set({ banks: updatedBanks });

    if (get().currentBankId === bankId) {
      set({ progressMap: newProgressMap });
    }

    get().showToast(`已清空「${bank.name}」的错题进度`);
    serializeSave();
  },

  clearFavoriteBranchProgress: (bankId: string) => {
    const { banks } = get();
    const bank = banks.find((b) => b.id === bankId);
    if (!bank) return;

    const newProgressMap = { ...bank.progressMap };
    bank.favoritesIds.forEach((qid) => {
      newProgressMap[qid] = {
        ...newProgressMap[qid],
        status: 'unanswered',
        locked: false,
        selected: [],
        selectedOriginalIndexes: [],
      };
    });

    const updatedBanks = banks.map((b) => {
      if (b.id === bankId) {
        return { ...b, progressMap: newProgressMap };
      }
      return b;
    });

    set({ banks: updatedBanks });

    if (get().currentBankId === bankId) {
      set({ progressMap: newProgressMap });
    }

    get().showToast(`已清空「${bank.name}」的收藏进度`);
    serializeSave();
  },

  exportWrongBranch: (bankId: string) => {
    const { banks } = get();
    const bank = banks.find((b) => b.id === bankId);
    if (!bank) return;

    if (bank.wrongBankIds.length === 0) {
      get().showToast('该题库没有错题');
      return;
    }

    const wrongQuestions = bank.questions.filter((q) =>
      bank.wrongBankIds.includes(q.id)
    );
    exportBothFiles(`${bank.name}_错题`, wrongQuestions);
    get().showToast(`已导出「${bank.name}」的 ${bank.wrongBankIds.length} 道错题`);
  },

  exportWrongAll: () => {
    const { banks } = get();

    const allWrongQuestions: Question[] = [];
    banks.forEach((bank) => {
      bank.wrongBankIds.forEach((qid) => {
        const q = bank.questions.find((q) => q.id === qid);
        if (q) {
          allWrongQuestions.push(q);
        }
      });
    });

    if (allWrongQuestions.length === 0) {
      get().showToast('没有错题可导出');
      return;
    }

    exportBothFiles('全部错题', allWrongQuestions);
    get().showToast(`已导出全部 ${allWrongQuestions.length} 道错题`);
  },

  exportFavoriteBranch: (bankId: string) => {
    const { banks } = get();
    const bank = banks.find((b) => b.id === bankId);
    if (!bank) return;

    if (bank.favoritesIds.length === 0) {
      get().showToast('该题库没有收藏题目');
      return;
    }

    const favQuestions = bank.questions.filter((q) =>
      bank.favoritesIds.includes(q.id)
    );
    exportBothFiles(`${bank.name}_收藏`, favQuestions);
    get().showToast(`已导出「${bank.name}」的 ${bank.favoritesIds.length} 道收藏题目`);
  },

  exportFavoriteAll: () => {
    const { banks } = get();

    const allFavQuestions: Question[] = [];
    banks.forEach((bank) => {
      bank.favoritesIds.forEach((qid) => {
        const q = bank.questions.find((q) => q.id === qid);
        if (q) {
          allFavQuestions.push(q);
        }
      });
    });

    if (allFavQuestions.length === 0) {
      get().showToast('没有收藏题目可导出');
      return;
    }

    exportBothFiles('全部收藏', allFavQuestions);
    get().showToast(`已导出全部 ${allFavQuestions.length} 道收藏题目`);
  },

  advanceToNextQuestion: () => {
    const { currentIndex } = get();
    const list = get().getCurrentQuestions();
    if (currentIndex < list.length - 1) {
      set({ currentIndex: currentIndex + 1, currentMode: 'question', phase: 'answer' });
      serializeSave();
    } else {
      const allAnswered = list.every(
        (q) => get().progressMap[q.id]?.status !== 'unanswered'
      );

      if (allAnswered) {
        set({ showSummary: true });
      } else {
        get().showToast('还有题目未完成');
      }
    }
  },

  goToQuestion: (index: number) => {
    const list = get().getCurrentQuestions();
    if (index >= 0 && index < list.length) {
      set({
        currentIndex: index,
        currentMode: 'question',
        phase: 'answer',
        isProgressBoardExpanded: false,
      });
      serializeSave();
    }
  },

  toggleFavorite: (questionId: string) => {
    const { favoritesIds } = get();
    const newFavorites = favoritesIds.includes(questionId)
      ? favoritesIds.filter((id) => id !== questionId)
      : [...favoritesIds, questionId];
    set({ favoritesIds: newFavorites });
    serializeSave();
  },

  toggleProgressBoard: () => {
    const { isProgressBoardExpanded } = get();
    set({ isProgressBoardExpanded: !isProgressBoardExpanded });
  },

  enterWrongBank: () => {
    const { wrongBankIds, progressMap, wrongBankRound, questions, currentBankId, banks } = get();
    if (wrongBankIds.length === 0) {
      get().showToast('🎉 错题库已清空！');
      return;
    }

    const newProgressMap = { ...progressMap };

    const allCompletedThisRound = wrongBankIds.every((id) => {
      const p = newProgressMap[id];
      return p && p.round === wrongBankRound && p.status !== 'unanswered';
    });

    let roundToUse = wrongBankRound;

    if (allCompletedThisRound) {
      roundToUse = wrongBankRound + 1;
      set({ wrongBankRound: roundToUse });
      get().showToast('新一轮错题挑战开始！');
    }

    wrongBankIds.forEach((id) => {
      const p = newProgressMap[id];
      if (p) {
        newProgressMap[id] = {
          ...p,
          status: 'unanswered',
          locked: false,
          selected: [],
          selectedOriginalIndexes: [],
          round: roundToUse,
        };
      }
    });

    const wrongQuestions = questions.filter((q) => wrongBankIds.includes(q.id));
    const shuffledQuestions = wrongQuestions.map(shuffleQuestionOptions);
    const shuffledVersion = (banks.find((b) => b.id === currentBankId)?.shuffledVersion ?? 0) + 1;

    const newQuestions = questions.map((q) => {
      const sq = shuffledQuestions.find((sq) => sq.id === q.id);
      return sq || q;
    });

    const updatedBanks = banks.map((b) => {
      if (b.id === currentBankId) {
        return { ...b, questions: newQuestions, shuffledVersion };
      }
      return b;
    });

    set({
      banks: updatedBanks,
      questions: newQuestions,
      progressMap: newProgressMap,
      isInWrongBank: true,
      isInFavoritesBank: false,
      currentIndex: 0,
      currentMode: 'question',
      phase: 'answer',
    });
    serializeSave();
  },

  exitWrongBank: () => {
    set({ isInWrongBank: false, currentIndex: 0, currentMode: 'question', phase: 'answer' });
    serializeSave();
  },

  enterFavoritesBank: () => {
    const { favoritesIds, questions, currentBankId, banks, progressMap } = get();
    if (favoritesIds.length === 0) {
      get().showToast('还没有收藏的题目');
      return;
    }

    const newProgressMap = { ...progressMap };
    favoritesIds.forEach((id) => {
      const p = newProgressMap[id];
      if (p) {
        newProgressMap[id] = {
          ...p,
          status: 'unanswered',
          locked: false,
          selected: [],
          selectedOriginalIndexes: [],
        };
      }
    });

    const favQuestions = questions.filter((q) => favoritesIds.includes(q.id));
    const shuffledQuestions = favQuestions.map(shuffleQuestionOptions);
    const shuffledVersion = (banks.find((b) => b.id === currentBankId)?.shuffledVersion ?? 0) + 1;

    const newQuestions = questions.map((q) => {
      const sq = shuffledQuestions.find((sq) => sq.id === q.id);
      return sq || q;
    });

    const updatedBanks = banks.map((b) => {
      if (b.id === currentBankId) {
        return { ...b, questions: newQuestions, shuffledVersion };
      }
      return b;
    });

    set({
      banks: updatedBanks,
      questions: newQuestions,
      progressMap: newProgressMap,
      isInFavoritesBank: true,
      isInWrongBank: false,
      currentIndex: 0,
      currentMode: 'question',
      phase: 'answer',
    });
    serializeSave();
  },

  exitFavoritesBank: () => {
    set({ isInFavoritesBank: false, currentIndex: 0, currentMode: 'question', phase: 'answer' });
    serializeSave();
  },

  clearAllFavorites: () => {
    set({ favoritesIds: [] });
    if (get().isInFavoritesBank) {
      set({ isInFavoritesBank: false, currentIndex: 0, currentMode: 'question', phase: 'answer' });
    }
    serializeSave();
    get().showToast('已清空所有收藏');
  },

  resetAll: () => {
    const { questions, currentBankId, banks } = get();
    const progressMap: Record<string, Progress> = {};
    questions.forEach((q) => {
      progressMap[q.id] = {
        questionId: q.id,
        selected: [],
        selectedOriginalIndexes: [],
        status: 'unanswered',
        locked: false,
      };
    });

    const shuffledQuestions = shuffleAllQuestions(questions);
    const shuffledVersion = (banks.find((b) => b.id === currentBankId)?.shuffledVersion ?? 0) + 1;

    const updatedBanks = banks.map((b) => {
      if (b.id === currentBankId) {
        return { ...b, questions: shuffledQuestions, shuffledVersion };
      }
      return b;
    });

    set({
      banks: updatedBanks,
      questions: shuffledQuestions,
      progressMap,
      wrongBankIds: [],
      favoritesIds: [],
      wrongBankRound: 0,
      wrongBankCompletedIds: [],
      currentIndex: 0,
      currentMode: 'question',
      phase: 'answer',
      isInWrongBank: false,
      isInFavoritesBank: false,
      showSummary: false,
      showHome: false,
    });
    serializeSave();
  },

  goHome: () => {
    set({ showHome: true, showSummary: false, phase: 'answer' });
    serializeSave();
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

  exportAllData: async () => {
    const state = get();
    const { banks } = state;
    if (banks.length === 0) {
      state.showToast('没有可导出的题库');
      return;
    }

    // 先保存所有数据到文件系统
    for (const bank of banks) {
      const questionRows: QuestionCSVRow[] = bank.questions.map((q) => ({
        id: q.id,
        index: String(q.index),
        title: q.title,
        content: q.content,
        options: JSON.stringify(q.options),
        answer: q.answer,
        explanation: q.explanation,
        type: q.type,
      }));
      await writeCSV(`bank_${bank.id}_questions.csv`, questionRows);

      const progressRows: ProgressCSVRow[] = Object.values(bank.progressMap).map((p) => ({
        questionId: p.questionId,
        selected: p.selected.join('|'),
        selectedOriginalIndexes: p.selectedOriginalIndexes ? p.selectedOriginalIndexes.join('|') : '',
        status: p.status,
        answeredAt: p.answeredAt ? String(p.answeredAt) : '',
        locked: String(p.locked),
        round: p.round ? String(p.round) : '',
      }));
      await writeCSV(`bank_${bank.id}_progress.csv`, progressRows);

      await writeCSV(`bank_${bank.id}_wrong.csv`, bank.wrongBankIds.map((id) => ({ questionId: id })));
      await writeCSV(`bank_${bank.id}_favorites.csv`, bank.favoritesIds.map((id) => ({ questionId: id })));
      await writeCSV(`bank_${bank.id}_completed.csv`, bank.wrongBankCompletedIds.map((id) => ({ questionId: id })));
    }

    const indexRows: BankIndexRow[] = banks.map((b) => ({
      id: b.id,
      name: b.name,
      created: String(b.created),
    }));
    await writeCSV('banks_index.csv', indexRows);

    // 读取所有文件并打包为ZIP
    try {
      const allFiles = await listAllFiles();
      const zipEntries: { name: string; content: string }[] = [];
      
      for (const filename of allFiles) {
        if (filename.startsWith('.') || filename === 'export_readme.txt') continue;
        const content = await readFile(filename);
        if (content !== null) {
          zipEntries.push({ name: filename, content });
        }
      }
      
      // 添加一个说明文件
      const readmeContent = `题库刷题软件 - 数据备份
导出时间: ${new Date().toLocaleString()}
包含题库: ${banks.length} 个

文件说明:
- banks_index.csv: 题库索引
- bank_*_questions.csv: 题目数据
- bank_*_progress.csv: 答题进度
- bank_*_wrong.csv: 错题本
- bank_*_favorites.csv: 收藏
- bank_*_completed.csv: 错题重做完成记录

使用方法:
1. 将此压缩包解压
2. 在另一台设备上打开软件
3. 点击"导入数据"按钮
4. 选择解压后的文件夹中的文件
`;
      zipEntries.push({ name: 'export_readme.txt', content: readmeContent });
      
      // 创建ZIP并下载
      const blob = await createZipFromFiles(zipEntries);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      await downloadZipBlob(blob, `题库数据备份_${timestamp}.zip`);
      
      state.showToast('已导出ZIP压缩包');
    } catch (e) {
      console.error('导出失败:', e);
      state.showToast('导出失败，请重试');
    }
  },

  importAllData: async (file: File) => {
    try {
      const fileName = file.name.toLowerCase();

      // 支持导入ZIP压缩包（包含所有数据的完整备份）
      if (fileName.endsWith('.zip')) {
        try {
          // 读取ZIP文件为Blob
          const arrayBuffer = await file.arrayBuffer();
          const zipBlob = new Blob([arrayBuffer]);
          
          // 解压ZIP文件
          const files = await extractZipFiles(zipBlob);
          
          // 将解压的文件写入存储目录
          let fileCount = 0;
          for (const [name, content] of files.entries()) {
            // 跳过说明文件
            if (name === 'export_readme.txt') continue;
            // 确保只处理数据文件
            if (name.endsWith('.csv') || name.endsWith('.md')) {
              await writeFile(name, content);
              fileCount++;
            }
          }
          
          if (fileCount === 0) {
            get().showToast('ZIP文件中未找到有效数据');
            return false;
          }
          
          // 重新加载数据
          const { banks, currentBankId } = await loadBanksFromFiles();
          
          if (banks.length === 0) {
            get().showToast('ZIP文件中未找到有效题库');
            return false;
          }

          const activeBankId = currentBankId || banks[0].id;
          const activeBank = banks.find(b => b.id === activeBankId) || banks[0];

          set({
            banks,
            currentBankId: activeBankId,
            questions: activeBank.questions,
            progressMap: activeBank.progressMap,
            wrongBankIds: activeBank.wrongBankIds,
            favoritesIds: activeBank.favoritesIds,
            wrongBankRound: 0,
            wrongBankCompletedIds: activeBank.wrongBankCompletedIds,
            currentIndex: 0,
            currentMode: 'question',
            phase: 'answer',
            isInWrongBank: false,
            isInFavoritesBank: false,
            showHome: true,
          });
          get().showToast(`成功导入ZIP备份，共 ${banks.length} 个题库`);
          return true;
        } catch (e) {
          console.error('ZIP解压失败:', e);
          get().showToast('ZIP文件解压失败');
          return false;
        }
      }

      // 读取文本内容
      const content = await readUploadedFile(file);

      if (fileName.endsWith('.csv')) {
        const rows = parseCSV<BankIndexRow>(content);
        if (rows.length === 0) {
          get().showToast('CSV文件为空或格式错误');
          return false;
        }

        const banks: Bank[] = [];
        for (const row of rows) {
          const questions = await readCSV<QuestionCSVRow>(`bank_${row.id}_questions.csv`);
          const progressRows = await readCSV<ProgressCSVRow>(`bank_${row.id}_progress.csv`);
          const wrongRows = await readCSV<{ questionId: string }>(`bank_${row.id}_wrong.csv`);
          const favRows = await readCSV<{ questionId: string }>(`bank_${row.id}_favorites.csv`);
          const completedRows = await readCSV<{ questionId: string }>(`bank_${row.id}_completed.csv`);

          const parsedQuestions: Question[] = questions.map((q) => {
            let options: { label: string; text: string; originalIndex: number }[];
            try {
              const parsed = JSON.parse(q.options);
              if (Array.isArray(parsed)) {
                options = parsed.map((opt, idx) => ({ ...opt, originalIndex: opt.originalIndex ?? idx }));
              } else {
                throw new Error('Not an array');
              }
            } catch {
              options = q.options.split('|').map((opt, idx) => {
                const parts = opt.split(':');
                let label: string;
                let text: string;
                let originalIndex: number;
                if (parts.length >= 3) {
                  label = parts[0];
                  originalIndex = parseInt(parts[parts.length - 1], 10);
                  text = parts.slice(1, -1).join(':');
                  if (isNaN(originalIndex)) {
                    text = parts.slice(1).join(':');
                    originalIndex = idx;
                  }
                } else {
                  const colonIdx = opt.indexOf(':');
                  label = opt.substring(0, colonIdx);
                  text = opt.substring(colonIdx + 1);
                  originalIndex = idx;
                }
                return { label, text, originalIndex };
              });
            }
            const question: Question = {
              id: q.id,
              index: parseInt(q.index) || 0,
              title: q.title,
              content: q.content,
              options,
              answer: q.answer,
              explanation: q.explanation,
              type: q.type as 'single' | 'multi',
            };
            return initQuestionWithShuffled(question);
          });

          const progressMap: Record<string, Progress> = {};
          progressRows.forEach((p) => {
            progressMap[p.questionId] = {
              questionId: p.questionId,
              selected: p.selected ? p.selected.split('|') : [],
              selectedOriginalIndexes: p.selectedOriginalIndexes ? p.selectedOriginalIndexes.split('|').map(Number) : [],
              status: p.status as AnswerStatus,
              locked: p.locked === 'true',
              answeredAt: p.answeredAt ? parseInt(p.answeredAt) : undefined,
              round: p.round ? parseInt(p.round) : undefined,
            };
          });

          const bank: Bank = {
            id: row.id,
            name: row.name,
            questions: parsedQuestions,
            progressMap,
            wrongBankIds: wrongRows.map((r) => r.questionId),
            favoritesIds: favRows.map((r) => r.questionId),
            wrongBankRound: 0,
            wrongBankCompletedIds: completedRows.map((r) => r.questionId),
            shuffledVersion: 0,
            created: parseInt(row.created) || Date.now(),
          };
          banks.push(bank);
        }

        if (banks.length === 0) {
          get().showToast('未找到有效题库数据');
          return false;
        }

        const activeBankId = banks[0].id;
        const activeBank = banks[0];

        set({
          banks,
          currentBankId: activeBankId,
          questions: activeBank.questions,
          progressMap: activeBank.progressMap,
          wrongBankIds: activeBank.wrongBankIds,
          favoritesIds: activeBank.favoritesIds,
          wrongBankRound: 0,
          wrongBankCompletedIds: activeBank.wrongBankCompletedIds,
          currentIndex: 0,
          currentMode: 'question',
          phase: 'answer',
          isInWrongBank: false,
          isInFavoritesBank: false,
          showHome: true,
        });
        get().showToast(`成功导入 ${banks.length} 个题库`);
        return true;
      }

      if (fileName.endsWith('.md') || fileName.endsWith('.markdown')) {
        const parseResult = parseMarkdownWithValidation(content);
        if (parseResult.questions.length === 0) {
          get().showToast('Markdown文件解析失败，请检查格式');
          return false;
        }

        const questions = parseResult.questions.map(initQuestionWithShuffled);
        const progressMap: Record<string, Progress> = {};
        questions.forEach((q) => {
          progressMap[q.id] = {
            questionId: q.id,
            selected: [],
            selectedOriginalIndexes: [],
            status: 'unanswered',
            locked: false,
          };
        });

        const bankName = file.name.replace(/\.md$/i, '').replace(/\.markdown$/i, '');
        const newBank: Bank = {
          id: generateId(),
          name: bankName,
          questions,
          progressMap,
          wrongBankIds: [],
          favoritesIds: [],
          wrongBankRound: 0,
          wrongBankCompletedIds: [],
          shuffledVersion: 0,
          created: Date.now(),
        };

        const { banks } = get();
        const newBanks = [...banks, newBank];
        set({
          banks: newBanks,
          currentBankId: newBank.id,
          questions,
          progressMap,
          wrongBankIds: [],
          favoritesIds: [],
          wrongBankRound: 0,
          wrongBankCompletedIds: [],
          currentIndex: 0,
          currentMode: 'question',
          phase: 'answer',
          isInWrongBank: false,
          isInFavoritesBank: false,
          showSummary: false,
          showHome: false,
        });
        await persistBanksToFiles(newBanks, newBank.id);
        get().showToast(`导入成功，共 ${parseResult.questions.length} 题`);
        return true;
      }

      get().showToast('请选择 .zip、.csv 或 .md 文件');
      return false;
    } catch (e) {
      console.warn('Import failed:', e);
      get().showToast('导入失败，请检查文件格式');
      return false;
    }
  },
}));

if (typeof window !== 'undefined') {
  Object.defineProperty(window, '__quizStore', {
    get: () => useAppStore,
    configurable: true,
  });
}
