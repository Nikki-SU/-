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

function isQuestionHeader(trimmed: string): boolean {
  if (/第\s*\d+\s*题/.test(trimmed)) return true;
  if (/^\s*\d+[.．)）]/.test(trimmed)) return true;
  if (/^\s*\d+[、]/.test(trimmed)) return true;
  if (/Question/i.test(trimmed)) return true;
  if (/问题/.test(trimmed)) return true;
  if (/^\s*\d+\s*$/.test(trimmed)) return true;
  return false;
}

function findQuestionBoundaries(text: string): number[] {
  const lines = text.split('\n');

  const header2Boundaries: number[] = [];
  const header3Or1Boundaries: number[] = [];
  const fallbackBoundaries: number[] = [];

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();

    if (/^##\s+/.test(trimmed)) {
      if (isQuestionHeader(trimmed)) {
        header2Boundaries.push(i);
      }
    }

    if (/^#{1,3}\s+/.test(trimmed)) {
      if (isQuestionHeader(trimmed) || header3Or1Boundaries.length === 0) {
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
  let inTable = false;

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

    if (/^答案[：:]/.test(trimmed) || /^解析[：:]/.test(trimmed) || /^参考答案[：:]/.test(trimmed)) {
      inContent = false;
      continue;
    }

    if (/^逐一分析/.test(trimmed) || /^逐一解答/.test(trimmed) || /^分析[：:]/.test(trimmed)) {
      inContent = false;
      continue;
    }

    if (/^[A-F][.．、)）]\s+/.test(trimmed) || 
        /^[A-F][.．、)）]\S/.test(trimmed) ||
        /^\*\*[A-F]\*\*[.．、)）]\s+/.test(trimmed) ||
        /^[A-F][.．、)）]\s*$/.test(trimmed) ||
        /^-\s*\*\*[A-F]\*\*/.test(trimmed) ||
        /^-\s*[A-F][.．、)）]/.test(trimmed)) {
      inContent = false;
      continue;
    }

    if (/<table[^>]*>/i.test(trimmed)) {
      inTable = true;
    }
    if (inTable) {
      if (/<\/table>/i.test(trimmed)) {
        inTable = false;
      }
      continue;
    }

    if (/<\/tr>|<\/td>|<tr[^>]*>|<td[^>]*>/i.test(trimmed)) {
      continue;
    }

    if (/[A-F][.．、)）]\s*\S/.test(trimmed) && !/^#{1,3}\s/.test(trimmed) && !/^\*\*/.test(trimmed)) {
      const match = trimmed.match(/([A-F][.．、)）]\s*\S)/);
      if (match && trimmed.indexOf(match[0]) <= 5) {
        inContent = false;
        continue;
      }
    }

    if (inContent || (!/^#{1,3}\s/.test(trimmed) && !/^\*\*/.test(trimmed) && !/^-\s*\*\*[A-F]/.test(trimmed) && !/^-\s*[A-F][.．、)）]/.test(trimmed))) {
      contentParts.push(trimmed);
    }
  }

  return contentParts.join('\n').trim();
}

function extractOptionsFromHTML(lines: string[]): { options: Option[]; labels: string[] } | null {
  const fullText = lines.join('\n');
  const tableRegex = /<table[^>]*>([\s\S]*?)<\/table>/gi;
  const options: Option[] = [];
  let match;

  while ((match = tableRegex.exec(fullText)) !== null) {
    const innerHTML = match[1];
    const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let rowMatch;

    while ((rowMatch = rowRegex.exec(innerHTML)) !== null) {
      const rowHTML = rowMatch[1];
      const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
      const cells: string[] = [];
      let cellMatch;

      while ((cellMatch = cellRegex.exec(rowHTML)) !== null) {
        cells.push(cellMatch[1].trim());
      }

      if (cells.length >= 2) {
        const firstCell = cells[0].trim();
        if (/^[A-F]$/.test(firstCell)) {
          const label = firstCell;
          const text = cells.slice(1).join(' | ').trim();
          if (text) {
            options.push({
              label,
              text,
              originalIndex: options.length,
            });
          }
        }
      }
    }
  }

  if (options.length === 0) return null;

  const labels = options.map(o => o.label).sort();
  return { options, labels };
}

