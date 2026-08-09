import React, { useEffect } from 'react';
import { View, StyleSheet, ActivityIndicator, Text } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { responsiveWidth, responsiveHeight, responsiveFontSize } from './src/utils/responsive';
import { useAppStore } from './src/stores/useAppStore';
import TopBar from './src/components/TopBar';
import ProgressBoard from './src/components/ProgressBoard';
import QuestionCard from './src/components/QuestionCard';
import BottomBar from './src/components/BottomBar';
import HomePage from './src/components/HomePage';
import Toast from './src/components/Toast';
import { autoRestoreDirectory, hasInitializedPath } from './src/utils/fileStorage';

function AppContent() {
  const questions = useAppStore((state) => state.questions);
  const showHome = useAppStore((state) => state.showHome);
  const loadFromCSV = useAppStore((state) => state.loadFromCSV);
  const selectDataDirectory = useAppStore((state) => state.selectDataDirectory);
  const [isLoading, setIsLoading] = React.useState(true);
  const [needsSetup, setNeedsSetup] = React.useState(false);

  useEffect(() => {
    const init = async () => {
      try {
        setIsLoading(true);
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
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4A90D9" />
        <Text style={styles.loadingText}>加载中...</Text>
      </View>
    );
  }

  if (needsSetup) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.setupContainer}>
          <Text style={styles.setupTitle}>📚 题库刷题</Text>
          <Text style={styles.setupDesc}>
            欢迎使用！为了保存您的学习进度，请选择一个本地文件夹来存储数据。
          </Text>
          <Text style={styles.setupNote}>
            注意：请使用 Chrome 或 Edge 浏览器，并通过 HTTPS 访问本页面。
          </Text>
          <View style={styles.setupBtn} onStartShouldSetResponder={() => {
            selectDataDirectory().then((path) => {
              if (path) {
                setNeedsSetup(false);
                loadFromCSV();
              }
            });
            return true;
          }}>
            <Text style={styles.setupBtnText}>📁 选择数据存储文件夹</Text>
          </View>
        </View>
        <Toast />
      </SafeAreaView>
    );
  }

  if (questions.length === 0 || showHome) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          <HomePage />
          <Toast />
          <StatusBar style="dark" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
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
  return (
    <SafeAreaProvider>
      <AppContent />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  questionContainer: {
    flex: 1,
    minHeight: 0,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F7FA',
  },
  loadingText: {
    marginTop: '4%',
    fontSize: responsiveFontSize(16),
    color: '#666666',
  },
  setupContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: responsiveWidth(32),
    backgroundColor: '#F5F7FA',
  },
  setupTitle: {
    fontSize: responsiveFontSize(28),
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: responsiveHeight(16),
  },
  setupDesc: {
    fontSize: responsiveFontSize(16),
    color: '#666666',
    textAlign: 'center',
    marginBottom: responsiveHeight(12),
    lineHeight: responsiveFontSize(24),
  },
  setupNote: {
    fontSize: responsiveFontSize(13),
    color: '#999999',
    textAlign: 'center',
    marginBottom: responsiveHeight(32),
    lineHeight: responsiveFontSize(20),
  },
  setupBtn: {
    backgroundColor: '#4A90D9',
    paddingHorizontal: responsiveWidth(32),
    paddingVertical: responsiveHeight(16),
    borderRadius: responsiveWidth(12),
  },
  setupBtnText: {
    color: '#FFFFFF',
    fontSize: responsiveFontSize(18),
    fontWeight: '600',
  },
});
