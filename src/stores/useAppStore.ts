import { create } from 'zustand';
import {
  readCSV,
  writeCSV,
  exportCSV,
  exportMarkdown,
  stringifyCSV,
  parseCSV as parseCSVUtil,
} from '../utils/csvStorage';
import {
  writeFile,
  readFile,
  removeFile,
  removeBankFiles,
  getDataPath,
  setDataPath,
  selectWebDirectory,
  isFileSystemAccessSupported,
  readUploadedFile,
  downloadFile,
  ensureDataDir,
  listAllFiles,
  SUB_DIRS,
  type SubDirName,
} from '../utils/fileStorage';
import {
  createZipFromFiles,
  downloadZipBlob,
  extractZipFiles,
} from '../utils/zipUtils';
import { parseMarkdownWithValidation, parseMarkdownToQuestions, type ParseError } from '../utils/markdownParser';
import { shuffleQuestionOptions, shuffleAllQuestions, shuffleArray, checkAnswerByContent, getDisplayAnswerLabels, getUserSelectedLabels } from '../utils/shuffleUtils';
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
  FavoriteCSVRow,
  WrongCSVRow,
  BankIndexRow,
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

function sanitizeFileName(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '_');
}

function questionToCSVRow(q: Question, progress?: Progress): QuestionCSVRow {
  const opt = q.options;
  const status = progress?.status || 'unanswered';
  const answered = progress && progress.status !== 'unanswered' ? 'true' : 'false';
  const round = progress?.round ?? 0;
  const selectedContents = progress?.selectedContents || [];

  return {
    index: String(q.index),
    题干: q.content,
    选项A: opt[0]?.text || '',
    选项B: opt[1]?.text || '',
    选项C: opt[2]?.text || '',
    选项D: opt[3]?.text || '',
    选项E: opt[4]?.text || '',
    选项F: opt[5]?.text || '',
    正确答案内容: q.answerContent,
    答案解析: q.explanation,
    题型: q.type,
    是否已答: answered,
    答题状态: status,
    轮次: String(round),
    已选内容: selectedContents.join('|||'),
  };
}

function csvRowToQuestion(row: QuestionCSVRow, id: string): Question {
  const options = [row.选项A, row.选项B, row.选项C, row.选项D, row.选项E, row.选项F]
    .filter(o => o && o.trim())
    .map((text, idx) => ({
      label: String.fromCharCode(65 + idx),
      text: text.trim(),
    }));

  const answerContent = row.正确答案内容 || '';
  const answerLabels = answerContent
    .split('|||')
    .filter(Boolean)
    .map((content) => {
      const opt = options.find(o => o.text === content.trim());
      return opt ? opt.label : '';
    })
    .filter(Boolean)
    .join('');

  return {
    id,
    index: parseInt(row.index) || 0,
    title: '',
    content: row.题干,
    options,
    answer: answerLabels,
    answerContent,
    explanation: row.答案解析 || '暂无解析',
    type: (row.题型 as 'single' | 'multi') || 'single',
  };
}

function initQuestionWithShuffled(q: Question): Question {
  const shuffled = shuffleArray(q.options);
  const relabeled = shuffled.map((opt, newIdx) => ({
    ...opt,
    label: String.fromCharCode(65 + newIdx),
  }));
  
  const answerContent = q.answerContent || '';
  const newAnswerContent = answerContent
    .split('|||')
    .filter(Boolean)
    .map((content) => {
      const opt = relabeled.find(o => o.text === content.trim());
      return opt ? opt.text : content.trim();
    })
    .join('|||');

  return {
    ...q,
    options: relabeled,
    answerContent: newAnswerContent,
  };
}

