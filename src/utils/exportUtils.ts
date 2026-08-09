import type { Question } from '../types';
import { getDisplayAnswerLabels } from './shuffleUtils';

export function generateQuestionsMarkdown(questions: Question[]): string {
  const lines: string[] = [];

  questions.forEach((q, index) => {
    lines.push(`${index + 1}. ${q.content}`);

    q.options.forEach((opt) => {
      lines.push(`   ${opt.label}. ${opt.text}`);
    });

    lines.push(`   答案：${q.answer}`);
    lines.push('');
  });

  return lines.join('\n');
}

export function generatePracticeMarkdown(questions: Question[]): string {
  const lines: string[] = [];

  questions.forEach((q, index) => {
    lines.push(`${index + 1}. ${q.content}`);

    q.options.forEach((opt) => {
      lines.push(`   ${opt.label}. ${opt.text}`);
    });

    lines.push('');
  });

  return lines.join('\n');
}

export function generateAnswerMarkdown(questions: Question[]): string {
  const lines: string[] = [];

  questions.forEach((q, index) => {
    lines.push(`${index + 1}. ${q.content}`);

    q.options.forEach((opt) => {
      lines.push(`   ${opt.label}. ${opt.text}`);
    });

    lines.push(`   答案：${getDisplayAnswerLabels(q)}`);
    if (q.explanation) {
      lines.push(`   解析：${q.explanation}`);
    }
    lines.push('');
  });

  return lines.join('\n');
}

export function exportBothFiles(
  baseName: string,
  questions: Question[]
): void {
  const practiceContent = generatePracticeMarkdown(questions);
  const answerContent = generateAnswerMarkdown(questions);

  downloadMarkdown(`${baseName}_练习.md`, practiceContent);
  downloadMarkdown(`${baseName}_答案解析.md`, answerContent);
}

export function downloadMarkdown(filename: string, content: string) {
  const isWeb = typeof window !== 'undefined';
  if (isWeb) {
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}