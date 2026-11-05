import React, { useEffect } from 'react';
import { View, Text, ScrollView, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';

import { HeroSection } from './components/HeroSection';
import { OptionGrid } from './components/OptionGrid';
import { ProgressIndicator } from './components/ProgressIndicator';
import { ContinueButton } from './components/ContinueButton';
import { styles } from './styles';
import OnboardingV4 from './v4/OnboardingV4';
import { isV4 } from '../../config/uiFlags';
import { useOnboardingScreen } from '../../hooks/useOnboardingScreen';

export const OnboardingScreen: React.FC = () => {
  const screen = useOnboardingScreen();
  if (isV4('onboarding')) {
    return <OnboardingV4 {...screen} />;
  }
  return <OnboardingLegacy screen={screen} />;
};

function OnboardingLegacy({ screen }: { screen: ReturnType<typeof useOnboardingScreen> }): React.ReactElement {
  const { width } = useWindowDimensions();
  const {
    currentStepIndex,
    setCurrentStepIndex,
    currentStep,
    selectedOptions,
    totalSteps,
    isLastStep,
    isContinueDisabled,
    handleToggleOption,
    finish,
  } = screen;

  const slideOffset = useSharedValue(0);

  const animatedSlideStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: slideOffset.value }],
    };
  });

  const handleContinue = async () => {
    if (isLastStep) {
      // Save data to AsyncStorage and replace route
      await finish();
    } else {
      // Slide current screen out to left
      slideOffset.value = withTiming(-width, { duration: 250 }, (finished) => {
        if (finished) {
          runOnJS(setCurrentStepIndex)(currentStepIndex + 1);
        }
      });
    }
  };

  // Slide new screen in from right when step index changes
  useEffect(() => {
    if (currentStepIndex > 0) {
      slideOffset.value = width;
      slideOffset.value = withTiming(0, { duration: 250 });
    }
  }, [currentStepIndex, width, slideOffset]);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.contentScroll}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <HeroSection />

        <Animated.View style={[animatedSlideStyle, { flex: 1 }]}>
          <View style={styles.textSection}>
            <Text style={styles.title}>{currentStep.title}</Text>
            <Text style={styles.subtitle}>{currentStep.subtitle}</Text>
          </View>

          <OptionGrid
            options={currentStep.options}
            selectedIds={selectedOptions}
            onToggleOption={handleToggleOption}
          />
        </Animated.View>
      </ScrollView>

      {/* Sticky Bottom Row for progress & action button */}
      <SafeAreaView style={styles.footer} edges={['bottom', 'left', 'right']}>
        <View style={styles.footerRow}>
          <ProgressIndicator
            currentStep={currentStepIndex}
            totalSteps={totalSteps}
          />
          <ContinueButton
            onPress={handleContinue}
            disabled={isContinueDisabled}
            text={isLastStep ? 'Finish' : 'Continue'}
          />
        </View>
      </SafeAreaView>
    </SafeAreaView>
  );
}

export default OnboardingScreen;
