/**
 * 与解析器严格对齐的 AI 题库生成 Prompt。
 *
 * 说明：本 App 的 Markdown 解析器（src/utils/markdownParser.ts）实际接受的规则为：
 *  - 题目之间用单独一行 “---” 分隔（preprocess 会先去掉 ** 、* 、` 等强调符号）
 *  - 标题形如 “## 第N题”
 *  - 选项逐行形如 “A. 内容”，字母从 A 起连续、不得跳号；每题至少 2 个选项
 *  - 答案行形如 “答案：B”（单选）或 “答案：ABD”（多选，按字母顺序连写）
 *  - 解析行形如 “解析：内容”
 * 因此 Prompt 必须把这些规则原样告诉 AI，保证生成结果能被 100% 解析。
 */
export const AI_GENERATOR_PROMPT = `你是资深题库编写专家。请严格按下方《题库格式规范》生成 Markdown 题库，生成结果必须能被解析程序逐题正确解析。

════════ 题库格式规范（Markdown）════════

【结构】每道题固定由 5 部分组成，顺序不可变：
① 标题行 → ② 题干 → ③ 选项行 → ④ 答案行 → ⑤ 解析行
相邻两道题之间，必须用单独一行 --- 作为分隔线。

【逐项规则】
1. 标题行：写成 “## 第N题”，N 从 1 开始、连续递增，不得跳号或重复。
2. 题干：写在标题行下方、选项上方，可一行或多行，使用纯文本；不要使用任何 Markdown 强调符号（不要 ** 、* 、# 、> 、\` ）。
3. 选项：每个选项独占一行，格式为「字母. 空格 选项内容」，例如 “A. 选项内容”。字母必须从 A 开始连续排列（A、B、C、D…），不得跳号、缺号；每题至少 2 个选项，建议 4 个。
4. 答案行：格式为 “答案：X”。单选题写 1 个字母（如 答案：B）；多选题写多个字母、按字母顺序连写、中间不加空格或逗号（如 答案：ABD）。答案字母必须真实存在于本题的选项字母中。
5. 解析行：格式为 “解析：内容”，写在同一行内、纯文本，不要加粗、不要换行。

【分隔符】
相邻两题之间必须有且仅有一行内容为 --- 的分隔线；第一题之前不要写 ---。

【严禁事项】
- 禁止使用表格、HTML 标签、图片、引用块、代码块。
- 禁止在答案或解析中使用 ** 加粗等任何 Markdown 语法。
- 禁止选项跳号、字母重复、或出现题目中不存在的答案字母。

════════ 标准范例（请完全模仿）════════

## 第1题
React 中用于在函数组件内添加状态的是哪个 Hook？

A. useEffect
B. useState
C. useContext
D. useMemo

答案：B
解析：useState 返回状态值与更新函数，是函数组件添加状态的标准 Hook。

---

## 第2题
以下哪些属于 React 的内置 Hook？

A. useState
B. useEffect
C. useFetch
D. useMemo

答案：ABD
解析：useState、useEffect、useMemo 均为 React 内置 Hook，useFetch 需要借助第三方库实现。

════════ 本次生成任务 ════════

请以「{{主题}}」为主题，严格按上述规范生成 {{N}} 道题目（其中单选题 {{单选数}} 道、多选题 {{多选数}} 道）。
只输出题目正文本身，不要输出任何前言、说明、总标题或结语。`;

export function buildPrompt(topic: string, totalCount: number, multiCount: number = 0): string {
  const singleCount = totalCount - multiCount;
  return AI_GENERATOR_PROMPT
    .replace('{{主题}}', topic)
    .replace('{{N}}', String(totalCount))
    .replace('{{单选数}}', String(singleCount))
    .replace('{{多选数}}', String(multiCount));
}
