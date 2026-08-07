import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, Alert } from 'react-native';
import * as FileSystem from 'expo-file-system';
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
解析：React.memo、useMemo和useCallback都是常用的性能优化手段，可以减少不必要的重渲染。`;

export default function HomePage() {
  const [showEditor, setShowEditor] = useState(false);
  const [markdownText, setMarkdownText] = useState('');
  const loadQuestionsFromMarkdown = useAppStore(
    (state) => state.loadQuestionsFromMarkdown
  );
  const questions = useAppStore((state) => state.questions);
  const loadFromCSV = useAppStore((state) => state.loadFromCSV);
  const showToast = useAppStore((state) => state.showToast);

  const handleImport = async () => {
    if (!markdownText.trim()) {
      showToast('请输入Markdown内容');
      return;
    }
    await loadQuestionsFromMarkdown(markdownText);
    setShowEditor(false);
    setMarkdownText('');
  };

  const handleLoadSample = () => {
    setMarkdownText(SAMPLE_MARKDOWN);
  };

  const handleStartCSV = async () => {
    await loadFromCSV();
    const state = useAppStore.getState();
    if (state.questions.length === 0) {
      showToast('请先导入有效题库');
    }
  };

  if (showEditor) {
    return (
      <View style={styles.container}>
        <View style={styles.editorHeader}>
          <TouchableOpacity onPress={() => setShowEditor(false)}>
            <Text style={styles.backButton}>← 返回</Text>
          </TouchableOpacity>
          <Text style={styles.editorTitle}>编辑Markdown题库</Text>
          <TouchableOpacity onPress={handleLoadSample}>
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
            onPress={handleLoadSample}
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