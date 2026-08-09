import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useAppStore } from '../stores/useAppStore';
import { widthPercent, heightPercent, fontSizePercent, small, fontSmall, heightSmall } from '../utils/responsive';

export default function SummaryPage() {
  const progressMap = useAppStore((state) => state.progressMap);
  const wrongBankIds = useAppStore((state) => state.wrongBankIds);
  const favoritesIds = useAppStore((state) => state.favoritesIds);
  const setShowSummary = useAppStore((state) => state.setShowSummary);
  const enterWrongBank = useAppStore((state) => state.enterWrongBank);
  const enterFavoritesBank = useAppStore((state) => state.enterFavoritesBank);
  const resetAll = useAppStore((state) => state.resetAll);
  const goHome = useAppStore((state) => state.goHome);
  const getCurrentQuestions = useAppStore((state) => state.getCurrentQuestions);
  const currentBank = useAppStore((state) => state.getCurrentBank());
  const isInFavoritesBank = useAppStore((state) => state.isInFavoritesBank);

  const questions = getCurrentQuestions();

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

  const getTitle = () => {
    if (isInFavoritesBank) return '收藏练习完成';
    if (wrongBankIds.length > 0 && questions.every(q => wrongBankIds.includes(q.id))) return '错题重做完成';
    return currentBank ? currentBank.name : '';
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.celebration}>🎉 完成！</Text>
          <Text style={styles.subtitle}>
            {getTitle()} · 全部题目已作答
          </Text>
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
          {wrongBankIds.length > 0 && !isInFavoritesBank && (
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
          {favoritesIds.length > 0 && !isInFavoritesBank && (
            <TouchableOpacity
              style={[styles.actionButton, styles.favoritesButton]}
              onPress={() => {
                setShowSummary(false);
                enterFavoritesBank();
              }}
            >
              <Text style={styles.actionButtonText}>⭐ 收藏练习</Text>
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
    padding: small.xl,
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: heightPercent((24 * 100) / 844),
    marginTop: heightPercent((24 * 100) / 844),
  },
  celebration: {
    fontSize: fontSizePercent((32 * 100) / 390),
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: heightSmall.md,
  },
  subtitle: {
    fontSize: fontSmall.md,
    color: '#666666',
  },
  statsCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: small.xl,
    padding: widthPercent((24 * 100) / 390),
    shadowColor: '#000',
    shadowOffset: { width: widthPercent(0), height: heightSmall.xs },
    shadowOpacity: 0.1,
    shadowRadius: small.md,
    elevation: 4,
    marginBottom: heightPercent((24 * 100) / 844),
  },
  statsTitle: {
    fontSize: fontSmall.xl,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: heightPercent((24 * 100) / 844),
    textAlign: 'center',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    marginBottom: heightPercent((24 * 100) / 844),
  },
  statItem: {
    width: '45%',
    alignItems: 'center',
    marginVertical: heightSmall.lg,
  },
  statValue: {
    fontSize: fontSizePercent((32 * 100) / 390),
    fontWeight: 'bold',
    color: '#333333',
  },
  statLabel: {
    fontSize: fontSmall.sm,
    color: '#666666',
    marginTop: heightSmall.md,
  },
  accuracySection: {
    alignItems: 'center',
    paddingTop: heightSmall.xl,
    borderTopWidth: small.xs,
    borderTopColor: '#E0E0E0',
  },
  accuracyLabel: {
    fontSize: fontSmall.md,
    color: '#666666',
    marginBottom: heightSmall.lg,
  },
  accuracyBar: {
    width: '80%',
    height: heightSmall.lg,
    backgroundColor: '#E0E0E0',
    borderRadius: small.md,
    overflow: 'hidden',
    marginBottom: heightSmall.lg,
  },
  accuracyFill: {
    height: '100%',
    backgroundColor: '#4CAF50',
    borderRadius: small.md,
  },
  accuracyValue: {
    fontSize: fontSizePercent((28 * 100) / 390),
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  buttonRow: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'center',
    marginBottom: heightPercent((20 * 100) / 844),
  },
  actionButton: {
    paddingHorizontal: widthPercent((24 * 100) / 390),
    paddingVertical: heightSmall.lg,
    borderRadius: small.lg,
    marginHorizontal: small.lg,
    minWidth: '35%',
    alignItems: 'center',
  },
  wrongBankButton: {
    backgroundColor: '#FF9800',
  },
  favoritesButton: {
    backgroundColor: '#FFC107',
  },
  resetButton: {
    backgroundColor: '#4A90D9',
  },
  actionButtonText: {
    fontSize: fontSmall.md,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  homeButton: {
    paddingVertical: heightSmall.lg,
    paddingHorizontal: widthPercent((32 * 100) / 390),
    borderRadius: small.lg,
    backgroundColor: '#F5F5F5',
    borderWidth: small.xs,
    borderColor: '#E0E0E0',
  },
  homeButtonText: {
    fontSize: fontSmall.md,
    color: '#666666',
  },
});