function extractOptionsFromSequential(lines: string[], existingLabels: string[]): { options: Option[]; labels: string[] } | null {
  if (existingLabels.length >= 2) return null;

  const optionMap = new Map<string, string>();
  const nonEmptyLines: string[] = [];
  let foundLabeledOption = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (/^#{1,3}\s+/.test(trimmed)) continue;
    if (/^答案[：:]/.test(trimmed) || /^解析[：:]/.test(trimmed)) break;
    if (/^[A-F][.．、)）]\s+/.test(trimmed) || /^\*\*[A-F]\*\*[.．、)）]\s+/.test(trimmed)) {
      foundLabeledOption = true;
      break;
    }
    if (!/<table|<\/table|<\/tr|<\/td/i.test(trimmed)) {
      nonEmptyLines.push(trimmed);
    }
  }

  if (foundLabeledOption) return null;
  if (nonEmptyLines.length < 2 || nonEmptyLines.length > 8) return null;

  for (let i = 0; i < nonEmptyLines.length; i++) {
    const label = String.fromCharCode(65 + i);
    optionMap.set(label, nonEmptyLines[i]);
  }

  const labels = Array.from(optionMap.keys()).sort();
  const options: Option[] = labels.map((label, idx) => ({
    label,
    text: optionMap.get(label) || '',
    originalIndex: idx,
  }));

  return { options, labels };
}

function extractOptionsFromSingleLine(lines: string[]): { options: Option[]; labels: string[] } | null {
  for (const line of lines) {
    const trimmed = line.trim();
    const matches = [];
    const regex = /([A-F])[.．、)）]([^\s])/g;
    let m;
    while ((m = regex.exec(trimmed)) !== null) {
      matches.push({ label: m[1], index: m.index });
    }
    if (matches.length >= 2) {
      const optionMap = new Map<string, string>();
      for (let i = 0; i < matches.length; i++) {
        const current = matches[i];
        const startIdx = current.index + 2;
        let endIdx = trimmed.length;
        if (i < matches.length - 1) {
          endIdx = matches[i + 1].index;
        }
        const text = trimmed.slice(startIdx, endIdx).trim();
        optionMap.set(current.label, text);
      }
      if (optionMap.size >= 2) {
        const labels = Array.from(optionMap.keys()).sort();
        const options: Option[] = labels.map((label, idx) => ({
          label,
          text: optionMap.get(label) || '',
          originalIndex: idx,
        }));
        return { options, labels };
      }
    }
  }
  return null;
}

