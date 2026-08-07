import type { Question, Option } from '../types';

export function parseMarkdownToQuestions(markdown: string): Question[] {
  const blocks = markdown.split('\n---\n').filter((s) => s.trim());

  return blocks.map((block, index) => {
    const lines = block.split('\n').filter((s) => s.trim());
    const optionRegex = /^([A-F])\.\s+(.+)$/;

    const titleLine = lines.find((l) => l.startsWith('# '));
    const title = titleLine || `# 第${index + 1}题`;

    const optionLines = lines.filter((l) => optionRegex.test(l.trim()));
    const options: Option[] = optionLines.map((l) => {
      const match = l.trim().match(optionRegex);
      return { label: match![1], text: match![2] };
    });

    const answerLine = lines.find((l) => /答案[：:]\s*/.test(l));
    const answer = answerLine
      ? answerLine.replace(/答案[：:]\s*/, '').trim().toUpperCase()
      : '';

    const explanationLine = lines.find((l) => /解析[：:]\s*/.test(l));
    const explanation = explanationLine
      ? explanationLine.replace(/解析[：:]\s*/, '').trim()
      : '暂无解析';

    const firstOptionIndex = lines.findIndex((l) => optionRegex.test(l.trim()));
    const contentLines = lines.slice(
      titleLine ? 1 : 0,
      firstOptionIndex === -1 ? lines.length : firstOptionIndex
    ).filter((l) => !/解析[：:]/.test(l) && !/答案[：:]/.test(l));
    const content = contentLines.join('\n').trim();

    return {
      id: `q${index + 1}`,
      index: index + 1,
      title,
      content,
      options,
      answer,
      explanation,
      type: answer.length === 1 ? 'single' : 'multi',
    };
  });
}