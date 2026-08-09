import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { widthPercent, heightPercent, fontSizePercent, small, fontSmall, heightSmall } from '../utils/responsive';
import { useAppStore } from '../stores/useAppStore';

export default function BottomBar() {
  const currentIndex = useAppStore((state) => state.currentIndex);
  const progressMap = useAppStore((state) => state.progressMap);
  const phase = useAppStore((state) => state.phase);
  const submitAnswer = useAppStore((state) => state.submitAnswer);
  const markDontKnow = useAppStore((state) => state.markDontKnow);
  const getCurrentQuestions = useAppStore((state) => state.getCurrentQuestions);

  const currentQuestions = getCurrentQuestions();
  const question = currentQuestions[currentIndex];
  const progress = question ? progressMap[question.id] : null;
  const isLocked = progress?.locked || false;

  if (!question) return null;

  if (phase === 'feedback' || phase === 'explanation') {
    return null;
  }

  if (isLocked) {
    return (
      <View style={styles.container}>
        <Text style={styles.hintText}>题目已锁定，请点击卡片进入下一题</Text>
      </View>
    );
  }

  const isMultiSelect = question.type === 'multi';

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.dontKnowButton}
        onPress={() => markDontKnow(question.id)}
      >
        <Text style={styles.buttonText}>不会</Text>
      </TouchableOpacity>

      {isMultiSelect && (
        <TouchableOpacity
          style={[
            styles.submitButton,
            progress?.selected.length === 0 && styles.buttonDisabled,
          ]}
          onPress={() => submitAnswer(question.id)}
          disabled={progress?.selected.length === 0}
        >
          <Text style={styles.buttonText}>提交</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: small.lg,
    paddingVertical: heightSmall.md,
    paddingBottom: heightSmall.md,
    backgroundColor: '#FFFFFF',
    borderTopWidth: small.xs,
    borderTopColor: '#E0E0E0',
    gap: small.md,
  },
  hintText: {
    fontSize: fontSmall.sm,
    color: '#999999',
    textAlign: 'center',
    width: '100%',
  },
  dontKnowButton: {
    backgroundColor: '#9E9E9E',
    flex: 1,
    height: heightPercent((40 * 100) / 844),
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: small.md,
  },
  submitButton: {
    backgroundColor: '#2196F3',
    flex: 1.5,
    height: heightPercent((40 * 100) / 844),
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: small.md,
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  buttonText: {
    fontSize: fontSmall.sm,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});