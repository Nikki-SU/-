import type { Question, Option } from '../types';

export interface ParseError {
  blockIndex: number;
  lineNumber: number;
  lineContent: string;
  message: string;
}

export interface ParseResult {
  questions: Question[];
  errors: ParseError[];
  totalBlocks: number;
  validBlocks: number;
}

export function parseMarkdownToQuestions(markdown: string): Question[] {
  const result = parseMarkdownWithValidation(markdown);
  return result.questions;
}

function findQuestionBoundaries(text: string): number[] {
  const lines = text.split('\n');

  const header2Boundaries: number[] = [];
  const header3Or1Boundaries: number[] = [];
  const fallbackBoundaries: number[] = [];

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();

    if (/^##\s+/.test(trimmed)) {
      if (/题目|第.+题|Question|问题|化学/.test(trimmed) || /^##\s+\d/.test(trimmed)) {
        header2Boundaries.push(i);
      }
    }

    if (/^#{1,3}\s+/.test(trimmed)) {
      if (/题目|第.+题|Question|问题|化学/.test(trimmed) || /^#{1,3}\s+\d/.test(trimmed) || header3Or1Boundaries.length === 0) {
        header3Or1Boundaries.push(i);
      }
    }

    const isFallbackStart =
      /^\*\*第.{0,5}题[：:)]/.test(trimmed) ||
      /^\*\*题目[：:]/.test(trimmed) ||
      /^\d+[、．.)]\s*\*\*/.test(trimmed) ||
      /^\d+[、．.)]\s*[^\d]/.test(trimmed) ||
      /^\*\*\d+[、．.)]/.test(trimmed) ||
      /^第\s*\d+\s*题/.test(trimmed) ||
      /^\d+\.\s*\*\*第.{0,5}题/.test(trimmed);

    if (isFallbackStart) {
      const lastFallback = fallbackBoundaries[fallbackBoundaries.length - 1] ?? -10;
      if (i === 0 || i - lastFallback > 2) {
        fallbackBoundaries.push(i);
      }
    }
  }

  if (header2Boundaries.length >= 2) {
    return header2Boundaries;
  }

  if (header3Or1Boundaries.length >= 2) {
    return header3Or1Boundaries;
  }

  if (fallbackBoundaries.length >= 2) {
    return fallbackBoundaries;
  }

  return [];
}

function splitIntoBlocks(markdown: string): string[] {
  if (markdown.includes('\n---\n')) {
    return markdown.split('\n---\n');
  }

  const boundaries = findQuestionBoundaries(markdown);

  if (boundaries.length >= 2) {
    const blocks: string[] = [];
    for (let i = 0; i < boundaries.length; i++) {
      const startLine = boundaries[i];
      const endLine = i + 1 < boundaries.length ? boundaries[i + 1] : markdown.split('\n').length;
      const lines = markdown.split('\n');
      const blockText = lines.slice(startLine, endLine).join('\n');
      if (blockText.trim()) {
        blocks.push(blockText);
      }
    }
    return blocks;
  }

  return [markdown];
}

function extractContent(lines: string[]): string {
  const contentParts: string[] = [];
  let inContent = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (inContent) contentParts.push('');
      continue;
    }

    if (/^#{1,3}\s+/.test(trimmed) && !inContent) {
      if (/题目|第.+题/.test(trimmed)) {
        inContent = true;
      }
      continue;
    }

    if (/^\*\*题目[：:]/.test(trimmed)) {
      inContent = true;
      const content = trimmed.replace(/^\*\*题目[：:]\*\*\s*/, '').trim();
      if (content) contentParts.push(content);
      continue;
    }

    if (/^答案[：:]/.test(trimmed) || /^解析[：:]/.test(trimmed)) {
      inContent = false;
      continue;
    }

    if (/^[A-F][.．、)）]\s+/.test(trimmed) || 
        /^\*\*[A-F]\*\*[.．、)）]\s+/.test(trimmed) ||
        /^[A-F][.．、)）]\s*$/.test(trimmed)) {
      inContent = false;
      continue;
    }

    if (inContent || (!/^#{1,3}\s/.test(trimmed) && !/^\*\*/.test(trimmed))) {
      contentParts.push(trimmed);
    }
  }

  return contentParts.join('\n').trim();
}

function extractOptions(lines: string[]): { options: Option[]; labels: string[] } {
  const optionStartRegex = /^([A-F])[.．、)）\s]+(.+)$/;
  const optionStartBoldRegex = /^\*\*([A-F])\*\*[.．、)）\s]+(.+)$/;
  const optionLabelOnlyRegex = /^([A-F])[.．、)）]\s*$/;
  
  const optionMap = new Map<string, string>();
  let currentLabel: string | null = null;
  let currentText: string[] = [];

  const flushCurrentOption = () => {
    if (currentLabel && currentText.length > 0) {
      optionMap.set(currentLabel, currentText.join(' ').trim());
      currentLabel = null;
      currentText = [];
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();
    
    if (!trimmed) {
      if (currentLabel) {
        flushCurrentOption();
      }
      continue;
    }

    let match = trimmed.match(optionStartBoldRegex);
    if (match) {
      flushCurrentOption();
      currentLabel = match[1];
      currentText = [match[2].trim()];
      continue;
    }

    match = trimmed.match(optionStartRegex);
    if (match) {
      flushCurrentOption();
      currentLabel = match[1];
      currentText = [match[2].trim()];
      continue;
    }

    match = trimmed.match(optionLabelOnlyRegex);
    if (match) {
      flushCurrentOption();
      currentLabel = match[1];
      currentText = [];
      continue;
    }

    if (currentLabel) {
      if (/^[A-F][.．、)）]\s+/.test(trimmed) || 
          /^\*\*[A-F]\*\*[.．、)）]\s+/.test(trimmed) ||
          /^答案[：:]/.test(trimmed) ||
          /^解析[：:]/.test(trimmed)) {
        flushCurrentOption();
      } else {
        currentText.push(trimmed);
      }
    }
  }
  
  flushCurrentOption();

  const labels = Array.from(optionMap.keys()).sort();
  const options: Option[] = labels.map((label, idx) => ({
    label,
    text: optionMap.get(label) || '',
    originalIndex: idx,
  }));

  return { options, labels };
}

