import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput } from 'react-native';
import { useAppStore } from '../stores/useAppStore';

const SAMPLE_MARKDOWN = `# 第1题
以下哪个是React Native的核心优势？
A. 只能用于iOS开发
B. 跨平台开发
C. 不支持热更新
D. 性能比原生代码更好
答案：B
解析：React Native的核心优势是跨平台开发，一套代码可以同时在iOS和Android上运行。

---
# 第2题
以下哪些是JavaScript中的基本数据类型？
A. String
B. Number
C. Array
D. Boolean
E. Object
答案：ABD
解析：JavaScript的基本数据类型包括String、Number、Boolean、Null、Undefined、Symbol和BigInt。Array和Object属于引用类型。

---
# 第3题
React Hooks中，用于管理副作用的是？
A. useState
B. useEffect
C. useContext
D. useRef
答案：B
解析：useEffect用于处理副作用，如数据获取、订阅、DOM操作等。它会在组件渲染后执行。

---
# 第4题
以下哪些方式可以优化React应用的性能？
A. 使用React.memo
B. 使用useMemo
C. 使用useCallback
D. 增加不必要的重渲染
答案：ABC
解析：React.memo、useMemo和useCallback都是常用的性能优化手段，可以减少不必要的重渲染。

---
# 第5题
TypeScript中，interface和type的主要区别是？
A. interface可以声明合并，type不行
B. type可以声明合并，interface不行
C. 两者完全相同
D. interface只能用于类
答案：A
解析：interface支持声明合并，多次定义同名interface会自动合并。type则不行，重复定义会报错。

---
# 第6题
以下哪个不是React的内置Hook？
A. useState
B. useEffect
C. useFetch
D. useMemo
答案：C
解析：useFetch不是React内置Hook，这是自定义Hook的常见命名。

---
# 第7题
JavaScript中，以下哪些是异步编程的方式？
A. Callback
B. Promise
C. async/await
D. setTimeout
答案：ABCD
解析：四种都是异步编程方式。Callback是回调，Promise是Promise对象，async/await是基于Promise的语法糖，setTimeout是定时器。

---
# 第8题
以下哪个CSS属性用于控制元素显示/隐藏且不占空间？
A. display: none
B. visibility: hidden
C. opacity: 0
D. overflow: hidden
答案：A
解析：display: none使元素完全消失，不占空间。visibility: hidden和opacity: 0虽然看不见但仍占空间。

---
# 第9题
React Native中，StyleSheet.create的主要作用是什么？
A. 创建全局样式变量
B. 优化性能，在JS和Native之间共享样式引用
C. 动态创建样式
D. 定义主题
答案：B
解析：StyleSheet.create用于创建不可变的样式表，可在JS和Native之间共享引用以优化性能。

---
# 第10题
以下哪些是Redux Toolkit的特性？
A. 自动生成action types
B. 支持createSlice简化reducer编写
C. 内置thunk中间件
D. 必须手动定义action types
答案：ABC
解析：Redux Toolkit简化了Redux开发，自动生成action types，提供createSlice，内置thunk中间件。选项D是传统Redux的做法。

---
# 第11题
Expo中，以下哪个命令用于启动开发服务器？
A. expo start
B. expo build
C. expo init
D. expo publish
答案：A
解析：expo start启动开发服务器，expo build打包，expo init初始化项目，expo publish发布到 Expo 服务器。

---
# 第12题
以下哪些是React Native常用的导航库？
A. React Navigation
B. React Native Router Flux
C. React Router DOM
D. React Native Navigation
答案：ABD
解析：React Router DOM 是 Web 专用，其他三个都是 RN 导航库。

---
# 第13题
JavaScript中，typeof null的结果是什么？
A. "null"
B. "undefined"
C. "object"
D. "number"
答案：C
解析：这是JavaScript的一个历史遗留bug，typeof null返回"object"。

---
# 第14题
以下哪些是有效的React Native组件？
A. Class Component
B. Function Component
C. PureComponent
D. Struct Component
答案：ABC
解析：React Native支持Class Component、Function Component和PureComponent，没有Struct Component这种组件类型。

---
# 第15题
Git中，以下哪个命令用于撤销所有未提交的更改？
A. git reset --hard
B. git clean
C. git checkout
D. git revert
答案：A
解析：git reset --hard会丢弃所有未提交的更改。git clean用于删除未跟踪文件，git checkout用于切换分支或恢复文件，git revert用于创建新提交来撤销更改。

---
# 第16题
以下哪些是ES6新增的特性？
A. let/const
B. Arrow Functions
C. var关键字
D. Template Literals
答案：ABD
解析：var关键字是ES5就有的，let/const、箭头函数和模板字符串都是ES6新增的。

---
# 第17题
React中，key属性的主要作用是什么？
A. 美化代码
B. 帮助React识别列表中哪些元素改变了
C. 设置样式
D. 传递数据
答案：B
解析：key帮助React高效更新虚拟DOM，识别列表中元素的变化。

---
# 第18题
以下哪个不是有效的HTTP方法？
A. GET
B. POST
C. FETCH
D. DELETE
答案：C
解析：FETCH不是HTTP方法，它是JavaScript的API。标准HTTP方法包括GET、POST、PUT、DELETE、PATCH等。`;

