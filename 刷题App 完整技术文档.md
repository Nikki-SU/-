
# 刷题App 完整技术文档（最终版）


## 一、产品概述

一个基于Markdown文件导入的选择题刷题App，支持单选/多选，卡片式全屏刷题，带有进度看板、收藏、错题库、正确率统计功能。所有数据以 **CSV文件** 形式持久化，人类可直接用Excel编辑查看。


## 二、数据格式规范

### 2.1 题库导入格式（Markdown）

用户导入的题库是一个 `.md` 文件，每道题用 `---` 分隔：

```markdown
# 第1题
题干文字，支持**加粗**、`行内代码`等Markdown语法
![图片描述](data:image/png;base64,xxxxx)
A. 选项A内容
B. 选项B内容
C. 选项C内容
D. 选项D内容
答案：A
解析：这是解析内容

---
# 第2题
题干文字
A. 选项A内容
B. 选项B内容
C. 选项C内容
D. 选项D内容
E. 选项E内容
答案：ABD
解析：这是解析内容
```

### 2.2 解析规则

| 字段 | 识别方式 | 说明 |
|------|----------|------|
| 题目标题 | `# 第X题` | 用作题目编号 |
| 题干 | 标题之后，第一个选项之前的所有内容 | 支持图片Base64 |
| 选项 | `A.` `B.` `C.` ... 正则匹配 | 3-6个选项 |
| 答案 | `答案：X` 或 `正确答案：X` | 单选填单字母，多选填连续字母如`ABD` |
| 解析 | `解析：X` | 纯文本内容 |
| 图片 | `![alt](data:image/png;base64,xxx)` | 嵌入题干中 |

### 2.3 题目类型判定

| 条件 | 类型 |
|------|------|
| 答案长度 === 1 | 单选题 |
| 答案长度 > 1 | 多选题 |


## 三、数据持久化方案（CSV文件）

### 3.1 存储目录结构

```
App数据目录/
├── questions.csv        ← 题目库（只读，首次导入生成）
├── progress.csv         ← 用户答题进度
├── wrong_bank.csv       ← 错题库ID列表
├── favorites.csv        ← 收藏ID列表
└── metadata.csv         ← 元数据（当前索引、模式等）
```

### 3.2 questions.csv（题库）

```csv
id,index,title,content,options,answer,explanation,type
q1,1,"# 第1题","题干内容支持图片Base64","A:选项A内容|B:选项B内容|C:选项C内容|D:选项D内容",A,"解析内容",single
q2,2,"# 第2题","题干内容","A:选项A|B:选项B|C:选项C|D:选项D|E:选项E",ABD,"解析内容",multi
```

**字段说明：**

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 题目唯一ID，格式 q1, q2, ... |
| index | number | 序号（从1开始） |
| title | string | 题目标题 "# 第X题" |
| content | string | 题干内容（含Base64图片） |
| options | string | 用 `\|` 分隔，每项格式 `标签:文字` |
| answer | string | 标准答案 "A" 或 "ABD" |
| explanation | string | 解析内容 |
| type | string | single 或 multi |

### 3.3 progress.csv（答题进度）

```csv
questionId,selected,status,answeredAt
q1,"A|B",partial,1699123456789
q2,A,correct,1699123456790
q3,,unanswered,
q4,"C|D",wrong,1699123456791
```

**字段说明：**

| 字段 | 类型 | 说明 |
|------|------|------|
| questionId | string | 题目ID |
| selected | string | 用户选的标签，多个用 `\|` 分隔，空=未选 |
| status | string | correct / wrong / partial / unanswered |
| answeredAt | number | 时间戳，空=未答 |

**status判定规则：**

| 题型 | 条件 | status |
|------|------|--------|
| 单选 | selected === answer | correct |
| 单选 | selected !== answer | wrong |
| 多选 | selected 与 answer 完全一致（顺序无关） | correct |
| 多选 | selected 包含任意非answer中的选项 | wrong |
| 多选 | selected 是 answer 的真子集（非空） | partial |
| 任意 | selected 为空 | unanswered |

### 3.4 wrong_bank.csv（错题库）

```csv
questionId
q1
q4
q7
```