function extractAnswer(lines: string[]): string {
  const answerPatterns = [
    /答案[：:]\s*\**\s*([A-F]+)/,
    /答案[：:]\s*([A-F]+)/,
    /参考答案[：:]\s*([A-F]+)/,
    /正确答案[：:]\s*([A-F]+)/,
  ];
  
  for (const line of lines) {
    const trimmed = line.trim();
    for (const pattern of answerPatterns) {
      const match = trimmed.match(pattern);
      if (match) {
        return match[1].toUpperCase();
      }
    }
  }
  return '';
}

function extractExplanation(lines: string[]): string {
  const explanationPatterns = [
    /解析[：:]\s*\**\s*(.+)/,
    /解析[：:]\s*(.+)/,
    /答案解析[：:]\s*(.+)/,
    /分析[：:]\s*(.+)/,
    /详解[：:]\s*(.+)/,
  ];
  
  const explanationParts: string[] = [];
  let collectingExplanation = false;
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    if (!trimmed) {
      if (collectingExplanation && explanationParts.length > 0) {
        explanationParts.push('');
      }
      continue;
    }
    
    if (!collectingExplanation) {
      for (const pattern of explanationPatterns) {
        const match = trimmed.match(pattern);
        if (match) {
          if (match[1]) {
            explanationParts.push(match[1].trim());
          }
          collectingExplanation = true;
          break;
        }
      }
    } else {
      if (/^[A-F][.．、)）]\s+/.test(trimmed) || 
          /^\*\*[A-F]\*\*[.．、)）]\s+/.test(trimmed) ||
          /^答案[：:]/.test(trimmed)) {
        break;
      }
      explanationParts.push(trimmed);
    }
  }
  
  return explanationParts.join(' ').trim() || '暂无解析';
}

export function parseMarkdownWithValidation(markdown: string): ParseResult {
  const errors: ParseError[] = [];
  const blocks = splitIntoBlocks(markdown);
  const questions: Question[] = [];
  let validBlocks = 0;

  for (let blockIndex = 0; blockIndex < blocks.length; blockIndex++) {
    const rawBlock = blocks[blockIndex];
    const trimmedBlock = rawBlock.trim();
    if (!trimmedBlock) continue;

    const blockStartLine = markdown.split('\n').indexOf(trimmedBlock.split('\n')[0]);
    const lines = trimmedBlock.split('\n');

    const titleMatch = trimmedBlock.match(/^#{1,3}\s*(.+)/m);
    const title = titleMatch ? titleMatch[1].trim() : `第${questions.length + 1}题`;

    const { options, labels: optionLabels } = extractOptions(lines);

    if (options.length < 2) {
      errors.push({
        blockIndex: blockIndex + 1,
        lineNumber: blockStartLine + 1,
        lineContent: trimmedBlock.split('\n').slice(0, 3).join(' / '),
        message: `题目至少需要2个选项（A、B等），当前只找到 ${options.length} 个选项。请检查选项格式是否为 "A. 选项内容"`,
      });
      continue;
    }

    const expectedLabels: string[] = [];
    for (let i = 0; i < optionLabels.length; i++) {
      expectedLabels.push(String.fromCharCode(65 + i));
    }

    const hasGap = optionLabels.some((label, i) => label !== expectedLabels[i]);
    if (hasGap) {
      errors.push({
        blockIndex: blockIndex + 1,
        lineNumber: blockStartLine + 1,
        lineContent: optionLabels.map(l => `${l}. ...`).join(' | '),
        message: `选项编号不连续，期望 ${expectedLabels.join('、')}，实际为 ${optionLabels.join('、')}`,
      });
    }

    const answer = extractAnswer(lines);
    if (!answer) {
      errors.push({
        blockIndex: blockIndex + 1,
        lineNumber: blockStartLine + 1,
        lineContent: trimmedBlock.split('\n').slice(0, 3).join(' / '),
        message: '缺少"答案"行，需要使用 "答案：A" 或 "答案：AB" 格式',
      });
      continue;
    }

    const validAnswers = optionLabels.join('');
    const answerChars = answer.split('');
    let answerValid = true;
    for (const ch of answerChars) {
      if (!validAnswers.includes(ch)) {
        errors.push({
          blockIndex: blockIndex + 1,
          lineNumber: blockStartLine + 1,
          lineContent: `答案：${answer}`,
          message: `答案中的 "${ch}" 不在选项 ${optionLabels.join('、')} 中`,
        });
        answerValid = false;
      }
    }
    if (!answerValid) continue;

    const content = extractContent(lines);
    if (!content) {
      errors.push({
        blockIndex: blockIndex + 1,
        lineNumber: blockStartLine + 1,
        lineContent: title,
        message: '题目内容为空，请在标题和选项之间添加题干内容',
      });
    }

    const explanation = extractExplanation(lines);
    const type = answer.length === 1 ? 'single' : 'multi';

    validBlocks++;
    questions.push({
      id: `q${questions.length + 1}`,
      index: questions.length + 1,
      title,
      content: content || '（无题干）',
      options,
      answer,
      explanation,
      type,
    });
  }

  return {
    questions,
    errors,
    totalBlocks: blocks.filter(b => b.trim()).length,
    validBlocks,
  };
}
