import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import StarRating from './StarRating';
import type { PublicReview } from '../types/review';
import { toStarCount } from '../utils/spaRating';

const formatDate = (value: string | null | undefined): string => {
  const date = new Date(value ?? '');
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

const ReviewCard: React.FC<{ review: PublicReview }> = React.memo(({ review }) => {
  const initial = (review.reviewer_name || 'T').trim().charAt(0).toUpperCase();

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        {/* {review.reviewer_avatar ? (
          <Image source={{ uri: review.reviewer_avatar }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}>
            <Text style={styles.avatarInitial}>{initial}</Text>
          </View>
        )} */}
        <View style={styles.headerText}>
          <Text style={styles.name} numberOfLines={1}>
            {review.reviewer_name}
          </Text>
          <View style={styles.metaRow}>
            <StarRating value={toStarCount(review.rating)} size={12} />
            <Text style={styles.date}>{formatDate(review.created_at)}</Text>
          </View>
        </View>
      </View>

      {review.service_name ? (
        <Text style={styles.service}>{review.service_name}</Text>
      ) : null}

      {review.comment ? <Text style={styles.comment}>{review.comment}</Text> : null}

      {review.response_text ? (
        <View style={styles.reply}>
          <Text style={styles.replyLabel}>Response from the spa</Text>
          <Text style={styles.replyText}>{review.response_text}</Text>
        </View>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#EBE3D7',
    padding: 14,
    marginBottom: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 10,
  },
  avatarFallback: {
    backgroundColor: '#FFF4DB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontFamily: 'Sora-SemiBold',
    fontSize: 15,
    color: '#FFB02E',
  },
  headerText: {
    flex: 1,
  },
  name: {
    fontFamily: 'WorkSans-SemiBold',
    fontSize: 14,
    color: '#2D2B28',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  date: {
    fontFamily: 'WorkSans-Regular',
    fontSize: 12,
    color: '#9A9084',
  },
  service: {
    fontFamily: 'WorkSans-Regular',
    fontSize: 12,
    color: '#9A9084',
    marginTop: 8,
  },
  comment: {
    fontFamily: 'WorkSans-Regular',
    fontSize: 14,
    color: '#4D4D4D',
    lineHeight: 20,
    marginTop: 8,
  },
  reply: {
    backgroundColor: '#FFF8EC',
    borderRadius: 10,
    padding: 10,
    marginTop: 10,
  },
  replyLabel: {
    fontFamily: 'WorkSans-SemiBold',
    fontSize: 12,
    color: '#B7791F',
    marginBottom: 3,
  },
  replyText: {
    fontFamily: 'WorkSans-Regular',
    fontSize: 13,
    color: '#4D4D4D',
    lineHeight: 18,
  },
});

export default ReviewCard;