| 字段 | 说明 |
|------|------|
| questionId | 错题ID（wrong/partial状态的题） |

### 3.5 favorites.csv（收藏）

```csv
questionId
q2
q5
```

| 字段 | 说明 |
|------|------|
| questionId | 收藏的题目ID |

### 3.6 metadata.csv（元数据）

```csv
key,value
currentIndex,3
isInWrongBank,false
totalQuestions,20
lastOpened,2026-01-15T14:30:00.000Z
```

| 字段 | 说明 |
|------|------|
| key | 元数据键名 |
| value | 对应的值 |


## 四、CSV读写工具

```typescript
// utils/csvStorage.ts

import * as FileSystem from 'expo-file-system'

const DATA_DIR = FileSystem.documentDirectory || './data/'

// 通用CSV解析
export function parseCSV<T>(csvString: string): T[] {
  const lines = csvString.trim().split('\n')
  if (lines.length < 2) return []
  
  const headers = lines[0].split(',').map(h => h.trim())
  return lines.slice(1).map(line => {
    const values = parseCSVLine(line)
    const obj: any = {}
    headers.forEach((h, i) => {
      let val = values[i] || ''
      if (val.startsWith('"') && val.endsWith('"')) {
        val = val.slice(1, -1).replace(/""/g, '"')
      }
      obj[h] = val.replace(/\\\|/g, '|')  // 还原分隔符
    })
    return obj as T
  })
}

// 解析CSV行（处理引号内的逗号）
function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === ',' && !inQuotes) {
      result.push(current)
      current = ''
    } else {
      current += char
    }
  }
  result.push(current)
  return result
}

// 对象数组转CSV
export function stringifyCSV<T extends Record<string, any>>(data: T[]): string {
  if (data.length === 0) return ''
  const headers = Object.keys(data[0])
  const rows = data.map(obj => 
    headers.map(h => {
      let val = String(obj[h] || '')
      val = val.replace(/\|/g, '\\|')  // 转义分隔符
      if (val.includes(',') || val.includes('"') || val.includes('|')) {
        val = `"${val.replace(/"/g, '""')}"`
      }
      return val
    }).join(',')
  )
  return [headers.join(','), ...rows].join('\n')
}

// 读写文件
export async function writeCSV(filename: string, data: any[]): Promise<void> {
  const content = stringifyCSV(data)
  const path = `${DATA_DIR}${filename}`
  await FileSystem.writeAsStringAsync(path, content, {
    encoding: FileSystem.EncodingType.UTF8
  })
}

export async function readCSV<T>(filename: string): Promise<T[]> {
  try {
    const path = `${DATA_DIR}${filename}`
    const content = await FileSystem.readAsStringAsync(path, {
      encoding: FileSystem.EncodingType.UTF8
    })
    return parseCSV<T>(content)
  } catch {
    return []
  }
}

// 确保目录存在
export async function ensureDataDir(): Promise<void> {
  const dirInfo = await FileSystem.getInfoAsync(DATA_DIR)
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(DATA_DIR, { intermediates: true })
  }
}
```


## 五、TypeScript类型定义

```typescript
// types/index.ts

export interface Option {
  label: string
  text: string
}

export interface Question {
  id: string
  index: number
  title: string
  content: string
  options: Option[]
  answer: string
  explanation: string
  type: 'single' | 'multi'
}

export type AnswerStatus = 'correct' | 'wrong' | 'partial' | 'unanswered'

export interface Progress {
  questionId: string
  selected: string[]
  status: AnswerStatus
  answeredAt?: number
}

export interface PersistedData {
  questions: Question[]
  progressMap: Record<string, Progress>
  wrongBankIds: string[]
  favoritesIds: string[]
  currentIndex: number
  isInWrongBank: boolean
  totalQuestions: number
  lastOpened: string
}

// CSV行类型
export interface QuestionCSVRow {
  id: string
  index: string
  title: string
  content: string
  options: string      // "A:选项A|B:选项B|C:选项C"
  answer: string
  explanation: string
  type: string
}

export interface ProgressCSVRow {
  questionId: string
  selected: string     // "A|B" 或 "A" 或 ""
  status: string
  answeredAt: string
}

export interface WrongBankCSVRow {
  questionId: string
}

