import React, { useEffect } from 'react';
import { View, Text } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { styles, COLORS } from '../styles';

interface ProgressIndicatorProps {
  currentStep: number;
  totalSteps: number;
}

// One component per dot: the hooks used to be called inside .map(), which breaks
// the rules of hooks as soon as totalSteps changes.
const ProgressDot: React.FC<{ isActive: boolean }> = ({ isActive }) => {
  const dotWidth = useSharedValue(isActive ? 24 : 8);

  useEffect(() => {
    dotWidth.value = withTiming(isActive ? 24 : 8, { duration: 250 });
  }, [isActive, dotWidth]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      width: dotWidth.value,
      backgroundColor: withTiming(
        isActive ? COLORS.primary : COLORS.inactiveDot,
        { duration: 250 }
      ),
    };
  });

  return <Animated.View style={[styles.progressDot, animatedStyle]} />;
};

export const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({
  currentStep,
  totalSteps,
}) => {
  return (
    <View style={styles.progressContainer}>
      {Array.from({ length: totalSteps }).map((_, index) => (
        <ProgressDot key={index} isActive={index === currentStep} />
      ))}
      <Text style={styles.progressText}>
        {currentStep + 1} of {totalSteps}
      </Text>
    </View>
  );
};
