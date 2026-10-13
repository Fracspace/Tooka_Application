import AsyncStorage from '@react-native-async-storage/async-storage';
import { OnboardingAnswers, OnboardingStorageData } from '../screens/Onboarding/types';

const STORAGE_KEY = 'TOOKA_ONBOARDING';

/**
 * Saves completed onboarding answers and status to AsyncStorage.
 * @param answers Selected goals and preferences
 */
export async function saveOnboarding(answers: OnboardingAnswers): Promise<void> {
  try {
    const data: OnboardingStorageData = {
      completed: true,
      version: 1,
      completedAt: Date.now(),
      answers,
    };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    if (__DEV__) {
      console.warn('[onboardingStorage] saveOnboarding error:', error);
    }
  }
}

/**
 * Reads the onboarding status and details from AsyncStorage.
 * @returns Saved onboarding data or null if not completed/not found.
 */
export async function getOnboarding(): Promise<OnboardingStorageData | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }
    const data = parsed as Partial<OnboardingStorageData>;
    if (data.completed) {
      return {
        completed: true,
        version: data.version ?? 1,
        completedAt: data.completedAt ?? Date.now(),
        answers: {
          goals: data.answers?.goals ?? [],
          preferences: data.answers?.preferences ?? [],
        },
      };
    }
    return null;
  } catch (error) {
    if (__DEV__) {
      console.warn('[onboardingStorage] getOnboarding error:', error);
    }
    return null;
  }
}

/**
 * Forgets the saved goals/preferences but keeps onboarding marked as completed.
 * Called on logout: profile sync pushes these answers to whoever logs in next, so
 * they used to overwrite the next account's preferred categories.
 */
export async function clearOnboardingAnswers(): Promise<void> {
  const existing = await getOnboarding();
  if (!existing) {
    return;
  }
  await saveOnboarding({ goals: [], preferences: [] });
}

/**
 * Clears the onboarding data from AsyncStorage.
 */
export async function clearOnboarding(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    if (__DEV__) {
      console.warn('[onboardingStorage] clearOnboarding error:', error);
    }
  }
}