export default function HomePage() {
  const [showEditor, setShowEditor] = useState(false);
  const [markdownText, setMarkdownText] = useState('');
  const loadQuestionsFromMarkdown = useAppStore(
    (state) => state.loadQuestionsFromMarkdown
  );
  const questions = useAppStore((state) => state.questions);
  const loadFromCSV = useAppStore((state) => state.loadFromCSV);
  const showToast = useAppStore((state) => state.showToast);
  const setShowSummary = useAppStore((state) => state.setShowSummary);

  const handleImport = async () => {
    if (!markdownText.trim()) {
      showToast('请输入Markdown内容');
      return;
    }
    await loadQuestionsFromMarkdown(markdownText);
    setShowEditor(false);
    setMarkdownText('');
  };

  const handleLoadSample = async () => {
    await loadQuestionsFromMarkdown(SAMPLE_MARKDOWN);
  };

  const handleStartCSV = async () => {
    await loadFromCSV();
    const state = useAppStore.getState();
    if (state.questions.length === 0) {
      showToast('未找到本地数据，请先导入题库');
    } else {
      showToast(`已加载 ${state.questions.length} 道题`);
    }
  };

  const handleGoQuiz = () => {
    setShowSummary(false);
  };

  if (showEditor) {
    return (
      <View style={styles.container}>
        <View style={styles.editorHeader}>
          <TouchableOpacity onPress={() => setShowEditor(false)}>
            <Text style={styles.backButton}>← 返回</Text>
          </TouchableOpacity>
          <Text style={styles.editorTitle}>编辑Markdown题库</Text>
          <TouchableOpacity
            onPress={() => setMarkdownText(SAMPLE_MARKDOWN)}
          >
            <Text style={styles.sampleButton}>示例</Text>
          </TouchableOpacity>
        </View>

        <TextInput
          style={styles.textInput}
          multiline
          numberOfLines={15}
          placeholder="在此粘贴Markdown格式的题库..."
          value={markdownText}
          onChangeText={setMarkdownText}
        />

        <TouchableOpacity
          style={styles.importButton}
          onPress={handleImport}
        >
          <Text style={styles.importButtonText}>导入题库</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>📚 刷题App</Text>
        <Text style={styles.subtitle}>选择一个开始方式</Text>
      </View>

      {questions.length > 0 ? (
        <View style={styles.existingDataSection}>
          <Text style={styles.existingDataText}>
            已有题库：{questions.length} 道题
          </Text>
          <TouchableOpacity
            style={styles.startButton}
            onPress={handleGoQuiz}
          >
            <Text style={styles.startButtonText}>继续上次答题</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <View style={styles.menuSection}>
        <TouchableOpacity
          style={[styles.menuButton, styles.primaryButton]}
          onPress={() => setShowEditor(true)}
        >
          <Text style={styles.menuIcon}>📝</Text>
          <Text style={styles.menuButtonText}>导入Markdown题库</Text>
          <Text style={styles.menuButtonDesc}>
            从.md文件导入选择题
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.menuButton, styles.secondaryButton]}
          onPress={handleLoadSample}
        >
          <Text style={styles.menuIcon}>✨</Text>
          <Text style={styles.secondaryButtonText}>使用示例题库</Text>
          <Text style={styles.menuButtonDesc}>
            快速体验，包含4道示例题
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.menuButton, styles.tertiaryButton]}
          onPress={handleStartCSV}
        >
          <Text style={styles.menuIcon}>📂</Text>
          <Text style={styles.tertiaryButtonText}>加载本地数据</Text>
          <Text style={styles.menuButtonDesc}>
            从CSV文件恢复进度
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
    padding: '5%',
  },
  header: {
    alignItems: 'center',
    marginTop: '15%',
    marginBottom: '10%',
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: '3%',
  },
  subtitle: {
    fontSize: 16,
    color: '#666666',
  },
  existingDataSection: {
    backgroundColor: '#E3F2FD',
    padding: '4%',
    borderRadius: 12,
    marginBottom: '8%',
    alignItems: 'center',
  },
  existingDataText: {
    fontSize: 16,
    color: '#1565C0',
    marginBottom: '3%',
  },
  startButton: {
    backgroundColor: '#4A90D9',
    paddingHorizontal: '8%',
    paddingVertical: '3%',
    borderRadius: 8,
  },
  startButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  menuSection: {
    marginTop: '5%',
  },
  menuButton: {
    padding: '6%',
    borderRadius: 16,
    marginBottom: '4%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  primaryButton: {
    backgroundColor: '#4A90D9',
  },
  secondaryButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#FF9800',
  },
  tertiaryButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#4CAF50',
  },
  menuIcon: {
    fontSize: 32,
    marginBottom: '2%',
  },
  menuButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: '1%',
  },
  secondaryButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: '1%',
  },
  tertiaryButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: '1%',
  },
  menuButtonDesc: {
    fontSize: 14,
    color: '#666666',
  },
  editorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '4%',
  },
  backButton: {
    fontSize: 16,
    color: '#4A90D9',
  },
  editorTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
  },
  sampleButton: {
    fontSize: 16,
    color: '#FF9800',
  },
  textInput: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: '4%',
    fontSize: 14,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  importButton: {
    backgroundColor: '#4A90D9',
    padding: '5%',
    borderRadius: 12,
    marginTop: '4%',
    alignItems: 'center',
  },
  importButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
});