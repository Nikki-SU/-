import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { getOptionColorBasedOnContent } from '../utils/shuffleUtils';
import { useAppStore } from '../stores/useAppStore';
import { colors, fontFamily, fontSize, radius, spacing } from '../utils/theme';
import type { AnswerStatus, ColorType, Question } from '../types';

const COLOR_MAP: Record<ColorType, { bg: string; border: string; text: string; badge: string }> = {
  gray: { bg: colors.surface, border: colors.border, text: colors.text, badge: colors.neutral },
  blue: { bg: colors.primarySoft, border: colors.primary, text: colors.primaryDeep, badge: colors.primary },
  green: { bg: colors.successSoft, border: colors.success, text: colors.success, badge: colors.success },
  red: { bg: colors.dangerSoft, border: colors.danger, text: colors.danger, badge: colors.danger },
  yellow: { bg: colors.warningSoft, border: colors.warning, text: colors.warning, badge: colors.warning },
};

interface OptionButtonProps {
  label: string;
  text: string;
  questionId: string;
  correctAnswer: string;
  correctAnswerContent: string;
  selected: string[];
  selectedContents: string[];
  status: AnswerStatus;
  locked?: boolean;
  question?: Question;
}

export default function OptionButton({
  label,
  text,
  questionId,
  correctAnswer,
  correctAnswerContent,
  selected,
  selectedContents,
  status,
  locked = false,
  question,
}: OptionButtonProps) {
  const selectOption = useAppStore((state) => state.selectOption);

  const colorType = getOptionColorBasedOnContent(
    question!,
    label,
    selectedContents,
    correctAnswerContent,
    status
  );
  const palette = COLOR_MAP[colorType];
  const isDisabled = locked || status !== 'unanswered';

  const handlePress = () => {
    if (!isDisabled) {
      selectOption(questionId, label);
    }
  };

  return (
    <TouchableOpacity
      style={[
        styles.container,
        {
          backgroundColor: palette.bg,
          borderColor: palette.border,
        },
        isDisabled && styles.disabledContainer,
      ]}
      onPress={handlePress}
      activeOpacity={isDisabled ? 1 : 0.7}
      disabled={isDisabled}
    >
      <View style={[styles.labelCircle, { backgroundColor: palette.badge }]}>
        <Text style={styles.labelText}>{label}</Text>
      </View>
      <View style={styles.textContainer}>
        <Text style={[styles.optionText, { color: palette.text }]}>{text}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    marginVertical: spacing.xs,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  disabledContainer: {
    opacity: 0.96,
  },
  labelCircle: {
    width: 26,
    height: 26,
    borderRadius: radius.pill,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
    flexShrink: 0,
  },
  labelText: {
    fontFamily,
    fontSize: fontSize.sm,
    fontWeight: 'bold',
    color: colors.white,
  },
  textContainer: {
    flex: 1,
  },
  optionText: {
    fontFamily,
    fontSize: fontSize.md,
    lineHeight: 24,
  },
});
