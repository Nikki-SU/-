import React from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, ScrollView } from 'react-native';
import { useAppStore } from '../stores/useAppStore';
import type { AnswerStatus } from '../types';

const COLOR_MAP: Record<AnswerStatus | 'default', string> = {
  correct: '#4CAF50',
  wrong: '#F44336',
  partial: '#FF9800',
  unanswered: '#CCCCCC',
  default: '#CCCCCC',
};

export default function ProgressBoard() {
  const questions = useAppStore((state) => state.questions);
  const progressMap = useAppStore((state) => state.progressMap);
  const currentIndex = useAppStore((state) => state.currentIndex);
  const isExpanded = useAppStore((state) => state.isProgressBoardExpanded);
  const isInWrongBank = useAppStore((state) => state.isInWrongBank);
  const wrongBankIds = useAppStore((state) => state.wrongBankIds);
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
    height: '6%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginHorizontal: 8,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  dotActive: {
    borderWidth: 3,
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
    borderRadius: 16,
    padding: '5%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '5%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333333',
  },
  closeButton: {
    fontSize: 20,
    color: '#999999',
    padding: '2%',
  },
  groupsContainer: {
    maxHeight: '50%',
  },
  groupContainer: {
    marginBottom: '6%',
  },
  groupTitle: {
    fontSize: 14,
    color: '#666666',
    marginBottom: '3%',
    fontWeight: '600',
  },
  groupDots: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  expandedDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    margin: 6,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  dotLabel: {
    fontSize: 10,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  legendContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    marginTop: '5%',
    paddingTop: '5%',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: '3%',
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 6,
  },
  legendText: {
    fontSize: 12,
    color: '#666666',
  },
});