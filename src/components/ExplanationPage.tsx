import React, { useRef, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableWithoutFeedback, useWindowDimensions } from 'react-native';
import { useAppStore } from '../stores/useAppStore';
import { getDisplayAnswer } from '../utils/shuffleUtils';
import { responsiveWidth, responsiveHeight, responsiveFontSize } from '../utils/responsive';

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
  const yourAnswer = progress?.selected || [];

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
                {getDisplayAnswer(question)}
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
            {(question.shuffledOptions || question.options).map((option) => {
              const isSelected = yourAnswer.includes(option.label);
              const displayAnswer = getDisplayAnswer(question);
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
    padding: responsiveWidth(16),
  },
  landscapeContent: {
    paddingVertical: responsiveHeight(12),
    paddingHorizontal: responsiveWidth(24),
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: responsiveFontSize(18),
    color: '#999999',
  },
  statusHeader: {
    alignItems: 'center',
    marginBottom: responsiveHeight(16),
  },
  statusBadge: {
    paddingHorizontal: responsiveWidth(16),
    paddingVertical: responsiveHeight(6),
    borderRadius: responsiveWidth(20),
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: responsiveFontSize(15),
    fontWeight: 'bold',
  },
  questionSection: {
    marginBottom: responsiveHeight(20),
  },
  questionType: {
    fontSize: responsiveFontSize(14),
    color: '#4A90D9',
    fontWeight: '600',
    marginBottom: responsiveHeight(10),
  },
  questionContent: {
    fontSize: responsiveFontSize(18),
    color: '#333333',
    lineHeight: responsiveFontSize(26),
  },
  landscapeText: {
    fontSize: responsiveFontSize(17),
    lineHeight: responsiveFontSize(24),
  },
  answerSection: {
    backgroundColor: '#F8F9FA',
    borderRadius: responsiveWidth(10),
    padding: responsiveWidth(14),
    marginBottom: responsiveHeight(16),
  },
  answerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: responsiveHeight(6),
  },
  answerLabel: {
    fontSize: responsiveFontSize(15),
    color: '#666666',
    minWidth: responsiveWidth(80),
  },
  answerValue: {
    fontSize: responsiveFontSize(16),
    fontWeight: 'bold',
  },
  explanationSection: {
    marginBottom: responsiveHeight(16),
  },
  explanationHeader: {
    marginBottom: responsiveHeight(10),
  },
  explanationTitle: {
    fontSize: responsiveFontSize(18),
    fontWeight: 'bold',
    color: '#333333',
  },
  explanationCard: {
    backgroundColor: '#F5F7FA',
    padding: responsiveWidth(16),
    borderRadius: responsiveWidth(10),
  },
  landscapeCard: {
    padding: responsiveWidth(12),
  },
  explanationText: {
    fontSize: responsiveFontSize(16),
    color: '#555555',
    lineHeight: responsiveFontSize(24),
  },
  optionsSection: {
    marginTop: responsiveHeight(8),
  },
  optionsLabel: {
    fontSize: responsiveFontSize(15),
    color: '#666666',
    marginBottom: responsiveHeight(10),
    fontWeight: '600',
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: responsiveHeight(12),
    paddingHorizontal: responsiveWidth(14),
    marginVertical: responsiveHeight(5),
    borderRadius: responsiveWidth(10),
    borderWidth: responsiveWidth(2),
  },
  optionLabel: {
    width: responsiveWidth(30),
    height: responsiveHeight(30),
    borderRadius: responsiveWidth(15),
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: responsiveWidth(10),
  },
  optionLabelText: {
    color: '#FFFFFF',
    fontSize: responsiveFontSize(14),
    fontWeight: 'bold',
  },
  optionText: {
    flex: 1,
    fontSize: responsiveFontSize(15),
    lineHeight: responsiveFontSize(22),
  },
  optionIcon: {
    fontSize: responsiveFontSize(18),
    fontWeight: 'bold',
    marginLeft: responsiveWidth(8),
  },
  footerSpace: {
    height: responsiveHeight(40),
  },
  hintBar: {
    padding: responsiveWidth(12),
    backgroundColor: '#F5F7FA',
    borderTopWidth: responsiveWidth(1),
    borderTopColor: '#EEEEEE',
    alignItems: 'center',
  },
  hintText: {
    fontSize: responsiveFontSize(13),
    color: '#999999',
  },
});
