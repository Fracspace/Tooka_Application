import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

import StarRating from './StarRating';
import {
  REVIEW_CATEGORIES,
  type MyReview,
  type ReviewCategoryKey,
  type SubmitReviewBody,
} from '../types/review';
import { toStarCount } from '../utils/spaRating';

export type FeedbackDraft = Omit<SubmitReviewBody, 'booking_id'>;

interface SpaFeedbackModalProps {
  visible: boolean;
  spaName: string;
  serviceName?: string | null;
  /** When set, the modal shows the guest's submitted feedback instead of the form. */
  review?: MyReview | null;
  submitting?: boolean;
  errorMessage?: string | null;
  onSubmit: (draft: FeedbackDraft) => void;
  onDismiss: () => void;
}

const MAX_COMMENT = 1000;

type CategoryRatings = Partial<Record<ReviewCategoryKey, number>>;

const SpaFeedbackModal: React.FC<SpaFeedbackModalProps> = React.memo(
  ({
    visible,
    spaName,
    serviceName,
    review,
    submitting = false,
    errorMessage,
    onSubmit,
    onDismiss,
  }) => {
    const [rating, setRating] = useState(0);
    const [categories, setCategories] = useState<CategoryRatings>({});
    const [comment, setComment] = useState('');
    const [isAnonymous, setIsAnonymous] = useState(false);

    useEffect(() => {
      if (visible) {
        setRating(0);
        setCategories({});
        setComment('');
        setIsAnonymous(false);
      }
    }, [visible, spaName]);

    const canSubmit = rating > 0 && !submitting;

    const handleSubmit = () => {
      const trimmed = comment.trim();
      onSubmit({
        rating: rating as FeedbackDraft['rating'],
        ...categories,
        comment: trimmed ? trimmed : null,
        is_anonymous: isAnonymous,
      });
    };

    const renderForm = () => (
      <>
        <Text style={styles.subtitle}>How was your visit?</Text>
        <StarRating value={rating} onChange={setRating} size={36} gap={8} />

        <Text style={styles.sectionLabel}>Rate the details (optional)</Text>
        {REVIEW_CATEGORIES.map(({ key, label }) => (
          <View key={key} style={styles.categoryRow}>
            <Text style={styles.categoryLabel}>{label}</Text>
            <StarRating
              value={categories[key] ?? 0}
              onChange={value =>
                setCategories(prev => ({ ...prev, [key]: value }))
              }
              size={20}
              gap={4}
            />
          </View>
        ))}

        <TextInput
          style={styles.input}
          value={comment}
          onChangeText={setComment}
          placeholder="Tell us about your experience (optional)"
          placeholderTextColor="#9CA3AF"
          multiline
          maxLength={MAX_COMMENT}
          textAlignVertical="top"
        />

        <View style={styles.anonymousRow}>
          <Text style={styles.categoryLabel}>Post anonymously</Text>
          <Switch
            value={isAnonymous}
            onValueChange={setIsAnonymous}
            trackColor={{ true: '#FFB02E', false: '#E5E7EB' }}
            thumbColor="#FFFFFF"
          />
        </View>

        {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}

        <Pressable
          style={[styles.button, !canSubmit && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={!canSubmit}
          accessibilityRole="button">
          <Text style={styles.buttonText}>
            {submitting ? 'Submitting…' : 'Submit'}
          </Text>
        </Pressable>

        <Pressable onPress={onDismiss} hitSlop={8} accessibilityRole="button">
          <Text style={styles.notNow}>Not now</Text>
        </Pressable>
      </>
    );

    const renderSubmitted = (submitted: MyReview) => (
      <>
        <Text style={styles.subtitle}>You rated this visit</Text>
        <StarRating value={toStarCount(submitted.rating)} size={30} gap={6} />

        {REVIEW_CATEGORIES.filter(({ key }) => submitted[key] != null).map(
          ({ key, label }) => (
            <View key={key} style={styles.categoryRow}>
              <Text style={styles.categoryLabel}>{label}</Text>
              <StarRating value={toStarCount(submitted[key])} size={16} />
            </View>
          ),
        )}

        {submitted.comment ? (
          <Text style={styles.comment}>“{submitted.comment}”</Text>
        ) : null}

        {submitted.response_text ? (
          <View style={styles.replyBox}>
            <Text style={styles.replyLabel}>Reply from {spaName}</Text>
            <Text style={styles.replyText}>{submitted.response_text}</Text>
          </View>
        ) : null}

        <Pressable
          style={[styles.button, styles.buttonSpaced]}
          onPress={onDismiss}
          accessibilityRole="button">
          <Text style={styles.buttonText}>Done</Text>
        </Pressable>
      </>
    );

    return (
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={onDismiss}>
        <KeyboardAvoidingView
          style={styles.backdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.card}>
            <Pressable
              style={styles.closeButton}
              onPress={onDismiss}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Close feedback">
              <Ionicons name="close" size={22} color="#6B7280" />
            </Pressable>

            <ScrollView
              contentContainerStyle={styles.content}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}>
              <Text style={styles.spaName} numberOfLines={2}>
                {spaName}
              </Text>
              {serviceName ? (
                <Text style={styles.serviceName}>{serviceName}</Text>
              ) : null}

              {review ? renderSubmitted(review) : renderForm()}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    );
  },
);

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(17,24,39,0.45)',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    maxHeight: '85%',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 20,
    alignItems: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: 14,
    right: 14,
    zIndex: 1,
  },
  spaName: {
    fontFamily: 'Sora-SemiBold',
    fontSize: 20,
    color: '#1F1F1F',
    textAlign: 'center',
    marginHorizontal: 16,
  },
  serviceName: {
    fontFamily: 'WorkSans-Regular',
    fontSize: 13,
    color: '#9CA3AF',
    marginTop: 2,
  },
  subtitle: {
    fontFamily: 'WorkSans-Regular',
    fontSize: 14,
    color: '#6B7280',
    marginTop: 6,
    marginBottom: 14,
  },
  sectionLabel: {
    alignSelf: 'flex-start',
    fontFamily: 'WorkSans-SemiBold',
    fontSize: 13,
    color: '#4B5563',
    marginTop: 20,
    marginBottom: 6,
  },
  categoryRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 5,
  },
  categoryLabel: {
    fontFamily: 'WorkSans-Regular',
    fontSize: 14,
    color: '#1F1F1F',
  },
  input: {
    width: '100%',
    minHeight: 96,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
    fontFamily: 'WorkSans-Regular',
    fontSize: 14,
    color: '#1F1F1F',
    marginTop: 14,
  },
  anonymousRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    marginBottom: 6,
  },
  error: {
    fontFamily: 'WorkSans-Regular',
    fontSize: 13,
    color: '#D94A45',
    textAlign: 'center',
    marginTop: 4,
  },
  comment: {
    fontFamily: 'WorkSans-Regular',
    fontSize: 14,
    color: '#4B5563',
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 14,
  },
  replyBox: {
    width: '100%',
    backgroundColor: '#FFF8EC',
    borderRadius: 12,
    padding: 12,
    marginTop: 14,
  },
  replyLabel: {
    fontFamily: 'WorkSans-SemiBold',
    fontSize: 12,
    color: '#B7791F',
    marginBottom: 4,
  },
  replyText: {
    fontFamily: 'WorkSans-Regular',
    fontSize: 13,
    color: '#4B5563',
    lineHeight: 18,
  },
  button: {
    backgroundColor: '#FFB02E',
    borderRadius: 999,
    paddingVertical: 12,
    width: '100%',
    alignItems: 'center',
    marginTop: 12,
  },
  buttonSpaced: {
    marginTop: 20,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    fontFamily: 'WorkSans-SemiBold',
    fontSize: 15,
    color: '#FFFFFF',
  },
  notNow: {
    fontFamily: 'WorkSans-SemiBold',
    fontSize: 14,
    color: '#6B7280',
    marginTop: 14,
  },
});

export default SpaFeedbackModal;
