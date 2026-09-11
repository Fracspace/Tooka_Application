import { StyleSheet, Dimensions } from 'react-native';

const { width, height } = Dimensions.get('window');
const isTablet = width >= 768;

export const COLORS = {
  primary: '#FFB02E',      // Brand Orange/Gold
  primaryLight: '#FFF8EB', // Light Orange Background
  title: '#222222',        // Title text color
  subtitle: '#8C8C8C',     // Subtitle text color
  white: '#FFFFFF',
  cardBorder: '#E8E8E8',
  shadow: '#000000',
  inactiveDot: '#E0E0E0',
  textDark: '#222222',
};

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF7EE',
  },
  contentScroll: {
    flexGrow: 1,
    paddingBottom: 24,
  },
  // Text Section
  textSection: {
    alignItems: 'center',
    paddingHorizontal: isTablet ? 40 : 24,
    marginTop: 15,
    marginBottom: 15,
  },
  title: {
    fontFamily: 'Sora-SemiBold',
    fontSize: 16,
    color: COLORS.title,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 6,
  },
  subtitle: {
    fontFamily: 'WorkSans-Regular',
    fontSize: 12,
    color: COLORS.subtitle,
    textAlign: 'center',
    lineHeight: 20,
  },
  // Options Grid
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: isTablet ? 40 : 15,
    marginBottom: 15,
  },
  cardWrapper: {
    width: '47.5%', // 2 columns with spacing
    marginVertical: 5,
  },
  optionCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    paddingVertical: isTablet ? 24 : 12,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    // Soft Shadow
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  optionCardSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryLight,
  },
  optionIcon: {
    fontSize: isTablet ? 32 : 22,
    marginBottom: 8,
    textAlign: 'center',
  },
  optionText: {
    fontFamily: 'WorkSans-Medium',
    fontSize: 14,
    color: COLORS.textDark,
    textAlign: 'center',
  },
  optionTextSelected: {
    color: COLORS.primary,
  },
  // Footer Area
  footer: {
    paddingHorizontal: isTablet ? 40 : 24,
    paddingBottom: 16,
    alignItems: 'center',
  },
  footerRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  // Progress Indicator
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressDot: {
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.inactiveDot,
    marginRight: 6,
  },
  progressText: {
    fontFamily: 'WorkSans-Medium',
    fontSize: 12,
    color: COLORS.subtitle,
    marginLeft: 6,
  },
  // Button
  button: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 28,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 140,
  },
  buttonDisabled: {
    backgroundColor: '#E0E0E0',
  },
  buttonText: {
    fontFamily: 'Sora-SemiBold',
    fontSize: 18,
    color: COLORS.white,
  },
  buttonTextDisabled: {
    color: '#A0A0A0',
  },
});
