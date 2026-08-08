import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useAppStore } from '../stores/useAppStore';
import OptionButton from './OptionButton';
import type { AnswerStatus } from '../types';

export default function QuestionCard() {
  const currentIndex = useAppStore((state) => state.currentIndex);
  const currentMode = useAppStore((state) => state.currentMode);
  const progressMap = useAppStore((state) => state.progressMap);
  const isInWrongBank = useAppStore((state) => state.isInWrongBank);
  const wrongBankIds = useAppStore((state) => state.wrongBankIds);
  const getCurrentQuestions = useAppStore((state) => state.getCurrentQuestions);

  const currentQuestions = getCurrentQuestions();
  const question = currentQuestions[currentIndex];

  if (!question) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>请先导入题库</Text>
      </View>
    );
  }

  const progress = progressMap[question.id];
  const hasSubmitted = progress?.status !== 'unanswered';

  if (currentMode === 'explanation' && hasSubmitted) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
        <View style={styles.explanationHeader}>
          <Text style={styles.explanationTitle}>💡 题目解析</Text>
        </View>
        <View style={styles.explanationCard}>
          <Text style={styles.explanationText}>{question.explanation}</Text>
        </View>
        <View style={styles.answerInfo}>
          <Text style={styles.answerLabel}>正确答案：</Text>
          <Text style={styles.answerValue}>{question.answer}</Text>
        </View>
        {progress?.status === 'partial' && (
          <Text style={styles.partialWarning}>
            ⚠️ 答案不完整，漏选了部分选项
          </Text>
        )}
        {progress?.status === 'wrong' && (
          <Text style={styles.wrongWarning}>
            ❌ 回答错误
          </Text>
        )}
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <View style={styles.questionHeader}>
        <Text style={styles.questionType}>
          [{question.type === 'single' ? '单选' : '多选'}]
        </Text>
      </View>

      <View style={styles.contentSection}>
        <Text style={styles.contentText}>{question.content}</Text>
      </View>

      <View style={styles.optionsSection}>
        {question.options.map((option) => (
          <OptionButton
            key={option.label}
            label={option.label}
            text={option.text}
            questionId={question.id}
            correctAnswer={question.answer}
            selected={progress?.selected || []}
            status={(progress?.status || 'unanswered') as AnswerStatus}
          />
        ))}
      </View>

      {hasSubmitted && (
        <View style={styles.feedbackSection}>
          {progress?.status === 'correct' && (
            <Text style={styles.feedbackCorrect}>✅ 回答正确！</Text>
          )}
          {progress?.status === 'wrong' && (
            <Text style={styles.feedbackWrong}>❌ 回答错误</Text>
          )}
          {progress?.status === 'partial' && (
            <Text style={styles.feedbackPartial}>⚠️ 部分正确</Text>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  contentContainer: {
    padding: '5%',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 18,
    color: '#999999',
  },
  questionHeader: {
    marginBottom: '4%',
  },
  questionType: {
    fontSize: 14,
    color: '#4A90D9',
    fontWeight: '600',
    paddingHorizontal: '3%',
    paddingVertical: '1%',
    backgroundColor: '#E3F2FD',
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  contentSection: {
    marginBottom: '6%',
  },
  contentText: {
    fontSize: 18,
    color: '#333333',
    lineHeight: 26,
  },
  optionsSection: {
    marginBottom: '4%',
  },
  feedbackSection: {
    marginTop: '4%',
    padding: '3%',
    borderRadius: 8,
    alignItems: 'center',
  },
  feedbackCorrect: {
    fontSize: 16,
    color: '#4CAF50',
    fontWeight: 'bold',
  },
  feedbackWrong: {
    fontSize: 16,
    color: '#F44336',
    fontWeight: 'bold',
  },
  feedbackPartial: {
    fontSize: 16,
    color: '#FF9800',
    fontWeight: 'bold',
  },
  explanationHeader: {
    marginBottom: '4%',
  },
  explanationTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
  },
  explanationCard: {
    backgroundColor: '#F5F7FA',
    padding: '4%',
    borderRadius: 10,
    marginBottom: '4%',
  },
  explanationText: {
    fontSize: 16,
    color: '#555555',
    lineHeight: 24,
  },
  answerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: '3%',
  },
  answerLabel: {
    fontSize: 16,
    color: '#666666',
  },
  answerValue: {
    fontSize: 16,
    color: '#4CAF50',
    fontWeight: 'bold',
  },
  partialWarning: {
    fontSize: 14,
    color: '#FF9800',
    marginTop: '2%',
  },
  wrongWarning: {
    fontSize: 14,
    color: '#F44336',
    marginTop: '2%',
  },
});