/**
 * AcademicFlow 主题
 * 学术风配色：墨蓝 + 羊皮纸 + 古金，搭配楷体与柔和圆角。
 */

export const colors = {
  // 页面底色（羊皮纸）
  paper: '#F6F2E9',
  paperDeep: '#EDE7D8',
  // 卡片 / 表面
  surface: '#FFFFFF',
  surfaceMuted: '#F5F1E7',
  // 品牌主色（墨蓝）
  primary: '#2F5D8A',
  primaryDeep: '#1F3F63',
  primarySoft: '#E7EEF6',
  // 点缀色（古金）
  accent: '#B0842F',
  accentSoft: '#F6EDD9',
  // 文字
  text: '#26333F',
  textMuted: '#6E7A85',
  textFaint: '#9AA3AB',
  // 描边
  border: '#E5DDCB',
  borderStrong: '#D7CCB4',
  // 语义色
  success: '#3E7F5C',
  successSoft: '#E7F1EA',
  danger: '#B4574B',
  dangerSoft: '#F7E8E4',
  warning: '#B8862A',
  warningSoft: '#F8EFD9',
  // 中性
  neutral: '#9AA3AB',
  neutralSoft: '#EFEBE1',
  white: '#FFFFFF',
};

/** 楷体字体链（Windows / macOS / 通用回退） */
export const fontFamily =
  '"KaiTi", "STKaiti", "Kaiti SC", "楷体", "Kaiti TC", "Songti SC", "Noto Serif SC", serif';

/** 统一的字号级差（px） */
export const fontSize = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 19,
  xl: 24,
  xxl: 30,
};

/** 统一圆角（px） */
export const radius = {
  sm: 10,
  md: 14,
  lg: 20,
  xl: 26,
  pill: 999,
};

/** 统一间距（px） */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

/** 卡片阴影 */
export const shadow = {
  card: {
    shadowColor: '#20364E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 14,
    elevation: 3,
  },
  soft: {
    shadowColor: '#20364E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 1,
  },
};

/** 内容最大宽度（桌面端居中显示） */
export const MAX_CONTENT_WIDTH = 460;
