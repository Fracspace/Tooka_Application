import React, { useEffect, useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { Button, Icon, PressableScale, RoundButton, Text } from '../ui';
import { brandAlpha, colors, fonts, radii, rise, shadows, space } from '../../theme';
import { REVIEW_CATEGORIES, type MyReview, type ReviewCategoryKey } from '../../types/review';
import { formatVisitDate } from '../../utils/formatVisitDate';
import { toStarCount } from '../../utils/spaRating';
import type { SpaFeedbackModalProps } from '../SpaFeedbackModal';

const MAX_COMMENT = 1000;
const STARS = [1, 2, 3, 4, 5];
const STAR_PATH = 'm12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z';
const RATING_WORDS = ['Tap a star to rate', 'Not good', 'Could be better', 'Good', 'Great', 'Loved it'];

type CategoryRatings = Partial<Record<ReviewCategoryKey, number>>;

function Star({ filled, size }: { filled: boolean; size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d={STAR_PATH}
        fill={filled ? colors.brand : 'transparent'}
        stroke={filled ? colors.brand : colors.subtle}
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function StarRow({
  value,
  size,
  gap,
  onChange,
  label,
}: {
  value: number;
  size: number;
  gap: number;
  onChange?: (value: number) => void;
  label?: string;
}) {
  return (
    <View style={[styles.starRow, { gap }]} accessibilityLabel={label}>
      {STARS.map(star =>
        onChange ? (
          <PressableScale
            key={star}
            onPress={() => onChange(star)}
            hitSlop={6}
            scaleTo={0.86}
            accessibilityRole="button"
            accessibilityLabel={`${label ? `${label}: ` : ''}${star} star${star > 1 ? 's' : ''}`}>
            <Star filled={star <= value} size={size} />
          </PressableScale>
        ) : (
          <Star key={star} filled={star <= value} size={size} />
        ),
      )}
    </View>
  );
}

/**
 * v4 "How was your visit?" sheet. Same props and behaviour as SpaFeedbackModal;
 * ReviewPromptContext picks this one when the reviewPrompt switch is on.
 */
const SpaFeedbackSheetV4 = React.memo(function SpaFeedbackSheet({
  visible,
  spaName,
  serviceName,
  photoUrl,
  visitAt,
  review,
  submitting = false,
  errorMessage,
  onSubmit,
  onDismiss,
}: SpaFeedbackModalProps) {
  const insets = useSafeAreaInsets();
  const [rating, setRating] = useState(0);
  const [categories, setCategories] = useState<CategoryRatings>({});
  const [comment, setComment] = useState('');

  useEffect(() => {
    if (visible) {
      setRating(0);
      setCategories({});
      setComment('');
    }
  }, [visible, spaName]);

  const handleSubmit = () => {
    const trimmed = comment.trim();
    onSubmit({
      rating: rating as 1 | 2 | 3 | 4 | 5,
      ...categories,
      comment: trimmed ? trimmed : null,
    });
  };

  const renderForm = () => (
    <>
      <Animated.View entering={rise(60)} style={styles.ratingBlock}>
        <StarRow value={rating} size={42} gap={10} onChange={setRating} label="Overall" />
        <Text variant="label" color={rating ? colors.brand : colors.subtle} style={styles.ratingWord}>
          {RATING_WORDS[rating]}
        </Text>
      </Animated.View>

      {rating > 0 ? (
        <Animated.View entering={FadeIn.duration(220)} exiting={FadeOut.duration(120)}>
          <View style={styles.card}>
            <Text variant="overline" color={colors.subtle} style={styles.cardLabel}>
              RATE THE DETAILS · OPTIONAL
            </Text>
            {REVIEW_CATEGORIES.map(({ key, label }) => (
              <View key={key} style={styles.categoryRow}>
                <Text variant="bodySm" color={colors.cream}>
                  {label}
                </Text>
                <StarRow
                  value={categories[key] ?? 0}
                  size={22}
                  gap={6}
                  label={label}
                  onChange={value => setCategories(prev => ({ ...prev, [key]: value }))}
                />
              </View>
            ))}
          </View>

          <TextInput
            style={styles.input}
            value={comment}
            onChangeText={setComment}
            placeholder="Tell us more (optional)"
            placeholderTextColor={colors.subtle}
            selectionColor={colors.brand}
            multiline
            maxLength={MAX_COMMENT}
            textAlignVertical="top"
            accessibilityLabel="Comment"
          />
        </Animated.View>
      ) : null}

      {errorMessage ? (
        <Text variant="bodySm" color={colors.danger} style={styles.error}>
          {errorMessage}
        </Text>
      ) : null}

      <Button
        label="Submit feedback"
        onPress={handleSubmit}
        disabled={rating === 0}
        loading={submitting}
        style={styles.primary}
      />
      <Button label="Not now" variant="ghost" size="md" onPress={onDismiss} disabled={submitting} />
    </>
  );

  const renderSubmitted = (submitted: MyReview) => (
    <>
      <View style={styles.ratingBlock}>
        <StarRow value={toStarCount(submitted.rating)} size={34} gap={8} label="Your rating" />
        <Text variant="label" color={colors.muted} style={styles.ratingWord}>
          You rated this visit
        </Text>
      </View>

      {REVIEW_CATEGORIES.some(({ key }) => submitted[key] != null) ? (
        <View style={styles.card}>
          {REVIEW_CATEGORIES.filter(({ key }) => submitted[key] != null).map(({ key, label }) => (
            <View key={key} style={styles.categoryRow}>
              <Text variant="bodySm" color={colors.cream}>
                {label}
              </Text>
              <StarRow value={toStarCount(submitted[key])} size={16} gap={4} label={label} />
            </View>
          ))}
        </View>
      ) : null}

      {submitted.comment ? (
        <Text variant="body" color={colors.cream} style={styles.comment}>
          “{submitted.comment}”
        </Text>
      ) : null}

      {submitted.response_text ? (
        <View style={styles.reply}>
          <Text variant="overline" color={colors.brand}>
            REPLY FROM THE SPA
          </Text>
          <Text variant="bodySm" color={colors.cream} style={styles.replyText}>
            {submitted.response_text}
          </Text>
        </View>
      ) : null}

      <Button label="Done" variant="secondary" onPress={onDismiss} style={styles.primary} />
    </>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onDismiss}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable
          style={styles.backdrop}
          onPress={submitting ? undefined : onDismiss}
          accessibilityLabel="Close feedback"
        />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, space.lg) }]}>
          <View style={styles.handle} />
          <ScrollView
            bounces={false}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.content}>
            <View style={styles.header}>
              {photoUrl ? (
                <Image source={{ uri: photoUrl }} style={styles.photo} />
              ) : (
                <View style={[styles.photo, styles.photoFallback]}>
                  <Icon name="star" size={22} color={colors.brand} />
                </View>
              )}
              <View style={styles.headerText}>
                <Text variant="overline" color={colors.subtle}>
                  {review ? 'YOUR FEEDBACK' : 'HOW WAS YOUR VISIT?'}
                </Text>
                <Text variant="title" numberOfLines={2} style={styles.spaName}>
                  {spaName}
                </Text>
                {serviceName ? (
                  <Text variant="bodySm" color={colors.muted} numberOfLines={1}>
                    {serviceName}
                  </Text>
                ) : null}
                {formatVisitDate(visitAt) ? (
                  <Text variant="caption" color={colors.subtle} numberOfLines={1}>
                    {formatVisitDate(visitAt)}
                  </Text>
                ) : null}
              </View>
              <RoundButton
                variant="soft"
                accessibilityLabel="Close feedback"
                onPress={submitting ? undefined : onDismiss}
                style={styles.close}>
                <Icon name="close" size={18} color={colors.muted} />
              </RoundButton>
            </View>

            {review ? renderSubmitted(review) : renderForm()}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
});

