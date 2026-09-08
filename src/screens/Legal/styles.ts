import { Platform, StyleSheet } from 'react-native';

export const colors = {
  background: '#FFF8F1',
  card: '#FFFFFF',
  primary: '#FFAE2B',
  primaryDark: '#F59C00',
  primaryLight: '#FFD56A',
  heading: '#1E1E1E',
  body: '#6D6D6D',
  white: '#FFFFFF',
  link: '#FFAE2B',
  backBtnBg: 'rgba(0, 0, 0, 0.18)',
};

export const fonts = {
  heading: 'Sora-SemiBold',
  subheading: 'WorkSans-Medium',
  body: 'WorkSans-Regular',
};

export const layout = {
  tabletBreakpoint: 768,
  contentMaxWidth: 700,
  cardBorderRadius: 36,
  headerOverlap: 28,
  headerMinHeight: 150,
};

export const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  cardContainer: {
    flex: 1,
    marginTop: -layout.headerOverlap,
  },
  scrollView: {
    flex: 1,
    backgroundColor: colors.card,
    borderTopLeftRadius: layout.cardBorderRadius,
    borderTopRightRadius: layout.cardBorderRadius,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 48,
  },
  tabletContent: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: layout.contentMaxWidth,
  },
  lastUpdated: {
    fontFamily: fonts.heading,
    fontSize: 14,
    color: colors.heading,
    marginBottom: 24,
    lineHeight: 22,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeading: {
    fontFamily: fonts.heading,
    fontSize: 14,
    color: colors.heading,
    marginBottom: 10,
    lineHeight: 22,
  },
  paragraph: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.body,
    lineHeight: 22,
    marginBottom: 10,
  },
  bulletList: {
    marginTop: 4,
    marginBottom: 4,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.heading,
    marginTop: 8,
    marginRight: 10,
  },
  nestedBulletDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: colors.body,
    marginTop: 8,
    marginRight: 10,
  },
  bulletText: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.body,
    lineHeight: 22,
  },
  nestedBulletList: {
    marginTop: 8,
    marginLeft: 16,
  },
  contactRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  contactPrefix: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.body,
    lineHeight: 22,
  },
  contactEmail: {
    fontFamily: fonts.subheading,
    fontSize: 14,
    color: colors.link,
    lineHeight: 22,
  },
  link: {
    fontFamily: fonts.subheading,
    fontSize: 14,
    color: colors.link,
    lineHeight: 22,
    textDecorationLine: 'underline',
  },
  header: {
    minHeight: layout.headerMinHeight,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    paddingBottom: layout.headerOverlap + 16,
  },
  headerGradient: {
    ...StyleSheet.absoluteFill,
  },
  headerCircleLarge: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    right: -60,
    top: -100,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  headerCircleSoft: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderRadius: 18,
    left: '42%',
    top: 36,
    backgroundColor: 'rgba(245, 156, 0, 0.2)',
  },
  headerDotOne: {
    position: 'absolute',
    width: 22,
    height: 22,
    borderRadius: 11,
    left: 48,
    bottom: 48,
    backgroundColor: 'rgba(245, 156, 0, 0.25)',
  },
  headerDotTwo: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    right: 64,
    bottom: 56,
    backgroundColor: 'rgba(224, 188, 188, 0.35)',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    minHeight: 44,
  },
  backButton: {
    position: 'absolute',
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.backBtnBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: fonts.heading,
    fontSize: 16,
    color: colors.white,
    textAlign: 'center',
    paddingHorizontal: 56,
  },
  backButtonPressed: {
    opacity: Platform.OS === 'ios' ? 0.7 : 1,
  },
});
