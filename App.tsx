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
import SummaryPage from './src/components/SummaryPage';
import Toast from './src/components/Toast';

function AppContent() {
  const questions = useAppStore((state) => state.questions);
  const showSummary = useAppStore((state) => state.showSummary);
  const showHome = useAppStore((state) => state.showHome);
  const loadFromCSV = useAppStore((state) => state.loadFromCSV);
  const [isLoading, setIsLoading] = React.useState(true);

  useEffect(() => {
    const init = async () => {
      try {
        await loadFromCSV();
      } catch (e) {
        console.warn('Failed to load CSV data:', e);
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

  if (showSummary) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          <SummaryPage />
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
        <QuestionCard />
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F7FA',
  },
  loadingText: {
    marginTop: '4%',
    fontSize: 16,
    color: '#666666',
  },
});