export interface FavoritesCSVRow {
  questionId: string
}

export interface MetadataCSVRow {
  key: string
  value: string
}
```


## 六、状态管理

```typescript
// stores/useAppStore.ts

import { create } from 'zustand'
import { 
  readCSV, writeCSV, ensureDataDir 
} from '../utils/csvStorage'
import { parseMarkdownToQuestions } from '../utils/markdownParser'
import { checkAnswer } from '../utils/answerChecker'
import type { 
  Question, Progress, AnswerStatus,
  QuestionCSVRow, ProgressCSVRow, MetadataCSVRow
} from '../types'

interface AppState {
  // 数据
  questions: Question[]
  progressMap: Record<string, Progress>
  wrongBankIds: string[]
  favoritesIds: string[]
  
  // UI状态
  currentIndex: number
  currentMode: 'question' | 'explanation'
  isInWrongBank: boolean
  isProgressBoardExpanded: boolean
  
  // Actions
  loadQuestionsFromMarkdown: (markdown: string) => Promise<void>
  loadFromCSV: () => Promise<void>
  saveToCSV: () => Promise<void>
  selectOption: (questionId: string, label: string) => void
  submitAnswer: (questionId: string) => void
  goToPrevious: () => void
  goToNext: () => void
  goToQuestion: (index: number) => void
  toggleExplanation: () => void
  toggleFavorite: (questionId: string) => void
  toggleProgressBoard: () => void
  enterWrongBank: () => void
  exitWrongBank: () => void
  resetAll: () => void
}

