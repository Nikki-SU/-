export const AI_GENERATOR_PROMPT = `你是一名专业的题库编写助手。请将以下主题/知识点生成符合指定格式的 Markdown 题库。

## 输出格式要求

严格按照以下Markdown格式生成题目，每道题用 --- 分隔：

---
## 第1题
这里写题干内容，可以是一句话或一个问题

A. 选项A的具体内容
B. 选项B的具体内容
C. 选项C的具体内容
D. 选项D的具体内容

**答案：** B
**解析：** 这里写答案的解析内容
---

## 严格格式规则
1. 每道题之间必须用 --- 作为分隔符
2. 每道题标题必须是 ## 第N题（N为数字序号）
3. 题干写在标题下方、选项上方
4. 选项必须以字母A. B. C. D. 依次排列，字母后加英文句点和空格
5. 单选题答案格式：**答案：** 单个大写字母（如 B）
6. 多选题答案格式：**答案：** 多个大写字母连写（如 ABD），按字母顺序
7. 解析格式：**解析：** 解析内容
8. 每个题目至少4个选项
9. 题干简洁清晰，建议控制在50字以内
10. 每题必须有答案和解析

## 单选题示例

---
## 第1题
React中用于在函数组件中添加内部状态的Hook是？

A. useEffect
B. useState
C. useContext
D. useMemo

**答案：** B
**解析：** useState是React中用于在函数组件中添加状态的Hook，它返回一个状态值和一个更新函数。
---

## 多选题示例

---
## 第2题
以下哪些是React的内置Hook？（多选）

A. useState
B. useEffect
C. useFetch
D. useMemo

**答案：** ABD
**解析：** useState、useEffect、useMemo都是React内置的Hook。useFetch不是React内置的，需要使用第三方库。
---

请根据以上格式，为"{{主题}}"生成 {{N}} 道题目，其中包含 {{单选数}} 道单选题和 {{多选数}} 道多选题。`;

export function buildPrompt(topic: string, totalCount: number, multiCount: number = 0): string {
  const singleCount = totalCount - multiCount;
  return AI_GENERATOR_PROMPT
    .replace('{{主题}}', topic)
    .replace('{{N}}', String(totalCount))
    .replace('{{单选数}}', String(singleCount))
    .replace('{{多选数}}', String(multiCount));
}
