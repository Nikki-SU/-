import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { responsiveWidth, responsiveHeight, responsiveFontSize } from '../utils/responsive';
import { getOptionColor } from '../utils/answerChecker';
import { useAppStore } from '../stores/useAppStore';
import type { AnswerStatus, ColorType } from '../types';

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
  questionId: string;
  correctAnswer: string;
  selected: string[];
  status: AnswerStatus;
  locked?: boolean;
}

export default function OptionButton({
  label,
  text,
  questionId,
  correctAnswer,
  selected,
  status,
  locked = false,
}: OptionButtonProps) {
  const selectOption = useAppStore((state) => state.selectOption);

  const color = getOptionColor(label, selected, correctAnswer, status);
  const colors = COLOR_MAP[color];
  const isDisabled = locked || status === 'locked' || status === 'correct' || status === 'wrong' || status === 'partial';

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
          backgroundColor: colors.bg,
          borderColor: colors.border,
        },
        isDisabled && styles.disabledContainer,
      ]}
      onPress={handlePress}
      activeOpacity={isDisabled ? 1 : 0.7}
      disabled={isDisabled}
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
      {isDisabled && (
        <Text style={styles.lockIcon}>🔒</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minHeight: 0,
    paddingVertical: responsiveHeight(6),
    paddingHorizontal: responsiveWidth(10),
    marginVertical: responsiveHeight(3),
    borderRadius: responsiveWidth(6),
    borderWidth: responsiveWidth(2),
  },
  disabledContainer: {
    opacity: 0.95,
  },
  labelCircle: {
    width: responsiveWidth(26),
    height: responsiveHeight(26),
    borderRadius: responsiveWidth(13),
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: responsiveWidth(10),
    flexShrink: 0,
  },
  labelText: {
    fontSize: responsiveFontSize(14),
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  textContainer: {
    flex: 1,
  },
  optionText: {
    fontSize: responsiveFontSize(14),
    lineHeight: responsiveFontSize(18),
  },
  lockIcon: {
    fontSize: responsiveFontSize(12),
    marginLeft: responsiveWidth(6),
  },
});
