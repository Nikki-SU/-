import React, { useEffect } from 'react';
import { View, StyleSheet, ActivityIndicator, Text } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useAppStore } from './src/stores/useAppStore';
import TopBar from './src/components/TopBar';
import ProgressBoard from './src/components/ProgressBoard';
import QuestionCard from './src/components/QuestionCard';
import BottomBar from './src/components/BottomBar';
import HomePage from './src/components/HomePage';
import Toast from './src/components/Toast';
import { autoRestoreDirectory, hasInitializedPath, isFileSystemAccessSupported, setDataPath, clearOldLocalStorageData } from './src/utils/fileStorage';
import { colors, fontFamily, fontSize, radius, spacing, shadow, MAX_CONTENT_WIDTH } from './src/utils/theme';

function AppContent() {
  const questions = useAppStore((state) => state.questions);
  const showHome = useAppStore((state) => state.showHome);
  const loadFromCSV = useAppStore((state) => state.loadFromCSV);
  const selectDataDirectory = useAppStore((state) => state.selectDataDirectory);
  const [isLoading, setIsLoading] = React.useState(true);
  const [needsSetup, setNeedsSetup] = React.useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).__appStore = useAppStore;
    }
    const init = async () => {
      try {
        setIsLoading(true);
        clearOldLocalStorageData();

        const restored = await autoRestoreDirectory();
        if (restored) {
          await loadFromCSV();
        } else if (hasInitializedPath()) {
          setNeedsSetup(true);
        } else {
          setNeedsSetup(true);
        }
      } catch (e) {
        console.warn('Failed to initialize:', e);
        setNeedsSetup(true);
      } finally {
        setIsLoading(false);
      }
    };
    init();
  }, []);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.shell}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>加载中…</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (needsSetup) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.shell}>
          <View style={styles.setupContainer}>
            <Text style={styles.setupTitle}>题库刷题</Text>
            <Text style={styles.setupDesc}>
              选择本地文件夹以保存学习进度（请用 Chrome / Edge 经 HTTPS 打开）
            </Text>
            <View
              style={styles.setupBtn}
              onStartShouldSetResponder={() => {
                selectDataDirectory().then((path) => {
                  if (path) {
                    setNeedsSetup(false);
                    loadFromCSV();
                  }
                });
                return true;
              }}
            >
              <Text style={styles.setupBtnText}>选择数据存储文件夹</Text>
            </View>
          </View>
          <Toast />
        </View>
      </SafeAreaView>
    );
  }

  if (questions.length === 0 || showHome) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.shell}>
          <HomePage />
          <Toast />
          <StatusBar style="dark" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.shell}>
        <TopBar />
        <ProgressBoard />
        <View style={styles.questionContainer}>
          <QuestionCard />
        </View>
        <BottomBar />
        <Toast />
        <StatusBar style="dark" />
      </View>
    </SafeAreaView>
  );
}

export default function App() {
  useEffect(() => {
    // Web 端全局注入楷体（RN Web 的样式不会自动级联到所有文本节点）
    if (typeof document !== 'undefined' && !document.getElementById('academicflow-font')) {
      const style = document.createElement('style');
      style.id = 'academicflow-font';
      style.textContent = `html, body, #root, #root * { font-family: ${fontFamily} !important; }`;
      document.head.appendChild(style);
    }
  }, []);

  return (
    <SafeAreaProvider>
      <AppContent />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.paperDeep,
    alignItems: 'center',
  },
  shell: {
    flex: 1,
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    backgroundColor: colors.paper,
    overflow: 'hidden',
  },
  questionContainer: {
    flex: 1,
    minHeight: 0,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.paper,
  },
  loadingText: {
    marginTop: spacing.lg,
    fontSize: fontSize.md,
    color: colors.textMuted,
  },
  setupContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.paper,
  },
  setupTitle: {
    fontSize: fontSize.xxl,
    fontWeight: 'bold',
    color: colors.primaryDeep,
    marginBottom: spacing.lg,
  },
  setupDesc: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.xl,
    lineHeight: 24,
  },
  setupBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    ...shadow.card,
  },
  setupBtnText: {
    color: colors.white,
    fontSize: fontSize.md,
    fontWeight: '600',
    letterSpacing: 1,
  },
});
