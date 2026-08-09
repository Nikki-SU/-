import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useAppStore } from '../stores/useAppStore';
import { responsiveWidth, responsiveHeight, responsiveFontSize } from '../utils/responsive';

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
    padding: responsiveWidth(20),
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: responsiveHeight(24),
    marginTop: responsiveHeight(24),
  },
  celebration: {
    fontSize: responsiveFontSize(32),
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: responsiveHeight(8),
  },
  subtitle: {
    fontSize: responsiveFontSize(16),
    color: '#666666',
  },
  statsCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: responsiveWidth(16),
    padding: responsiveWidth(24),
    shadowColor: '#000',
    shadowOffset: { width: responsiveWidth(0), height: responsiveHeight(2) },
    shadowOpacity: 0.1,
    shadowRadius: responsiveWidth(8),
    elevation: 4,
    marginBottom: responsiveHeight(24),
  },
  statsTitle: {
    fontSize: responsiveFontSize(20),
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: responsiveHeight(24),
    textAlign: 'center',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    marginBottom: responsiveHeight(24),
  },
  statItem: {
    width: '45%',
    alignItems: 'center',
    marginVertical: responsiveHeight(12),
  },
  statValue: {
    fontSize: responsiveFontSize(32),
    fontWeight: 'bold',
    color: '#333333',
  },
  statLabel: {
    fontSize: responsiveFontSize(14),
    color: '#666666',
    marginTop: responsiveHeight(8),
  },
  accuracySection: {
    alignItems: 'center',
    paddingTop: responsiveHeight(16),
    borderTopWidth: responsiveWidth(1),
    borderTopColor: '#E0E0E0',
  },
  accuracyLabel: {
    fontSize: responsiveFontSize(16),
    color: '#666666',
    marginBottom: responsiveHeight(12),
  },
  accuracyBar: {
    width: '80%',
    height: responsiveHeight(12),
    backgroundColor: '#E0E0E0',
    borderRadius: responsiveWidth(6),
    overflow: 'hidden',
    marginBottom: responsiveHeight(12),
  },
  accuracyFill: {
    height: '100%',
    backgroundColor: '#4CAF50',
    borderRadius: responsiveWidth(6),
  },
  accuracyValue: {
    fontSize: responsiveFontSize(28),
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  buttonRow: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'center',
    marginBottom: responsiveHeight(20),
  },
  actionButton: {
    paddingHorizontal: responsiveWidth(24),
    paddingVertical: responsiveHeight(12),
    borderRadius: responsiveWidth(12),
    marginHorizontal: responsiveWidth(12),
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
    fontSize: responsiveFontSize(16),
    fontWeight: '600',
    color: '#FFFFFF',
  },
  homeButton: {
    paddingVertical: responsiveHeight(14),
    paddingHorizontal: responsiveWidth(32),
    borderRadius: responsiveWidth(12),
    backgroundColor: '#F5F5F5',
    borderWidth: responsiveWidth(1),
    borderColor: '#E0E0E0',
  },
  homeButtonText: {
    fontSize: responsiveFontSize(16),
    color: '#666666',
  },
});