const styles = StyleSheet.create({
  flex: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(8,6,5,0.62)' },
  sheet: {
    maxHeight: '90%',
    backgroundColor: colors.s1,
    borderTopLeftRadius: radii.hero,
    borderTopRightRadius: radii.hero,
    boxShadow: shadows.card,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    marginTop: 10,
    backgroundColor: colors.edgeHi,
  },
  content: { paddingHorizontal: space.xxl, paddingTop: space.xl },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  photo: { width: 56, height: 56, borderRadius: radii.sm, backgroundColor: colors.s2 },
  photoFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: brandAlpha(0.12) },
  headerText: { flex: 1, gap: 2 },
  spaName: { marginTop: 2 },
  close: { width: 36, height: 36, borderRadius: 18, alignSelf: 'flex-start' },
  ratingBlock: { alignItems: 'center', marginTop: 28, marginBottom: space.xxl },
  starRow: { flexDirection: 'row', alignItems: 'center' },
  ratingWord: { marginTop: space.md },
  card: {
    backgroundColor: colors.s2,
    borderRadius: radii.lg,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    boxShadow: shadows.ring,
  },
  cardLabel: { marginBottom: space.xs },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: space.sm,
  },
  input: {
    marginTop: space.md,
    minHeight: 96,
    borderRadius: radii.lg,
    backgroundColor: colors.s2,
    boxShadow: shadows.ring,
    color: colors.text,
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 21,
    paddingHorizontal: space.lg,
    paddingTop: 14,
    paddingBottom: 14,
  },
  error: { marginTop: space.md, textAlign: 'center' },
  primary: { marginTop: space.xl, marginBottom: space.xs },
  comment: { marginTop: space.lg, fontStyle: 'italic' },
  reply: {
    marginTop: space.lg,
    padding: space.lg,
    borderRadius: radii.lg,
    backgroundColor: colors.s2,
    borderLeftWidth: 2,
    borderLeftColor: colors.brand,
  },
  replyText: { marginTop: space.xs },
});

export default SpaFeedbackSheetV4;
