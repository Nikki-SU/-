# 题库刷题 App 项目情况

## 一、项目概述

### 项目类型
- React Native + Expo + TypeScript Web 应用
- 题库刷题软件，支持多题库管理

### 核心功能
1. **题库管理**：导入、删除、切换题库
2. **答题模式**：单选题、多选题
3. **错题本**：收集错题、错题重做、按来源分类
4. **收藏库**：收藏题目、收藏练习、按来源分类
5. **进度追踪**：答题进度、正确率统计
6. **数据持久化**：文件系统存储、ZIP 导入导出

### 技术栈
- **前端框架**：React Native (Expo)
- **状态管理**：Zustand
- **样式方案**：StyleSheet.create + 响应式函数
- **数据存储**：FileSystem Access API + IndexedDB
- **压缩工具**：JSZip
- **Markdown 导出**：自定义格式生成

---

## 二、项目结构

```
/workspace
├── App.tsx                    # 主入口
├── src/
│   ├── components/            # 组件目录
│   │   ├── QuestionCard.tsx   # 答题卡片（核心组件）
│   │   ├── OptionButton.tsx   # 选项按钮
│   │   ├── TopBar.tsx         # 顶部栏（进度、收藏、导出）
│   │   ├── ProgressBoard.tsx  # 进度面板
│   │   ├── BottomBar.tsx      # 底部操作栏
│   │   ├── ExplanationPage.tsx # 解析页
│   │   ├── SummaryPage.tsx    # 完成总结页
│   │   ├── HomePage.tsx       # 首页
│   │   └── Toast.tsx          # 提示组件
│   ├── stores/
│   │   └── useAppStore.ts     # 全局状态管理
│   ├── utils/
│   │   ├── responsive.ts      # 响应式布局工具
│   │   ├── fileStorage.ts     # 文件存储工具
│   │   ├── zipUtils.ts        # ZIP 压缩工具
│   │   ├── exportUtils.ts     # 导出工具
│   │   ├── answerChecker.ts   # 答案检查工具
│   │   └── shuffleUtils.ts    # 乱序工具
│   └── types/
│       └── index.ts           # 类型定义
└── package.json
```

---

## 三、核心业务逻辑

### 3.1 答题流程

```
答题阶段 (answer)
    ↓
用户选择答案
    ↓
判断对错
    ↓
┌─ 正确答案 → 显示绿色标记 → 1秒后自动下一题
│
└─ 错误/部分正确 → 显示红色/黄色标记 → 1秒后跳转到解析页
                                      ↓
                               显示解析内容
                                      ↓
                               用户点击任意位置
                                      ↓
                               进入下一题
```

### 3.2 选项颜色标记规则

| 状态 | 颜色 | 说明 |
|------|------|------|
| 正确答案（单选） | 🟢 绿色 | 用户选对了 |
| 错误答案 | 🔴 红色 | 用户选错了 |
| 多选漏选 | 🟡 黄色 | 应该选但没选 |
| 多选选对 | 🟢 绿色 | 应该选且选了 |
| 多选错选 | 🔴 红色 | 不该选但选了 |

### 3.3 错题本规则

1. **进入错题本**：错题在原始题库中标记为"已锁定"，在错题本中为"未作答"
2. **刷题流程**：
   - 用户在错题本中重新作答
   - 答对 → 从错题本移除，原始题库标记为"正确"
   - 答错 → 保留在错题本，本轮结束后重置为"未作答"
3. **多轮迭代**：错题可以多轮重做，直到全部清空

### 3.4 收藏库规则

1. **收藏操作**：点击星标按钮收藏当前题目
2. **收藏练习**：可以在收藏库中刷题
3. **收藏特点**：
   - 收藏的题目不会自动移出
   - 支持按来源题库分类
   - 支持清空进度

### 3.5 选项乱序规则

- **触发时机**：
  - 进入错题库/收藏库的每一轮
  - 清空进度后重新开始
- **乱序算法**：Fisher-Yates 洗牌算法
- **目的**：防止用户记住选项位置，而忽视选项内容

---

## 四、数据存储方案

### 4.1 存储架构

```
浏览器
  ↓
FileSystem Access API（用户选择目录）
  ↓
文件系统存储
├── questions/           # 题库文件
│   ├── bank_001.csv
│   └── bank_002.csv
├── progress/           # 进度文件
│   ├── progress_001.json
│   └── progress_002.json
├── wrong_bank.json      # 错题本数据
└── favorites.json       # 收藏数据

IndexedDB（仅存储目录句柄）
  ↓
localStorage（仅存储路径信息）
```

### 4.2 导入导出

#### 导出
- **格式**：ZIP 压缩包
- **内容**：所有题库、进度、错题本、收藏数据
- **包含**：说明文件（export_readme.txt）
- **用途**：跨设备数据迁移、备份

#### 导入
- **支持格式**：ZIP、CSV、Markdown
- **自动恢复**：打开网页时自动读取已保存的数据

### 4.3 Markdown 导出格式

```markdown
# 题库名_练习题

1. 题目内容
A. 选项A
B. 选项B
C. 选项C
D. 选项D

2. 题目内容
...
```

