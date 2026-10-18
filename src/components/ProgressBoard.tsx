import React from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, ScrollView } from 'react-native';
import { colors, fontFamily, fontSize, radius, spacing, shadow } from '../utils/theme';
import { useAppStore } from '../stores/useAppStore';
import type { AnswerStatus } from '../types';

const COLOR_MAP: Record<AnswerStatus | 'default', string> = {
  correct: colors.success,
  wrong: colors.danger,
  partial: colors.warning,
  unanswered: colors.borderStrong,
  locked: colors.borderStrong,
  default: colors.borderStrong,
};

export default function ProgressBoard() {
  const progressMap = useAppStore((state) => state.progressMap);
  const currentIndex = useAppStore((state) => state.currentIndex);
  const isExpanded = useAppStore((state) => state.isProgressBoardExpanded);
  const goToQuestion = useAppStore((state) => state.goToQuestion);
  const toggleProgressBoard = useAppStore(
    (state) => state.toggleProgressBoard
  );
  const getCurrentQuestions = useAppStore((state) => state.getCurrentQuestions);

  const currentQuestions = getCurrentQuestions();

  const getStatus = (questionId: string): AnswerStatus => {
    return progressMap[questionId]?.status || 'unanswered';
  };

  const handleDotClick = (index: number) => {
    goToQuestion(index);
  };

  const renderCompact = () => {
    const startIdx = Math.floor(currentIndex / 5) * 5;
    const endIdx = Math.min(startIdx + 5, currentQuestions.length);
    const visibleQuestions = currentQuestions.slice(startIdx, endIdx);

    return (
      <View style={styles.compactContainer}>
        {visibleQuestions.map((q, i) => {
          const absoluteIndex = startIdx + i;
          const status = getStatus(q.id);
          return (
            <TouchableOpacity
              key={q.id}
              style={[
                styles.dot,
                { backgroundColor: COLOR_MAP[status] },
                absoluteIndex === currentIndex && styles.dotActive,
              ]}
              onPress={() => handleDotClick(absoluteIndex)}
            />
          );
        })}
      </View>
    );
  };

  const renderExpanded = () => {
    const groups: { start: number; end: number; questions: typeof currentQuestions }[] = [];
    for (let i = 0; i < currentQuestions.length; i += 5) {
      groups.push({
        start: i,
        end: Math.min(i + 5, currentQuestions.length),
        questions: currentQuestions.slice(i, Math.min(i + 5, currentQuestions.length)),
      });
    }

    return (
      <Modal
        visible={isExpanded}
        transparent={true}
        animationType="slide"
        onRequestClose={toggleProgressBoard}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>题目进度</Text>
              <TouchableOpacity onPress={toggleProgressBoard}>
                <Text style={styles.closeButton}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.groupsContainer} showsVerticalScrollIndicator={false}>
              {groups.map((group, gi) => (
                <View key={gi} style={styles.groupContainer}>
                  <Text style={styles.groupTitle}>
                    第 {gi + 1} 组（{group.start + 1}-{group.end}）
                  </Text>
                  <View style={styles.groupDots}>
                    {group.questions.map((q, i) => {
                      const absoluteIndex = group.start + i;
                      const status = getStatus(q.id);
                      return (
                        <TouchableOpacity
                          key={q.id}
                          style={[
                            styles.expandedDot,
                            { backgroundColor: COLOR_MAP[status] },
                            absoluteIndex === currentIndex && styles.dotActive,
                          ]}
                          onPress={() => handleDotClick(absoluteIndex)}
                        >
                          <Text style={styles.dotLabel}>
                            {absoluteIndex + 1}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              ))}
            </ScrollView>

            <View style={styles.legendContainer}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: COLOR_MAP.correct }]} />
                <Text style={styles.legendText}>正确</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: COLOR_MAP.wrong }]} />
                <Text style={styles.legendText}>错误</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: COLOR_MAP.partial }]} />
                <Text style={styles.legendText}>部分对</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: COLOR_MAP.unanswered }]} />
                <Text style={styles.legendText}>未做</Text>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  return (
    <>
      {!isExpanded && renderCompact()}
      {renderExpanded()}
    </>
  );
}

const styles = StyleSheet.create({
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    backgroundColor: colors.paper,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  dot: {
    width: radius.sm,
    height: radius.sm,
    borderRadius: radius.pill,
    marginHorizontal: spacing.sm,
    borderWidth: 1.5,
    borderColor: colors.paper,
  },
  dotActive: {
    borderWidth: 2,
    borderColor: colors.primary,
    transform: [{ scale: 1.25 }],
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(32, 54, 78, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '86%',
    maxWidth: 420,
    maxHeight: '80%',
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
    ...shadow.card,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  modalTitle: {
    fontFamily,
    fontSize: fontSize.lg,
    fontWeight: 'bold',
    color: colors.primaryDeep,
  },
  closeButton: {
    fontSize: fontSize.lg,
    color: colors.textFaint,
    padding: spacing.xs,
  },
  groupsContainer: {
    maxHeight: 340,
  },
  groupContainer: {
    marginBottom: spacing.lg,
  },
  groupTitle: {
    fontFamily,
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginBottom: spacing.sm,
    fontWeight: '600',
  },
  groupDots: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  expandedDot: {
    width: 30,
    height: 30,
    borderRadius: radius.pill,
    marginHorizontal: 3,
    marginVertical: 3,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.surface,
  },
  dotLabel: {
    fontFamily,
    fontSize: fontSize.xs,
    color: colors.white,
    fontWeight: 'bold',
  },
  legendContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    marginTop: spacing.lg,
    paddingTop: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.sm,
    marginVertical: spacing.xs,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: radius.pill,
    marginRight: spacing.sm,
  },
  legendText: {
    fontFamily,
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
});
