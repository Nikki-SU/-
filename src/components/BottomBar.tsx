import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useAppStore } from '../stores/useAppStore';
import { colors, fontFamily, fontSize, radius, spacing, shadow } from '../utils/theme';

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
        <Text style={styles.hintText}>点击卡片进入下一题</Text>
      </View>
    );
  }

  const isMultiSelect = question.type === 'multi';

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.button, styles.dontKnowButton]}
        onPress={() => markDontKnow(question.id)}
        activeOpacity={0.8}
      >
        <Text style={styles.dontKnowText}>不会</Text>
      </TouchableOpacity>

      {isMultiSelect && (
        <TouchableOpacity
          style={[
            styles.button,
            styles.submitButton,
            progress?.selected.length === 0 && styles.buttonDisabled,
          ]}
          onPress={() => submitAnswer(question.id)}
          disabled={progress?.selected.length === 0}
          activeOpacity={0.8}
        >
          <Text style={styles.submitText}>提交</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.paper,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    gap: spacing.md,
  },
  hintText: {
    fontFamily,
    fontSize: fontSize.sm,
    color: colors.textFaint,
    textAlign: 'center',
    width: '100%',
  },
  button: {
    flex: 1,
    height: 46,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: radius.md,
  },
  dontKnowButton: {
    backgroundColor: colors.paperDeep,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  submitButton: {
    flex: 1.4,
    backgroundColor: colors.primary,
    ...shadow.soft,
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  dontKnowText: {
    fontFamily,
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.textMuted,
    letterSpacing: 1,
  },
  submitText: {
    fontFamily,
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.white,
    letterSpacing: 1,
  },
});