function extractOptions(lines: string[]): { options: Option[]; labels: string[] } {
  const optionStartRegex = /^([A-F])[.．、)）\s]+(.+)$/;
  const optionStartNoSpaceRegex = /^([A-F])[.．、)）]([^\s])/;
  const optionStartBoldRegex = /^\*\*([A-F])\*\*[.．、)）\s]+(.+)$/;
  const optionLabelOnlyRegex = /^([A-F])[.．、)）]\s*$/;
  const embeddedOptionRegex = /([A-F])[.．、)）](\s+|[^\s])/;
  
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

    if (/^答案[：:]/.test(trimmed) || /^参考答案[：:]/.test(trimmed) || /^正确答案[：:]/.test(trimmed)) {
      if (currentLabel) flushCurrentOption();
      break;
    }

    if (/<table[\s\S]*?<\/table>/i.test(trimmed)) {
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

    match = trimmed.match(optionStartNoSpaceRegex);
    if (match) {
      flushCurrentOption();
      currentLabel = match[1];
      const idx = trimmed.indexOf(match[0]);
      currentText = [trimmed.slice(idx + match[0].length).trim()];
      continue;
    }

    match = trimmed.match(optionLabelOnlyRegex);
    if (match) {
      flushCurrentOption();
      currentLabel = match[1];
      currentText = [];
      continue;
    }

    const embeddedMatch = trimmed.match(embeddedOptionRegex);
    if (embeddedMatch && !currentLabel) {
      const label = embeddedMatch[1];
      const idx = trimmed.indexOf(`${label}.`);
      if (idx >= 0) {
        const afterLabel = trimmed.slice(idx + 2);
        if (afterLabel.length > 0 && !/^\s*[A-F][.．、)）]/.test(afterLabel)) {
          flushCurrentOption();
          currentLabel = label;
          currentText = [afterLabel.trim()];
          continue;
        }
      }
    }

    if (currentLabel) {
      if (/^[A-F][.．、)）]\s+/.test(trimmed) || 
          /^[A-F][.．、)）]\S/.test(trimmed) ||
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

  for (const [label, text] of [...optionMap.entries()]) {
    const nextLabelRegex = /([A-F])[.．、)）]([^\s])/g;
    const matches = [];
    let nm;
    while ((nm = nextLabelRegex.exec(text)) !== null) {
      matches.push({ label: nm[1], index: nm.index });
    }
    if (matches.length > 0) {
      const firstMatch = matches[0];
      const cleanFirstText = text.slice(0, firstMatch.index).trim();
      optionMap.set(label, cleanFirstText);
      
      for (const m of matches) {
        const startIdx = m.index + 2;
        let endIdx = text.length;
        const nextMatch = matches.find(x => x.index > m.index);
        if (nextMatch) {
          endIdx = nextMatch.index;
        }
        const partText = text.slice(startIdx, endIdx).trim();
        if (!optionMap.has(m.label)) {
          optionMap.set(m.label, partText);
        }
      }
    }
  }

  const labels = Array.from(optionMap.keys()).sort();
  const options = labels.map((label, idx) => ({
    label,
    text: optionMap.get(label) || '',
    originalIndex: idx,
  }));

  if (options.length < 2) {
    const singleLineOptions = extractOptionsFromSingleLine(lines);
    if (singleLineOptions && singleLineOptions.options.length >= 2) {
      return singleLineOptions;
    }
  }

  if (options.length < 2) {
    const htmlResult = extractOptionsFromHTML(lines);
    if (htmlResult && htmlResult.options.length >= 2) {
      return htmlResult;
    }
  }

  if (options.length < 2) {
    const seqResult = extractOptionsFromSequential(lines, labels);
    if (seqResult && seqResult.options.length >= 2) {
      return seqResult;
    }
  }

  if (options.length < 2 && embeddedOptionRegex.test(lines.join('\n'))) {
    const allText = lines.join('\n');
    const optionRegex = /([A-F])[.．、)）](\s+|[^\s])/g;
    let m;
    const tempMap = new Map<string, string>();
    while ((m = optionRegex.exec(allText)) !== null) {
      const label = m[1];
      if (!tempMap.has(label)) {
        const startIdx = allText.indexOf(`${label}.`);
        const nextLabels = ['A', 'B', 'C', 'D', 'E', 'F'];
        let endIdx = allText.length;
        for (const nl of nextLabels) {
          if (nl !== label) {
            const nextIdx = allText.indexOf(`${nl}.`, startIdx + 2);
            if (nextIdx > startIdx && nextIdx < endIdx) endIdx = nextIdx;
          }
        }
        const text = allText.slice(startIdx + 2, endIdx).replace(/\n$/, '').trim();
        tempMap.set(label, text);
      }
    }
    if (tempMap.size >= 2) {
      labels = Array.from(tempMap.keys()).sort();
      options = labels.map((label, idx) => ({
        label,
        text: tempMap.get(label) || '',
        originalIndex: idx,
      }));
      return { options, labels };
    }
  }

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
    const validAnswerChars = answerChars.filter(ch => validAnswers.includes(ch));
    let answerValid = true;
    if (validAnswerChars.length === 0 && answerChars.length > 0) {
      errors.push({
        blockIndex: blockIndex + 1,
        lineNumber: blockStartLine + 1,
        lineContent: `答案：${answer}`,
        message: `答案 "${answer}" 中的所有字符均不在选项 ${optionLabels.join('、')} 中，使用第一个选项作为答案`,
      });
      answerValid = false;
    } else if (validAnswerChars.length < answerChars.length) {
      errors.push({
        blockIndex: blockIndex + 1,
        lineNumber: blockStartLine + 1,
        lineContent: `答案：${answer}`,
        message: `答案中的部分字符（${answerChars.filter(ch => !validAnswers.includes(ch)).join('、')}）不在选项 ${optionLabels.join('、')} 中，已忽略`,
      });
    }

    const effectiveAnswer = validAnswerChars.length > 0 ? validAnswerChars.join('') : (optionLabels[0] || 'A');

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
    const type = effectiveAnswer.length === 1 ? 'single' : 'multi';

    const answerContent = effectiveAnswer.split('').map((label) => {
      const opt = options.find(o => o.label === label);
      return opt ? opt.text : '';
    }).filter(Boolean).join('|||');

    validBlocks++;
    questions.push({
      id: `q${questions.length + 1}`,
      index: questions.length + 1,
      title,
      content: content || '（无题干）',
      options,
      answer: effectiveAnswer,
      answerContent,
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