- 选项一行一个
- 题目间空一行
- 普通编号（1、2、3...）

---

## 五、响应式布局方案

### 5.1 当前实现（纯百分比方案）

```typescript
import { Dimensions } from 'react-native';

// 宽度百分比
export const widthPercent = (percent: number): number => {
  const { width } = Dimensions.get('window');
  return (percent / 100) * width;
};

// 高度百分比
export const heightPercent = (percent: number): number => {
  const { height } = Dimensions.get('window');
  return (percent / 100) * height;
};

// 字体百分比
export const fontSizePercent = (percent: number): number => {
  const { width } = Dimensions.get('window');
  return (percent / 100) * width;
};

// 预设尺寸
export const small = { xs: widthPercent(1), sm: widthPercent(1.5), md: widthPercent(2), lg: widthPercent(3), xl: widthPercent(4) };
export const fontSmall = { xs: fontSizePercent(2.5), sm: fontSizePercent(3), md: fontSizePercent(3.5), lg: fontSizePercent(4), xl: fontSizePercent(5) };
export const heightSmall = { xs: heightPercent(0.5), sm: heightPercent(1), md: heightPercent(1.5), lg: heightPercent(2), xl: heightPercent(3) };
```

### 5.2 使用示例

```typescript
const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: widthPercent(3),  // 屏幕宽度的 3%
    paddingVertical: heightPercent(2),   // 屏幕高度的 2%
  },
  title: {
    fontSize: fontSizePercent(4),        // 屏幕宽度的 4%
  },
  button: {
    padding: small.md,                   // 使用预设值
  },
});
```

### 5.3 布局原则

1. **无设计稿基准**：所有尺寸都是相对于当前屏幕的百分比
2. **整体布局**：使用 flex 布局分配空间
3. **选项区域**：`flex: 1` + `justifyContent: 'space-evenly'`
4. **减少滚动**：大部分内容一屏显示
5. **允许滚动**：仅在内容过长时允许滚动
6. **预设值**：使用 `small.*`、`fontSmall.*`、`heightSmall.*` 快速设置常见尺寸

---

## 六、主要文件说明

### useAppStore.ts（核心状态管理）

**状态管理内容**：
- `phase`：答题阶段（answer/feedback/explanation）
- `questions`：题目列表
- `progressMap`：进度映射
- `favoritesIds`：收藏题目 ID
- `wrongBankIds`：错题 ID
- `banks`：题库列表
- `currentIndex`：当前题目索引

**主要方法**：
- `selectOption()`：选择选项
- `submitAnswer()`：提交答案（多选）
- `advanceToNextQuestion()`：下一题
- `toggleFavorite()`：切换收藏
- `markDontKnow()`：标记为不会
- `exportAllData()`：导出所有数据
- `importAllData()`：导入数据

### QuestionCard.tsx（答题卡片）

**渲染逻辑**：
1. `showExplanation = true` 时显示解析页
2. 答题中显示题目和选项
3. 选项根据状态显示不同颜色

**交互逻辑**：
- 已锁定时点击卡片 → 下一题
- 多选时显示提交按钮
- 显示/隐藏解析按钮

### fileStorage.ts（文件存储）

**主要功能**：
- `selectDataDirectory()`：选择存储目录
- `autoRestoreDirectory()`：自动恢复目录
- `loadBanksFromFiles()`：从文件加载题库
- `saveBankToFile()`：保存题库到文件
- `saveProgressToFile()`：保存进度

---

## 七、已知问题与待优化

### 7.1 功能问题

1. **错题库分支显示**：点击进入后应显示所有分支，而非仅当前分支
2. **刷题跳转**：从错题库/收藏库点击"刷题"应刷对应分支的题
3. **数据恢复**：浏览器重新打开时数据恢复不完整

### 7.2 体验问题

1. **滑动与点击区分**：解析页滑动时可能误触跳转
2. **响应式验证**：需要在不同屏幕尺寸下测试
3. **加载体验**：首次加载时间较长

### 7.3 待增强功能

1. **批量操作**：批量删除收藏、批量清空进度
2. **统计图表**：更丰富的学习统计
3. **同步功能**：云端同步（远期目标）

---

## 八、开发注意事项

### 8.1 推送规则

```bash
# 仓库地址
git remote add origin https://${TOKEN}@github.com/Nikki-SU/-.git

# API Token（需要时由用户提供）
export TOKEN=your_token_here

# 推送命令
git push -u origin main
```

### 8.2 开发命令

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run web

# 构建生产版本
npm run build
```

### 8.3 代码规范

1. 使用 TypeScript 类型定义
2. 使用函数式组件 + Hooks
3. 使用 Zustand 管理状态
4. 使用响应式布局函数
5. 不使用硬编码像素值

### 8.4 测试要点

1. 单选题作答流程
2. 多选题作答流程
3. 错题重做流程
4. 收藏练习流程
5. 数据导入导出
6. 响应式布局适配
7. 不同浏览器兼容性

---

## 九、联系与维护

- **仓库地址**：https://github.com/Nikki-SU/-
- **技术支持**：通过 GitHub Issues
- **开发模式**：React Native (Web)
