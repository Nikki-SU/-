import { Dimensions } from 'react-native';

// 以移动端为基准：宽度按 460 封顶、高度按 900 封顶，
// 避免在桌面/大屏上百分比尺寸被无限放大导致排版失真。
const BASE_WIDTH = 460;
const BASE_HEIGHT = 900;

const clampedWidth = (): number => {
  const { width } = Dimensions.get('window');
  return Math.min(width, BASE_WIDTH);
};

const clampedHeight = (): number => {
  const { height } = Dimensions.get('window');
  return Math.min(height, BASE_HEIGHT);
};

export const widthPercent = (percent: number): number => {
  return (percent / 100) * clampedWidth();
};

export const heightPercent = (percent: number): number => {
  return (percent / 100) * clampedHeight();
};

export const fontSizePercent = (percent: number): number => {
  return (percent / 100) * clampedWidth();
};

export const small = {
  xs: widthPercent(1),
  sm: widthPercent(1.5),
  md: widthPercent(2),
  lg: widthPercent(3),
  xl: widthPercent(4),
};

export const fontSmall = {
  xs: fontSizePercent(2.5),
  sm: fontSizePercent(3),
  md: fontSizePercent(3.5),
  lg: fontSizePercent(4),
  xl: fontSizePercent(5),
};

export const heightSmall = {
  xs: heightPercent(0.5),
  sm: heightPercent(1),
  md: heightPercent(1.5),
  lg: heightPercent(2),
  xl: heightPercent(3),
};

export const getScreenWidth = (): number => {
  const { width } = Dimensions.get('window');
  return width;
};

export const getScreenHeight = (): number => {
  const { height } = Dimensions.get('window');
  return height;
};

export const isTablet = (): boolean => {
  const { width } = Dimensions.get('window');
  return width >= widthPercent(50);
};

export const isLandscapeMode = (): boolean => {
  const { width, height } = Dimensions.get('window');
  return width > height;
};
