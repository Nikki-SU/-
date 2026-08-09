import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableWithoutFeedback, TouchableOpacity } from 'react-native';
import { useAppStore } from '../stores/useAppStore';
import OptionButton from './OptionButton';
import { getDisplayAnswer } from '../utils/shuffleUtils';
import { widthPercent, heightPercent, fontSizePercent, small, fontSmall, heightSmall } from '../utils/responsive';
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
                question={question}
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
    paddingHorizontal: small.lg,
    paddingVertical: heightSmall.md,
    justifyContent: 'space-between',
  },
  headerSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: heightSmall.sm,
  },
  questionType: {
    fontSize: fontSmall.sm,
    color: '#4A90D9',
    fontWeight: '600',
  },
  lockedIndicator: {
    fontSize: fontSmall.xs,
    color: '#FF9800',
    marginLeft: small.md,
    fontWeight: '500',
  },
  questionSection: {
    flexShrink: 1,
    marginBottom: heightSmall.md,
  },
  contentText: {
    fontSize: fontSmall.md,
    color: '#333333',
    lineHeight: fontSizePercent((22 * 100) / 390),
  },
  optionsSection: {
    flex: 1,
    justifyContent: 'space-evenly',
    minHeight: 0,
  },
  actionBar: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingTop: heightSmall.md,
  },
  explainBtn: {
    paddingVertical: heightSmall.md,
    paddingHorizontal: small.xl,
    backgroundColor: '#2196F3',
    borderRadius: small.md,
    alignItems: 'center',
  },
  explainBtnText: {
    color: '#FFFFFF',
    fontSize: fontSmall.sm,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: fontSmall.md,
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
    paddingVertical: heightSmall.md,
    paddingHorizontal: small.lg,
    backgroundColor: '#2196F3',
  },
  explanationTitle: {
    fontSize: fontSmall.md,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: heightSmall.xs,
  },
  explanationHint: {
    fontSize: fontSmall.xs,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  explanationScroll: {
    flex: 1,
  },
  explanationContent: {
    padding: small.lg,
  },
  explanationSection: {
    marginBottom: heightSmall.lg,
    padding: small.md,
    backgroundColor: '#F8F9FA',
    borderRadius: small.md,
  },
  exLabel: {
    fontSize: fontSmall.sm,
    color: '#666666',
    fontWeight: '600',
    marginBottom: heightSmall.sm,
  },
  exContent: {
    fontSize: fontSmall.sm,
    color: '#333333',
    lineHeight: fontSmall.xl,
  },
  exAnswer: {
    fontSize: fontSmall.sm,
    fontWeight: 'bold',
  },
  exOptionText: {
    fontSize: fontSmall.sm,
    lineHeight: fontSmall.lg,
    marginBottom: heightSmall.xs,
  },
  explanationBottom: {
    marginTop: heightSmall.lg,
    padding: small.md,
    backgroundColor: '#E3F2FD',
    borderRadius: small.md,
    alignItems: 'center',
  },
  explanationBottomText: {
    fontSize: fontSmall.sm,
    color: '#2196F3',
    fontWeight: '600',
  },
});