export const useAppStore = create<AppState>((set, get) => ({
  // 初始状态
  questions: [],
  progressMap: {},
  wrongBankIds: [],
  favoritesIds: [],
  currentIndex: 0,
  currentMode: 'question',
  isInWrongBank: false,
  isProgressBoardExpanded: false,

  // 从Markdown导入题库
  loadQuestionsFromMarkdown: async (markdown: string) => {
    const questions = parseMarkdownToQuestions(markdown)
    const progressMap: Record<string, Progress> = {}
    questions.forEach(q => {
      progressMap[q.id] = {
        questionId: q.id,
        selected: [],
        status: 'unanswered'
      }
    })
    set({ 
      questions, 
      progressMap, 
      wrongBankIds: [], 
      favoritesIds: [],
      currentIndex: 0 
    })
    await get().saveToCSV()
  },

  // 从CSV加载数据
  loadFromCSV: async () => {
    await ensureDataDir()
    
    // 加载题库
    const questionRows = await readCSV<QuestionCSVRow>('questions.csv')
    const questions: Question[] = questionRows.map(row => ({
      id: row.id,
      index: parseInt(row.index),
      title: row.title,
      content: row.content,
      options: row.options.split('|').map(opt => {
        const [label, ...textParts] = opt.split(':')
        return { label, text: textParts.join(':') }
      }),
      answer: row.answer,
      explanation: row.explanation,
      type: row.type as 'single' | 'multi'
    }))
    
    // 加载进度
    const progressRows = await readCSV<ProgressCSVRow>('progress.csv')
    const progressMap: Record<string, Progress> = {}
    progressRows.forEach(row => {
      progressMap[row.questionId] = {
        questionId: row.questionId,
        selected: row.selected ? row.selected.split('|') : [],
        status: row.status as AnswerStatus,
        answeredAt: row.answeredAt ? parseInt(row.answeredAt) : undefined
      }
    })
    
    // 加载错题库
    const wrongRows = await readCSV<WrongBankCSVRow>('wrong_bank.csv')
    const wrongBankIds = wrongRows.map(r => r.questionId)
    
    // 加载收藏
    const favRows = await readCSV<FavoritesCSVRow>('favorites.csv')
    const favoritesIds = favRows.map(r => r.questionId)
    
    // 加载元数据
    const metaRows = await readCSV<MetadataCSVRow>('metadata.csv')
    const metaMap: Record<string, string> = {}
    metaRows.forEach(r => { metaMap[r.key] = r.value })
    
    set({
      questions,
      progressMap,
      wrongBankIds,
      favoritesIds,
      currentIndex: parseInt(metaMap.currentIndex || '0'),
      isInWrongBank: metaMap.isInWrongBank === 'true'
    })
  },

  // 保存到CSV
  saveToCSV: async () => {
    await ensureDataDir()
    const state = get()
    
    // 保存题库
    const questionRows: QuestionCSVRow[] = state.questions.map(q => ({
      id: q.id,
      index: String(q.index),
      title: q.title,
      content: q.content,
      options: q.options.map(o => `${o.label}:${o.text}`).join('|'),
      answer: q.answer,
      explanation: q.explanation,
      type: q.type
    }))
    await writeCSV('questions.csv', questionRows)
    
    // 保存进度
    const progressRows: ProgressCSVRow[] = Object.values(state.progressMap).map(p => ({
      questionId: p.questionId,
      selected: p.selected.join('|'),
      status: p.status,
      answeredAt: p.answeredAt ? String(p.answeredAt) : ''
    }))
    await writeCSV('progress.csv', progressRows)
    
    // 保存错题库
    const wrongRows = state.wrongBankIds.map(id => ({ questionId: id }))
    await writeCSV('wrong_bank.csv', wrongRows)
    
    // 保存收藏
    const favRows = state.favoritesIds.map(id => ({ questionId: id }))
    await writeCSV('favorites.csv', favRows)
    
    // 保存元数据
    const metaRows: MetadataCSVRow[] = [
      { key: 'currentIndex', value: String(state.currentIndex) },
      { key: 'isInWrongBank', value: String(state.isInWrongBank) },
      { key: 'totalQuestions', value: String(state.questions.length) },
      { key: 'lastOpened', value: new Date().toISOString() }
    ]
    await writeCSV('metadata.csv', metaRows)
  },

  // 选择选项
  selectOption: (questionId: string, label: string) => {
    const { progressMap, questions } = get()
    const question = questions.find(q => q.id === questionId)
    const progress = progressMap[questionId]
    if (!question || !progress || progress.status !== 'unanswered') return
    
    let newSelected: string[]
    if (question.type === 'single') {
      newSelected = progress.selected.includes(label) ? [] : [label]
    } else {
      newSelected = progress.selected.includes(label)
        ? progress.selected.filter(s => s !== label)
        : [...progress.selected, label].sort()
    }
    
    set({
      progressMap: {
        ...progressMap,
        [questionId]: { ...progress, selected: newSelected }
      }
    })
    get().saveToCSV()
  },

  // 提交答案
  submitAnswer: (questionId: string) => {
    const { progressMap, questions, wrongBankIds, favoritesIds } = get()
    const question = questions.find(q => q.id === questionId)
    const progress = progressMap[questionId]
    if (!question || !progress) return
    if (progress.selected.length === 0) {
      // Toast: "请选择一个选项"
      return
    }
    
    const status = checkAnswer(progress.selected, question.answer, question.type)
    
    const newProgress = {
      ...progress,
      status,
      answeredAt: Date.now()
    }
    
    let newWrongBankIds = [...wrongBankIds]
    if (status === 'wrong' || status === 'partial') {
      if (!newWrongBankIds.includes(questionId)) {
        newWrongBankIds.push(questionId)
      }
    } else if (status === 'correct') {
      newWrongBankIds = newWrongBankIds.filter(id => id !== questionId)
    }
    
    set({
      progressMap: {
        ...progressMap,
        [questionId]: newProgress
      },
      wrongBankIds: newWrongBankIds
    })
    get().saveToCSV()
    
    if (status === 'correct') {
      setTimeout(() => get().goToNext(), 800)
    }
  },

  // 切换题目
  goToPrevious: () => {
    const { currentIndex, isInWrongBank, wrongBankIds, questions } = get()
    const list = isInWrongBank 
      ? wrongBankIds.map(id => questions.find(q => q.id === id)!).filter(Boolean)
      : questions
    if (currentIndex > 0) {
      set({ currentIndex: currentIndex - 1, currentMode: 'question' })
      get().saveToCSV()
    }
  },

  goToNext: () => {
    const { currentIndex, isInWrongBank, wrongBankIds, questions } = get()
    const list = isInWrongBank 
      ? wrongBankIds.map(id => questions.find(q => q.id === id)!).filter(Boolean)
      : questions
    if (currentIndex < list.length - 1) {
      set({ currentIndex: currentIndex + 1, currentMode: 'question' })
      get().saveToCSV()
    }
  },

  goToQuestion: (index: number) => {
    const { isInWrongBank, wrongBankIds, questions } = get()
    const list = isInWrongBank 
      ? wrongBankIds.map(id => questions.find(q => q.id === id)!).filter(Boolean)
      : questions
    if (index >= 0 && index < list.length) {
      set({ 
        currentIndex: index, 
        currentMode: 'question',
        isProgressBoardExpanded: false
      })
      get().saveToCSV()
    }
  },

  // 切换解析
  toggleExplanation: () => {
    const { currentMode } = get()
    set({ currentMode: currentMode === 'question' ? 'explanation' : 'question' })
  },

  // 切换收藏
  toggleFavorite: (questionId: string) => {
    const { favoritesIds } = get()
    const newFavorites = favoritesIds.includes(questionId)
      ? favoritesIds.filter(id => id !== questionId)
      : [...favoritesIds, questionId]
    set({ favoritesIds: newFavorites })
    get().saveToCSV()
  },

  // 进度看板
  toggleProgressBoard: () => {
    const { isProgressBoardExpanded } = get()
    set({ isProgressBoardExpanded: !isProgressBoardExpanded })
  },

  // 错题库
  enterWrongBank: () => {
    const { wrongBankIds } = get()
    if (wrongBankIds.length === 0) {
      // Toast: "错题库已清空"
      return
    }
    set({ isInWrongBank: true, currentIndex: 0, currentMode: 'question' })
    get().saveToCSV()
  },

  exitWrongBank: () => {
    set({ isInWrongBank: false, currentIndex: 0, currentMode: 'question' })
    get().saveToCSV()
  },

  // 重置
  resetAll: () => {
    const { questions } = get()
    const progressMap: Record<string, Progress> = {}
    questions.forEach(q => {
      progressMap[q.id] = {
        questionId: q.id,
        selected: [],
        status: 'unanswered'
      }
    })
    set({
      progressMap,
      wrongBankIds: [],
      favoritesIds: [],
      currentIndex: 0,
      currentMode: 'question',
      isInWrongBank: false
    })
    get().saveToCSV()
  }
}))
```


## 七、答案判定逻辑

```typescript
// utils/answerChecker.ts

