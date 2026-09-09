import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Linking, Platform } from 'react-native';
import {
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  ActivityIndicator,
  type ListRenderItemInfo,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/AppNavigator';

import MapView, { Marker } from 'react-native-maps';
// import { useNavigation } from '@react-navigation/native';
// import Ionicons from 'react-native-vector-icons/Ionicons';

// import { useNearbySpa } from '../../context/NearbySpaContext';
// import { useLocation } from '../../context/LocationContext';

import Header from '../../components/Header';
import SearchBar from '../../components/SearchBar';
import CategoryCard from '../../components/CategoryCard';
import FeaturedSpaCard from '../../components/FeaturedSpaCard';
import NearbySpaCard from '../../components/NearbySpaCard';
import OfferCard from '../../components/OfferCard';
import WellnessCard from '../../components/WellnessCard';
import { categories as categoriesData, wellnessMoments as wellnessMomentsData, offer as offerData, wellnessInsight as wellnessInsightData, } from '../../data/homeData';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSpaDiscovery } from '../../hooks/useSpaDiscovery';
import { useLocation } from '../../context/LocationContext';
import { useNearbySpas } from '../../context/NearbySpaContext';
import { useSpaSearch } from '../../hooks/useSpaSearch';
import FullScreenLoader from '../../components/loaders/FullScreenLoader';
import StateMessage from '../../components/common/StateMessage';

import type { Spa } from '../../types/spa';
import { getSpaDistance } from '../../utils/distance';
import { getLocationDisplayParts } from '../../services/locationAddress';
import { useProfile } from '../../context/ProfileContext';
import { Analytics, AnalyticsEvents, AnalyticsScreens } from '../../services/firebase/analytics';
import { Crashlytics } from '../../services/firebase/crashlytics';
import { restart } from 'react-native-stallion';

type HomeScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Home'>;

interface CategoryItem {
  id: string;
  label: string;
  icon: string;
  selected?: boolean;
}

interface FeaturedSpaItem {
  id: string;
  name: string;
  location: string;
  distance: string;
  rating: string;
  reviews: string;
  price: string;
  oldPrice?: string;
  badge: string;
  image: string;
  favorite: boolean;
}

interface NearbySpaItem {
  id: string;
  name: string;
  subtitle: string;
  typeA: string;
  typeB: string;
  rating: string;
  image: string;
  latitude: number;
  longitude: number
}

interface OfferItem {
  id: string;
  label: string;
  title: string;
  subtitle: string;
  cta: string;
}

interface WellnessMomentItem {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  big?: boolean;
}

interface WellnessInsightItem {
  id: string;
  title: string;
  description: string;
  image: string;
}

const PLACEHOLDER_IMAGE = 'https://d2f15ematxpwp4.cloudfront.net/appImages/Spacover.jpg';
const DEFAULT_LOCATION = 'Hyderabad';
const DEFAULT_RATING = 4.5;
const DEFAULT_BADGE = 'Premium';
const DEFAULT_PRICE = '1,499';
const DEFAULT_DISTANCE = '1.2 km';

const FEATURED_CARD_WIDTH = 250;
const FEATURED_CARD_MARGIN = 16;

