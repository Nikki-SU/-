import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { getOptionColor } from '../utils/answerChecker';
import { useAppStore } from '../stores/useAppStore';
import type { ColorType } from '../types';

const COLOR_MAP: Record<ColorType, { bg: string; border: string; text: string }> = {
  gray: { bg: '#F5F5F5', border: '#E0E0E0', text: '#666666' },
  blue: { bg: '#E3F2FD', border: '#4A90D9', text: '#4A90D9' },
  green: { bg: '#E8F5E9', border: '#4CAF50', text: '#4CAF50' },
  red: { bg: '#FFEBEE', border: '#F44336', text: '#F44336' },
  yellow: { bg: '#FFF8E1', border: '#FF9800', text: '#FF9800' },
};

interface OptionButtonProps {
  label: string;
  text: string;
}

export default function OptionButton({ label, text }: OptionButtonProps) {
  const questions = useAppStore((state) => state.questions);
  const progressMap = useAppStore((state) => state.progressMap);
  const currentIndex = useAppStore((state) => state.currentIndex);
  const selectOption = useAppStore((state) => state.selectOption);
  const getCurrentQuestions = useAppStore((state) => state.getCurrentQuestions);

  const currentQuestions = getCurrentQuestions();
  const question = currentQuestions[currentIndex];
  if (!question) return null;

  const progress = progressMap[question.id];
  const status = progress?.status || 'unanswered';

  const color = getOptionColor(
    label,
    progress?.selected || [],
    question.answer,
    status
  );

  const colors = COLOR_MAP[color];
  const isDisabled = status !== 'unanswered';

  const handlePress = () => {
    if (!isDisabled) {
      selectOption(question.id, label);
    }
  };

  return (
    <TouchableOpacity
      style={[
        styles.container,
        {
          backgroundColor: colors.bg,
          borderColor: colors.border,
        },
      ]}
      onPress={handlePress}
      activeOpacity={isDisabled ? 1 : 0.7}
    >
      <View
        style={[
          styles.labelCircle,
          {
            backgroundColor: colors.border,
          },
        ]}
      >
        <Text style={styles.labelText}>{label}</Text>
      </View>
      <View style={styles.textContainer}>
        <Text style={[styles.optionText, { color: colors.text }]}>
          {text}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: '2.5%',
    paddingHorizontal: '4%',
    marginVertical: '1%',
    borderRadius: 10,
    borderWidth: 2,
  },
  labelCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: '3%',
  },
  labelText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  textContainer: {
    flex: 1,
  },
  optionText: {
    fontSize: 16,
    lineHeight: 22,
  },
});