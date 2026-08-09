import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableWithoutFeedback, TouchableOpacity } from 'react-native';
import { useAppStore } from '../stores/useAppStore';
import OptionButton from './OptionButton';
import { getDisplayAnswer } from '../utils/shuffleUtils';
import { responsiveWidth, responsiveHeight, responsiveFontSize } from '../utils/responsive';
import type { AnswerStatus } from '../types';

export default function QuestionCard() {
  const currentIndex = useAppStore((state) => state.currentIndex);
  const progressMap = useAppStore((state) => state.progressMap);
  const phase = useAppStore((state) => state.phase);
  const getCurrentQuestions = useAppStore((state) => state.getCurrentQuestions);
  const advanceToNextQuestion = useAppStore((state) => state.advanceToNextQuestion);

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
  const isLocked = progress?.locked || false;
  const status = progress?.status || 'unanswered';
  const questionType = question.type === 'single' ? '单选题' : '多选题';
  const showExplanationBtn = isLocked && (status === 'wrong' || status === 'partial' || status === 'correct');

  const handleCardTap = () => {
    if (isLocked && phase !== 'feedback') {
      advanceToNextQuestion();
    }
  };

  const [showExplanation, setShowExplanation] = React.useState(false);
  const lastScrollTimeRef = React.useRef(0);
  
  React.useEffect(() => {
    if (phase === 'explanation') {
      setShowExplanation(true);
    } else if (phase === 'answer') {
      setShowExplanation(false);
    }
  }, [phase, question.id]);

  if (showExplanation || phase === 'explanation') {
    const handleExplanationTap = () => {
      const now = Date.now();
      if (now - lastScrollTimeRef.current < 250) {
        return;
      }
      advanceToNextQuestion();
    };
    
    return (
      <View style={styles.explanationContainer}>
        <View style={styles.explanationHeader}>
          <Text style={styles.explanationTitle}>💡 题目解析</Text>
          <Text style={styles.explanationHint}>点击任意位置进入下一题</Text>
        </View>
        <TouchableWithoutFeedback onPress={handleExplanationTap}>
          <ScrollView 
            style={styles.explanationScroll}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.explanationContent}>
              <View style={styles.explanationSection}>
                <Text style={styles.exLabel}>题目：</Text>
                <Text style={styles.exContent}>{question.content}</Text>
              </View>
              <View style={styles.explanationSection}>
                <Text style={styles.exLabel}>选项：</Text>
                {(question.shuffledOptions || question.options).map((opt) => {
                  const isSelected = progress?.selected.includes(opt.label);
                  const displayAnswer = getDisplayAnswer(question);
                  const isCorrect = displayAnswer.includes(opt.label);
                  let color = '#666';
                  if (isSelected && isCorrect) color = '#4CAF50';
                  else if (isSelected && !isCorrect) color = '#F44336';
                  else if (!isSelected && isCorrect) color = '#FF9800';
                  return (
                    <Text key={opt.label} style={[styles.exOptionText, { color }]}>
                      {opt.label}. {opt.text}
                    </Text>
                  );
                })}
              </View>
              <View style={styles.explanationSection}>
                <Text style={styles.exLabel}>你的答案：</Text>
                <Text style={[styles.exAnswer, { color: status === 'correct' ? '#4CAF50' : '#F44336' }]}>
                  {progress?.selected.join(', ') || '未作答'}
                </Text>
              </View>
              <View style={styles.explanationSection}>
                <Text style={styles.exLabel}>正确答案：</Text>
                <Text style={[styles.exAnswer, { color: '#4CAF50' }]}>{getDisplayAnswer(question)}</Text>
              </View>
              <View style={styles.explanationSection}>
                <Text style={styles.exLabel}>解析：</Text>
                <Text style={styles.exContent}>{question.explanation}</Text>
              </View>
              <View style={styles.explanationBottom}>
                <Text style={styles.explanationBottomText}>
                  👆 点击屏幕任意位置进入下一题
                </Text>
              </View>
            </View>
          </ScrollView>
        </TouchableWithoutFeedback>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TouchableWithoutFeedback onPress={handleCardTap} disabled={!isLocked}>
        <View style={styles.cardContent}>
          <View style={styles.headerSection}>
            <Text style={styles.questionType}>{questionType}</Text>
            {isLocked && (
              <Text style={styles.lockedIndicator}>已锁定</Text>
            )}
          </View>
          
          <View style={styles.questionSection}>
            <Text style={styles.contentText}>{question.content}</Text>
          </View>
          
          <View style={styles.optionsSection}>
            {(question.shuffledOptions || question.options).map((opt) => (
              <OptionButton
                key={opt.label}
                label={opt.label}
                text={opt.text}
                questionId={question.id}
                correctAnswer={question.answer}
                selected={progress?.selected || []}
                status={status}
                locked={isLocked}
              />
            ))}
          </View>
          
          <View style={styles.actionBar}>
            {showExplanationBtn && (
              <TouchableOpacity 
                style={styles.explainBtn}
                onPress={(e) => {
                  e.stopPropagation();
                  setShowExplanation(true);
                }}
              >
                <Text style={styles.explainBtnText}>查看解析</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </TouchableWithoutFeedback>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  cardContent: {
    flex: 1,
    paddingHorizontal: responsiveWidth(12),
    paddingVertical: responsiveHeight(8),
    justifyContent: 'space-between',
  },
  headerSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: responsiveHeight(4),
  },
  questionType: {
    fontSize: responsiveFontSize(13),
    color: '#4A90D9',
    fontWeight: '600',
  },
  lockedIndicator: {
    fontSize: responsiveFontSize(12),
    color: '#FF9800',
    marginLeft: responsiveWidth(8),
    fontWeight: '500',
  },
  questionSection: {
    flexShrink: 1,
    marginBottom: responsiveHeight(6),
  },
  contentText: {
    fontSize: responsiveFontSize(16),
    color: '#333333',
    lineHeight: responsiveFontSize(22),
  },
  optionsSection: {
    flex: 1,
    justifyContent: 'space-evenly',
    minHeight: 0,
  },
  actionBar: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingTop: responsiveHeight(6),
  },
  explainBtn: {
    paddingVertical: responsiveHeight(8),
    paddingHorizontal: responsiveWidth(20),
    backgroundColor: '#2196F3',
    borderRadius: responsiveWidth(6),
    alignItems: 'center',
  },
  explainBtnText: {
    color: '#FFFFFF',
    fontSize: responsiveFontSize(14),
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: responsiveFontSize(16),
    color: '#999999',
  },
  explanationContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  explanationHeader: {
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: responsiveHeight(10),
    paddingHorizontal: responsiveWidth(12),
    backgroundColor: '#2196F3',
  },
  explanationTitle: {
    fontSize: responsiveFontSize(16),
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: responsiveHeight(2),
  },
  explanationHint: {
    fontSize: responsiveFontSize(12),
    color: 'rgba(255, 255, 255, 0.8)',
  },
  explanationScroll: {
    flex: 1,
  },
  explanationContent: {
    padding: responsiveWidth(12),
  },
  explanationSection: {
    marginBottom: responsiveHeight(12),
    padding: responsiveWidth(8),
    backgroundColor: '#F8F9FA',
    borderRadius: responsiveWidth(6),
  },
  exLabel: {
    fontSize: responsiveFontSize(13),
    color: '#666666',
    fontWeight: '600',
    marginBottom: responsiveHeight(4),
  },
  exContent: {
    fontSize: responsiveFontSize(14),
    color: '#333333',
    lineHeight: responsiveFontSize(20),
  },
  exAnswer: {
    fontSize: responsiveFontSize(14),
    fontWeight: 'bold',
  },
  exOptionText: {
    fontSize: responsiveFontSize(13),
    lineHeight: responsiveFontSize(18),
    marginBottom: responsiveHeight(2),
  },
  explanationBottom: {
    marginTop: responsiveHeight(12),
    padding: responsiveWidth(10),
    backgroundColor: '#E3F2FD',
    borderRadius: responsiveWidth(6),
    alignItems: 'center',
  },
  explanationBottomText: {
    fontSize: responsiveFontSize(13),
    color: '#2196F3',
    fontWeight: '600',
  },
});
