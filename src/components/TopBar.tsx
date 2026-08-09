import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { widthPercent, heightPercent, fontSizePercent, small, fontSmall, heightSmall } from '../utils/responsive';
import { useAppStore } from '../stores/useAppStore';
import { generateQuestionsMarkdown, downloadMarkdown } from '../utils/exportUtils';

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
  const isInFavoritesBank = useAppStore((state) => state.isInFavoritesBank);
  const toggleProgressBoard = useAppStore(
    (state) => state.toggleProgressBoard
  );
  const toggleFavorite = useAppStore((state) => state.toggleFavorite);
  const exitWrongBank = useAppStore((state) => state.exitWrongBank);
  const exitFavoritesBank = useAppStore((state) => state.exitFavoritesBank);
  const goHome = useAppStore((state) => state.goHome);
  const getCurrentQuestions = useAppStore((state) => state.getCurrentQuestions);
  const currentBank = useAppStore((state) => state.getCurrentBank());

  const currentQuestions = getCurrentQuestions();
  const currentQuestion = currentQuestions[currentIndex];
  const isFavorite = currentQuestion
    ? favoritesIds.includes(currentQuestion.id)
    : false;

  const displayTotal = isInFavoritesBank
    ? favoritesIds.length
    : isInWrongBank
    ? useAppStore.getState().wrongBankIds.length
    : currentQuestions.length;

  const displayName = isInFavoritesBank
    ? '收藏'
    : isInWrongBank
    ? '错题'
    : (currentBank?.name || '');

  const handleBack = () => {
    if (isInFavoritesBank) {
      exitFavoritesBank();
    } else if (isInWrongBank) {
      exitWrongBank();
    } else {
      goHome();
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.iconButton} onPress={handleBack}>
        <Text style={styles.iconText}>←</Text>
      </TouchableOpacity>

      <View style={styles.centerContainer}>
        {displayName ? (
          <Text style={styles.bankNameText} numberOfLines={1}>
            {displayName}
          </Text>
        ) : null}
        <Text style={styles.progressText}>
          {currentIndex + 1}/{displayTotal}
        </Text>
      </View>

      <View style={styles.rightContainer}>
        {currentQuestions.length > 0 && (
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => {
              if (currentQuestions.length > 0) {
                const md = generateQuestionsMarkdown(currentQuestions);
                let name = '题目';
                if (isInFavoritesBank) name = '收藏题目';
                else if (isInWrongBank) name = '错题';
                else if (currentBank) name = currentBank.name;
                downloadMarkdown(`${name}_${Date.now()}.md`, md);
              }
            }}
          >
            <Text style={styles.iconText}>📤</Text>
          </TouchableOpacity>
        )}

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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: small.lg,
    paddingVertical: heightSmall.md,
    backgroundColor: COLORS.background,
    borderBottomWidth: small.xs,
    borderBottomColor: COLORS.border,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
  },
  progressText: {
    fontSize: fontSmall.md,
    fontWeight: '600',
    color: COLORS.text,
  },
  bankNameText: {
    fontSize: fontSmall.xs,
    color: COLORS.primary,
    fontWeight: '600',
    maxWidth: '60%',
    overflow: 'hidden',
  },
  rightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    padding: small.md,
    marginHorizontal: small.sm,
  },
  iconText: {
    fontSize: fontSmall.lg,
    color: COLORS.starInactive,
  },
});