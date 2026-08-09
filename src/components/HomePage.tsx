import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { useAppStore, type BatchImportResult, type ImportFileResult } from '../stores/useAppStore';
import { isFileSystemAccessSupported, clearDirHandle, readUploadedFile, downloadFile } from '../utils/fileStorage';
import { buildPrompt, AI_GENERATOR_PROMPT } from '../utils/promptTemplate';
import type { Bank } from '../types';
import { responsiveWidth, responsiveHeight, responsiveFontSize } from '../utils/responsive';

export default function HomePage() {
  const [showImport, setShowImport] = useState(false);
  const [showBankManager, setShowBankManager] = useState(false);
  const [showDataSettings, setShowDataSettings] = useState(false);
  const [customPath, setCustomPath] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<BatchImportResult | null>(null);
  const [showFormatHelp, setShowFormatHelp] = useState(false);
  const [showPromptGenerator, setShowPromptGenerator] = useState(false);
  const [promptTopic, setPromptTopic] = useState('');
  const [promptTotal, setPromptTotal] = useState('10');
  const [promptMulti, setPromptMulti] = useState('2');
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [showWrongDetail, setShowWrongDetail] = useState(false);
  const [showFavDetail, setShowFavDetail] = useState(false);

  const banks = useAppStore((state) => state.banks);
  const currentBankId = useAppStore((state) => state.currentBankId);
  const addBank = useAppStore((state) => state.addBank);
  const importMarkdownFiles = useAppStore((state) => state.importMarkdownFiles);
  const switchBank = useAppStore((state) => state.switchBank);
  const deleteBank = useAppStore((state) => state.deleteBank);
  const renameBank = useAppStore((state) => state.renameBank);
  const currentBank = useAppStore((state) => state.getCurrentBank());
  const showToast = useAppStore((state) => state.showToast);
  const setShowHome = useAppStore((state) => state.setShowHome);
  const wrongBankIds = useAppStore((state) => state.wrongBankIds);
  const favoritesIds = useAppStore((state) => state.favoritesIds);
  const clearAllFavorites = useAppStore((state) => state.clearAllFavorites);
  const dataPath = useAppStore((state) => state.dataPath);
  const initializeDataPath = useAppStore((state) => state.initializeDataPath);
  const setCustomDataPath = useAppStore((state) => state.setCustomDataPath);
  const selectDataDirectory = useAppStore((state) => state.selectDataDirectory);
  const loadFromCSV = useAppStore((state) => state.loadFromCSV);
  const isLoading = useAppStore((state) => state.isLoading);
  const exportAllData = useAppStore((state) => state.exportAllData);
  const importAllData = useAppStore((state) => state.importAllData);
  const resetAll = useAppStore((state) => state.resetAll);
  const getWrongBankBranches = useAppStore((state) => state.getWrongBankBranches);
  const getFavoriteBranches = useAppStore((state) => state.getFavoriteBranches);
  const enterWrongBankBranch = useAppStore((state) => state.enterWrongBankBranch);
  const enterFavoriteBranch = useAppStore((state) => state.enterFavoriteBranch);
  const clearWrongBranchProgress = useAppStore((state) => state.clearWrongBranchProgress);
  const clearFavoriteBranchProgress = useAppStore((state) => state.clearFavoriteBranchProgress);
  const exportWrongBranch = useAppStore((state) => state.exportWrongBranch);
  const exportWrongAll = useAppStore((state) => state.exportWrongAll);
  const exportFavoriteBranch = useAppStore((state) => state.exportFavoriteBranch);
  const exportFavoriteAll = useAppStore((state) => state.exportFavoriteAll);

  const totalWrongCount = banks.reduce((sum, bank) => sum + bank.wrongBankIds.length, 0);
  const totalFavCount = banks.reduce((sum, bank) => sum + bank.favoritesIds.length, 0);

  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const dataFileInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    initializeDataPath();
  }, []);

  const handleFiles = useCallback(async (fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    if (files.length === 0) return;

    setIsImporting(true);
    setImportResult(null);

    try {
      const fileDataPromises = files
        .filter(f => f.name.toLowerCase().endsWith('.md') || f.name.toLowerCase().endsWith('.markdown'))
        .map(async (f) => ({
          name: f.name,
          content: await readUploadedFile(f),
        }));

      const fileData = await Promise.all(fileDataPromises);

      if (fileData.length === 0) {
        showToast('请选择 .md 格式的文件');
        setIsImporting(false);
        return;
      }

      const result = await importMarkdownFiles(fileData);
      setImportResult(result);

      if (result.successCount > 0) {
        const firstSuccess = result.results.find(r => r.questionsCount > 0);
        if (firstSuccess) {
          setShowImport(false);
          setShowHome(false);
        }
      }
    } catch (e) {
      console.error('Import failed:', e);
      showToast('导入失败，请检查文件');
    } finally {
      setIsImporting(false);
    }
  }, [importMarkdownFiles, setShowHome, showToast]);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      await handleFiles(files);
    }
  }, [handleFiles]);

  const handleSelectBank = (bankId: string) => {
    switchBank(bankId);
    setShowImport(false);
    setShowHome(false);
    setShowBankManager(false);
  };

  const handleDeleteBank = (bank: Bank) => {
    const isWeb = typeof window !== 'undefined';
    if (isWeb) {
      if (window.confirm(`确定要删除"${bank.name}"吗？此操作不可恢复。`)) {
        deleteBank(bank.id);
      }
    } else {
      Alert.alert(
        '删除题库',
        `确定要删除"${bank.name}"吗？此操作不可恢复。`,
        [
          { text: '取消', style: 'cancel' },
          { text: '删除', style: 'destructive', onPress: () => deleteBank(bank.id) },
        ]
      );
    }
  };

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  const startRename = (bank: Bank) => {
    setEditingId(bank.id);
    setEditingName(bank.name);
  };

  const confirmRename = () => {
    if (editingId && editingName.trim()) {
      renameBank(editingId, editingName.trim());
    }
    setEditingId(null);
    setEditingName('');
  };

  const getBankBasicStats = (bank: Bank) => {
    const total = bank.questions.length;
    let answered = 0;
    bank.questions.forEach(q => {
      const p = bank.progressMap[q.id];
      if (p && p.status !== 'unanswered') answered++;
    });
    return { total, answered };
  };

  const getBankStats = useCallback((bankId: string) => {
    const bank = banks.find(b => b.id === bankId);
    if (!bank) return { wrong: 0, favorite: 0 };
    const wrongCount = bank.wrongBankIds.length;
    const favCount = bank.favoritesIds.length;
    return { wrong: wrongCount, favorite: favCount };
  }, [banks]);

  if (showImport) {
    const generatedPrompt = promptTopic.trim()
      ? buildPrompt(promptTopic.trim(), parseInt(promptTotal) || 10, parseInt(promptMulti) || 0)
      : AI_GENERATOR_PROMPT;

    const copyToClipboard = (text: string) => {
      const isWeb = typeof window !== 'undefined';
      if (isWeb && navigator.clipboard) {
        navigator.clipboard.writeText(text).then(() => {
          setCopiedPrompt(true);
          setTimeout(() => setCopiedPrompt(false), 2000);
        }).catch(() => {
          showToast('复制失败，请手动复制');
        });
      } else {
        showToast('请在 Web 端使用复制功能');
      }
    };

    return (
      <View style={styles.container}>
        <View style={styles.editorHeader}>
          <TouchableOpacity onPress={() => { setShowImport(false); setImportResult(null); }}>
            <Text style={styles.backButton}>← 返回</Text>
          </TouchableOpacity>
          <Text style={styles.editorTitle}>导入题库</Text>
          <TouchableOpacity onPress={() => setShowFormatHelp(!showFormatHelp)}>
            <Text style={styles.sampleButton}>格式说明</Text>
          </TouchableOpacity>
        </View>

        {showFormatHelp && (
          <View style={styles.helpBox}>
            <Text style={styles.helpTitle}>📋 Markdown 格式要求</Text>
            <Text style={styles.helpText}>• 支持 --- 分隔符 或 ## 标题 或 编号 格式</Text>
            <Text style={styles.helpText}>• 选项格式：A. 选项内容（依次 A→B→C→D）</Text>
            <Text style={styles.helpText}>• 答案格式：答案：A（单选）或 答案：ABCD（多选）</Text>
            <Text style={styles.helpText}>• 解析格式：**解析：** 内容（可选）</Text>
            <Text style={styles.helpText}>• 文件名为题库名称</Text>
            <TouchableOpacity
              style={styles.promptGenButton}
              onPress={() => setShowPromptGenerator(!showPromptGenerator)}
            >
              <Text style={styles.promptGenButtonText}>
                {showPromptGenerator ? '▲ 收起 AI Prompt' : '✨ 使用 AI 生成（一键复制 Prompt）'}
              </Text>
            </TouchableOpacity>

            {showPromptGenerator && (
              <View style={styles.promptGenerator}>
                <Text style={styles.promptGenSubtitle}>自定义 Prompt 参数</Text>

                <View style={styles.promptInputRow}>
                  <Text style={styles.promptInputLabel}>主题/知识点：</Text>
                  <TextInput
                    style={styles.promptInput}
                    placeholder="如：有机化学、React基础"
                    value={promptTopic}
                    onChangeText={setPromptTopic}
                  />
                </View>

                <View style={styles.promptInputRowInline}>
                  <View style={styles.promptInputInlineItem}>
                    <Text style={styles.promptInputLabel}>总题数：</Text>
                    <TextInput
                      style={styles.promptSmallInput}
                      value={promptTotal}
                      onChangeText={setPromptTotal}
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={styles.promptInputInlineItem}>
                    <Text style={styles.promptInputLabel}>多选题数：</Text>
                    <TextInput
                      style={styles.promptSmallInput}
                      value={promptMulti}
                      onChangeText={setPromptMulti}
                      keyboardType="numeric"
                    />
                  </View>
                </View>

                <View style={styles.promptPreviewBox}>
                  <Text style={styles.promptPreviewText} selectable>
                    {generatedPrompt}
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.copyButton}
                  onPress={() => copyToClipboard(generatedPrompt)}
                >
                  <Text style={styles.copyButtonText}>
                    {copiedPrompt ? '✓ 已复制！' : '📋 一键复制 Prompt'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.copyButton, styles.exportMdButton]}
                  onPress={() => {
                    downloadFile(`AI题库生成Prompt_${Date.now()}.md`, generatedPrompt, 'text/markdown');
                    showToast('已导出为 .md 文件');
                  }}
                >
                  <Text style={styles.copyButtonText}>📥 导出为 .md 文件</Text>
                </TouchableOpacity>

                <Text style={styles.promptHint}>
                  复制后粘贴到 AI 对话中，将生成可直接导入的题库
                </Text>
              </View>
            )}
          </View>
        )}

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: responsiveHeight(20) }}>
          {!importResult ? (
            <View
              style={[styles.dropZone, isDragging && styles.dropZoneActive]}
              {...({
                onDragEnter: (e: any) => { e.preventDefault(); setIsDragging(true); },
                onDragOver: (e: any) => { e.preventDefault(); setIsDragging(true); },
                onDragLeave: (e: any) => { e.preventDefault(); setIsDragging(false); },
                onDrop: handleDrop,
              } as any)}
            >
              {isImporting ? (
                <>
                  <ActivityIndicator size="large" color="#4A90D9" />
                  <Text style={styles.dropText}>正在解析文件...</Text>
                </>
              ) : (
                <>
                  <Text style={styles.dropIcon}>📂</Text>
                  <Text style={styles.dropTitle}>拖拽 .md 文件到这里</Text>
                  <Text style={styles.dropSubtitle}>支持多文件批量导入</Text>
                  <TouchableOpacity
                    style={styles.browseButton}
                    onPress={() => fileInputRef.current?.click()}
                  >
                    <Text style={styles.browseButtonText}>📁 选择文件</Text>
                  </TouchableOpacity>
                  <Text style={styles.dropHint}>文件名将自动作为题库名称</Text>
                </>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept=".md,.markdown"
                multiple
                style={{ display: 'none' }}
                onChange={async (e) => {
                  const files = e.target.files;
                  if (files && files.length > 0) {
                    await handleFiles(files);
                  }
                  e.target.value = '';
                }}
              />
            </View>
          ) : (
            <View style={styles.resultSection}>
              <View style={styles.resultHeader}>
                <Text style={styles.resultTitle}>导入结果</Text>
                <Text style={styles.resultStats}>
                  共 {importResult.totalFiles} 个文件 · 成功 {importResult.successCount} · 失败 {importResult.failCount}
                </Text>
              </View>

              {importResult.results.map((result, idx) => (
                <ResultCard key={idx} result={result} onSelect={handleSelectBank} />
              ))}

              <TouchableOpacity
                style={styles.importAgainButton}
                onPress={() => { setImportResult(null); setShowImport(false); }}
              >
                <Text style={styles.importAgainText}>完成</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </View>
    );
  }

  if (showBankManager) {
    return (
      <View style={styles.container}>
        <View style={styles.editorHeader}>
          <TouchableOpacity onPress={() => setShowBankManager(false)}>
            <Text style={styles.backButton}>← 返回</Text>
          </TouchableOpacity>
          <Text style={styles.editorTitle}>题库管理</Text>
          <View style={{ width: responsiveWidth(50) }} />
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: responsiveHeight(20) }}>
          {banks.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>📚</Text>
              <Text style={styles.emptyText}>还没有题库</Text>
              <Text style={styles.emptyDesc}>点击下方按钮导入或创建新题库</Text>
            </View>
          ) : (
            banks.map((bank) => {
              const stats = getBankBasicStats(bank);
              const isCurrent = bank.id === currentBankId;
              const isEditing = editingId === bank.id;
              return (
                <View key={bank.id} style={[styles.bankCard, isCurrent && styles.bankCardCurrent]}>
                  {isEditing ? (
                    <View style={styles.bankEditRow}>
                      <TextInput
                        style={styles.nameInput}
                        value={editingName}
                        onChangeText={setEditingName}
                        autoFocus
                      />
                      <TouchableOpacity style={styles.bankActionBtn} onPress={confirmRename}>
                        <Text style={styles.bankActionText}>保存</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.bankActionBtn} onPress={() => { setEditingId(null); setEditingName(''); }}>
                        <Text style={styles.bankActionText}>取消</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <>
                      <TouchableOpacity style={styles.bankInfo} onPress={() => handleSelectBank(bank.id)}>
                        <View style={styles.bankHeader}>
                          <Text style={styles.bankName}>{bank.name}</Text>
                          {isCurrent && <Text style={styles.currentBadge}>当前</Text>}
                        </View>
                        <Text style={styles.bankStats}>
                          {stats.answered}/{stats.total} 题已答
                          {bank.wrongBankIds.length > 0 ? ` · ${bank.wrongBankIds.length} 错题` : ''}
                        </Text>
                        <View style={styles.progressBar}>
                          <View
                            style={[
                              styles.progressFill,
                              { width: `${stats.total > 0 ? (stats.answered / stats.total) * 100 : 0}%` },
                            ]}
                          />
                        </View>
                      </TouchableOpacity>
                      <View style={styles.bankActions}>
                        <TouchableOpacity onPress={() => startRename(bank)}>
                          <Text style={styles.bankActionText}>✏️ 重命名</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => handleDeleteBank(bank)}>
                          <Text style={[styles.bankActionText, styles.deleteText]}>🗑️ 删除</Text>
                        </TouchableOpacity>
                      </View>
                    </>
                  )}
                </View>
              );
            })
          )}
        </ScrollView>

        <TouchableOpacity
          style={[styles.menuButton, styles.primaryButton]}
          onPress={() => { setShowBankManager(false); setShowImport(true); }}
        >
          <Text style={styles.menuIcon}>📥</Text>
          <Text style={styles.menuButtonText}>导入新题库</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const currentStats = currentBank ? getBankBasicStats(currentBank) : null;

  return (
    <View style={styles.container}>
      <ScrollView 
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
      {currentBank && currentStats ? (
        <View style={styles.currentBankSection}>
          <Text style={styles.currentBankLabel}>当前题库</Text>
          <TouchableOpacity style={styles.currentBankCard} onPress={() => handleSelectBank(currentBank.id)}>
            <Text style={styles.currentBankName}>{currentBank.name}</Text>
            <Text style={styles.currentBankStats}>
              {currentStats.answered}/{currentStats.total} 题已答
              {wrongBankIds.length > 0 ? ` · ${wrongBankIds.length} 错题` : ''}
            </Text>
            <View style={styles.progressBarLarge}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${currentStats.total > 0 ? (currentStats.answered / currentStats.total) * 100 : 0}%` },
                ]}
              />
            </View>
          </TouchableOpacity>
          <View style={styles.currentBankActions}>
            <TouchableOpacity
              style={styles.resumeButton}
              onPress={() => setShowHome(false)}
            >
              <Text style={styles.resumeButtonText}>继续刷题 →</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.manageButton}
              onPress={() => setShowBankManager(true)}
            >
              <Text style={styles.manageButtonText}>管理题库</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.manageButton, { borderColor: '#F44336' }]}
              onPress={() => {
                const isWeb = typeof window !== 'undefined';
                if (isWeb) {
                  if (window.confirm('确定要清空所有进度并重新开始吗？选项将被打乱。')) {
                    resetAll();
                  }
                } else {
                  Alert.alert(
                    '清空进度',
                    '确定要清空所有进度并重新开始吗？选项将被打乱。',
                    [
                      { text: '取消', style: 'cancel' },
                      { text: '确认', style: 'destructive', onPress: () => resetAll() },
                    ]
                  );
                }
              }}
            >
              <Text style={[styles.manageButtonText, { color: '#F44336' }]}>清空进度</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      {banks.length > 1 && (
        <TouchableOpacity
          style={styles.bankListButton}
          onPress={() => setShowBankManager(true)}
        >
          <Text style={styles.bankListText}>📁 切换题库（共 {banks.length} 个）</Text>
        </TouchableOpacity>
      )}

      <View style={styles.favoritesSection}>
        <Text style={styles.favoritesLabel}>收藏夹</Text>
        <TouchableOpacity 
          style={[styles.favoritesCard, totalFavCount === 0 && styles.emptyCard]}
          onPress={() => { 
            if (totalFavCount === 0) {
              showToast('还没有收藏的题目');
              return;
            }
            setShowFavDetail(!showFavDetail);
          }}
        >
          <View style={styles.favoritesInfo}>
            <Text style={styles.favoritesIcon}>⭐</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.favoritesCount}>
                {totalFavCount > 0 ? `${totalFavCount} 道收藏题目` : '暂无收藏题目'}
              </Text>
              <Text style={styles.favoritesDesc}>
                {totalFavCount > 0 ? '点击查看分类详情' : '答题时点击 ★ 收藏题目'}
              </Text>
            </View>
            {totalFavCount > 0 && (
              <Text style={styles.arrowText}>{showFavDetail ? '▲' : '▼'}</Text>
            )}
          </View>

          {showFavDetail && totalFavCount > 0 && (
            <View style={styles.detailSection}>
              {getFavoriteBranches().map((branch) => (
                <View key={branch.bankId} style={styles.detailRow}>
                  <View style={styles.detailRowInfo}>
                    <Text style={styles.detailRowName}>{branch.bankName}</Text>
                    <Text style={styles.detailRowCount}>{branch.questionIds.length} 题</Text>
                  </View>
                  <View style={styles.detailRowActions}>
                    <TouchableOpacity
                      style={[styles.detailActionBtn, styles.detailActionPrimary]}
                      onPress={() => enterFavoriteBranch(branch.bankId)}
                    >
                      <Text style={styles.detailActionTextPrimary}>刷题</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.detailActionBtn, styles.detailActionClear]}
                      onPress={() => {
                        const isWeb = typeof window !== 'undefined';
                        if (isWeb) {
                          if (window.confirm(`确定要清空「${branch.bankName}」的 ${branch.questionIds.length} 个收藏吗？`)) {
                            clearFavoriteBranchProgress(branch.bankId);
                          }
                        } else {
                          Alert.alert(
                            '清空收藏',
                            `确定要清空「${branch.bankName}」的 ${branch.questionIds.length} 个收藏吗？`,
                            [
                              { text: '取消', style: 'cancel' },
                              { text: '确认', style: 'destructive', onPress: () => clearFavoriteBranchProgress(branch.bankId) },
                            ]
                          );
                        }
                      }}
                    >
                      <Text style={styles.detailActionTextClear}>清空</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.detailActionBtn, styles.detailActionExport]}
                      onPress={() => exportFavoriteBranch(branch.bankId)}
                    >
                      <Text style={styles.detailActionTextExport}>导出</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
              <View style={styles.detailFooter}>
                <TouchableOpacity
                  style={styles.exportAllBtn}
                  onPress={() => exportFavoriteAll()}
                >
                  <Text style={styles.exportAllBtnText}>📥 全部导出 ({totalFavCount}题)</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {!showFavDetail && totalFavCount > 0 && (
            <View style={styles.favoritesActions}>
              <TouchableOpacity
                style={styles.clearFavBtn}
                onPress={() => {
                  const isWeb = typeof window !== 'undefined';
                  if (isWeb) {
                    if (window.confirm(`确定要清空所有 ${totalFavCount} 个收藏的进度吗？`)) {
                      banks.forEach(bank => {
                        if (bank.favoritesIds.length > 0) {
                          clearFavoriteBranchProgress(bank.id);
                        }
                      });
                    }
                  } else {
                    Alert.alert(
                      '清空收藏进度',
                      `确定要清空所有 ${totalFavCount} 个收藏的进度吗？`,
                      [
                        { text: '取消', style: 'cancel' },
                        { text: '确认', style: 'destructive', onPress: () => {
                          banks.forEach(bank => {
                            if (bank.favoritesIds.length > 0) {
                              clearFavoriteBranchProgress(bank.id);
                            }
                          });
                        } },
                      ]
                    );
                  }
                }}
              >
                <Text style={styles.clearFavText}>清空所有进度</Text>
              </TouchableOpacity>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.favoritesSection}>
        <Text style={styles.favoritesLabel}>错题库</Text>
        <TouchableOpacity 
          style={[styles.favoritesCard, totalWrongCount === 0 && styles.emptyCard, { borderColor: '#F44336' }]}
          onPress={() => { 
            if (totalWrongCount === 0) {
              showToast('🎉 错题库已清空！');
              return;
            }
            setShowWrongDetail(!showWrongDetail);
          }}
        >
          <View style={styles.favoritesInfo}>
            <Text style={styles.favoritesIcon}>❌</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.favoritesCount}>
                {totalWrongCount > 0 ? `${totalWrongCount} 道错题` : '暂无错题'}
              </Text>
              <Text style={styles.favoritesDesc}>
                {totalWrongCount > 0 ? '点击查看分类详情' : '答错的题目将自动加入错题库'}
              </Text>
            </View>
            {totalWrongCount > 0 && (
              <Text style={styles.arrowText}>{showWrongDetail ? '▲' : '▼'}</Text>
            )}
          </View>

          {showWrongDetail && totalWrongCount > 0 && (
            <View style={styles.detailSection}>
              {getWrongBankBranches().map((branch) => (
                <View key={branch.bankId} style={styles.detailRow}>
                  <View style={styles.detailRowInfo}>
                    <Text style={styles.detailRowName}>{branch.bankName}</Text>
                    <Text style={styles.detailRowCount}>{branch.questionIds.length} 题</Text>
                  </View>
                  <View style={styles.detailRowActions}>
                    <TouchableOpacity
                      style={[styles.detailActionBtn, styles.detailActionPrimary]}
                      onPress={() => enterWrongBankBranch(branch.bankId)}
                    >
                      <Text style={styles.detailActionTextPrimary}>刷题</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.detailActionBtn, styles.detailActionClear]}
                      onPress={() => {
                        const isWeb = typeof window !== 'undefined';
                        if (isWeb) {
                          if (window.confirm(`确定要清空「${branch.bankName}」的 ${branch.questionIds.length} 个错题吗？`)) {
                            clearWrongBranchProgress(branch.bankId);
                          }
                        } else {
                          Alert.alert(
                            '清空错题',
                            `确定要清空「${branch.bankName}」的 ${branch.questionIds.length} 个错题吗？`,
                            [
                              { text: '取消', style: 'cancel' },
                              { text: '确认', style: 'destructive', onPress: () => clearWrongBranchProgress(branch.bankId) },
                            ]
                          );
                        }
                      }}
                    >
                      <Text style={styles.detailActionTextClear}>清空</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.detailActionBtn, styles.detailActionExport]}
                      onPress={() => exportWrongBranch(branch.bankId)}
                    >
                      <Text style={styles.detailActionTextExport}>导出</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
              <View style={styles.detailFooter}>
                <TouchableOpacity
                  style={[styles.exportAllBtn, styles.exportAllBtnWrong]}
                  onPress={() => exportWrongAll()}
                >
                  <Text style={styles.exportAllBtnText}>📥 全部导出 ({totalWrongCount}题)</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.menuSection}>
        <TouchableOpacity
          style={[styles.menuButton, styles.primaryButton]}
          onPress={() => setShowImport(true)}
        >
          <Text style={styles.menuIcon}>📥</Text>
          <Text style={styles.menuButtonText}>导入题库</Text>
          <Text style={styles.menuButtonDesc}>拖拽或选择 .md 文件，文件名即为题库名</Text>
        </TouchableOpacity>

        {banks.length > 0 && (
          <TouchableOpacity
            style={[styles.menuButton, styles.tertiaryButton]}
            onPress={() => setShowBankManager(true)}
          >
            <Text style={styles.menuIcon}>📂</Text>
            <Text style={styles.tertiaryButtonText}>管理题库</Text>
            <Text style={styles.menuButtonDesc}>切换、重命名或删除题库</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.dataSection}>
        <TouchableOpacity
          style={styles.dataHeader}
          onPress={() => setShowDataSettings(!showDataSettings)}
        >
          <Text style={styles.dataHeaderText}>⚙️ 数据设置</Text>
          <Text style={styles.dataHeaderArrow}>{showDataSettings ? '▲' : '▼'}</Text>
        </TouchableOpacity>

        {showDataSettings && (
          <View style={styles.dataContent}>
            <View style={styles.dataPathRow}>
              <Text style={styles.dataPathLabel}>当前存储路径：</Text>
              <Text style={styles.dataPathValue} numberOfLines={1}>
                {dataPath || '未设置（使用默认路径）'}
              </Text>
            </View>

            {isFileSystemAccessSupported() ? (
              <TouchableOpacity
                style={styles.dataActionButton}
                onPress={async () => {
                  await selectDataDirectory();
                }}
              >
                <Text style={styles.dataActionIcon}>📁</Text>
                <Text style={styles.dataActionText}>选择本地文件夹</Text>
              </TouchableOpacity>
            ) : null}

            <View style={styles.dataInputRow}>
              <Text style={styles.dataInputLabel}>
                {isFileSystemAccessSupported() ? '原生App可手动输入路径：' : '手动输入路径：'}
              </Text>
              <View style={styles.dataInputRowInner}>
                <TextInput
                  style={styles.dataInput}
                  placeholder="/path/to/your/data"
                  value={customPath}
                  onChangeText={setCustomPath}
                />
                <TouchableOpacity
                  style={styles.dataSubmitBtn}
                  onPress={async () => {
                    if (customPath.trim()) {
                      await setCustomDataPath(customPath.trim());
                      setCustomPath('');
                    }
                  }}
                >
                  <Text style={styles.dataSubmitBtnText}>应用</Text>
                </TouchableOpacity>
              </View>
            </View>

            <Text style={styles.dataHint}>
              数据将以CSV文件形式保存在指定目录中，每个题库独立存储，同时保存题目、进度、错题本等数据。
            </Text>

            <View style={styles.dataActionsRow}>
              <TouchableOpacity
                style={[styles.dataActionBtn, styles.exportBtn]}
                onPress={() => exportAllData()}
              >
                <Text style={styles.dataActionBtnText}>导出数据</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.dataActionBtn, styles.importBtn]}
                onPress={() => dataFileInputRef.current?.click()}
              >
                <Text style={styles.dataActionBtnText}>导入数据</Text>
              </TouchableOpacity>
            </View>

            {dataPath && isFileSystemAccessSupported() ? (
              <TouchableOpacity
                style={styles.clearBtn}
                onPress={() => {
                  const isWeb = typeof window !== 'undefined';
                  if (isWeb) {
                    if (window.confirm('将清除本地存储路径绑定，需要重新选择文件夹。已保存的文件不会被删除。')) {
                      clearDirHandle();
                      useAppStore.setState({ dataPath: null });
                      useAppStore.getState().showToast('已清除，请重新选择文件夹');
                    }
                  } else {
                    Alert.alert(
                      '清除存储',
                      '将清除本地存储路径绑定，需要重新选择文件夹。已保存的文件不会被删除。',
                      [
                        { text: '取消', style: 'cancel' },
                        {
                          text: '确认清除',
                          style: 'destructive',
                          onPress: () => {
                            clearDirHandle();
                            useAppStore.setState({ dataPath: null });
                            useAppStore.getState().showToast('已清除，请重新选择文件夹');
                          },
                        },
                      ]
                    );
                  }
                }}
              >
                <Text style={styles.clearBtnText}>清除存储绑定</Text>
              </TouchableOpacity>
            ) : null}

            <input
              ref={dataFileInputRef}
              type="file"
              accept=".csv,.md,.markdown"
              style={{ display: 'none' }}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (file) {
                  await importAllData(file);
                  e.target.value = '';
                }
              }}
            />
          </View>
        )}
      </View>
      </ScrollView>
    </View>
  );
}

function ResultCard({ result, onSelect }: { result: ImportFileResult; onSelect: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const hasErrors = result.errors.length > 0;

  return (
    <View style={[styles.resultCard, result.questionsCount === 0 && styles.resultCardError]}>
      <TouchableOpacity
        style={styles.resultCardHeader}
        onPress={() => setExpanded(!expanded)}
      >
        <View style={styles.resultCardIcon}>
          {result.questionsCount > 0 ? '✅' : '❌'}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.resultCardName} numberOfLines={1}>{result.fileName}</Text>
          <Text style={styles.resultCardInfo}>
            {result.questionsCount > 0
              ? `${result.questionsCount} 题已导入`
              : '未导入任何题目'}
            {hasErrors ? ` · ${result.errors.length} 个问题` : ''}
          </Text>
        </View>
        <Text style={styles.resultCardArrow}>{expanded ? '▲' : '▼'}</Text>
      </TouchableOpacity>

      {expanded && (
        <View style={styles.resultCardBody}>
          {result.errors.length > 0 && (
            <View style={styles.errorsList}>
              {result.errors.map((err, idx) => (
                <View key={idx} style={styles.errorItem}>
                  <Text style={styles.errorBlock}>第 {err.blockIndex} 题块</Text>
                  <Text style={styles.errorMsg}>{err.message}</Text>
                  <Text style={styles.errorLine}>位置：第 {err.lineNumber} 行</Text>
                  {err.lineContent ? (
                    <Text style={styles.errorContent} numberOfLines={2}>
                      {err.lineContent}
                    </Text>
                  ) : null}
                </View>
              ))}
            </View>
          )}

          {result.questionsCount > 0 && result.errors.length === 0 && (
            <Text style={styles.allGoodText}>✓ 格式正确，已成功导入 {result.questionsCount} 题</Text>
          )}

          {result.questionsCount > 0 && result.errors.length > 0 && (
            <Text style={styles.partialText}>⚠ 部分题目格式有问题，已跳过 {result.errors.length} 个题目块</Text>
          )}

          {result.questionsCount > 0 && (
            <TouchableOpacity
              style={styles.goToBankBtn}
              onPress={() => {
                const store = useAppStore.getState();
                const bank = store.banks.find(b => b.name === result.bankName);
                if (bank) onSelect(bank.id);
              }}
            >
              <Text style={styles.goToBankText}>进入「{result.bankName}」→</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    padding: responsiveWidth(16),
    paddingBottom: responsiveHeight(40),
  },
  currentBankSection: {
    marginBottom: responsiveHeight(16),
  },
  currentBankLabel: {
    fontSize: responsiveFontSize(14),
    color: '#666666',
    marginBottom: responsiveHeight(6),
    fontWeight: '600',
  },
  currentBankCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: responsiveWidth(12),
    padding: responsiveWidth(14),
    borderWidth: responsiveWidth(2),
    borderColor: '#4A90D9',
  },
  currentBankName: {
    fontSize: responsiveFontSize(18),
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: responsiveHeight(4),
  },
  currentBankStats: {
    fontSize: responsiveFontSize(14),
    color: '#666666',
    marginBottom: responsiveHeight(8),
  },
  progressBar: {
    height: responsiveHeight(6),
    backgroundColor: '#E0E0E0',
    borderRadius: responsiveWidth(3),
    overflow: 'hidden',
  },
  progressBarLarge: {
    height: responsiveHeight(10),
    backgroundColor: '#E0E0E0',
    borderRadius: responsiveWidth(5),
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#4CAF50',
    borderRadius: responsiveWidth(3),
  },
  currentBankActions: {
    flexDirection: 'row',
    marginTop: responsiveHeight(10),
    gap: responsiveWidth(10),
  },
  resumeButton: {
    flex: 1,
    backgroundColor: '#4A90D9',
    paddingVertical: responsiveHeight(12),
    borderRadius: responsiveWidth(8),
    alignItems: 'center',
  },
  resumeButtonText: {
    color: '#FFFFFF',
    fontSize: responsiveFontSize(16),
    fontWeight: '600',
  },
  manageButton: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: responsiveWidth(1),
    borderColor: '#E0E0E0',
    paddingVertical: responsiveHeight(12),
    borderRadius: responsiveWidth(8),
    alignItems: 'center',
  },
  manageButtonText: {
    color: '#666666',
    fontSize: responsiveFontSize(16),
    fontWeight: '600',
  },
  bankListButton: {
    backgroundColor: '#E3F2FD',
    padding: responsiveWidth(12),
    borderRadius: responsiveWidth(10),
    alignItems: 'center',
    marginBottom: responsiveHeight(16),
  },
  bankListText: {
    fontSize: responsiveFontSize(14),
    color: '#1565C0',
    fontWeight: '600',
  },
  menuSection: {
    marginTop: responsiveHeight(8),
  },
  menuButton: {
    padding: responsiveWidth(20),
    borderRadius: responsiveWidth(16),
    marginBottom: responsiveHeight(14),
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: responsiveHeight(2) },
    shadowOpacity: 0.1,
    shadowRadius: responsiveWidth(6),
    elevation: 3,
  },
  primaryButton: {
    backgroundColor: '#4A90D9',
  },
  tertiaryButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: responsiveWidth(2),
    borderColor: '#4CAF50',
  },
  menuIcon: {
    fontSize: responsiveFontSize(32),
    marginBottom: responsiveHeight(6),
  },
  menuButtonText: {
    fontSize: responsiveFontSize(18),
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: responsiveHeight(4),
  },
  tertiaryButtonText: {
    fontSize: responsiveFontSize(18),
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: responsiveHeight(4),
  },
  menuButtonDesc: {
    fontSize: responsiveFontSize(14),
    color: '#666666',
  },
  editorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: responsiveHeight(16),
  },
  backButton: {
    fontSize: responsiveFontSize(16),
    color: '#4A90D9',
  },
  editorTitle: {
    fontSize: responsiveFontSize(18),
    fontWeight: 'bold',
    color: '#333333',
  },
  sampleButton: {
    fontSize: responsiveFontSize(16),
    color: '#FF9800',
  },
  helpBox: {
    backgroundColor: '#FFF8E1',
    borderRadius: responsiveWidth(10),
    padding: responsiveWidth(14),
    marginBottom: responsiveHeight(16),
    borderWidth: responsiveWidth(1),
    borderColor: '#FFE082',
  },
  helpTitle: {
    fontSize: responsiveFontSize(15),
    fontWeight: 'bold',
    color: '#333',
    marginBottom: responsiveHeight(8),
  },
  helpText: {
    fontSize: responsiveFontSize(13),
    color: '#555',
    lineHeight: responsiveFontSize(22),
  },
  promptGenButton: {
    marginTop: responsiveHeight(12),
    backgroundColor: '#4A90D9',
    paddingVertical: responsiveHeight(10),
    paddingHorizontal: responsiveWidth(14),
    borderRadius: responsiveWidth(8),
    alignItems: 'center',
  },
  promptGenButtonText: {
    color: '#FFFFFF',
    fontSize: responsiveFontSize(14),
    fontWeight: '600',
  },
  promptGenerator: {
    marginTop: responsiveHeight(14),
    backgroundColor: '#FFFFFF',
    borderRadius: responsiveWidth(10),
    padding: responsiveWidth(14),
    borderWidth: responsiveWidth(1),
    borderColor: '#E0E0E0',
  },
  promptGenSubtitle: {
    fontSize: responsiveFontSize(14),
    fontWeight: '600',
    color: '#333',
    marginBottom: responsiveHeight(10),
  },
  promptInputRow: {
    marginBottom: responsiveHeight(10),
  },
  promptInputLabel: {
    fontSize: responsiveFontSize(13),
    color: '#666',
    marginBottom: responsiveHeight(4),
  },
  promptInput: {
    backgroundColor: '#F8F9FA',
    borderRadius: responsiveWidth(6),
    paddingHorizontal: responsiveWidth(10),
    paddingVertical: responsiveHeight(8),
    fontSize: responsiveFontSize(14),
    borderWidth: responsiveWidth(1),
    borderColor: '#E0E0E0',
    color: '#333',
  },
  promptInputRowInline: {
    flexDirection: 'row',
    gap: responsiveWidth(10),
    marginBottom: responsiveHeight(10),
  },
  promptInputInlineItem: {
    flex: 1,
  },
  promptSmallInput: {
    backgroundColor: '#F8F9FA',
    borderRadius: responsiveWidth(6),
    paddingHorizontal: responsiveWidth(10),
    paddingVertical: responsiveHeight(8),
    fontSize: responsiveFontSize(14),
    borderWidth: responsiveWidth(1),
    borderColor: '#E0E0E0',
    color: '#333',
  },
  promptPreviewBox: {
    backgroundColor: '#1E1E1E',
    borderRadius: responsiveWidth(8),
    padding: responsiveWidth(12),
    marginBottom: responsiveHeight(12),
    maxHeight: responsiveHeight(200),
  },
  promptPreviewText: {
    color: '#D4D4D4',
    fontSize: responsiveFontSize(11),
    fontFamily: 'monospace',
    lineHeight: responsiveFontSize(18),
  },
  copyButton: {
    backgroundColor: '#27AE60',
    paddingVertical: responsiveHeight(12),
    borderRadius: responsiveWidth(8),
    alignItems: 'center',
    marginBottom: responsiveHeight(6),
  },
  exportMdButton: {
    backgroundColor: '#8E44AD',
  },
  copyButtonText: {
    color: '#FFFFFF',
    fontSize: responsiveFontSize(15),
    fontWeight: '600',
  },
  promptHint: {
    fontSize: responsiveFontSize(12),
    color: '#999',
    textAlign: 'center',
  },
  dropZone: {
    backgroundColor: '#FFFFFF',
    borderRadius: responsiveWidth(16),
    borderWidth: responsiveWidth(2),
    borderStyle: 'dashed',
    borderColor: '#B0BEC5',
    padding: responsiveWidth(40),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: responsiveHeight(20),
    minHeight: responsiveHeight(280),
  },
  dropZoneActive: {
    borderColor: '#4A90D9',
    backgroundColor: '#E3F2FD',
  },
  dropIcon: {
    fontSize: responsiveFontSize(48),
    marginBottom: responsiveHeight(12),
  },
  dropTitle: {
    fontSize: responsiveFontSize(18),
    fontWeight: 'bold',
    color: '#333',
    marginBottom: responsiveHeight(4),
  },
  dropSubtitle: {
    fontSize: responsiveFontSize(14),
    color: '#666',
    marginBottom: responsiveHeight(16),
  },
  dropText: {
    fontSize: responsiveFontSize(14),
    color: '#666',
    marginTop: responsiveHeight(12),
  },
  browseButton: {
    backgroundColor: '#4A90D9',
    paddingHorizontal: responsiveWidth(24),
    paddingVertical: responsiveHeight(12),
    borderRadius: responsiveWidth(10),
    marginTop: responsiveHeight(8),
  },
  browseButtonText: {
    color: '#FFFFFF',
    fontSize: responsiveFontSize(16),
    fontWeight: '600',
  },
  dropHint: {
    fontSize: responsiveFontSize(12),
    color: '#999',
    marginTop: responsiveHeight(12),
  },
  resultSection: {
    paddingBottom: responsiveHeight(16),
  },
  resultHeader: {
    marginBottom: responsiveHeight(14),
  },
  resultTitle: {
    fontSize: responsiveFontSize(18),
    fontWeight: 'bold',
    color: '#333',
    marginBottom: responsiveHeight(4),
  },
  resultStats: {
    fontSize: responsiveFontSize(14),
    color: '#666',
  },
  resultCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: responsiveWidth(12),
    marginBottom: responsiveHeight(10),
    borderWidth: responsiveWidth(1),
    borderColor: '#E0E0E0',
    overflow: 'hidden',
  },
  resultCardError: {
    borderColor: '#F44336',
    borderWidth: responsiveWidth(2),
  },
  resultCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: responsiveWidth(14),
  },
  resultCardIcon: {
    fontSize: responsiveFontSize(24),
    marginRight: responsiveWidth(10),
  },
  resultCardName: {
    fontSize: responsiveFontSize(15),
    fontWeight: '600',
    color: '#333',
  },
  resultCardInfo: {
    fontSize: responsiveFontSize(13),
    color: '#666',
    marginTop: responsiveHeight(2),
  },
  resultCardArrow: {
    fontSize: responsiveFontSize(12),
    color: '#999',
    marginLeft: responsiveWidth(8),
  },
  resultCardBody: {
    padding: responsiveWidth(14),
    paddingTop: 0,
    borderTopWidth: responsiveWidth(1),
    borderTopColor: '#F0F0F0',
  },
  errorsList: {
    marginBottom: responsiveHeight(10),
  },
  errorItem: {
    backgroundColor: '#FFF5F5',
    borderRadius: responsiveWidth(8),
    padding: responsiveWidth(10),
    marginBottom: responsiveHeight(8),
    borderLeftWidth: responsiveWidth(3),
    borderLeftColor: '#F44336',
  },
  errorBlock: {
    fontSize: responsiveFontSize(12),
    color: '#F44336',
    fontWeight: '600',
    marginBottom: responsiveHeight(4),
  },
  errorMsg: {
    fontSize: responsiveFontSize(14),
    color: '#333',
    lineHeight: responsiveFontSize(20),
  },
  errorLine: {
    fontSize: responsiveFontSize(11),
    color: '#999',
    marginTop: responsiveHeight(4),
  },
  errorContent: {
    fontSize: responsiveFontSize(12),
    color: '#666',
    fontStyle: 'italic',
    marginTop: responsiveHeight(4),
    backgroundColor: '#F5F5F5',
    padding: responsiveWidth(6),
    borderRadius: responsiveWidth(4),
  },
  allGoodText: {
    fontSize: responsiveFontSize(14),
    color: '#4CAF50',
    fontWeight: '600',
    textAlign: 'center',
    padding: responsiveWidth(8),
  },
  partialText: {
    fontSize: responsiveFontSize(13),
    color: '#FF9800',
    padding: responsiveWidth(8),
    textAlign: 'center',
  },
  goToBankBtn: {
    backgroundColor: '#4A90D9',
    paddingVertical: responsiveHeight(10),
    borderRadius: responsiveWidth(8),
    alignItems: 'center',
    marginTop: responsiveHeight(8),
  },
  goToBankText: {
    color: '#FFFFFF',
    fontSize: responsiveFontSize(14),
    fontWeight: '600',
  },
  importAgainButton: {
    backgroundColor: '#4A90D9',
    paddingVertical: responsiveHeight(14),
    borderRadius: responsiveWidth(12),
    marginTop: responsiveHeight(10),
    alignItems: 'center',
  },
  importAgainText: {
    color: '#FFFFFF',
    fontSize: responsiveFontSize(16),
    fontWeight: 'bold',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: responsiveHeight(40),
  },
  emptyIcon: {
    fontSize: responsiveFontSize(48),
    marginBottom: responsiveHeight(12),
  },
  emptyText: {
    fontSize: responsiveFontSize(18),
    fontWeight: '600',
    color: '#333333',
    marginBottom: responsiveHeight(4),
  },
  emptyDesc: {
    fontSize: responsiveFontSize(14),
    color: '#666666',
  },
  bankCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: responsiveWidth(12),
    padding: responsiveWidth(14),
    marginBottom: responsiveHeight(12),
    borderWidth: responsiveWidth(1),
    borderColor: '#E0E0E0',
  },
  bankCardCurrent: {
    borderColor: '#4A90D9',
    borderWidth: responsiveWidth(2),
  },
  bankInfo: {
    marginBottom: responsiveHeight(10),
  },
  bankHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: responsiveHeight(4),
  },
  bankName: {
    fontSize: responsiveFontSize(17),
    fontWeight: 'bold',
    color: '#333333',
    flex: 1,
  },
  currentBadge: {
    backgroundColor: '#4A90D9',
    color: '#FFFFFF',
    fontSize: responsiveFontSize(12),
    paddingHorizontal: responsiveWidth(8),
    paddingVertical: responsiveHeight(2),
    borderRadius: responsiveWidth(10),
    overflow: 'hidden',
  },
  bankStats: {
    fontSize: responsiveFontSize(13),
    color: '#666666',
    marginBottom: responsiveHeight(6),
  },
  bankActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: responsiveWidth(20),
    borderTopWidth: responsiveWidth(1),
    borderTopColor: '#F0F0F0',
    paddingTop: responsiveHeight(8),
  },
  bankActionBtn: {
    paddingHorizontal: responsiveWidth(10),
    paddingVertical: responsiveHeight(6),
  },
  bankActionText: {
    fontSize: responsiveFontSize(14),
    color: '#4A90D9',
  },
  deleteText: {
    color: '#F44336',
  },
  bankEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsiveWidth(8),
  },
  nameInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: responsiveWidth(8),
    paddingHorizontal: responsiveWidth(12),
    paddingVertical: responsiveHeight(10),
    fontSize: responsiveFontSize(14),
    borderWidth: responsiveWidth(1),
    borderColor: '#E0E0E0',
    marginBottom: responsiveHeight(10),
  },
  dataSection: {
    marginTop: responsiveHeight(24),
    backgroundColor: '#FFFFFF',
    borderRadius: responsiveWidth(12),
    borderWidth: responsiveWidth(1),
    borderColor: '#E0E0E0',
    overflow: 'hidden',
  },
  dataHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: responsiveWidth(16),
    backgroundColor: '#F8F9FA',
  },
  dataHeaderText: {
    fontSize: responsiveFontSize(16),
    fontWeight: '600',
    color: '#333333',
  },
  dataHeaderArrow: {
    fontSize: responsiveFontSize(12),
    color: '#666666',
  },
  dataContent: {
    padding: responsiveWidth(16),
  },
  dataPathRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: responsiveHeight(14),
    gap: responsiveWidth(6),
  },
  dataPathLabel: {
    fontSize: responsiveFontSize(13),
    color: '#666666',
  },
  dataPathValue: {
    fontSize: responsiveFontSize(13),
    color: '#4A90D9',
    fontWeight: '600',
    flex: 1,
  },
  dataActionButton: {
    backgroundColor: '#4A90D9',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: responsiveHeight(12),
    borderRadius: responsiveWidth(8),
    marginBottom: responsiveHeight(14),
    gap: responsiveWidth(6),
  },
  dataActionIcon: {
    fontSize: responsiveFontSize(20),
  },
  dataActionText: {
    color: '#FFFFFF',
    fontSize: responsiveFontSize(15),
    fontWeight: '600',
  },
  dataInputRow: {
    marginBottom: responsiveHeight(10),
  },
  dataInputLabel: {
    fontSize: responsiveFontSize(13),
    color: '#666666',
    marginBottom: responsiveHeight(6),
  },
  dataInputRowInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsiveWidth(8),
  },
  dataInput: {
    flex: 1,
    backgroundColor: '#F8F9FA',
    borderRadius: responsiveWidth(6),
    paddingHorizontal: responsiveWidth(12),
    paddingVertical: responsiveHeight(10),
    fontSize: responsiveFontSize(14),
    borderWidth: responsiveWidth(1),
    borderColor: '#E0E0E0',
    color: '#333333',
  },
  dataSubmitBtn: {
    backgroundColor: '#4A90D9',
    paddingHorizontal: responsiveWidth(16),
    paddingVertical: responsiveHeight(10),
    borderRadius: responsiveWidth(6),
  },
  dataSubmitBtnText: {
    color: '#FFFFFF',
    fontSize: responsiveFontSize(14),
    fontWeight: '600',
  },
  dataHint: {
    fontSize: responsiveFontSize(12),
    color: '#999999',
    lineHeight: responsiveFontSize(18),
  },
  dataActionsRow: {
    flexDirection: 'row',
    gap: responsiveWidth(12),
    marginTop: responsiveHeight(12),
  },
  dataActionBtn: {
    flex: 1,
    paddingVertical: responsiveHeight(12),
    paddingHorizontal: responsiveWidth(16),
    borderRadius: responsiveWidth(8),
    alignItems: 'center',
  },
  exportBtn: {
    backgroundColor: '#3498db',
  },
  importBtn: {
    backgroundColor: '#27ae60',
  },
  dataActionBtnText: {
    color: '#ffffff',
    fontSize: responsiveFontSize(14),
    fontWeight: '600',
  },
  clearBtn: {
    marginTop: responsiveHeight(12),
    paddingVertical: responsiveHeight(10),
    paddingHorizontal: responsiveWidth(16),
    borderRadius: responsiveWidth(8),
    borderWidth: responsiveWidth(1),
    borderColor: '#e74c3c',
    alignItems: 'center',
  },
  clearBtnText: {
    color: '#e74c3c',
    fontSize: responsiveFontSize(13),
    fontWeight: '500',
  },
  favoritesSection: {
    marginBottom: responsiveHeight(16),
  },
  favoritesLabel: {
    fontSize: responsiveFontSize(14),
    color: '#666666',
    marginBottom: responsiveHeight(6),
    fontWeight: '600',
  },
  favoritesCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: responsiveWidth(12),
    padding: responsiveWidth(14),
    borderWidth: responsiveWidth(2),
    borderColor: '#FFC107',
  },
  favoritesInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsiveWidth(10),
  },
  favoritesIcon: {
    fontSize: responsiveFontSize(28),
  },
  favoritesCount: {
    fontSize: responsiveFontSize(17),
    fontWeight: 'bold',
    color: '#333333',
  },
  favoritesDesc: {
    fontSize: responsiveFontSize(13),
    color: '#666666',
    marginTop: responsiveHeight(2),
  },
  favoritesActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: responsiveHeight(10),
    paddingTop: responsiveHeight(8),
    borderTopWidth: responsiveWidth(1),
    borderTopColor: '#F0F0F0',
  },
  clearFavBtn: {
    backgroundColor: '#FFEBEE',
    paddingHorizontal: responsiveWidth(14),
    paddingVertical: responsiveHeight(6),
    borderRadius: responsiveWidth(8),
  },
  clearFavText: {
    color: '#E53935',
    fontSize: responsiveFontSize(13),
    fontWeight: '600',
  },
  emptyCard: {
    borderStyle: 'dashed',
    opacity: 0.8,
  },
  categoryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: responsiveHeight(8),
    gap: responsiveWidth(6),
  },
  categoryChip: {
    backgroundColor: '#E3F2FD',
    paddingHorizontal: responsiveWidth(8),
    paddingVertical: responsiveHeight(4),
    borderRadius: responsiveWidth(12),
    fontSize: responsiveFontSize(12),
    color: '#1976D2',
  },
  categoryChipText: {
    fontSize: responsiveFontSize(12),
    color: '#1976D2',
  },
  categoryChipWrong: {
    backgroundColor: '#FFEBEE',
  },
  categoryChipWrongText: {
    color: '#C62828',
  },
  arrowText: {
    fontSize: responsiveFontSize(14),
    color: '#999',
    marginLeft: responsiveWidth(8),
  },
  detailSection: {
    marginTop: responsiveHeight(12),
    borderTopWidth: responsiveWidth(1),
    borderTopColor: '#F0F0F0',
    paddingTop: responsiveHeight(10),
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: responsiveHeight(10),
    paddingHorizontal: responsiveWidth(8),
    backgroundColor: '#F8F9FA',
    borderRadius: responsiveWidth(8),
    marginBottom: responsiveHeight(8),
  },
  detailRowInfo: {
    flex: 1,
  },
  detailRowName: {
    fontSize: responsiveFontSize(14),
    fontWeight: '600',
    color: '#333',
  },
  detailRowCount: {
    fontSize: responsiveFontSize(12),
    color: '#666',
    marginTop: responsiveHeight(2),
  },
  detailRowActions: {
    flexDirection: 'row',
    gap: responsiveWidth(6),
  },
  detailActionBtn: {
    paddingHorizontal: responsiveWidth(10),
    paddingVertical: responsiveHeight(5),
    borderRadius: responsiveWidth(6),
    minWidth: responsiveWidth(44),
    alignItems: 'center',
  },
  detailActionPrimary: {
    backgroundColor: '#4A90D9',
  },
  detailActionClear: {
    backgroundColor: '#FFEBEE',
  },
  detailActionExport: {
    backgroundColor: '#E8F5E9',
  },
  detailActionTextPrimary: {
    color: '#fff',
    fontSize: responsiveFontSize(12),
    fontWeight: '600',
  },
  detailActionTextClear: {
    color: '#C62828',
    fontSize: responsiveFontSize(12),
    fontWeight: '600',
  },
  detailActionTextExport: {
    color: '#2E7D32',
    fontSize: responsiveFontSize(12),
    fontWeight: '600',
  },
  detailFooter: {
    marginTop: responsiveHeight(8),
    paddingTop: responsiveHeight(8),
    borderTopWidth: responsiveWidth(1),
    borderTopColor: '#F0F0F0',
    alignItems: 'center',
  },
  exportAllBtn: {
    backgroundColor: '#4A90D9',
    paddingVertical: responsiveHeight(10),
    paddingHorizontal: responsiveWidth(20),
    borderRadius: responsiveWidth(8),
    alignItems: 'center',
  },
  exportAllBtnWrong: {
    backgroundColor: '#F44336',
  },
  exportAllBtnText: {
    color: '#fff',
    fontSize: responsiveFontSize(14),
    fontWeight: '600',
  },
});
