import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { responsiveWidth, responsiveHeight, responsiveFontSize } from '../utils/responsive';
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
    paddingHorizontal: responsiveWidth(12),
    paddingVertical: responsiveHeight(8),
    paddingBottom: responsiveHeight(10),
    backgroundColor: '#FFFFFF',
    borderTopWidth: responsiveWidth(1),
    borderTopColor: '#E0E0E0',
    gap: responsiveWidth(8),
  },
  hintText: {
    fontSize: responsiveFontSize(13),
    color: '#999999',
    textAlign: 'center',
    width: '100%',
  },
  dontKnowButton: {
    backgroundColor: '#9E9E9E',
    flex: 1,
    height: responsiveHeight(40),
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: responsiveWidth(6),
  },
  submitButton: {
    backgroundColor: '#2196F3',
    flex: 1.5,
    height: responsiveHeight(40),
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: responsiveWidth(6),
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  buttonText: {
    fontSize: responsiveFontSize(14),
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
