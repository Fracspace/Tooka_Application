import { useCallback, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { onboardingData } from '../screens/Onboarding/onboardingData';
import type { OnboardingAnswers } from '../screens/Onboarding/types';
import { saveOnboarding } from '../utils/onboardingStorage';
import type { RootStackParamList } from '../navigation/AppNavigator';

/** Most options a user can pick on one step. */
export const MAX_ONBOARDING_PICKS = 3;

/**
 * The two onboarding questions: up to three picks per step, then the answers
 * are saved and the user lands on the tabs. The old layout and the v4 layout
 * both read from here; each draws its own step transition.
 */
export function useOnboardingScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [answers, setAnswers] = useState<OnboardingAnswers>({
    goals: [],
    preferences: [],
  });

  const currentStep = onboardingData[currentStepIndex];
  const selectedOptions = answers[currentStep.key];
  const totalSteps = onboardingData.length;
  const isLastStep = currentStepIndex === totalSteps - 1;

  const handleToggleOption = (optionId: string) => {
    if (selectedOptions.includes(optionId)) {
      setAnswers((prev) => ({
        ...prev,
        [currentStep.key]: prev[currentStep.key].filter((id) => id !== optionId),
      }));
    } else {
      if (selectedOptions.length < MAX_ONBOARDING_PICKS) {
        setAnswers((prev) => ({
          ...prev,
          [currentStep.key]: [...prev[currentStep.key], optionId],
        }));
      }
    }
  };

  /** Saves the answers and replaces the stack with the tabs. */
  const finish = useCallback(async () => {
    await saveOnboarding(answers);
    navigation.reset({
      index: 0,
      routes: [{ name: 'BottomNavigation' }],
    });
  }, [answers, navigation]);

  return {
    currentStepIndex,
    setCurrentStepIndex,
    currentStep,
    selectedOptions,
    totalSteps,
    isLastStep,
    isContinueDisabled: selectedOptions.length === 0,
    handleToggleOption,
    finish,
  };
}
