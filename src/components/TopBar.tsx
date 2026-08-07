import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useAppStore } from '../stores/useAppStore';

const COLORS = {
  primary: '#4A90D9',
  background: '#F5F7FA',
  text: '#333333',
  textLight: '#999999',
  star: '#FFD700',
  starInactive: '#CCCCCC',
  border: '#E0E0E0',
};

export default function TopBar() {
  const questions = useAppStore((state) => state.questions);
  const currentIndex = useAppStore((state) => state.currentIndex);
  const favoritesIds = useAppStore((state) => state.favoritesIds);
  const isInWrongBank = useAppStore((state) => state.isInWrongBank);
  const toggleProgressBoard = useAppStore(
    (state) => state.toggleProgressBoard
  );
  const toggleFavorite = useAppStore((state) => state.toggleFavorite);
  const exitWrongBank = useAppStore((state) => state.exitWrongBank);
  const getCurrentQuestions = useAppStore((state) => state.getCurrentQuestions);

  const currentQuestions = getCurrentQuestions();
  const currentQuestion = currentQuestions[currentIndex];
  const isFavorite = currentQuestion
    ? favoritesIds.includes(currentQuestion.id)
    : false;

  const displayTotal = isInWrongBank
    ? useAppStore.getState().wrongBankIds.length
    : questions.length;

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.iconButton}
        onPress={() => {
          if (isInWrongBank) {
            exitWrongBank();
          }
        }}
      >
        <Text style={styles.iconText}>
          {isInWrongBank ? '←' : '⭐'}
        </Text>
      </TouchableOpacity>

      <View style={styles.centerContainer}>
        <Text style={styles.progressText}>
          {isInWrongBank ? '错题' : ''} 第 {currentIndex + 1}/{displayTotal} 题
        </Text>
      </View>

      <View style={styles.rightContainer}>
        <TouchableOpacity
          style={styles.iconButton}
          onPress={() => {
            if (currentQuestion) {
              toggleFavorite(currentQuestion.id);
            }
          }}
        >
          <Text
            style={[
              styles.iconText,
              isFavorite && { color: COLORS.star },
            ]}
          >
            ★
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.iconButton}
          onPress={toggleProgressBoard}
        >
          <Text style={styles.iconText}>📋</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: '8%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: '4%',
    backgroundColor: COLORS.background,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
  },
  progressText: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
  },
  rightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    padding: '2%',
    marginHorizontal: '2%',
  },
  iconText: {
    fontSize: 24,
    color: COLORS.starInactive,
  },
});