async function loadBanksFromFiles(): Promise<{ banks: Bank[]; currentBankId: string | null }> {
  try {
    const indexRows = await readCSV<BankIndexRow>('banks_index.csv', SUB_DIRS.META);
    if (indexRows.length === 0) {
      return { banks: [], currentBankId: null };
    }

    const banks: Bank[] = [];
    for (const row of indexRows) {
      const safeName = sanitizeFileName(row.name);
      
      let questions: Question[] = [];
      const csvQuestions = await readCSV<QuestionCSVRow>(`${safeName}.csv`, SUB_DIRS.QUESTIONS);
      if (csvQuestions.length > 0) {
        questions = csvQuestions.map((q, idx) => {
          const question = csvRowToQuestion(q, `q_${row.id}_${idx}`);
          return initQuestionWithShuffled(question);
        });
      }

      const progressMap: Record<string, Progress> = {};
      questions.forEach((q) => {
        const csvRow = csvQuestions.find(r => String(r.index) === String(q.index));
        let status = csvRow?.答题状态 as AnswerStatus || 'unanswered';
        const round = csvRow?.轮次 ? parseInt(csvRow.轮次) : 0;
        const selectedContents = csvRow?.已选内容 ? csvRow.已选内容.split('|||').filter(Boolean) : [];
        
        // 如果状态是 'locked'，根据选中内容重新计算正确状态
        if (status === 'locked' && selectedContents.length > 0) {
          status = checkAnswerByContent(selectedContents, q.answerContent, q.type);
        }
        
        // 根据 selectedContents 和当前打乱的选项重新计算 selected 标签
        const selected = selectedContents.map((content) => {
          const opt = q.options.find(o => o.text === content.trim());
          return opt ? opt.label : '';
        }).filter(Boolean);
        
        progressMap[q.id] = {
          questionId: q.id,
          selected,
          selectedContents,
          status,
          locked: status !== 'unanswered',
          round,
        };
      });

      const favRows = await readCSV<FavoriteCSVRow>(`${safeName}_收藏夹.csv`, SUB_DIRS.FAVORITES);
      const favoritesIds = favRows.map(r => {
        const q = questions.find(q => String(q.index) === r.index);
        return q ? q.id : '';
      }).filter(Boolean);

      const wrongRows = await readCSV<WrongCSVRow>(`${safeName}_错题本.csv`, SUB_DIRS.WRONG);
      const wrongBankIds = wrongRows.map(r => {
        const q = questions.find(q => String(q.index) === r.index);
        return q ? q.id : '';
      }).filter(Boolean);

      const bank: Bank = {
        id: row.id,
        name: row.name,
        questions,
        progressMap,
        wrongBankIds,
        favoritesIds,
        wrongBankRound: Math.max(0, ...wrongRows.map(r => parseInt(r.轮次) || 0)),
        wrongBankCompletedIds: [],
        shuffledVersion: 0,
        created: parseInt(row.created) || Date.now(),
      };
      banks.push(bank);
    }

    const metaContent = await readFile('app_meta.csv', SUB_DIRS.META);
    let currentBankId: string | null = null;
    if (metaContent) {
      const meta = parseCSVUtil<{ key: string; value: string }>(metaContent);
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

async function persistBanksToFiles(banks: Bank[], currentBankId: string | null) {
  try {
    const indexRows: BankIndexRow[] = banks.map((b) => ({
      id: b.id,
      name: b.name,
      created: String(b.created),
    }));
    await writeCSV('banks_index.csv', indexRows, SUB_DIRS.META);

    if (currentBankId) {
      await writeCSV('app_meta.csv', [{ key: 'currentBankId', value: currentBankId }], SUB_DIRS.META);
    } else {
      await writeCSV('app_meta.csv', [{ key: 'currentBankId', value: '' }], SUB_DIRS.META);
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
      const currentBank = updatedBanks.find(b => b.id === currentBankId);
      if (!currentBank) return;

      const safeName = sanitizeFileName(currentBank.name);

      const questionRows: QuestionCSVRow[] = questions.map(q => 
        questionToCSVRow(q, progressMap[q.id])
      );
      await writeCSV(`${safeName}.csv`, questionRows, SUB_DIRS.QUESTIONS);

      const favRows: FavoriteCSVRow[] = favoritesIds.map(id => {
        const q = questions.find(q => q.id === id);
        return {
          index: String(q?.index || ''),
          收藏时间: new Date().toISOString(),
        };
      }).filter(r => r.index);
      await writeCSV(`${safeName}_收藏夹.csv`, favRows, SUB_DIRS.FAVORITES);

      const wrongRows: WrongCSVRow[] = wrongBankIds.map(id => {
        const q = questions.find(q => q.id === id);
        if (!q) return null;
        const progress = progressMap[id];
        const selectedContents = progress?.selectedContents || [];
        return {
          index: String(q.index),
          用户选择内容: selectedContents.join('|||'),
          错误时间: new Date().toISOString(),
          轮次: String(progress?.round || 0),
        };
      }).filter(Boolean) as WrongCSVRow[];
      await writeCSV(`${safeName}_错题本.csv`, wrongRows, SUB_DIRS.WRONG);
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

  const questionRows: QuestionCSVRow[] = questions.map(q => {
    const opt = q.options;
    const progress = progressMap[q.id];
    const status = progress?.status || 'unanswered';
    const answered = progress && progress.status !== 'unanswered' ? 'true' : 'false';
    const round = progress?.round ?? 0;
    const selectedContents = progress?.selectedContents || [];
    return {
      index: String(q.index),
      题干: q.content,
      选项A: opt[0]?.text || '',
      选项B: opt[1]?.text || '',
      选项C: opt[2]?.text || '',
      选项D: opt[3]?.text || '',
      选项E: opt[4]?.text || '',
      选项F: opt[5]?.text || '',
      正确答案内容: q.answerContent,
      答案解析: q.explanation,
      题型: q.type,
      是否已答: answered,
      答题状态: status,
      轮次: String(round),
      已选内容: selectedContents.join('|||'),
    };
  });
  await writeCSV('questions.csv', questionRows);

  const progressRows: ProgressCSVRow[] = Object.values(progressMap).map(
    (p) => ({
      questionId: p.questionId,
      selected: p.selected.join('|'),
      selectedContents: p.selectedContents ? p.selectedContents.join('|') : '',
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
        selectedContents: [],
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
    serializeSave();
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
          selectedContents: [],
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
      serializeSave();
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
      await removeBankFiles(bankToDelete.id, bankToDelete.name);
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
    let questions: Question[] = [];
    try {
      const questionRows = await readCSV<QuestionCSVRow>('questions.csv');
      if (questionRows.length > 0) {
        questions = questionRows.map((row, idx) => {
          const question = csvRowToQuestion(row, `q_loaded_${idx}`);
          return initQuestionWithShuffled(question);
        });
      }
    } catch (e) {
      console.warn('Failed to load CSV questions:', e);
    }

    const progressRows = await readCSV<ProgressCSVRow>('progress.csv');
    const progressMap: Record<string, Progress> = {};
    progressRows.forEach((row) => {
      progressMap[row.questionId] = {
        questionId: row.questionId,
        selected: row.selected ? row.selected.split('|') : [],
        selectedContents: row.selectedContents ? row.selectedContents.split('|') : [],
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
      if (progress.status !== 'unanswered') {
        return;
      }
    }

    const clickedOption = question.options.find((o) => o.label === label);
    if (!clickedOption) return;

    let newSelected: string[] = progress.selected || [];
    let newSelectedContents: string[] = progress.selectedContents || [];

    if (question.type === 'single') {
      if (newSelected.includes(label)) {
        newSelected = [];
        newSelectedContents = [];
      } else {
        newSelected = [label];
        newSelectedContents = [clickedOption.text];
      }
    } else {
      if (newSelected.includes(label)) {
        newSelected = newSelected.filter((s) => s !== label);
        newSelectedContents = newSelectedContents.filter((c) => c !== clickedOption.text);
      } else {
        newSelected = [...newSelected, label].sort();
        newSelectedContents = [...newSelectedContents, clickedOption.text];
      }
    }

    const newProgress = { 
      ...progress, 
      selected: newSelected, 
      selectedContents: newSelectedContents 
    };
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
      if (progress.status !== 'unanswered') return;
    }

    const newProgress = {
      ...progress,
      status: 'wrong' as AnswerStatus,
      locked: true,
      selected: [],
      selectedContents: [],
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
    if (progress.selectedContents.length === 0) {
      get().showToast('请选择一个选项');
      return;
    }

    const isInWrongBank = get().isInWrongBank;
    if (isInWrongBank) {
      if (progress.round !== undefined && progress.round !== wrongBankRound) {
        return;
      }
      if (progress.status !== 'unanswered') return;
    }

    const userSelectedContents = progress.selectedContents;
    const correctAnswerContent = question.answerContent;
    const type = question.type;

    let status: AnswerStatus = checkAnswerByContent(userSelectedContents, correctAnswerContent, type);

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
        
        const { currentIndex } = get();
        const newListLength = newWrongBankIds.length;
        let newIndex = currentIndex;
        
        if (newListLength === 0) {
          set({
            progressMap: {
              ...progressMap,
              [questionId]: newProgress,
            },
            wrongBankIds: [],
            wrongBankCompletedIds: newCompletedIds,
            phase: 'feedback',
          });

          setTimeout(() => {
            const currentPhase = get().phase;
            if (currentPhase !== 'feedback') return;
            set({ 
              isInWrongBank: false, 
              currentIndex: 0, 
              currentMode: 'question', 
              phase: 'answer' 
            });
            get().showToast('🎉 错题本已完成！');
          }, 1000);

          serializeSave();
          return;
        }
        
        if (currentIndex >= newListLength) {
          newIndex = newListLength - 1;
        }

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
          set({ 
            currentIndex: newIndex, 
            currentMode: 'question', 
            phase: 'answer' 
          });
          serializeSave();
        }, 1000);

        serializeSave();
        return;
      } else {
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
      return p && p.round === wrongBankRound && p.status !== 'unanswered';
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
      if (p && p.status !== 'unanswered') {
        newProgressMap[id] = {
          ...p,
          status: 'unanswered',
          locked: false,
          selected: [],
          selectedContents: [],
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
        selectedContents: [],
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
        selectedContents: [],
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
        selectedContents: [],
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
        selectedContents: [],
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
    const { currentIndex, isInWrongBank } = get();
    const list = get().getCurrentQuestions();
    const { wrongBankIds, progressMap } = get();
    
    if (isInWrongBank && wrongBankIds.length === 0) {
      set({ isInWrongBank: false, currentIndex: 0, currentMode: 'question', phase: 'answer' });
      get().showToast('🎉 错题本已完成！');
      serializeSave();
      return;
    }
    
    if (list.length === 0) {
      set({ showSummary: true });
      return;
    }
    
    if (isInWrongBank) {
      if (currentIndex >= list.length) {
        set({ currentIndex: list.length - 1, currentMode: 'question', phase: 'answer' });
        serializeSave();
        return;
      }
      
      if (currentIndex < list.length - 1) {
        set({ currentIndex: currentIndex + 1, currentMode: 'question', phase: 'answer' });
        serializeSave();
        return;
      }
      
      // At the last question in wrong bank
      const hasUnanswered = wrongBankIds.some((id) => {
        const p = progressMap[id];
        return p && p.status === 'unanswered';
      });
      
      if (hasUnanswered) {
        // Still have unanswered questions, jump to the last remaining one
        const lastUnansweredIdx = [...wrongBankIds].reverse().findIndex((id) => {
          const p = progressMap[id];
          return p && p.status === 'unanswered';
        });
        const targetIdx = wrongBankIds.length - 1 - lastUnansweredIdx;
        set({ currentIndex: targetIdx, currentMode: 'question', phase: 'answer' });
        serializeSave();
        return;
      }
      
      // All questions answered in this round
      const hasWrong = wrongBankIds.some((id) => {
        const p = progressMap[id];
        return p && p.status === 'wrong';
      });
      
      if (hasWrong) {
        // Has wrong answers, start a new round
        get().resetWrongBankLocked();
      } else {
        // All correct, go home
        set({ isInWrongBank: false, currentIndex: 0, currentMode: 'question', phase: 'answer' });
        get().showToast('🎉 错题本已完成！');
        serializeSave();
      }
      return;
    }
    
    // Normal (non-wrong-bank) flow
    const safeIndex = Math.min(currentIndex, list.length - 1);
    
    if (safeIndex < list.length - 1) {
      set({ currentIndex: safeIndex + 1, currentMode: 'question', phase: 'answer' });
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
    let { wrongBankIds, progressMap, wrongBankRound, questions, currentBankId, banks, wrongBankCompletedIds } = get();
    
    if (wrongBankIds.length === 0) {
      set({ isInWrongBank: false, currentIndex: 0, currentMode: 'question', phase: 'answer' });
      get().showToast('🎉 错题本已完成！');
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
          selectedContents: [],
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
          selectedContents: [],
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
        selectedContents: [],
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

    for (const bank of banks) {
      const questionRows: QuestionCSVRow[] = bank.questions.map(q => {
        const opt = q.options;
        const progress = bank.progressMap[q.id];
        const status = progress?.status || 'unanswered';
        const answered = progress && progress.status !== 'unanswered' ? 'true' : 'false';
        const round = progress?.round ?? 0;
        return {
          index: String(q.index),
          题干: q.content,
          选项A: opt[0]?.text || '',
          选项B: opt[1]?.text || '',
          选项C: opt[2]?.text || '',
          选项D: opt[3]?.text || '',
          选项E: opt[4]?.text || '',
          选项F: opt[5]?.text || '',
          正确答案内容: q.answerContent,
          答案解析: q.explanation,
          题型: q.type,
          是否已答: answered,
          答题状态: status,
          轮次: String(round),
        };
      });
      await writeCSV(`bank_${bank.id}_questions.csv`, questionRows);

      const progressRows: ProgressCSVRow[] = Object.values(bank.progressMap).map((p) => ({
        questionId: p.questionId,
        selected: p.selected.join('|'),
        selectedContents: p.selectedContents ? p.selectedContents.join('|') : '',
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
        const rows = parseCSVUtil<BankIndexRow>(content);
        if (rows.length === 0) {
          get().showToast('CSV文件为空或格式错误');
          return false;
        }

        const banks: Bank[] = [];
        for (const row of rows) {
          let questionList: Question[] = [];
          const csvQuestions = await readCSV<QuestionCSVRow>(`bank_${row.id}_questions.csv`);
          if (csvQuestions.length > 0) {
            questionList = csvQuestions.map((q, idx) => {
              const question = csvRowToQuestion(q, `q_${row.id}_${idx}`);
              return initQuestionWithShuffled(question);
            });
          }

          const progressRows = await readCSV<ProgressCSVRow>(`bank_${row.id}_progress.csv`);
          const wrongRows = await readCSV<{ questionId: string }>(`bank_${row.id}_wrong.csv`);
          const favRows = await readCSV<{ questionId: string }>(`bank_${row.id}_favorites.csv`);
          const completedRows = await readCSV<{ questionId: string }>(`bank_${row.id}_completed.csv`);

          const progressMap: Record<string, Progress> = {};
          progressRows.forEach((p) => {
            progressMap[p.questionId] = {
              questionId: p.questionId,
              selected: p.selected ? p.selected.split('|') : [],
              selectedContents: p.selectedContents ? p.selectedContents.split('|') : [],
              status: p.status as AnswerStatus,
              locked: p.locked === 'true',
              answeredAt: p.answeredAt ? parseInt(p.answeredAt) : undefined,
              round: p.round ? parseInt(p.round) : undefined,
            };
          });

          const bank: Bank = {
            id: row.id,
            name: row.name,
            questions: questionList,
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
            selectedContents: [],
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
