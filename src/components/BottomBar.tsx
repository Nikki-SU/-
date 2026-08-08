import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useAppStore } from '../stores/useAppStore';

export default function BottomBar() {
  const currentIndex = useAppStore((state) => state.currentIndex);
  const currentMode = useAppStore((state) => state.currentMode);
  const progressMap = useAppStore((state) => state.progressMap);
  const isInWrongBank = useAppStore((state) => state.isInWrongBank);
  const wrongBankIds = useAppStore((state) => state.wrongBankIds);
  const goToPrevious = useAppStore((state) => state.goToPrevious);
  const goToNext = useAppStore((state) => state.goToNext);
  const submitAnswer = useAppStore((state) => state.submitAnswer);
  const toggleExplanation = useAppStore((state) => state.toggleExplanation);
  const getCurrentQuestions = useAppStore((state) => state.getCurrentQuestions);

  const currentQuestions = getCurrentQuestions();
  const question = currentQuestions[currentIndex];
  const progress = question ? progressMap[question.id] : null;
  const hasSubmitted = progress?.status !== 'unanswered';

  const isFirst = currentIndex === 0;
  const isLast = currentIndex === currentQuestions.length - 1;
  const allAnswered = currentQuestions.every(
    (q) => progressMap[q.id]?.status !== 'unanswered'
  );
  const finishDisabled = isLast && !allAnswered;

  const getMiddleButton = () => {
    if (!hasSubmitted && question) {
      return (
        <TouchableOpacity
          style={[styles.button, styles.submitButton]}
          onPress={() => submitAnswer(question.id)}
        >
          <Text style={styles.buttonText}>提交</Text>
        </TouchableOpacity>
      );
    }

    if (currentMode === 'question') {
      return (
        <TouchableOpacity
          style={[styles.button, styles.explainButton]}
          onPress={toggleExplanation}
        >
          <Text style={styles.buttonText}>解析</Text>
        </TouchableOpacity>
      );
    }

    return (
      <TouchableOpacity
        style={[styles.button, styles.questionButton]}
        onPress={toggleExplanation}
      >
        <Text style={styles.buttonText}>题目</Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.button, styles.navButton, isFirst && styles.buttonDisabled]}
        onPress={goToPrevious}
        disabled={isFirst}
      >
        <Text style={[styles.buttonText, isFirst && styles.textDisabled]}>
          上一题
        </Text>
      </TouchableOpacity>

      {getMiddleButton()}

      <TouchableOpacity
        style={[
          styles.button,
          styles.navButton,
          isLast && allAnswered && styles.finishButton,
          finishDisabled && styles.buttonDisabled,
        ]}
        onPress={goToNext}
      >
        <Text
          style={[
            styles.buttonText,
            finishDisabled && styles.textDisabled,
          ]}
        >
          {isLast ? '完成' : '下一题'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: '10%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: '4%',
    paddingBottom: '2%',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  button: {
    height: '65%',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10,
    paddingHorizontal: '6%',
    minWidth: '22%',
  },
  navButton: {
    backgroundColor: '#F5F5F5',
  },
  submitButton: {
    backgroundColor: '#4A90D9',
    minWidth: '28%',
  },
  explainButton: {
    backgroundColor: '#FF9800',
    minWidth: '28%',
  },
  questionButton: {
    backgroundColor: '#4CAF50',
    minWidth: '28%',
  },
  finishButton: {
    backgroundColor: '#4CAF50',
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  textDisabled: {
    color: '#999999',
  },
});