import { AnswerStatus } from '../types'

export function checkAnswer(
  selected: string[],
  correctAnswer: string,
  type: 'single' | 'multi'
): AnswerStatus {
  if (selected.length === 0) return 'unanswered'
  
  const correctSet = new Set(correctAnswer.split(''))
  const selectedSet = new Set(selected)
  
  if (type === 'single') {
    return selected[0] === correctAnswer ? 'correct' : 'wrong'
  }
  
  const hasWrong = selected.some(s => !correctSet.has(s))
  const isSubset = selected.every(s => correctSet.has(s))
  const isEqual = selected.length === correctSet.size && isSubset
  
  if (isEqual) return 'correct'
  if (hasWrong) return 'wrong'
  if (isSubset && selected.length < correctSet.size) return 'partial'
  return 'wrong'
}

// 获取选项颜色
export function getOptionColor(
  label: string,
  selected: string[],
  correctAnswer: string,
  status: AnswerStatus
): 'gray' | 'blue' | 'green' | 'red' | 'yellow' {
  if (status === 'unanswered') {
    return selected.includes(label) ? 'blue' : 'gray'
  }
  
  const isSelected = selected.includes(label)
  const isCorrect = correctAnswer.includes(label)
  
  if (isSelected && isCorrect) return 'green'
  if (isSelected && !isCorrect) return 'red'
  if (!isSelected && isCorrect && status === 'partial') return 'yellow'
  return 'gray'
}
```


## 八、Markdown解析器

```typescript
// utils/markdownParser.ts

import { Question, Option } from '../types'

