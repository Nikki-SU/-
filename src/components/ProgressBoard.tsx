import React from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, ScrollView } from 'react-native';
import { responsiveWidth, responsiveHeight, responsiveFontSize } from '../utils/responsive';
import { useAppStore } from '../stores/useAppStore';
import type { AnswerStatus } from '../types';

const COLOR_MAP: Record<AnswerStatus | 'default', string> = {
  correct: '#4CAF50',
  wrong: '#F44336',
  partial: '#FF9800',
  unanswered: '#CCCCCC',
  locked: '#CCCCCC',
  default: '#CCCCCC',
};

export default function ProgressBoard() {
  const questions = useAppStore((state) => state.questions);
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
    const groups: { start: number; end: number; questions: typeof questions }[] = [];
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
              <Text style={styles.modalTitle}>📋 全部题目进度</Text>
              <TouchableOpacity onPress={toggleProgressBoard}>
                <Text style={styles.closeButton}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.groupsContainer}>
              {groups.map((group, gi) => (
                <View key={gi} style={styles.groupContainer}>
                  <Text style={styles.groupTitle}>
                    第{gi + 1}组 ({group.start + 1}-{group.end}题):
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
    height: responsiveHeight(32),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: responsiveWidth(1),
    borderBottomColor: '#E0E0E0',
  },
  dot: {
    width: responsiveWidth(14),
    height: responsiveHeight(14),
    borderRadius: responsiveWidth(7),
    marginHorizontal: responsiveWidth(6),
    borderWidth: responsiveWidth(2),
    borderColor: '#FFFFFF',
  },
  dotActive: {
    borderWidth: responsiveWidth(3),
    borderColor: '#4A90D9',
    transform: [{ scale: 1.2 }],
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '85%',
    maxHeight: '80%',
    backgroundColor: '#FFFFFF',
    borderRadius: responsiveWidth(12),
    padding: responsiveWidth(14),
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: responsiveHeight(12),
  },
  modalTitle: {
    fontSize: responsiveFontSize(16),
    fontWeight: 'bold',
    color: '#333333',
  },
  closeButton: {
    fontSize: responsiveFontSize(18),
    color: '#999999',
    padding: responsiveWidth(6),
  },
  groupsContainer: {
    maxHeight: responsiveHeight(280),
  },
  groupContainer: {
    marginBottom: responsiveHeight(12),
  },
  groupTitle: {
    fontSize: responsiveFontSize(12),
    color: '#666666',
    marginBottom: responsiveHeight(6),
    fontWeight: '600',
  },
  groupDots: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  expandedDot: {
    width: responsiveWidth(28),
    height: responsiveHeight(28),
    borderRadius: responsiveWidth(14),
    marginHorizontal: responsiveWidth(4),
    marginVertical: responsiveHeight(4),
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: responsiveWidth(2),
    borderColor: '#FFFFFF',
  },
  dotLabel: {
    fontSize: responsiveFontSize(10),
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  legendContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    marginTop: responsiveHeight(12),
    paddingTop: responsiveHeight(12),
    borderTopWidth: responsiveWidth(1),
    borderTopColor: '#E0E0E0',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: responsiveWidth(6),
    marginVertical: responsiveHeight(4),
  },
  legendDot: {
    width: responsiveWidth(12),
    height: responsiveHeight(12),
    borderRadius: responsiveWidth(6),
    marginRight: responsiveWidth(4),
  },
  legendText: {
    fontSize: responsiveFontSize(12),
    color: '#666666',
  },
});
