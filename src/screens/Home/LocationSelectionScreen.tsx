import React from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import LocationSelectionV4 from './v4/LocationSelectionV4';
import { isV4 } from '../../config/uiFlags';
import { POPULAR_CITIES, useLocationSelectionScreen } from '../../hooks/useLocationSelectionScreen';

const LocationSelectionScreen: React.FC = () => {
  const screen = useLocationSelectionScreen();
  if (isV4('locationPicker')) {
    return <LocationSelectionV4 {...screen} />;
  }
  return <LocationSelectionLegacy screen={screen} />;
};

function LocationSelectionLegacy({ screen }: { screen: ReturnType<typeof useLocationSelectionScreen> }): React.ReactElement {
  const {
    location,
    query,
    setQuery,
    autocompleteResults,
    searching,
    searchFailed,
    selectingPlaceId,
    gpsLoading,
    gpsError,
    resolvingCity,
    currentSelectionLabel,
    handleUseCurrentLocation,
    handleOpenSettings,
    handleSelectAutocompleteItem,
    handleSelectPopularCity,
    goBack,
  } = screen;
  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          style={styles.backButton}
          onPress={() => goBack()}
          hitSlop={8}
        >
          <Ionicons name="arrow-back" size={24} color="#1F1F1F" />
        </Pressable>
        <Text style={styles.headerTitle}>Select Location</Text>
        <View style={styles.headerRightPlaceholder} />
      </View>

      <View style={styles.container}>
        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Ionicons name="search-outline" size={20} color="#8F8F8F" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search city or locality"
            placeholderTextColor="#8F8F8F"
            value={query}
            onChangeText={setQuery}
            autoCorrect={false}
            returnKeyType="search"
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery('')} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color="#8F8F8F" />
            </Pressable>
          )}
        </View>

        {/* Current Active Selection Card */}
        {location && (
          <View style={styles.currentActiveCard}>
            <Ionicons name="checkmark-circle" size={20} color="#FFB02E" />
            <View style={styles.currentActiveTextWrap}>
              <Text style={styles.currentActiveBadge}>
                {location.isManualSelection ? 'MANUALLY SELECTED LOCATION' : 'CURRENT GPS LOCATION'}
              </Text>
              <Text style={styles.currentActiveTitle}>{currentSelectionLabel}</Text>
            </View>
          </View>
        )}

        {/* If user is typing search query */}
        {query.trim().length > 0 ? (
          <View style={styles.resultsContainer}>
            {searching ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator size="small" color="#FFB02E" />
                <Text style={styles.loadingText}>Searching locations...</Text>
              </View>
            ) : autocompleteResults.length === 0 && query.trim().length >= 2 ? (
              <View style={styles.emptyBox}>
                <Ionicons name="location-outline" size={32} color="#8F8F8F" />
                <Text style={styles.emptyTitle}>
                  {searchFailed ? "Couldn't search locations" : 'No locations found'}
                </Text>
                <Text style={styles.emptySubtitle}>
                  {searchFailed
                    ? 'Please check your connection and try again.'
                    : 'Try typing a different city or locality name.'}
                </Text>
              </View>
            ) : (
              <FlatList
                data={autocompleteResults}
                keyExtractor={(item) => item.placeId}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => {
                  const isSelecting = selectingPlaceId === item.placeId;
                  return (
                    <Pressable
                      style={styles.resultItem}
                      onPress={() => handleSelectAutocompleteItem(item)}
                      disabled={Boolean(selectingPlaceId)}
                    >
                      <Ionicons name="location-sharp" size={20} color="#FFB02E" style={styles.resultIcon} />
                      <View style={styles.resultTextWrap}>
                        <Text style={styles.resultTitle}>{item.mainText}</Text>
                        {Boolean(item.secondaryText) && (
                          <Text style={styles.resultSubtitle} numberOfLines={1}>
                            {item.secondaryText}
                          </Text>
                        )}
                      </View>
                      {isSelecting ? (
                        <ActivityIndicator size="small" color="#FFB02E" />
                      ) : (
                        <Ionicons name="chevron-forward" size={18} color="#C4C4C4" />
                      )}
                    </Pressable>
                  );
                }}
              />
            )}
          </View>
        ) : (
          /* Default Screen Options: Use Current Location + Popular Cities */
          <View style={styles.defaultContent}>
            {/* Option: Use Current Location */}
            <Pressable
              style={styles.currentLocationOption}
              onPress={handleUseCurrentLocation}
              disabled={gpsLoading}
            >
              <View style={styles.currentLocationIconCircle}>
                {gpsLoading ? (
                  <ActivityIndicator size="small" color="#FFB02E" />
                ) : (
                  <Ionicons name="navigate" size={20} color="#FFB02E" />
                )}
              </View>
              <View style={styles.currentLocationTextWrap}>
                <Text style={styles.currentLocationTitle}>Use Current Location</Text>
                <Text style={styles.currentLocationSubtitle}>Enable GPS for precise nearby spas</Text>
              </View>
            </Pressable>

            {gpsError && (
              <View style={styles.gpsErrorBanner}>
                <Ionicons name="alert-circle" size={18} color="#FF4F6D" />
                <Text style={styles.gpsErrorText}>{gpsError}</Text>
                {gpsError.includes('Settings') && (
                  <Pressable style={styles.settingsButton} onPress={handleOpenSettings}>
                    <Text style={styles.settingsButtonText}>Settings</Text>
                  </Pressable>
                )}
              </View>
            )}

            <View style={styles.divider} />

            {/* Popular Cities Section */}
            <Text style={styles.sectionTitle}>Popular Cities</Text>

            <View style={styles.popularContainer}>
              {POPULAR_CITIES.map((cityObj) => {
                const isSelected =
                  location?.city?.toLowerCase() === cityObj.name.toLowerCase() ||
                  location?.locality?.toLowerCase() === cityObj.name.toLowerCase();
                const isResolving = resolvingCity === cityObj.name;

                return (
                  <Pressable
                    key={cityObj.name}
                    style={[styles.popularChip, isSelected && styles.popularChipSelected]}
                    onPress={() => handleSelectPopularCity(cityObj)}
                    disabled={Boolean(resolvingCity)}
                  >
                    {isResolving ? (
                      <ActivityIndicator size="small" color="#FFB02E" style={{ marginRight: 6 }} />
                    ) : (
                      <Ionicons
                        name="business-outline"
                        size={16}
                        color={isSelected ? '#1F1F1F' : '#666'}
                        style={{ marginRight: 6 }}
                      />
                    )}
                    <Text style={[styles.popularChipText, isSelected && styles.popularChipTextSelected]}>
                      {cityObj.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

export default LocationSelectionScreen;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F4EFE8',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EBE5DC',
    backgroundColor: '#F4EFE8',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontFamily: 'Sora-SemiBold',
    fontSize: 18,
    color: '#1F1F1F',
  },
  headerRightPlaceholder: {
    width: 28,
  },
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#EBE5DC',
    marginBottom: 16,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontFamily: 'WorkSans-Regular',
    fontSize: 15,
    color: '#1F1F1F',
    padding: 0,
  },
  currentActiveCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF9EF',
    borderWidth: 1,
    borderColor: '#FFE8C2',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  currentActiveTextWrap: {
    marginLeft: 10,
    flex: 1,
  },
  currentActiveBadge: {
    fontFamily: 'WorkSans-Medium',
    fontSize: 10,
    color: '#D28A00',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  currentActiveTitle: {
    fontFamily: 'Sora-SemiBold',
    fontSize: 14,
    color: '#1F1F1F',
  },
  defaultContent: {
    flex: 1,
  },
  currentLocationOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#EBE5DC',
  },
  currentLocationIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFF4DF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  currentLocationTextWrap: {
    flex: 1,
  },
  currentLocationTitle: {
    fontFamily: 'Sora-SemiBold',
    fontSize: 15,
    color: '#1F1F1F',
  },
  currentLocationSubtitle: {
    fontFamily: 'WorkSans-Regular',
    fontSize: 12,
    color: '#8F8F8F',
    marginTop: 2,
  },
  gpsErrorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFEBF0',
    borderRadius: 10,
    padding: 10,
    marginTop: 10,
  },
  gpsErrorText: {
    flex: 1,
    fontFamily: 'WorkSans-Regular',
    fontSize: 12,
    color: '#FF4F6D',
    marginLeft: 8,
  },
  settingsButton: {
    backgroundColor: '#FF4F6D',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    marginLeft: 8,
  },
  settingsButtonText: {
    fontFamily: 'WorkSans-Medium',
    fontSize: 11,
    color: '#FFFFFF',
  },
  divider: {
    height: 1,
    backgroundColor: '#EBE5DC',
    marginVertical: 20,
  },
  sectionTitle: {
    fontFamily: 'Sora-SemiBold',
    fontSize: 16,
    color: '#1F1F1F',
    marginBottom: 12,
  },
  popularContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  popularChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EBE5DC',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  popularChipSelected: {
    borderColor: '#FFB02E',
    backgroundColor: '#FFF4DF',
  },
  popularChipText: {
    fontFamily: 'WorkSans-Medium',
    fontSize: 14,
    color: '#555555',
  },
  popularChipTextSelected: {
    fontFamily: 'Sora-SemiBold',
    color: '#1F1F1F',
  },
  resultsContainer: {
    flex: 1,
  },
  loadingBox: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  loadingText: {
    fontFamily: 'WorkSans-Regular',
    fontSize: 13,
    color: '#8F8F8F',
    marginTop: 8,
  },
  emptyBox: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  emptyTitle: {
    fontFamily: 'Sora-SemiBold',
    fontSize: 16,
    color: '#1F1F1F',
    marginTop: 8,
  },
  emptySubtitle: {
    fontFamily: 'WorkSans-Regular',
    fontSize: 13,
    color: '#8F8F8F',
    marginTop: 4,
    textAlign: 'center',
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#EBE5DC',
  },
  resultIcon: {
    marginRight: 12,
  },
  resultTextWrap: {
    flex: 1,
    marginRight: 8,
  },
  resultTitle: {
    fontFamily: 'Sora-SemiBold',
    fontSize: 14,
    color: '#1F1F1F',
  },
  resultSubtitle: {
    fontFamily: 'WorkSans-Regular',
    fontSize: 12,
    color: '#8F8F8F',
    marginTop: 2,
  },
});