export function parseMarkdownToQuestions(markdown: string): Question[] {
  const blocks = markdown.split('\n---\n').filter(s => s.trim())
  
  return blocks.map((block, index) => {
    const lines = block.split('\n').filter(s => s.trim())
    const optionRegex = /^([A-F])\.\s+(.+)$/
    
    // 提取标题
    const titleLine = lines.find(l => l.startsWith('# '))
    const title = titleLine || `# 第${index + 1}题`
    
    // 提取选项
    const optionLines = lines.filter(l => optionRegex.test(l.trim()))
    const options: Option[] = optionLines.map(l => {
      const match = l.trim().match(optionRegex)
      return { label: match![1], text: match![2] }
    })
    
    // 提取答案
    const answerLine = lines.find(l => /答案[：:]\s*/.test(l))
    const answer = answerLine 
      ? answerLine.replace(/答案[：:]\s*/, '').trim().toUpperCase()
      : ''
    
    // 提取解析
    const explanationLine = lines.find(l => /解析[：:]\s*/.test(l))
    const explanation = explanationLine
      ? explanationLine.replace(/解析[：:]\s*/, '').trim()
      : '暂无解析'
    
    // 提取题干
    const firstOptionIndex = lines.findIndex(l => optionRegex.test(l.trim()))
    const contentLines = lines.slice(
      titleLine ? 1 : 0,
      firstOptionIndex === -1 ? lines.length : firstOptionIndex
    ).filter(l => !/解析[：:]/.test(l) && !/答案[：:]/.test(l))
    const content = contentLines.join('\n').trim()
    
    return {
      id: `q${index + 1}`,
      index: index + 1,
      title,
      content,
      options,
      answer,
      explanation,
      type: answer.length === 1 ? 'single' : 'multi'
    }
  })
}
```


## 九、UI布局规范

### 9.1 整体布局（全部用相对单位）

```
┌──────────────────────────────────────┐  ← 100vh 全屏
│  ↑ 8vh                              │
│  ⭐  第 3/20 题    📋展开           │  ← 顶部栏
│  ──────────────────────────────────  │
│  ↑ 6vh                              │
│  ● ● ● ○ ○                         │  ← 进度看板（只显示当前组5个）
│  ──────────────────────────────────  │
│  ↑ flex:1（自动撑满）              │
│  题目内容                            │  ← 题目区域（内容过长时可滚动）
│  ⚪A  选项A内容                      │     底部按钮固定不滚动
│  ⚪B  选项B内容                      │
│  ⚪C  选项C内容                      │
│  ⚪D  选项D内容                      │
│                                      │
│  ──────────────────────────────────  │
│  ↑ 7vh                              │
│  [上一题]  [提交]  [下一题]         │  ← 底部按钮
│  ↓ 安全区（如有）                   │
└──────────────────────────────────────┘
```

### 9.2 尺寸规范（全部用vh/vw）

| 元素 | 尺寸 |
|------|------|
| 顶部栏高度 | 8vh |
| 进度看板高度 | 6vh |
| 底部按钮高度 | 7vh |
| 题目区域 | flex:1（剩余空间） |
| 选项内边距 | 1.2vh 2vw |
| 圆形字母直径 | 3.5vh |
| 题干字号 | 2.2vh |
| 选项字号 | 2vh |
| 按钮字号 | 1.8vh |
| 圆角 | 1.2vh |
| 间距 | 0.8vh |

### 9.3 滚动行为

- **默认：** 内容恰好占满100vh，无需滚动
- **内容过长时：** 题目区域内部可滚动，底部按钮固定在屏幕底部
- 判断方式：内容高度与可用空间比较，超出则启用滚动

### 9.4 进度看板

**收起状态（默认）：** 只显示当前组的5个圆圈
**展开状态：** 全屏遮罩弹窗，只显示进度看板（无题干、无选项、无底部按钮）

```
┌──────────────────────────────────────┐
│  📋 全部题目进度                     │
│                                      │
│  第1组 (1-5题):                     │
│  [1]● [2]● [3]● [4]○ [5]○         │
│                                      │
│  第2组 (6-10题):                    │
│  [6]○ [7]○ [8]○ [9]○ [10]○       │
│                                      │
│  绿色●=对  红色●=错  黄色●=部分对  │
│  灰色○=未做                         │
│                                      │
│  点击任意圆圈跳转，弹窗自动关闭      │
└──────────────────────────────────────┘
```


## 十、交互流程

### 10.1 用户操作 → 系统响应

| 用户操作 | 系统响应 |
|---------|---------|
| 点击选项（圆形/矩形） | 切换选中状态（灰色↔蓝色），单选互斥，多选可累加 |
| 点击【提交】 | 判定对错，显示颜色反馈，更新CSV，答对0.8秒自动跳转，答错/部分对停留 |
| 点击【解析】 | 隐藏题干选项，显示纯解析文字，中间按钮变为【题目】 |
| 点击【题目】 | 隐藏解析，显示题干选项+颜色反馈，中间按钮变为【解析】 |
| 点击【上一题】/【下一题】 | 切换题目，强制回到题目模式，更新CSV |
| 点击进度看板圆点 | 跳转对应题目，关闭看板，回到题目模式 |
| 点击⭐ | 切换收藏状态，更新favorites.csv |
| 展开看板 | 全屏遮罩，只显示所有题目进度圆点 |
| 关闭看板 | 回到题目区 |

### 10.2 按钮状态切换

| 模式 | 左按钮 | 中按钮 | 右按钮 |
|------|--------|--------|--------|
| 答题中（未提交） | 上一题 | **提交** | 下一题 |
| 展示答案（已提交） | 上一题 | **解析** | 下一题 |
| 解析模式 | 上一题 | **题目** | 下一题 |

### 10.3 颜色规则

| 选项状态 | 颜色 |
|----------|------|
| 未选中 | 灰色 |
| 选中（提交前） | 蓝色 |
| 用户选中 + 正确答案 | 绿色 |
| 用户选中 + 错误答案 | 红色 |
| 用户未选 + 正确答案（漏选） | 黄色 |

### 10.4 错题库逻辑

| 答题结果 | 是否收录 |
|----------|----------|
| correct（答对） | 不移入 |
| wrong（答错） | 移入 |
| partial（部分对） | 移入 |

在错题库中答对（correct）→ 立即从wrong_bank.csv移除


## 十一、总结页

```
┌──────────────────────────────────────┐
│                                      │
│          🎉 全部完成！               │
│                                      │
│          📊 统计结果                 │
│                                      │
│         总题数：20 题                 │
│         ✅ 正确：12 题                │
│         ❌ 错误：5 题                 │
│         ⚠️ 部分对：3 题               │
│                                      │
│         🎯 正确率：60%               │
│                                      │
│    ┌──────────┐  ┌──────────┐       │
│    │  错题库   │  │ 重新刷题  │       │
│    └──────────┘  └──────────┘       │
│                                      │
│    ┌──────────┐                      │
│    │  返回首页  │                      │
│    └──────────┘                      │
└──────────────────────────────────────┘
```


## 十二、边界情况处理

| 场景 | 处理 |
|------|------|
| 未选选项点击提交 | Toast提示"请选择一个选项" |
| Markdown解析失败 | 提示"格式错误：第X行" |
| 选项数量<2或>6 | 提示"选项数量需2-6个" |
| 未填答案 | 提示"缺少标准答案" |
| 图片加载失败 | 显示占位框 |
| CSV读写失败 | 静默失败 + console警告 |
| 题库为空 | 提示"请导入有效题库" |
| 错题库为空 | 点击入口提示"🎉 错题库已清空！" |
| 第一题点击上一题 | 按钮置灰 |
| 最后一题点击下一题 | 按钮置灰 |


## 十三、性能优化

| 优化点 | 方案 |
|--------|------|
| 图片加载 | `loading="lazy"` + 占位框 |
| 状态更新 | Zustand + 浅比较 |
| CSV读写 | 异步I/O，不阻塞UI |
| 防抖提交 | 提交后禁用按钮0.3s |
| 动画 | CSS transform + opacity |


## 十四、平台适配

### 14.1 存储路径

| 平台 | 数据目录 |
|------|----------|
| iOS (Expo) | `FileSystem.documentDirectory` |
| Android (Expo) | `FileSystem.documentDirectory` |
| Web | `localStorage`（降级方案） |
| 桌面端 | `用户目录/.quiz_app/data/` |

### 14.2 安全区域

- iOS刘海屏：`safe-area-inset-top/bottom`
- 底部按钮避开Home Indicator

---
