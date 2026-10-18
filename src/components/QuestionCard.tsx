import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableWithoutFeedback, TouchableOpacity } from 'react-native';
import { useAppStore } from '../stores/useAppStore';
import OptionButton from './OptionButton';
import { getDisplayAnswerLabels } from '../utils/shuffleUtils';
import { colors, fontFamily, fontSize, radius, spacing } from '../utils/theme';

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
  const selectedContents = progress?.selectedContents || [];

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

    const handleScrollBegin = () => {
      lastScrollTimeRef.current = Date.now();
    };

    return (
      <View style={styles.explanationContainer}>
        <View style={styles.explanationHeader}>
          <Text style={styles.explanationTitle}>题目解析</Text>
          <Text style={styles.explanationHint}>轻触任意处进入下一题</Text>
        </View>
        <TouchableWithoutFeedback onPress={handleExplanationTap}>
          <ScrollView
            style={styles.explanationScroll}
            contentContainerStyle={styles.explanationContent}
            showsVerticalScrollIndicator={false}
            onScrollBeginDrag={handleScrollBegin}
          >
            <View style={styles.explanationSection}>
              <Text style={styles.exLabel}>题目</Text>
              <Text style={styles.exContent}>{question.content}</Text>
            </View>

            <View style={styles.explanationSection}>
              <Text style={styles.exLabel}>选项</Text>
              {question.options.map((opt) => {
                const isSelected = selectedContents.includes(opt.text);
                const displayAnswer = getDisplayAnswerLabels(question);
                const isCorrect = displayAnswer.includes(opt.label);
                let tone = colors.textMuted;
                if (isSelected && isCorrect) tone = colors.success;
                else if (isSelected && !isCorrect) tone = colors.danger;
                else if (!isSelected && isCorrect) tone = colors.warning;
                return (
                  <Text key={opt.label} style={[styles.exOptionText, { color: tone }]}>
                    {opt.label}. {opt.text}
                  </Text>
                );
              })}
            </View>

            <View style={styles.answerGrid}>
              <View style={styles.answerCell}>
                <Text style={styles.exLabel}>你的答案</Text>
                <Text
                  style={[
                    styles.exAnswer,
                    { color: status === 'correct' ? colors.success : colors.danger },
                  ]}
                >
                  {selectedContents.length > 0
                    ? selectedContents
                        .map((c) => {
                          const opt = question.options.find((o) => o.text === c);
                          return opt ? `${opt.label}. ${c}` : c;
                        })
                        .join('，')
                    : '未作答'}
                </Text>
              </View>
              <View style={styles.answerCell}>
                <Text style={styles.exLabel}>正确答案</Text>
                <Text style={[styles.exAnswer, { color: colors.success }]}>
                  {getDisplayAnswerLabels(question)}
                </Text>
              </View>
            </View>

            <View style={styles.explanationSection}>
              <Text style={styles.exLabel}>解析</Text>
              <Text style={styles.exContent}>{question.explanation}</Text>
            </View>
          </ScrollView>
        </TouchableWithoutFeedback>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TouchableWithoutFeedback onPress={handleCardTap} disabled={!isLocked}>
        <ScrollView
          style={styles.cardScroll}
          contentContainerStyle={styles.cardContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.headerSection}>
            <Text style={styles.questionType}>{questionType}</Text>
            {isLocked && <Text style={styles.lockedIndicator}>已锁定</Text>}
          </View>

          <View style={styles.questionSection}>
            <Text style={styles.contentText}>{question.content}</Text>
          </View>

          <View style={styles.optionsSection}>
            {question.options.map((opt) => (
              <OptionButton
                key={opt.label}
                label={opt.label}
                text={opt.text}
                questionId={question.id}
                correctAnswer={question.answer}
                correctAnswerContent={question.answerContent}
                selected={progress?.selected || []}
                selectedContents={progress?.selectedContents || []}
                status={status}
                locked={isLocked}
                question={question}
              />
            ))}
          </View>

          {showExplanationBtn && (
            <View style={styles.actionBar}>
              <TouchableOpacity
                style={styles.explainBtn}
                onPress={(e) => {
                  e.stopPropagation();
                  setShowExplanation(true);
                }}
              >
                <Text style={styles.explainBtnText}>查看解析</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </TouchableWithoutFeedback>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.paper,
  },
  cardScroll: {
    flex: 1,
  },
  cardContent: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexGrow: 1,
  },
  headerSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  questionType: {
    fontFamily,
    fontSize: fontSize.sm,
    color: colors.primary,
    fontWeight: '600',
    letterSpacing: 1,
  },
  lockedIndicator: {
    fontFamily,
    fontSize: fontSize.xs,
    color: colors.accent,
    marginLeft: spacing.md,
    fontWeight: '600',
  },
  questionSection: {
    flexShrink: 1,
    marginBottom: spacing.md,
  },
  contentText: {
    fontFamily,
    fontSize: fontSize.md,
    color: colors.text,
    lineHeight: 26,
  },
  optionsSection: {
    justifyContent: 'flex-start',
  },
  actionBar: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingTop: spacing.md,
  },
  explainBtn: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    alignItems: 'center',
  },
  explainBtnText: {
    fontFamily,
    color: colors.white,
    fontSize: fontSize.sm,
    fontWeight: '600',
    letterSpacing: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.paper,
  },
  emptyText: {
    fontFamily,
    fontSize: fontSize.md,
    color: colors.textFaint,
  },
  explanationContainer: {
    flex: 1,
    backgroundColor: colors.paper,
  },
  explanationHeader: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.primary,
    alignItems: 'center',
    borderBottomLeftRadius: radius.lg,
    borderBottomRightRadius: radius.lg,
  },
  explanationTitle: {
    fontFamily,
    fontSize: fontSize.lg,
    fontWeight: 'bold',
    color: colors.white,
    letterSpacing: 2,
  },
  explanationHint: {
    fontFamily,
    fontSize: fontSize.xs,
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: 2,
  },
  explanationScroll: {
    flex: 1,
  },
  explanationContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  explanationSection: {
    marginBottom: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  exLabel: {
    fontFamily,
    fontSize: fontSize.xs,
    color: colors.accent,
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  exContent: {
    fontFamily,
    fontSize: fontSize.sm,
    color: colors.text,
    lineHeight: 24,
  },
  exAnswer: {
    fontFamily,
    fontSize: fontSize.md,
    fontWeight: 'bold',
    lineHeight: 22,
  },
  exOptionText: {
    fontFamily,
    fontSize: fontSize.sm,
    lineHeight: 24,
    marginBottom: 2,
  },
  answerGrid: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  answerCell: {
    flex: 1,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
