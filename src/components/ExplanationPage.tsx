import React, { useRef, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableWithoutFeedback, useWindowDimensions } from 'react-native';
import { useAppStore } from '../stores/useAppStore';
import { getDisplayAnswerLabels } from '../utils/shuffleUtils';
import { widthPercent, heightPercent, fontSizePercent, small, fontSmall, heightSmall } from '../utils/responsive';

export default function ExplanationPage() {
  const currentIndex = useAppStore((state) => state.currentIndex);
  const getCurrentQuestions = useAppStore((state) => state.getCurrentQuestions);
  const advanceToNextQuestion = useAppStore((state) => state.advanceToNextQuestion);
  const progressMap = useAppStore((state) => state.progressMap);

  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  const scrollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const justScrolled = useRef(false);

  const currentQuestions = getCurrentQuestions();
  const question = currentQuestions[currentIndex];

  if (!question) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>题目不存在</Text>
      </View>
    );
  }

  const progress = progressMap[question.id];
  const yourAnswer = progress?.selectedContents || [];

  const handleScrollBegin = useCallback(() => {
    justScrolled.current = true;
    if (scrollTimer.current) {
      clearTimeout(scrollTimer.current);
    }
  }, []);

  const handleScrollEnd = useCallback(() => {
    if (scrollTimer.current) {
      clearTimeout(scrollTimer.current);
    }
    scrollTimer.current = setTimeout(() => {
      justScrolled.current = false;
    }, 250);
  }, []);

  const handleTap = useCallback(() => {
    if (justScrolled.current) return;
    advanceToNextQuestion();
  }, [advanceToNextQuestion]);

  const status = progress?.status;
  const statusText = status === 'wrong' ? '回答错误' : status === 'partial' ? '部分正确' : '';
  const statusColor = status === 'wrong' ? '#F44336' : '#FF9800';

  return (
    <TouchableWithoutFeedback onPress={handleTap}>
      <View style={styles.container}>
        <ScrollView
          style={styles.scrollContainer}
          contentContainerStyle={[
            styles.contentContainer,
            isLandscape && styles.landscapeContent,
          ]}
          onScrollBeginDrag={handleScrollBegin}
          onMomentumScrollEnd={handleScrollEnd}
        >
          <View style={styles.statusHeader}>
            <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
              <Text style={styles.statusText}>{statusText}</Text>
            </View>
          </View>

          <View style={styles.questionSection}>
            <Text style={[styles.questionType, isLandscape && styles.landscapeText]}>
              [{question.type === 'single' ? '单选' : '多选'}]
            </Text>
            <Text style={[styles.questionContent, isLandscape && styles.landscapeText]}>
              {question.content}
            </Text>
          </View>

          <View style={styles.answerSection}>
            <View style={styles.answerRow}>
              <Text style={styles.answerLabel}>你的答案：</Text>
              <Text style={[styles.answerValue, { color: statusColor }]}>
                {yourAnswer.length > 0 ? yourAnswer.join(', ') : '未作答'}
              </Text>
            </View>
            <View style={styles.answerRow}>
              <Text style={styles.answerLabel}>正确答案：</Text>
              <Text style={[styles.answerValue, { color: '#4CAF50' }]}>
                {getDisplayAnswerLabels(question)}
              </Text>
            </View>
          </View>

          <View style={styles.explanationSection}>
            <View style={styles.explanationHeader}>
              <Text style={styles.explanationTitle}>💡 题目解析</Text>
            </View>
            <View style={[styles.explanationCard, isLandscape && styles.landscapeCard]}>
              <Text style={[styles.explanationText, isLandscape && styles.landscapeText]}>
                {question.explanation}
              </Text>
            </View>
          </View>

          <View style={styles.optionsSection}>
            <Text style={styles.optionsLabel}>选项详情：</Text>
            {question.options.map((option) => {
              const isSelected = yourAnswer.includes(option.text);
              const displayAnswer = getDisplayAnswerLabels(question);
              const isCorrect = displayAnswer.includes(option.label);
              
              let bgColor = '#F5F5F5';
              let borderColor = '#E0E0E0';
              let textColor = '#666666';
              
              if (isSelected && isCorrect) {
                bgColor = '#E8F5E9';
                borderColor = '#4CAF50';
                textColor = '#4CAF50';
              } else if (isSelected && !isCorrect) {
                bgColor = '#FFEBEE';
                borderColor = '#F44336';
                textColor = '#F44336';
              } else if (!isSelected && isCorrect) {
                bgColor = '#FFF8E1';
                borderColor = '#FF9800';
                textColor = '#FF9800';
              }

              return (
                <View
                  key={option.label}
                  style={[
                    styles.optionItem,
                    { backgroundColor: bgColor, borderColor },
                  ]}
                >
                  <View
                    style={[
                      styles.optionLabel,
                      { backgroundColor: borderColor },
                    ]}
                  >
                    <Text style={styles.optionLabelText}>{option.label}</Text>
                  </View>
                  <Text style={[styles.optionText, { color: textColor }]}>
                    {option.text}
                  </Text>
                  {isSelected && isCorrect && <Text style={styles.optionIcon}>✓</Text>}
                  {isSelected && !isCorrect && <Text style={styles.optionIcon}>✗</Text>}
                  {!isSelected && isCorrect && <Text style={styles.optionIcon}>⚠</Text>}
                </View>
              );
            })}
          </View>

          <View style={styles.footerSpace} />
        </ScrollView>

        <View style={styles.hintBar}>
          <Text style={styles.hintText}>点击屏幕进入下一题（滑动不触发）</Text>
        </View>
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContainer: {
    flex: 1,
  },
  contentContainer: {
    padding: small.xl,
  },
  landscapeContent: {
    paddingVertical: heightSmall.lg,
    paddingHorizontal: widthPercent((24 * 100) / 390),
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: fontSmall.lg,
    color: '#999999',
  },
  statusHeader: {
    alignItems: 'center',
    marginBottom: heightSmall.xl,
  },
  statusBadge: {
    paddingHorizontal: small.xl,
    paddingVertical: heightSmall.md,
    borderRadius: small.xl,
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: fontSmall.md,
    fontWeight: 'bold',
  },
  questionSection: {
    marginBottom: heightPercent((20 * 100) / 844),
  },
  questionType: {
    fontSize: fontSmall.sm,
    color: '#4A90D9',
    fontWeight: '600',
    marginBottom: heightSmall.md,
  },
  questionContent: {
    fontSize: fontSmall.lg,
    color: '#333333',
    lineHeight: fontSizePercent((26 * 100) / 390),
  },
  landscapeText: {
    fontSize: fontSmall.lg,
    lineHeight: fontSizePercent((24 * 100) / 390),
  },
  answerSection: {
    backgroundColor: '#F8F9FA',
    borderRadius: small.md,
    padding: small.lg,
    marginBottom: heightSmall.xl,
  },
  answerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: heightSmall.md,
  },
  answerLabel: {
    fontSize: fontSmall.md,
    color: '#666666',
    minWidth: widthPercent((80 * 100) / 390),
  },
  answerValue: {
    fontSize: fontSmall.md,
    fontWeight: 'bold',
  },
  explanationSection: {
    marginBottom: heightSmall.xl,
  },
  explanationHeader: {
    marginBottom: heightSmall.md,
  },
  explanationTitle: {
    fontSize: fontSmall.lg,
    fontWeight: 'bold',
    color: '#333333',
  },
  explanationCard: {
    backgroundColor: '#F5F7FA',
    padding: small.xl,
    borderRadius: small.md,
  },
  landscapeCard: {
    padding: small.lg,
  },
  explanationText: {
    fontSize: fontSmall.md,
    color: '#555555',
    lineHeight: fontSizePercent((24 * 100) / 390),
  },
  optionsSection: {
    marginTop: heightSmall.md,
  },
  optionsLabel: {
    fontSize: fontSmall.md,
    color: '#666666',
    marginBottom: heightSmall.md,
    fontWeight: '600',
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: heightSmall.lg,
    paddingHorizontal: small.lg,
    marginVertical: heightSmall.sm,
    borderRadius: small.md,
    borderWidth: small.xs,
  },
  optionLabel: {
    width: widthPercent((30 * 100) / 390),
    height: heightPercent((30 * 100) / 844),
    borderRadius: widthPercent((15 * 100) / 390),
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: small.md,
  },
  optionLabelText: {
    color: '#FFFFFF',
    fontSize: fontSmall.sm,
    fontWeight: 'bold',
  },
  optionText: {
    flex: 1,
    fontSize: fontSmall.md,
    lineHeight: fontSizePercent((22 * 100) / 390),
  },
  optionIcon: {
    fontSize: fontSmall.lg,
    fontWeight: 'bold',
    marginLeft: small.md,
  },
  footerSpace: {
    height: heightPercent((40 * 100) / 844),
  },
  hintBar: {
    padding: small.lg,
    backgroundColor: '#F5F7FA',
    borderTopWidth: small.xs,
    borderTopColor: '#EEEEEE',
    alignItems: 'center',
  },
  hintText: {
    fontSize: fontSmall.sm,
    color: '#999999',
  },
});