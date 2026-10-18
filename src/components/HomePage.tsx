import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { useAppStore, type BatchImportResult, type ImportFileResult, type ImportMode } from '../stores/useAppStore';
import { isFileSystemAccessSupported, clearDirHandle, readUploadedFile, downloadFile } from '../utils/fileStorage';
import { buildPrompt, AI_GENERATOR_PROMPT } from '../utils/promptTemplate';
import { generateCSVTemplates } from '../utils/csvImport';
import type { Bank } from '../types';
import { colors, fontFamily, fontSize, radius, spacing, shadow, MAX_CONTENT_WIDTH } from '../utils/theme';

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
  const [importMode, setImportMode] = useState<ImportMode>('csv');

  const banks = useAppStore((state) => state.banks);
  const currentBankId = useAppStore((state) => state.currentBankId);
  const addBank = useAppStore((state) => state.addBank);
  const importMarkdownFiles = useAppStore((state) => state.importMarkdownFiles);
  const importCSVFiles = useAppStore((state) => state.importCSVFiles);
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
      if (importMode === 'csv') {
        const fileDataPromises = files
          .filter(f => f.name.toLowerCase().endsWith('.csv'))
          .map(async (f) => ({
            name: f.name,
            content: await readUploadedFile(f),
          }));

        const fileData = await Promise.all(fileDataPromises);

        if (fileData.length === 0) {
          showToast('请选择 .csv 格式的文件');
          setIsImporting(false);
          return;
        }

        const result = await importCSVFiles(fileData);
        setImportResult(result);

        if (result.successCount > 0) {
          const firstSuccess = result.results.find(r => r.questionsCount > 0);
          if (firstSuccess) {
            setShowImport(false);
            setShowHome(false);
          }
        }
      } else {
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
      }
    } catch (e) {
      console.error('Import failed:', e);
      showToast('导入失败，请检查文件');
    } finally {
      setIsImporting(false);
    }
  }, [importMode, importMarkdownFiles, importCSVFiles, setShowHome, showToast]);

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
          <View style={styles.helpWrapper}>
            <View style={styles.helpBox}>
              <Text style={styles.helpTitle}>CSV 题库格式（Tab 分隔）</Text>
              <Text style={styles.helpText}>• 用制表符 Tab 分隔 10 列，首行表头可省略</Text>
              <Text style={styles.helpText}>• 列顺序：题号｜题干｜选项A~F｜正确答案内容｜解析</Text>
              <Text style={styles.helpText}>• 正确答案填「选项内容」原文；多选时用换行分隔每个正确项</Text>
              <Text style={styles.helpText}>• 选项不足 6 个时，多余列留空即可</Text>

              <TouchableOpacity
                style={styles.sampleButton2}
                onPress={() => {
                  downloadFile('CSV导入模板.tsv', generateCSVTemplates(), 'text/tab-separated-values');
                  showToast('已下载 CSV 模板');
                }}
              >
                <Text style={styles.sampleButtonText}>下载 CSV 模板</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.promptGenButton}
                onPress={() => setShowPromptGenerator(!showPromptGenerator)}
              >
                <Text style={styles.promptGenButtonText}>
                  {showPromptGenerator ? '收起 AI Prompt ▲' : '用 AI 生成题库 ✨'}
                </Text>
              </TouchableOpacity>

              {showPromptGenerator && (
                <View style={styles.promptGenerator}>
                  <Text style={styles.promptGenSubtitle}>自定义 Prompt 参数</Text>

                  <View style={styles.promptInputRow}>
                    <Text style={styles.promptInputLabel}>主题 / 知识点</Text>
                    <TextInput
                      style={styles.promptInput}
                      placeholder="如：有机化学、React 基础"
                      value={promptTopic}
                      onChangeText={setPromptTopic}
                    />
                  </View>

                  <View style={styles.promptInputRowInline}>
                    <View style={styles.promptInputInlineItem}>
                      <Text style={styles.promptInputLabel}>总题数</Text>
                      <TextInput
                        style={styles.promptSmallInput}
                        value={promptTotal}
                        onChangeText={setPromptTotal}
                        keyboardType="numeric"
                      />
                    </View>
                    <View style={styles.promptInputInlineItem}>
                      <Text style={styles.promptInputLabel}>多选题数</Text>
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
                      {copiedPrompt ? '已复制 ✓' : '一键复制 Prompt'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.copyButton, styles.exportMdButton]}
                    onPress={() => {
                      downloadFile(`AI题库生成Prompt_${Date.now()}.md`, generatedPrompt, 'text/markdown');
                      showToast('已导出为 .md 文件');
                    }}
                  >
                    <Text style={styles.copyButtonText}>导出为 .md 文件</Text>
                  </TouchableOpacity>

                  <Text style={styles.promptHint}>
                    生成的是 Markdown 题库，返回后请选择「Markdown 文本」导入
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.markdownHelpBox}>
              <Text style={styles.helpTitle}>Markdown 题库格式</Text>
              <Text style={styles.helpText}>• 标题：## 第N题；相邻题目之间用单独一行 --- 分隔</Text>
              <Text style={styles.helpText}>• 选项每行一个：A. 内容（A→B→C 连续，不要跳号，至少 2 个）</Text>
              <Text style={styles.helpText}>• 答案行：答案：B（单选）或 答案：ABD（多选，字母按序连写）</Text>
              <Text style={styles.helpText}>• 解析行：解析：内容（可省略）</Text>
            </View>
          </View>
        )}

        <ScrollView style={styles.flexFill} contentContainerStyle={styles.importScrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.modeSelector}>
            <TouchableOpacity
              style={[styles.modeButton, importMode === 'csv' && styles.modeButtonActive]}
              onPress={() => setImportMode('csv')}
            >
              <Text style={[styles.modeButtonText, importMode === 'csv' && styles.modeButtonTextActive]}>表格 CSV</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeButton, importMode === 'markdown' && styles.modeButtonActive]}
              onPress={() => setImportMode('markdown')}
            >
              <Text style={[styles.modeButtonText, importMode === 'markdown' && styles.modeButtonTextActive]}>Markdown 文本</Text>
            </TouchableOpacity>
          </View>

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
                  <ActivityIndicator size="large" color={colors.primary} />
                  <Text style={styles.dropText}>正在解析文件…</Text>
                </>
              ) : (
                <>
                  <Text style={styles.dropIcon}>{importMode === 'csv' ? '📊' : '📂'}</Text>
                  <Text style={styles.dropTitle}>
                    拖拽 {importMode === 'csv' ? '.csv' : '.md'} 文件到这里
                  </Text>
                  <Text style={styles.dropSubtitle}>支持多文件批量导入</Text>
                  <TouchableOpacity
                    style={styles.browseButton}
                    onPress={() => fileInputRef.current?.click()}
                  >
                    <Text style={styles.browseButtonText}>选择文件</Text>
                  </TouchableOpacity>
                  <Text style={styles.dropHint}>文件名即题库名</Text>
                </>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept={importMode === 'csv' ? '.csv' : '.md,.markdown'}
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
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView style={styles.flexFill} contentContainerStyle={styles.bankScrollContent} showsVerticalScrollIndicator={false}>
          {banks.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>📚</Text>
              <Text style={styles.emptyText}>还没有题库</Text>
              <Text style={styles.emptyDesc}>点击下方按钮导入题库</Text>
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
                          <Text style={styles.bankActionText}>重命名</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => handleDeleteBank(bank)}>
                          <Text style={[styles.bankActionText, styles.deleteText]}>删除</Text>
                        </TouchableOpacity>
                      </View>
                    </>
                  )}
                </View>
              );
            })
          )}
        </ScrollView>

        <View style={styles.footerBar}>
          <TouchableOpacity
            style={[styles.footerButton, styles.primaryButton]}
            onPress={() => { setShowBankManager(false); setShowImport(true); }}
          >
            <Text style={styles.footerButtonText}>导入题库</Text>
          </TouchableOpacity>
        </View>
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
        <View style={styles.hero}>
          <Text style={styles.heroTitle}>题库刷题</Text>
          <Text style={styles.heroSubtitle}>AcademicFlow</Text>
        </View>

        {currentBank && currentStats ? (
          <View style={styles.currentBankSection}>
            <Text style={styles.sectionLabel}>当前题库</Text>
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
                style={[styles.manageButton, styles.dangerManageButton]}
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
                <Text style={styles.dangerManageText}>清空进度</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        {banks.length > 1 && (
          <TouchableOpacity
            style={styles.bankListButton}
            onPress={() => setShowBankManager(true)}
          >
            <Text style={styles.bankListText}>切换题库 · 共 {banks.length} 个</Text>
          </TouchableOpacity>
        )}

        <View style={styles.favoritesSection}>
          <Text style={styles.sectionLabel}>收藏夹</Text>
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
              <View style={styles.flex1}>
                <Text style={styles.favoritesCount}>
                  {totalFavCount > 0 ? `${totalFavCount} 道收藏题目` : '暂无收藏题目'}
                </Text>
                <Text style={styles.favoritesDesc}>
                  {totalFavCount > 0 ? '点击查看分类详情' : '答题时点击 ★ 收藏'}
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
                    <Text style={styles.exportAllBtnText}>全部导出 ({totalFavCount}题)</Text>
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
          <Text style={styles.sectionLabel}>错题库</Text>
          <TouchableOpacity
            style={[styles.favoritesCard, totalWrongCount === 0 && styles.emptyCard, styles.wrongCard]}
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
              <View style={styles.flex1}>
                <Text style={styles.favoritesCount}>
                  {totalWrongCount > 0 ? `${totalWrongCount} 道错题` : '暂无错题'}
                </Text>
                <Text style={styles.favoritesDesc}>
                  {totalWrongCount > 0 ? '点击查看分类详情' : '答错的题目会自动加入'}
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
                    <Text style={styles.exportAllBtnText}>全部导出 ({totalWrongCount}题)</Text>
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
            <Text style={styles.menuButtonDesc}>支持 CSV / Markdown，可批量导入</Text>
          </TouchableOpacity>

          {banks.length > 0 && (
            <TouchableOpacity
              style={[styles.menuButton, styles.tertiaryButton]}
              onPress={() => setShowBankManager(true)}
            >
              <Text style={styles.menuIcon}>📂</Text>
              <Text style={styles.tertiaryButtonText}>管理题库</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.dataSection}>
          <TouchableOpacity
            style={styles.dataHeader}
            onPress={() => setShowDataSettings(!showDataSettings)}
          >
            <Text style={styles.dataHeaderText}>数据设置</Text>
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
                  <Text style={styles.dataActionText}>选择本地文件夹</Text>
                </TouchableOpacity>
              ) : null}

              <View style={styles.dataInputRow}>
                <Text style={styles.dataInputLabel}>
                  {isFileSystemAccessSupported() ? '原生 App 可手动输入路径：' : '手动输入路径：'}
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
                数据以 CSV 文件保存在指定目录，每个题库独立存储，同时保存题目、进度、错题本等数据。
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
  const isCSVImport = result.csvErrors !== undefined;

  return (
    <View style={[styles.resultCard, result.questionsCount === 0 && styles.resultCardError]}>
      <TouchableOpacity
        style={styles.resultCardHeader}
        onPress={() => setExpanded(!expanded)}
      >
        <View style={styles.resultCardIcon}>
          {result.questionsCount > 0 ? '✅' : '❌'}
        </View>
        <View style={styles.flex1}>
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
                  <Text style={styles.errorBlock}>
                    {isCSVImport ? `第 ${err.lineNumber} 行` : `第 ${err.blockIndex} 题块`}
                  </Text>
                  <Text style={styles.errorMsg}>{err.message}</Text>
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
            <Text style={styles.partialText}>⚠ 部分题目格式有问题，已跳过 {result.errors.length} 个题目</Text>
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
    backgroundColor: colors.paper,
  },
  flexFill: {
    flex: 1,
  },
  flex1: {
    flex: 1,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  importScrollContent: {
    paddingBottom: spacing.xxl,
  },
  bankScrollContent: {
    paddingBottom: spacing.xxl,
  },
  headerSpacer: {
    width: 48,
  },
  hero: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  heroTitle: {
    fontFamily,
    fontSize: fontSize.xxl,
    fontWeight: 'bold',
    color: colors.primaryDeep,
    letterSpacing: 4,
  },
  heroSubtitle: {
    fontFamily,
    fontSize: fontSize.xs,
    color: colors.accent,
    letterSpacing: 6,
    marginTop: 4,
  },
  sectionLabel: {
    fontFamily,
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginBottom: spacing.sm,
    fontWeight: '600',
    letterSpacing: 1,
  },
  currentBankSection: {
    marginBottom: spacing.lg,
  },
  currentBankCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.primary,
    ...shadow.soft,
  },
  currentBankName: {
    fontFamily,
    fontSize: fontSize.lg,
    fontWeight: 'bold',
    color: colors.primaryDeep,
    marginBottom: 6,
  },
  currentBankStats: {
    fontFamily,
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginBottom: spacing.md,
  },
  progressBar: {
    height: 8,
    backgroundColor: colors.neutralSoft,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  progressBarLarge: {
    height: 8,
    backgroundColor: colors.neutralSoft,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
  },
  currentBankActions: {
    flexDirection: 'row',
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  resumeButton: {
    flex: 1.4,
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
    ...shadow.soft,
  },
  resumeButtonText: {
    fontFamily,
    color: colors.white,
    fontSize: fontSize.md,
    fontWeight: '600',
    letterSpacing: 1,
  },
  manageButton: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  manageButtonText: {
    fontFamily,
    color: colors.textMuted,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  dangerManageButton: {
    borderColor: colors.danger,
  },
  dangerManageText: {
    fontFamily,
    color: colors.danger,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  bankListButton: {
    backgroundColor: colors.primarySoft,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  bankListText: {
    fontFamily,
    fontSize: fontSize.sm,
    color: colors.primaryDeep,
    fontWeight: '600',
  },
  menuSection: {
    marginTop: spacing.sm,
  },
  menuButton: {
    paddingVertical: spacing.lg,
    borderRadius: radius.lg,
    marginBottom: spacing.md,
    alignItems: 'center',
    ...shadow.card,
  },
  primaryButton: {
    backgroundColor: colors.primary,
  },
  tertiaryButton: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  menuIcon: {
    fontSize: 22,
    marginBottom: spacing.xs,
  },
  menuButtonText: {
    fontFamily,
    fontSize: fontSize.md,
    fontWeight: 'bold',
    color: colors.white,
    letterSpacing: 1,
  },
  tertiaryButtonText: {
    fontFamily,
    fontSize: fontSize.md,
    fontWeight: 'bold',
    color: colors.primaryDeep,
    letterSpacing: 1,
  },
  menuButtonDesc: {
    fontFamily,
    fontSize: fontSize.xs,
    color: 'rgba(255, 255, 255, 0.75)',
    marginTop: 4,
  },
  editorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },
  backButton: {
    fontFamily,
    fontSize: fontSize.md,
    color: colors.primary,
  },
  editorTitle: {
    fontFamily,
    fontSize: fontSize.lg,
    fontWeight: 'bold',
    color: colors.primaryDeep,
    letterSpacing: 1,
  },
  sampleButton: {
    fontFamily,
    fontSize: fontSize.sm,
    color: colors.accent,
  },
  sampleButton2: {
    fontFamily,
    fontSize: fontSize.sm,
    color: colors.primary,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  sampleButtonText: {
    fontFamily,
    fontSize: fontSize.sm,
    color: colors.primary,
    fontWeight: '600',
    textAlign: 'center',
  },
  helpWrapper: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  helpBox: {
    backgroundColor: colors.accentSoft,
    borderRadius: radius.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  markdownHelpBox: {
    marginTop: spacing.md,
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  helpTitle: {
    fontFamily,
    fontSize: fontSize.sm,
    fontWeight: 'bold',
    color: colors.primaryDeep,
    marginBottom: spacing.sm,
    letterSpacing: 1,
  },
  helpText: {
    fontFamily,
    fontSize: fontSize.sm,
    color: colors.text,
    lineHeight: 24,
  },
  modeSelector: {
    flexDirection: 'row',
    marginBottom: spacing.md,
    backgroundColor: colors.neutralSoft,
    borderRadius: radius.pill,
    padding: 4,
    gap: 4,
  },
  modeButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    alignItems: 'center',
  },
  modeButtonActive: {
    backgroundColor: colors.surface,
    ...shadow.soft,
  },
  modeButtonText: {
    fontFamily,
    fontSize: fontSize.sm,
    color: colors.textMuted,
    fontWeight: '600',
  },
  modeButtonTextActive: {
    color: colors.primaryDeep,
  },
  promptGenButton: {
    marginTop: spacing.md,
    backgroundColor: colors.accent,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  promptGenButtonText: {
    fontFamily,
    color: colors.white,
    fontSize: fontSize.sm,
    fontWeight: '600',
    letterSpacing: 1,
  },
  promptGenerator: {
    marginTop: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  promptGenSubtitle: {
    fontFamily,
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.primaryDeep,
    marginBottom: spacing.md,
  },
  promptInputRow: {
    marginBottom: spacing.md,
  },
  promptInputLabel: {
    fontFamily,
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  promptInput: {
    backgroundColor: colors.paper,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: fontSize.sm,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
  },
  promptInputRowInline: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  promptInputInlineItem: {
    flex: 1,
  },
  promptSmallInput: {
    backgroundColor: colors.paper,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: fontSize.sm,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
  },
  promptPreviewBox: {
    backgroundColor: colors.primaryDeep,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    maxHeight: 200,
  },
  promptPreviewText: {
    color: '#DCE6F0',
    fontSize: fontSize.xs,
    fontFamily: 'monospace',
    lineHeight: 18,
  },
  copyButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  exportMdButton: {
    backgroundColor: colors.accent,
  },
  copyButtonText: {
    fontFamily,
    color: colors.white,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  promptHint: {
    fontFamily,
    fontSize: fontSize.xs,
    color: colors.textFaint,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  dropZone: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.borderStrong,
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 260,
  },
  dropZoneActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  dropIcon: {
    fontSize: 30,
    marginBottom: spacing.md,
  },
  dropTitle: {
    fontFamily,
    fontSize: fontSize.md,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  dropSubtitle: {
    fontFamily,
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginBottom: spacing.lg,
  },
  dropText: {
    fontFamily,
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginTop: spacing.md,
  },
  browseButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    ...shadow.soft,
  },
  browseButtonText: {
    fontFamily,
    color: colors.white,
    fontSize: fontSize.sm,
    fontWeight: '600',
    letterSpacing: 1,
  },
  dropHint: {
    fontFamily,
    fontSize: fontSize.xs,
    color: colors.textFaint,
    marginTop: spacing.md,
  },
  resultSection: {
    paddingBottom: spacing.lg,
  },
  resultHeader: {
    marginBottom: spacing.md,
  },
  resultTitle: {
    fontFamily,
    fontSize: fontSize.md,
    fontWeight: 'bold',
    color: colors.primaryDeep,
    marginBottom: 4,
  },
  resultStats: {
    fontFamily,
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },
  resultCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  resultCardError: {
    borderColor: colors.danger,
  },
  resultCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
  },
  resultCardIcon: {
    fontSize: fontSize.xl,
    marginRight: spacing.md,
  },
  resultCardName: {
    fontFamily,
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.text,
  },
  resultCardInfo: {
    fontFamily,
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginTop: 2,
  },
  resultCardArrow: {
    fontFamily,
    fontSize: fontSize.xs,
    color: colors.textFaint,
    marginLeft: spacing.md,
  },
  resultCardBody: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
  },
  errorsList: {
    marginBottom: spacing.sm,
  },
  errorItem: {
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: colors.danger,
  },
  errorBlock: {
    fontFamily,
    fontSize: fontSize.xs,
    color: colors.danger,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  errorMsg: {
    fontFamily,
    fontSize: fontSize.sm,
    color: colors.text,
    lineHeight: 22,
  },
  errorContent: {
    fontFamily,
    fontSize: fontSize.xs,
    color: colors.textMuted,
    fontStyle: 'italic',
    marginTop: spacing.xs,
    backgroundColor: colors.paper,
    padding: spacing.sm,
    borderRadius: radius.sm,
  },
  allGoodText: {
    fontFamily,
    fontSize: fontSize.sm,
    color: colors.success,
    fontWeight: '600',
    textAlign: 'center',
    padding: spacing.sm,
  },
  partialText: {
    fontFamily,
    fontSize: fontSize.sm,
    color: colors.warning,
    padding: spacing.sm,
    textAlign: 'center',
  },
  goToBankBtn: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  goToBankText: {
    fontFamily,
    color: colors.white,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  importAgainButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    marginTop: spacing.md,
    alignItems: 'center',
    ...shadow.soft,
  },
  importAgainText: {
    fontFamily,
    color: colors.white,
    fontSize: fontSize.md,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
  },
  emptyIcon: {
    fontSize: 30,
    marginBottom: spacing.md,
  },
  emptyText: {
    fontFamily,
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  emptyDesc: {
    fontFamily,
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },
  bankCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bankCardCurrent: {
    borderColor: colors.primary,
  },
  bankInfo: {
    marginBottom: spacing.md,
  },
  bankHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  bankName: {
    fontFamily,
    fontSize: fontSize.md,
    fontWeight: 'bold',
    color: colors.primaryDeep,
    flex: 1,
  },
  currentBadge: {
    fontFamily,
    backgroundColor: colors.primary,
    color: colors.white,
    fontSize: fontSize.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  bankStats: {
    fontFamily,
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginBottom: spacing.md,
  },
  bankActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.xl,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
  },
  bankActionBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  bankActionText: {
    fontFamily,
    fontSize: fontSize.sm,
    color: colors.primary,
  },
  deleteText: {
    color: colors.danger,
  },
  bankEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  nameInput: {
    flex: 1,
    backgroundColor: colors.paper,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: fontSize.sm,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
  },
  footerBar: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.paper,
  },
  footerButton: {
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
    ...shadow.soft,
  },
  footerButtonText: {
    fontFamily,
    color: colors.white,
    fontSize: fontSize.md,
    fontWeight: '600',
    letterSpacing: 1,
  },
  dataSection: {
    marginTop: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  dataHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  dataHeaderText: {
    fontFamily,
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.text,
    letterSpacing: 1,
  },
  dataHeaderArrow: {
    fontFamily,
    fontSize: fontSize.xs,
    color: colors.textFaint,
  },
  dataContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
  },
  dataPathRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  dataPathLabel: {
    fontFamily,
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },
  dataPathValue: {
    fontFamily,
    fontSize: fontSize.sm,
    color: colors.primary,
    fontWeight: '600',
    flex: 1,
  },
  dataActionButton: {
    backgroundColor: colors.primary,
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.md,
  },
  dataActionText: {
    fontFamily,
    color: colors.white,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  dataInputRow: {
    marginBottom: spacing.md,
  },
  dataInputLabel: {
    fontFamily,
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  dataInputRowInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  dataInput: {
    flex: 1,
    backgroundColor: colors.paper,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: fontSize.sm,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
  },
  dataSubmitBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  dataSubmitBtnText: {
    fontFamily,
    color: colors.white,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  dataHint: {
    fontFamily,
    fontSize: fontSize.xs,
    color: colors.textFaint,
    lineHeight: 20,
  },
  dataActionsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  dataActionBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  exportBtn: {
    backgroundColor: colors.primary,
  },
  importBtn: {
    backgroundColor: colors.success,
  },
  dataActionBtnText: {
    fontFamily,
    color: colors.white,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  clearBtn: {
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.danger,
    alignItems: 'center',
  },
  clearBtnText: {
    fontFamily,
    color: colors.danger,
    fontSize: fontSize.sm,
    fontWeight: '500',
  },
  favoritesSection: {
    marginBottom: spacing.lg,
  },
  favoritesCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  wrongCard: {
    borderColor: colors.danger,
  },
  favoritesInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  favoritesIcon: {
    fontSize: fontSize.xl,
  },
  favoritesCount: {
    fontFamily,
    fontSize: fontSize.md,
    fontWeight: 'bold',
    color: colors.text,
  },
  favoritesDesc: {
    fontFamily,
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginTop: 2,
  },
  favoritesActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  clearFavBtn: {
    backgroundColor: colors.dangerSoft,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  clearFavText: {
    fontFamily,
    color: colors.danger,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  emptyCard: {
    borderStyle: 'dashed',
    opacity: 0.85,
  },
  arrowText: {
    fontFamily,
    fontSize: fontSize.sm,
    color: colors.textFaint,
    marginLeft: spacing.md,
  },
  detailSection: {
    marginTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.paper,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
  },
  detailRowInfo: {
    flex: 1,
  },
  detailRowName: {
    fontFamily,
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.text,
  },
  detailRowCount: {
    fontFamily,
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginTop: 2,
  },
  detailRowActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  detailActionBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
    minWidth: 44,
    alignItems: 'center',
  },
  detailActionPrimary: {
    backgroundColor: colors.primary,
  },
  detailActionClear: {
    backgroundColor: colors.dangerSoft,
  },
  detailActionExport: {
    backgroundColor: colors.successSoft,
  },
  detailActionTextPrimary: {
    fontFamily,
    color: colors.white,
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  detailActionTextClear: {
    fontFamily,
    color: colors.danger,
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  detailActionTextExport: {
    fontFamily,
    color: colors.success,
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  detailFooter: {
    marginTop: spacing.sm,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    alignItems: 'center',
  },
  exportAllBtn: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  exportAllBtnWrong: {
    backgroundColor: colors.danger,
  },
  exportAllBtnText: {
    fontFamily,
    color: colors.white,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
});
