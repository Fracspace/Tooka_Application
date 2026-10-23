import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import ReviewApi from '../../api/ReviewApi';
import ReviewCard from '../../components/ReviewCard';
import StarRating from '../../components/StarRating';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import type { PublicReview, SpaReviewSort, SpaReviewStats } from '../../types/review';

type Props = NativeStackScreenProps<RootStackParamList, 'SpaReviews'>;

const SORTS: Array<{ key: SpaReviewSort; label: string }> = [
  { key: 'recent', label: 'Recent' },
  { key: 'helpful', label: 'Helpful' },
  { key: 'highest', label: 'Highest' },
  { key: 'lowest', label: 'Lowest' },
];

const STAR_ROWS: Array<{ stars: number; key: keyof SpaReviewStats }> = [
  { stars: 5, key: 'five_star' },
  { stars: 4, key: 'four_star' },
  { stars: 3, key: 'three_star' },
  { stars: 2, key: 'two_star' },
  { stars: 1, key: 'one_star' },
];

const SpaReviewsScreen: React.FC<Props> = ({ navigation, route }) => {
  const { spaId, spaName } = route.params;
  const [sort, setSort] = useState<SpaReviewSort>('recent');
  const [reviews, setReviews] = useState<PublicReview[]>([]);
  const [stats, setStats] = useState<SpaReviewStats | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  const load = useCallback(
    async (nextPage: number) => {
      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;
      setLoading(true);
      setError(null);

      try {
        const result = await ReviewApi.getSpaReviews({
          spaId,
          page: nextPage,
          sort,
          signal: controller.signal,
        });
        setReviews(prev => (nextPage === 1 ? result.reviews : [...prev, ...result.reviews]));
        if (result.stats) {
          setStats(result.stats);
        }
        setPage(nextPage);
        setHasMore(result.hasMore);
      } catch {
        if (!controller.signal.aborted) {
          setError('Unable to load reviews.');
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    },
    [spaId, sort],
  );

  useEffect(() => {
    void load(1);
    return () => controllerRef.current?.abort();
  }, [load]);

  const handleEndReached = useCallback(() => {
    if (!loading && hasMore && !error) {
      void load(page + 1);
    }
  }, [loading, hasMore, error, load, page]);

  const renderHeader = () => (
    <View>
      {stats && stats.total > 0 ? (
        <View style={styles.statsCard}>
          <View style={styles.statsLeft}>
            <Text style={styles.avg}>{stats.avg_rating.toFixed(1)}</Text>
            <StarRating value={Math.round(stats.avg_rating)} size={14} />
            <Text style={styles.total}>{stats.total} reviews</Text>
          </View>
          <View style={styles.statsBars}>
            {STAR_ROWS.map(({ stars, key }) => {
              const count = stats[key];
              return (
                <View key={key} style={styles.barRow}>
                  <Text style={styles.barLabel}>{stars}</Text>
                  <View style={styles.barTrack}>
                    <View
                      style={[styles.barFill, { width: `${(count / stats.total) * 100}%` }]}
                    />
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      ) : null}

      <View style={styles.sortRow}>
        {SORTS.map(option => (
          <Pressable
            key={option.key}
            style={[styles.chip, sort === option.key && styles.chipActive]}
            onPress={() => setSort(option.key)}
            accessibilityRole="button">
            <Text style={[styles.chipText, sort === option.key && styles.chipTextActive]}>
              {option.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );

  const renderEmpty = () =>
    loading ? null : (
      <Text style={styles.empty}>{error ?? 'No reviews yet.'}</Text>
    );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.topBar}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10} accessibilityRole="button">
          <Ionicons name="arrow-back" size={22} color="#2D2B28" />
        </Pressable>
        <Text style={styles.title} numberOfLines={1}>
          {spaName ? `${spaName} reviews` : 'Reviews'}
        </Text>
      </View>

      <FlatList
        data={reviews}
        keyExtractor={item => item.id}
        renderItem={({ item }) => <ReviewCard review={item} />}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        ListFooterComponent={
          loading ? <ActivityIndicator style={styles.loader} color="#FFB02E" /> : null
        }
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.4}
        contentContainerStyle={styles.list}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF8F0',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  title: {
    flex: 1,
    fontFamily: 'Sora-SemiBold',
    fontSize: 18,
    color: '#2D2B28',
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  statsCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#EBE3D7',
    padding: 14,
    marginBottom: 12,
  },
  statsLeft: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingRight: 16,
    gap: 4,
  },
  avg: {
    fontFamily: 'Sora-SemiBold',
    fontSize: 32,
    color: '#2D2B28',
  },
  total: {
    fontFamily: 'WorkSans-Regular',
    fontSize: 12,
    color: '#9A9084',
  },
  statsBars: {
    flex: 1,
    justifyContent: 'center',
    gap: 4,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  barLabel: {
    width: 10,
    fontFamily: 'WorkSans-Regular',
    fontSize: 12,
    color: '#4D4D4D',
  },
  barTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#F0EAE0',
    overflow: 'hidden',
  },
  barFill: {
    height: 6,
    backgroundColor: '#FFB02E',
  },
  sortRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#EBE3D7',
    backgroundColor: '#FFFFFF',
  },
  chipActive: {
    backgroundColor: '#FFB02E',
    borderColor: '#FFB02E',
  },
  chipText: {
    fontFamily: 'WorkSans-SemiBold',
    fontSize: 13,
    color: '#4D4D4D',
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  empty: {
    fontFamily: 'WorkSans-Regular',
    fontSize: 14,
    color: '#9A9084',
    textAlign: 'center',
    marginTop: 32,
  },
  loader: {
    marginVertical: 16,
  },
});

export default SpaReviewsScreen;