const HomeScreen: React.FC = () => {
  const navigation = useNavigation<HomeScreenNavigationProp>();
  const { width } = useWindowDimensions();
  const [selectedCategory, setSelectedCategory] = useState<string>('spa');
  const isTablet = width >= 768;
  const { profile, loading: profileLoading } = useProfile();

  const categories = categoriesData as CategoryItem[];
  const { location, loading: locationLoading, refreshLocation } = useLocation();
  // console.log("User locartionL ", location);
  const {
    spas: contextSpas,
    loading: contextLoading,
    refreshing: contextRefreshing,
    refresh: contextRefresh,
    error: contextError,
    loadNextPage,
    loadingMore,
    retry,
  } = useNearbySpas();
  const {
    searchQuery,
    setSearchQuery,
    searchResults,
    searchLoading,
    searchError,
    normalizedQuery,
    retrySearch,
    clearSearch,
  } = useSpaSearch();
  // console.log("Context spa: ", contextSpas, "Search Results: ", searchResults);

  const nearbySpas = useMemo<NearbySpaItem[]>(
    () =>
      contextSpas.map((s) => ({
        id: s.id,
        name: s.name,
        subtitle: s.subtitle,
        typeA: s.typeA,
        typeB: s.typeB,
        rating: s.rating.toFixed(1),
        image: s.image,
        latitude: s.latitude,
        longitude: s.longitude,
        price: s.starting_price ?? DEFAULT_PRICE,
      })),
    [contextSpas],
  );

  //   const navigation = useNavigation();

  // const { spas } = useNearbySpa();
  // const { location } = useLocation();

  useEffect(() => {
    // Analytics.logScreen(AnalyticsScreens.Home);

    Analytics.logEvent(AnalyticsEvents.HOME_VIEWED);
  }, []);
  useEffect(() => {
    Crashlytics.log('Application Started');
  }, []);



  const wellnessMoments = wellnessMomentsData as WellnessMomentItem[];
  const offer = offerData as OfferItem;
  const wellnessInsight = wellnessInsightData as WellnessInsightItem;

  const resolvedCity = useMemo(() => {
    const pCity = profile?.city?.trim();
    const lCity = location?.city?.trim();
    return lCity || pCity || 'Hyderabad';
  }, [profile?.city, location?.city]);

  const { spas, loading, error, refreshing, refetch, onRefresh } = useSpaDiscovery(resolvedCity);

  const locationDisplay = useMemo(() => {
    const address = location ? {
      locality: location.locality ?? null,
      subLocality: location.subLocality ?? null,
      city: location.city ?? null,
      state: location.state ?? null,
      country: location.country ?? null,
    } : null;

    return getLocationDisplayParts(address, { isLoading: locationLoading });
  }, [location, locationLoading]);

  const handlePressLocation = useCallback(() => {
    navigation.navigate('LocationSelection');
  }, [navigation]);

  // console.log("Curated spas: ", spas);

  const featuredSpas = useMemo<FeaturedSpaItem[]>(
    () =>
      spas.map((spa) => {
        const { distanceStr } = getSpaDistance(
          spa,
          location?.latitude,
          location?.longitude,
        );
        return {
          id: spa.id,
          name: spa.name ?? 'Untitled Spa',
          location: spa.city_name ?? DEFAULT_LOCATION,
          distance: distanceStr,
          rating: String(spa.rating_google ?? DEFAULT_RATING),
          reviews: `${spa.review_count_google ?? 0} reviews`,
          price: `₹ ${spa.starting_price ?? DEFAULT_PRICE}`,
          oldPrice: '',
          badge: DEFAULT_BADGE,
          image: spa.cover_photo_url ?? PLACEHOLDER_IMAGE,
          favorite: false,
        };
      }),
    [spas, location?.latitude, location?.longitude],
  );

  const mapRef = useRef<MapView | null>(null);

  const handleMapReady = useCallback(() => {
    if (location?.latitude != null && location?.longitude != null) {
      mapRef.current?.animateToRegion(
        {
          latitude: location.latitude,
          longitude: location.longitude,
          latitudeDelta: 0.04,
          longitudeDelta: 0.04,
        },
        300,
      );
    }
  }, [location?.latitude, location?.longitude]);

  useEffect(() => {
    if (location?.latitude != null && location?.longitude != null) {
      mapRef.current?.animateToRegion(
        {
          latitude: location.latitude,
          longitude: location.longitude,
          latitudeDelta: 0.04,
          longitudeDelta: 0.04,
        },
        500,
      );
    }
  }, [location?.latitude, location?.longitude]);

  const previewSpas = useMemo(() => {
    if (nearbySpas.length > 0) {
      return nearbySpas
        .slice(0, 5)
        .map((s) => ({
          id: s.id,
          name: s.name,
          latitude: Number(s.latitude),
          longitude: Number(s.longitude),
        }))
        .filter(
          (s) =>
            !isNaN(s.latitude) &&
            !isNaN(s.longitude) &&
            s.latitude !== 0 &&
            s.longitude !== 0,
        );
    }

    return spas
      .slice(0, 5)
      .map((s) => ({
        id: s.id,
        name: s.name,
        latitude: Number(s.lat),
        longitude: Number(s.lng),
      }))
      .filter(
        (s) =>
          !isNaN(s.latitude) &&
          !isNaN(s.longitude) &&
          s.latitude !== 0 &&
          s.longitude !== 0,
      );
  }, [nearbySpas, spas]);

  const isSearchActive = normalizedQuery.length >= 2;

  const mappedSearchResults = useMemo<FeaturedSpaItem[]>(() => {
    // console.log("Search Results: ", searchResults);
    return searchResults.map((spa) => {
      const { distanceStr } = getSpaDistance(
        { lat: spa.latitude, lng: spa.longitude },
        location?.latitude,
        location?.longitude,
      );
      // console.log("Mapped Search Results: ", spa, distanceStr);
      return {
        id: spa.id,
        name: spa.name ?? 'Untitled Spa',
        location: spa.subtitle ?? DEFAULT_LOCATION,
        distance: distanceStr,
        rating: spa.rating ?? String(DEFAULT_RATING),
        reviews: '0 reviews',
        price: `₹ ${spa.starting_price ?? DEFAULT_PRICE}`,
        oldPrice: '',
        badge: DEFAULT_BADGE,
        image: spa.image === "" ? PLACEHOLDER_IMAGE : spa.image ?? PLACEHOLDER_IMAGE,
        favorite: false,
      };
    });
  }, [searchResults, location?.latitude, location?.longitude]);

  const curatedList = useMemo<FeaturedSpaItem[]>(() => {
    if (isSearchActive) {
      return mappedSearchResults;
    }
    return featuredSpas;
  }, [featuredSpas, isSearchActive, mappedSearchResults]);

  const shouldShowSearchLoading = isSearchActive && searchLoading;
  const shouldShowSearchEmptyState = isSearchActive && !searchLoading && !searchError && curatedList.length === 0;
  const shouldShowSearchError = isSearchActive && Boolean(searchError) && curatedList.length === 0;
  const shouldShowSearchResults = isSearchActive && !searchLoading && curatedList.length > 0;
  // console.log("Preview Spa: ", previewSpas);

  const handlePressSpaCard = useCallback(
    (spaId: string) => {
      navigation.navigate('SpaDetails', { spaId });
    },
    [navigation],
  );

  const handlePressCategory = useCallback((id: string) => setSelectedCategory(id), []);

  const handleFavoritePress = useCallback(() => undefined, []);

  const renderCategoryItem = useCallback(
    ({ item }: ListRenderItemInfo<CategoryItem>) => (
      <CategoryCard
        icon={item.icon}
        label={item.label}
        selected={item.id === selectedCategory}
        onPress={() => handlePressCategory(item.id)}
      />
    ),
    [handlePressCategory, selectedCategory],
  );

  const renderFeaturedSpaItem = useCallback(
    ({ item }: ListRenderItemInfo<FeaturedSpaItem>) => (
      <FeaturedSpaCard
        item={item}
        onPress={() => handlePressSpaCard(item.id)}
        onPressFavorite={handleFavoritePress}
      />
    ),
    [handleFavoritePress, handlePressSpaCard],
  );

  const renderNearbySpaItem = useCallback(
    ({ item }: ListRenderItemInfo<NearbySpaItem>) => (
      <NearbySpaCard item={item} onPress={() => handlePressSpaCard(item.id)} />
    ),
    [handlePressSpaCard],
  );

  const renderListSeparator = useCallback(
    () => <View style={styles.listSeparator} />,
    [],
  );

  const getFeaturedSpaItemLayout = useCallback(
    (_: ArrayLike<FeaturedSpaItem> | null | undefined, index: number) => ({
      length: FEATURED_CARD_WIDTH + FEATURED_CARD_MARGIN,
      offset: (FEATURED_CARD_WIDTH + FEATURED_CARD_MARGIN) * index,
      index,
    }),
    [],
  );

  const isRefreshing = refreshing || contextRefreshing;

  const handleRefresh = useCallback(async () => {
    await Promise.all([
      onRefresh(),
      contextRefresh().catch(() => { }),
    ]);
  }, [onRefresh, contextRefresh]);

  // const handleScroll = useCallback(
  //   ({ nativeEvent }: any) => {
  //     const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
  //     const isCloseToBottom =
  //       layoutMeasurement.height + contentOffset.y >= contentSize.height - 150;

  //     if (isCloseToBottom) {
  //       loadNextPage();
  //     }
  //   },
  //   [loadNextPage],
  // );

  const isInitialLoading = (loading && spas.length === 0) ||
    (contextLoading && contextSpas.length === 0 && location?.permission === 'granted');

  if (isInitialLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <FullScreenLoader />
      </SafeAreaView>
    );
  }
  const shouldRenderEmptyState = !loading && !error && featuredSpas.length === 0;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={[styles.content, isTablet && styles.contentTablet]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />}
      // onScroll={handleScroll}
      // scrollEventThrottle={16}
      >
        <Header
          location={locationDisplay.primary}
          locationSecondary={locationDisplay.secondary}
          isLoading={locationLoading && !location?.city && !location?.locality && !location?.subLocality}
          isPermissionDenied={location?.permission === 'denied' || location?.permission === 'blocked' || location?.permission === 'restricted' || location?.permission === 'disabled'}
          onPressLocation={handlePressLocation}
          onPressNotification={() => {
            // TODO: Add notification navigation
          }}
        />

        {/* <Button
          title="Test Crash"
          onPress={() => Crashlytics.testCrash()}
        /> */}

        {/* <Text style={styles.greeting}>
          {profile?.displayName ? `Hello, ${profile?.displayName}` : `Hello User`}
        </Text>
        <Text style={styles.title}>Ready to relax and recharge?</Text> */}
        {/* <Text>Welcome to Tooka OTA 🚀</Text> */}

        {/* <Button
          title="Restart OTA"
          onPress={() => {
            console.log('Restarting OTA...');
            restart();
          }}
        /> */}

        <SearchBar
          value={searchQuery}
          onChangeText={setSearchQuery}
          onPressSearch={() => {
            // TODO: Add search action
          }}
          onPressClear={() => {
            setSearchQuery('');
          }}
        />

        {/* <FlatList<CategoryItem>
          data={categories}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.categoriesList}
          initialNumToRender={4}
          maxToRenderPerBatch={4}
          windowSize={3}
          removeClippedSubviews
          renderItem={renderCategoryItem}
        /> */}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Curated for you</Text>
          <Pressable onPress={() => { }}>
            {/* <Text style={styles.sectionAction}>See all</Text> */}
          </Pressable>
        </View>

        {shouldShowSearchLoading ? (
          <View style={styles.searchLoadingContainer}>
            <ActivityIndicator size="small" color="#FFB02E" />
          </View>
        ) : shouldShowSearchEmptyState ? (
          <View style={styles.emptyStateContainer}>
            <Ionicons name="search-outline" size={32} color="#FFB02E" />
            <Text style={styles.emptyStateTitle}>No spas found</Text>
            <Text style={styles.emptyStateSubtitle}>Try another spa name or city.</Text>
            <Pressable style={styles.emptyStateButton} onPress={clearSearch}>
              <Text style={styles.emptyStateButtonText}>Clear Search</Text>
            </Pressable>
          </View>
        ) : shouldShowSearchError ? (
          <StateMessage
            title="Couldn't search spas."
            subtitle="Please try again with another spa name or city."
            actionLabel="Retry"
            onAction={retrySearch}
          />
        ) : error && spas.length === 0 ? (
          <StateMessage
            title="Something went wrong."
            subtitle="Please try again."
            actionLabel="Retry"
            onAction={refetch}
          />
        ) : shouldRenderEmptyState ? (
          <StateMessage
            title="No spas available in this location."
            subtitle="Try a different city or refresh the list."
            actionLabel="Retry"
            onAction={refetch}
          />
        ) : (
          <FlatList<FeaturedSpaItem>
            data={curatedList}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.featuredList}
            initialNumToRender={3}
            maxToRenderPerBatch={4}
            windowSize={5}
            removeClippedSubviews
            renderItem={renderFeaturedSpaItem}
            getItemLayout={getFeaturedSpaItemLayout}
          />
        )}

        {/* <View style={styles.nearbySection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Explore Nearby</Text>
            <Pressable onPress={() => {}}>
              <Text style={styles.sectionAction}>View Map</Text>
            </Pressable>
          </View>

          <Pressable style={styles.mapCard} onPress={() => {}}>
            <Image
              source={{ uri: 'https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=900&q=60' }}
              style={styles.mapImage}
            />
            <View style={styles.mapOverlay} />
            <View style={styles.mapBadge}>
              <Ionicons name="location-sharp" size={16} color="#FFB02E" />
              <Text style={styles.mapBadgeText}>Nearby spas</Text>
            </View>
            <View style={styles.mapInfo}>
              <Text style={styles.mapTitle}>Malkam Cheruvu Park</Text>
              <Text style={styles.mapSubtitle}>Find the best spas around your current area.</Text>
            </View>
          </Pressable>
        </View> */}

        <View style={styles.nearbySection}>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              Explore Around you
            </Text>

            <Pressable
              onPress={() =>
                navigation.navigate('Explore')
              }>
              <Text style={styles.sectionAction}>
                View Map
              </Text>
            </Pressable>
          </View>

          <Pressable
            // activeOpacity={0.9}
            style={styles.mapCard}
            onPress={() =>
              navigation.navigate('Explore')
            }>

            <View style={styles.mapContainer}>

              <MapView
                ref={mapRef}
                style={styles.map}
                pointerEvents="none"
                scrollEnabled={false}
                zoomEnabled={false}
                rotateEnabled={false}
                pitchEnabled={false}
                toolbarEnabled={false}
                loadingEnabled
                onMapReady={handleMapReady}
                initialRegion={{
                  latitude:
                    location?.latitude ??
                    17.41217,
                  longitude:
                    location?.longitude ??
                    78.42293,
                  latitudeDelta: 0.04,
                  longitudeDelta: 0.04,
                }}>

                {location?.latitude != null && location?.longitude != null && (
                  <Marker
                    coordinate={{
                      latitude: location.latitude,
                      longitude: location.longitude,
                    }}>
                    <View style={styles.userDot} />
                  </Marker>
                )}

                {previewSpas.map(spa => {
                  // console.log('Spa marker: ', spa.name, spa.lat, spa.lng);
                  return (
                    <Marker
                      key={spa.id}
                      coordinate={{
                        latitude: spa.latitude,
                        longitude: spa.longitude,
                      }}>
                      <View style={styles.marker} />
                    </Marker>
                  );
                })}
              </MapView>

            </View>

            <View style={styles.rightContainer}>

              <Ionicons
                name="flower-outline"
                size={20}
                color="#F6A623"
              />

              <Text style={styles.rightTitle}>
                Many top-rated spas around you
              </Text>

              <View style={styles.button}>

                <Text style={styles.buttonText}>
                  Explore Nearby
                </Text>

              </View>

            </View>

          </Pressable>

        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Nearby Retreats</Text>
          <Pressable onPress={() => { }}>
            {/* <Text style={styles.sectionAction}>See all</Text> */}
          </Pressable>
        </View>

        <FlatList<NearbySpaItem>
          data={nearbySpas}
          keyExtractor={(item) => item.id}
          renderItem={renderNearbySpaItem}
          scrollEnabled={false}
          ItemSeparatorComponent={renderListSeparator}
          initialNumToRender={3}
          maxToRenderPerBatch={4}
          windowSize={5}
          removeClippedSubviews
        />

        {/* {loadingMore && (
          <View style={{ paddingVertical: 12, alignItems: 'center' }}>
            <ActivityIndicator size="small" color="#FFB02E" />
          </View>
        )} */}

        <View style={styles.loadMoreContainer}>
          {loadingMore ? (
            <ActivityIndicator
              size="small"
              color="#FFB02E"
            />
          ) : (
            <Pressable
              disabled={loadingMore}
              style={[
                styles.loadMoreButton,
                loadingMore && {
                  opacity: 0.6,
                },
              ]}
              onPress={loadNextPage}
            >
              <Text style={styles.loadMoreText}>
                Load More Spas
              </Text>
            </Pressable>
          )}
        </View>

        {contextError && (
          <View style={{ paddingVertical: 12, alignItems: 'center' }}>
            <Text style={{ color: '#FF4F6D', fontFamily: 'WorkSans-Regular', fontSize: 13, marginBottom: 8 }}>
              {contextError}
            </Text>
            <Pressable onPress={retry} style={{ paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#FFB02E', borderRadius: 6 }}>
              <Text style={{ color: '#FFF', fontFamily: 'WorkSans-SemiBold', fontSize: 12 }}>Retry</Text>
            </Pressable>
          </View>
        )}

        {/* <OfferCard
          item={offer}
          onPress={() => {
            // TODO: Add offer action
          }}
        /> */}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Your wellness moment</Text>
          <Pressable onPress={() => { }}>
            {/* <Text style={styles.sectionAction}>Explore</Text> */}
          </Pressable>
        </View>

        <View style={styles.wellnessRow}>
          <ScrollView horizontal style={{ flexDirection: 'row', gap: 10 }}>
            {wellnessMoments.map((item) => (
              <WellnessCard key={item.id} item={item} onPress={() => { }} />
            ))}
          </ScrollView>
        </View>

        <Pressable style={styles.insightCard} onPress={() => { navigation.navigate('wellnessArticle') }}>
          <Image source={{ uri: wellnessInsight.image }} style={styles.insightImage} />
          <View style={styles.insightContent}>
            <Text style={styles.insightLabel}>WELLNESS INSIGHT</Text>
            <Text style={styles.insightTitle}>{wellnessInsight.title}</Text>
            <Text style={styles.insightDescription}>{wellnessInsight.description}</Text>
            <Text style={{ fontFamily: 'Sora-SemiBold', fontSize: 12, color: '#ffb02e', textDecorationLine: 'underline', marginTop: 10 }}>Read</Text>
          </View>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F4EFE8',
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  contentTablet: {
    paddingHorizontal: 24,
  },
  greeting: {
    fontFamily: "WorkSans-Medium",
    fontSize: 12,
    color: '#8f8f8f',
    marginBottom: 0,
  },
  title: {
    fontFamily: "Sora-SemiBold",
    fontSize: 16,
    color: '#1F1F1F',
    // lineHeight: 36,
    marginBottom: 10,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
    marginTop: -5
  },
  sectionTitle: {
    fontFamily: 'Sora-SemiBold',
    fontSize: 16,
    color: '#1F1F1F',
  },
  sectionAction: {
    fontSize: 13,
    color: '#FFB02E',
    fontWeight: '700',
  },
  categoriesList: {
    paddingBottom: 18,
  },
  featuredList: {
    paddingBottom: 24,
  },
  searchLoadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
  },
  emptyStateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    marginBottom: 24,
  },
  emptyStateTitle: {
    marginTop: 12,
    fontSize: 18,
    fontWeight: '800',
    color: '#1F1F1F',
  },
  emptyStateSubtitle: {
    marginTop: 8,
    fontSize: 13,
    color: '#7A7A7A',
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  emptyStateButton: {
    marginTop: 16,
    backgroundColor: '#FFB02E',
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  emptyStateButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  // nearbySection: {
  //   marginBottom: 24,
  // },

  nearbySection: {
    marginBottom: 20,
  },

  // sectionHeader: {
  //     flexDirection: 'row',
  //     justifyContent: 'space-between',
  //     alignItems: 'center',
  //     marginBottom: 14,
  // },

  // sectionTitle: {
  //     fontFamily: 'Sora-SemiBold',
  //     fontSize: 22,
  //     color: '#1F1F1F',
  // },

  // sectionAction: {
  //     fontFamily: 'WorkSans-Medium',
  //     fontSize: 15,
  //     color: '#F6A623',
  // },

  mapCard: {
    overflow: 'hidden',
    borderRadius: 15,
    backgroundColor: '#fff',
    flexDirection: 'row',
    elevation: 3,
  },

  mapContainer: {
    flex: 3,
    height: 180,
  },

  map: {
    flex: 1,
  },

  rightContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },

  rightTitle: {
    marginTop: 12,
    textAlign: 'center',
    fontFamily: 'WorkSans-Medium',
    fontSize: 12,
    // lineHeight: 28,
    color: '#1F1F1F',
  },

  button: {
    marginTop: 15,
    backgroundColor: '#1F1F1F',
    borderRadius: 10,
    paddingHorizontal: 15,
    paddingVertical: 10,
  },

  buttonText: {
    color: '#fff',
    fontFamily: 'Sora-SemiBold',
    fontSize: 10,
    textAlign: 'center'
  },

  marker: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#FFB02E',
    borderWidth: 3,
    borderColor: '#fff',
  },

  userDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#fff',
    borderWidth: 5,
    borderColor: '#FFB02E',
  },

  // mapCard: {
  //   width: '100%',
  //   borderRadius: 28,
  //   overflow: 'hidden',
  //   minHeight: 220,
  //   backgroundColor: '#F4EFE8',
  //   shadowColor: '#000',
  //   shadowOpacity: 0.08,
  //   shadowRadius: 18,
  //   shadowOffset: { width: 0, height: 10 },
  //   elevation: 4,
  // },
  mapImage: {
    width: '100%',
    height: 180,
  },
  mapOverlay: {
    // ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.18)',
  },
  mapBadge: {
    position: 'absolute',
    top: 18,
    left: 18,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  mapBadgeText: {
    marginLeft: 8,
    color: '#3C3C3C',
    fontSize: 12,
    fontWeight: '700',
  },
  mapInfo: {
    position: 'absolute',
    bottom: 18,
    left: 18,
    right: 18,
  },
  mapTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 6,
  },
  mapSubtitle: {
    color: '#EDEDED',
    fontSize: 13,
    lineHeight: 20,
  },
  listSeparator: {
    height: 0,
  },
  loadMoreContainer: {
    alignItems: 'center',
    marginTop: 18,
    marginBottom: 12,
  },

  loadMoreButton: {
    backgroundColor: '#FFB02E',
    borderRadius: 28,
    paddingHorizontal: 28,
    paddingVertical: 14,
    minWidth: 180,
    alignItems: 'center',
    justifyContent: 'center',
  },

  loadMoreText: {
    fontFamily: 'WorkSans-SemiBold',
    fontSize: 15,
    color: '#FFFFFF',
  },
  wellnessRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  insightCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 12,
    marginHorizontal: 20,
    overflow: 'hidden',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
    marginBottom: 60
  },
  insightImage: {
    width: '100%',
    height: 180,
    borderRadius: 10
  },
  insightContent: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    alignItems: 'center'
  },
  insightLabel: {
    color: '#FFB02E',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 10,
    letterSpacing: 0.7,
    textAlign: 'center'
  },
  insightTitle: {
    fontFamily: 'Sora-SemiBold',
    fontSize: 16,
    fontWeight: '800',
    color: '#1F1F1F',
    marginBottom: 10,
    lineHeight: 30,
    textAlign: 'center'
  },
  insightDescription: {
    fontSize: 13,
    color: '#8f8f8f',
    lineHeight: 20,
    textAlign: 'center'
  },
});

export default HomeScreen;
