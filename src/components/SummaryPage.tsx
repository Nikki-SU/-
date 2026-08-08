import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useAppStore } from '../stores/useAppStore';

export default function SummaryPage() {
  const questions = useAppStore((state) => state.questions);
  const progressMap = useAppStore((state) => state.progressMap);
  const wrongBankIds = useAppStore((state) => state.wrongBankIds);
  const setShowSummary = useAppStore((state) => state.setShowSummary);
  const enterWrongBank = useAppStore((state) => state.enterWrongBank);
  const resetAll = useAppStore((state) => state.resetAll);
  const goHome = useAppStore((state) => state.goHome);

  const stats = questions.reduce(
    (acc, q) => {
      const status = progressMap[q.id]?.status;
      if (status === 'correct') acc.correct++;
      else if (status === 'wrong') acc.wrong++;
      else if (status === 'partial') acc.partial++;
      else acc.unanswered++;
      return acc;
    },
    { correct: 0, wrong: 0, partial: 0, unanswered: 0 }
  );

  const total = questions.length;
  const attempted = stats.correct + stats.wrong + stats.partial;
  const accuracy = attempted > 0 ? Math.round((stats.correct / attempted) * 100) : 0;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.celebration}>🎉 完成！</Text>
          <Text style={styles.subtitle}>全部题目已作答</Text>
        </View>

        <View style={styles.statsCard}>
          <Text style={styles.statsTitle}>📊 统计结果</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{total}</Text>
              <Text style={styles.statLabel}>总题数</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: '#4CAF50' }]}>
                {stats.correct}
              </Text>
              <Text style={styles.statLabel}>✅ 正确</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: '#F44336' }]}>
                {stats.wrong}
              </Text>
              <Text style={styles.statLabel}>❌ 错误</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: '#FF9800' }]}>
                {stats.partial}
              </Text>
              <Text style={styles.statLabel}>⚠️ 部分对</Text>
            </View>
          </View>

          <View style={styles.accuracySection}>
            <Text style={styles.accuracyLabel}>🎯 正确率</Text>
            <View style={styles.accuracyBar}>
              <View
                style={[
                  styles.accuracyFill,
                  { width: `${accuracy}%` },
                ]}
              />
            </View>
            <Text style={styles.accuracyValue}>{accuracy}%</Text>
          </View>
        </View>

        <View style={styles.buttonRow}>
          {wrongBankIds.length > 0 && (
            <TouchableOpacity
              style={[styles.actionButton, styles.wrongBankButton]}
              onPress={() => {
                setShowSummary(false);
                enterWrongBank();
              }}
            >
              <Text style={styles.actionButtonText}>📝 错题重做</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.actionButton, styles.resetButton]}
            onPress={() => {
              resetAll();
              setShowSummary(false);
            }}
          >
            <Text style={styles.actionButtonText}>🔄 重新刷题</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.homeButton}
          onPress={() => goHome()}
        >
          <Text style={styles.homeButtonText}>← 返回首页</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  content: {
    padding: '6%',
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: '8%',
    marginTop: '8%',
  },
  celebration: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: '2%',
  },
  subtitle: {
    fontSize: 16,
    color: '#666666',
  },
  statsCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: '6%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: '6%',
  },
  statsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: '6%',
    textAlign: 'center',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    marginBottom: '6%',
  },
  statItem: {
    width: '45%',
    alignItems: 'center',
    marginVertical: '3%',
  },
  statValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#333333',
  },
  statLabel: {
    fontSize: 14,
    color: '#666666',
    marginTop: '2%',
  },
  accuracySection: {
    alignItems: 'center',
    paddingTop: '4%',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  accuracyLabel: {
    fontSize: 16,
    color: '#666666',
    marginBottom: '3%',
  },
  accuracyBar: {
    width: '80%',
    height: 12,
    backgroundColor: '#E0E0E0',
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: '3%',
  },
  accuracyFill: {
    height: '100%',
    backgroundColor: '#4CAF50',
    borderRadius: 6,
  },
  accuracyValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  buttonRow: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'center',
    marginBottom: '5%',
  },
  actionButton: {
    paddingHorizontal: '8%',
    paddingVertical: '4%',
    borderRadius: 12,
    marginHorizontal: '3%',
    minWidth: '35%',
    alignItems: 'center',
  },
  wrongBankButton: {
    backgroundColor: '#FF9800',
  },
  resetButton: {
    backgroundColor: '#4A90D9',
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  homeButton: {
    paddingVertical: '4%',
    paddingHorizontal: '10%',
    borderRadius: 12,
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  homeButtonText: {
    fontSize: 16,
    color: '#666666',
  },
});