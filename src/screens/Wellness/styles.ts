import { StyleSheet, Dimensions } from 'react-native';

const { width } = Dimensions.get('window');

// Defining local colors to match Tooka brand as a central theme wasn't found
export const COLORS = {
  primary: '#FFB02E', // Tooka orange
  primaryLight: '#ffaf2e0D', // Very light orange background
  primaryLighter: '#FFF3E3', // Slightly darker light orange for pills
  background: '#FFF7EE', // General screen background
  text: '#1F1F1F', // Dark text
  secondaryText: '#8f8f8f', // Grey text
  white: '#FFFFFF',
  border: '#E7E2DA',
  cardShadow: 'rgba(0, 0, 0, 0.05)',
  gradientStart: '#FFC86E',
  gradientEnd: '#FFB02E',
};

export const SIZES = {
  padding: 20,
  radius: 16,
  cardWidth: width * 0.65, // For horizontal scroll cards
};

export const FONTS = {
  h1: { fontFamily: 'Sora-SemiBold', fontSize: 18, color: COLORS.text },
  h2: { fontFamily: 'Sora-SemiBold', fontSize: 16, color: COLORS.text },
  h3: { fontFamily: 'Sora-SemiBold', fontSize: 14, color: COLORS.text },
  body1: { fontFamily: 'WorkSans-Regular', fontSize: 14, color: COLORS.text, lineHeight: 22 },
  body2: { fontFamily: 'WorkSans-Regular', fontSize: 13, color: COLORS.text, lineHeight: 20 },
  subtitle: { fontFamily: 'WorkSans-Regular', fontSize: 14, color: COLORS.secondaryText, fontStyle: 'italic' as const },
  button: { fontFamily: 'WorkSans-Medium', fontSize: 14, color: COLORS.white },
  caption: { fontFamily: 'WorkSans-Regular', fontSize: 12, color: COLORS.secondaryText },
};

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  contentContainer: {
    paddingBottom: 40,
  },
  section: {
    paddingHorizontal: SIZES.padding,
    marginTop: 24,
  },
  // Hero Image
  heroImage: {
    width: width - SIZES.padding * 2,
    height: 220,
    borderRadius: SIZES.radius,
    alignSelf: 'center',
    marginTop: -80,
  },
  // Category Pill
  categoryPill: {
    backgroundColor: COLORS.primaryLighter,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  categoryText: {
    ...FONTS.caption,
    color: COLORS.primary,
    fontFamily: 'Sora-SemiBold',
    fontSize: 10,
    textTransform: 'uppercase',
  },
  // Typography
  title: {
    ...FONTS.h1,
    marginBottom: 8,
  },
  subtitle: {
    ...FONTS.subtitle,
    marginBottom: 16,
  },
  body: {
    ...FONTS.body1,
    color: '#4A4A4A',
  },
  // Benefits
  benefitsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  benefitCard: {
    width: (width - SIZES.padding * 2 - 16) / 2, // Two cards side by side with gap
    backgroundColor: COLORS.white,
    borderRadius: SIZES.radius,
    padding: 16,
    shadowColor: COLORS.cardShadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 2,
  },
  benefitIconContainer: {
    marginBottom: 12,
  },
  benefitTitle: {
    ...FONTS.h3,
    marginBottom: 4,
  },
  benefitDesc: {
    ...FONTS.caption,
    lineHeight: 18,
  },
  // Did You Know
  dykCard: {
    backgroundColor: COLORS.primaryLight,
    borderWidth: 1,
    borderColor: '#FFB02E1A',
    borderRadius: SIZES.radius,
    padding: 20,
    marginTop: 24,
    marginHorizontal: SIZES.padding,
    overflow: 'hidden',
  },
  dykHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  dykTitle: {
    ...FONTS.h2,
    color: COLORS.primary,
    marginLeft: 8,
  },
  dykBody: {
    ...FONTS.body1,
    color: '#666666',
  },
  dykDecoration: {
    position: 'absolute',
    right: -20,
    top: -20,
    opacity: 0.1,
  },
  // Spas
  spasHeader: {
    ...FONTS.h2,
    marginBottom: 16,
  },
  spaCard: {
    width: SIZES.cardWidth,
    backgroundColor: COLORS.white,
    borderRadius: SIZES.radius,
    marginRight: 16,
    shadowColor: COLORS.cardShadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 3,
    overflow: 'hidden',
  },
  spaImage: {
    width: '100%',
    height: 120,
  },
  spaContent: {
    padding: 12,
  },
  spaName: {
    ...FONTS.h3,
    marginBottom: 4,
  },
  spaMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  spaMetaText: {
    ...FONTS.caption,
    marginLeft: 4,
  },
  spaDot: {
    color: COLORS.secondaryText,
    marginHorizontal: 4,
  },
  // Button
  button: {
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  buttonText: {
    ...FONTS.button,
  },
  // Header Component
  headerContainer: {
    paddingTop: 200, // Safe area approx
    paddingBottom: 20,
    paddingHorizontal: SIZES.padding,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    overflow: 'hidden',
  },
  headerTitle: {
    ...FONTS.h2,
    color: COLORS.white,
    flex: 1,
    textAlign: 'center',
    marginRight: 24, // To balance the back button
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    zIndex: 1,
  }
});
