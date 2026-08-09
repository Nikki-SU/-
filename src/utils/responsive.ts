import { Dimensions, PixelRatio } from 'react-native';

const BASE_WIDTH = 390;
const BASE_HEIGHT = 844;

export const responsiveWidth = (w: number): number => {
  const { width } = Dimensions.get('window');
  return (w / BASE_WIDTH) * width;
};

export const responsiveHeight = (h: number): number => {
  const { height } = Dimensions.get('window');
  return (h / BASE_HEIGHT) * height;
};

export const responsiveFontSize = (f: number): number => {
  const { width } = Dimensions.get('window');
  const scale = width / BASE_WIDTH;
  return PixelRatio.roundToNearestPixel(f * scale);
};

export const responsivePadding = (p: number): number => {
  return responsiveWidth(p);
};

export const responsiveMargin = (m: number): number => {
  return responsiveHeight(m);
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
  return width >= 768;
};

export const isLandscapeMode = (): boolean => {
  const { width, height } = Dimensions.get('window');
  return width > height;
};
