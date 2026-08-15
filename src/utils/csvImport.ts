import type { Question, Option } from '../types';

export interface CSVParseError {
  rowIndex: number;
  message: string;
  lineContent: string;
}

export interface CSVParseResult {
  questions: Question[];
  errors: CSVParseError[];
  totalRows: number;
  validRows: number;
}

const DELIMITER = '\t';

const EXPECTED_HEADERS = [
  '题号', '题干', '选项A', '选项B', '选项C', '选项D', '选项E', '选项F', '正确答案内容', '解析',
];

function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let currentField = '';
  let inQuotes = false;
  let i = 0;

  while (i < line.length) {
    const char = line[i];

    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          currentField += '"';
          i += 2;
          continue;
        } else {
          inQuotes = false;
          i++;
          continue;
        }
      } else {
        currentField += char;
        i++;
        continue;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
        i++;
        continue;
      } else if (char === DELIMITER) {
        fields.push(currentField);
        currentField = '';
        i++;
        continue;
      } else if (char === '\n') {
        fields.push(currentField);
        currentField = '';
        i++;
        continue;
      } else if (char === '\r') {
        i++;
        continue;
      } else {
        currentField += char;
        i++;
        continue;
      }
    }
  }

  fields.push(currentField);
  return fields;
}

function splitIntoRows(content: string): string[] {
  const rows: string[] = [];
  let currentRow = '';
  let inQuotes = false;
  let i = 0;

  while (i < content.length) {
    const char = content[i];

    if (char === '"') {
      if (inQuotes && i + 1 < content.length && content[i + 1] === '"') {
        currentRow += '""';
        i += 2;
        continue;
      }
      inQuotes = !inQuotes;
      currentRow += char;
      i++;
      continue;
    }

    if (inQuotes) {
      currentRow += char;
      i++;
      continue;
    }

    if (char === '\n') {
      if (currentRow.trim()) {
        rows.push(currentRow);
      }
      currentRow = '';
      i++;
      continue;
    }

    if (char === '\r') {
      i++;
      continue;
    }

    currentRow += char;
    i++;
  }

  if (currentRow.trim()) {
    rows.push(currentRow);
  }

  return rows;
}

function detectHeader(row: string[]): boolean {
  const matchCount = EXPECTED_HEADERS.filter((h) =>
    row.some((cell) => cell.trim() === h)
  ).length;
  return matchCount >= 3;
}

function buildOptions(optionTexts: string[]): Option[] {
  const options: Option[] = [];
  for (let i = 0; i < optionTexts.length; i++) {
    const text = optionTexts[i].trim();
    if (text) {
      options.push({
        label: String.fromCharCode(65 + i),
        text,
        originalIndex: i,
      });
    }
  }
  return options;
}

function normalizeMultilineContent(content: string): string {
  return content.replace(/\\n/g, '\n');
}

function determineQuestionType(answerContent: string): 'single' | 'multi' {
  const normalized = normalizeMultilineContent(answerContent);
  const lines = normalized.split('\n').filter((l) => l.trim());
  return lines.length > 1 ? 'multi' : 'single';
}

function extractAnswerLabels(answerContent: string, options: Option[]): string {
  const normalized = normalizeMultilineContent(answerContent);
  const answerLines = normalized
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  if (answerLines.length === 0) return '';

  const labels: string[] = [];
  for (const line of answerLines) {
    const matched = options.find(
      (o) => o.text.trim() === line || o.text.trim().includes(line) || line.includes(o.text.trim())
    );
    if (matched) {
      labels.push(matched.label);
    }
  }

  if (labels.length > 0) {
    return labels.join('');
  }

  if (options.length >= 2) {
    return 'A';
  }
  return '';
}

export function parseCSVToQuestions(csvContent: string): CSVParseResult {
  const errors: CSVParseError[] = [];
  const questions: Question[] = [];

  const rows = splitIntoRows(csvContent);

  if (rows.length === 0) {
    return { questions: [], errors: [], totalRows: 0, validRows: 0 };
  }

  const firstFields = parseCSVLine(rows[0]);
  const hasHeader = detectHeader(firstFields);

  const dataRows = hasHeader ? rows.slice(1) : rows;

  for (let rowIdx = 0; rowIdx < dataRows.length; rowIdx++) {
    const row = dataRows[rowIdx];
    const trimmedRow = row.trim();
    if (!trimmedRow) continue;

    const fields = parseCSVLine(row);

    const rowIndex = fields[0]?.trim() || String(rowIdx + 1);
    const content = fields[1]?.trim() || '';
    const optionTexts = [
      fields[2]?.trim() || '',
      fields[3]?.trim() || '',
      fields[4]?.trim() || '',
      fields[5]?.trim() || '',
      fields[6]?.trim() || '',
      fields[7]?.trim() || '',
    ];
    const answerContentRaw = fields[8] || '';
    const explanation = fields[9]?.trim() || '暂无解析';

    const nonEmptyOptions = optionTexts.filter((t) => t);

    if (nonEmptyOptions.length < 2) {
      errors.push({
        rowIndex: rowIdx + 1,
        message: `第 ${rowIndex} 题：至少需要 2 个选项，当前只有 ${nonEmptyOptions.length} 个`,
        lineContent: row.slice(0, 100),
      });
      continue;
    }

    if (!content) {
      errors.push({
        rowIndex: rowIdx + 1,
        message: `第 ${rowIndex} 题：题干为空`,
        lineContent: row.slice(0, 100),
      });
      continue;
    }

    const options = buildOptions(optionTexts);
    const effectiveAnswerContent = normalizeMultilineContent(answerContentRaw.trim());

    if (!effectiveAnswerContent) {
      errors.push({
        rowIndex: rowIdx + 1,
        message: `第 ${rowIndex} 题：缺少正确答案内容`,
        lineContent: row.slice(0, 100),
      });
      continue;
    }

    const answer = extractAnswerLabels(effectiveAnswerContent, options);
    const type = determineQuestionType(effectiveAnswerContent);

    const validAnswerLines = effectiveAnswerContent
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    const answerDisplay = validAnswerLines
      .map((line) => {
        const opt = options.find(
          (o) => o.text.trim() === line || line.includes(o.text.trim())
        );
        return opt ? opt.label : '';
      })
      .filter(Boolean)
      .join('');

    const effectiveAnswer = answer || answerDisplay || options[0]?.label || 'A';

    questions.push({
      id: `q_csv_${questions.length + 1}`,
      index: questions.length + 1,
      title: `第${questions.length + 1}题`,
      content,
      options,
      answer: effectiveAnswer,
      answerContent: effectiveAnswerContent,
      explanation: normalizeMultilineContent(explanation),
      type,
    });
  }

  return {
    questions,
    errors,
    totalRows: dataRows.filter((r) => r.trim()).length,
    validRows: questions.length,
  };
}

export function generateCSVTemplates(): string {
  return [
    '题号\t题干\t选项A\t选项B\t选项C\t选项D\t选项E\t选项F\t正确答案内容\t解析',
    '1\t题干内容示例1\t选项A内容\t选项B内容\t选项C内容\t选项D内容\t\t\t"选项B的内容"\t"解析内容\\n可以多行"',
    '2\t题干内容示例2（多选）\t选项A内容\t选项B内容\t选项C内容\t选项D内容\t\t\t"选项A的内容\\n选项C的内容"\t解析内容',
    '',
    '说明：',
    '• 使用 Tab 分隔各列',
    '• 多选题正确答案内容用换行分隔每个正确选项',
    '• 解析内容支持换行',
    '• 空列请留空（如选项E、F不需要时留空）',
  ].join('\n');
}
