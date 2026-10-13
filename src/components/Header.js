import React from 'react';
import { View, Text, StyleSheet, Pressable, Image, Dimensions } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

const Header = ({
  location,
  locationSecondary,
  isLoading = false,
  isPermissionDenied = false,
  onPressLocation,
  onPressNotification,
}) => {
  const {width} = Dimensions.get("window");
  const primaryLabel = isPermissionDenied
    ? '📍 Enable Location'
    : isLoading
      ? '📍 Detecting location...'
      : location || '📍 Unknown Location';
  const secondaryLabel = isPermissionDenied ? '' : locationSecondary || '';
  const isTablet = width >= 768;

  return (
    <View style={styles.header}>
      <View style={styles.brandColumn}>
        <Image resizeMode='cover' source={{uri:'https://d2f15ematxpwp4.cloudfront.net/appImages/Tooka_Logo.png'}}
          style={{width: isTablet ? width*0.15 : width*0.3, height: 60}}
        />
      </View>
      <View style={styles.actionRow}>
        <Pressable style={styles.locationButton} onPress={onPressLocation}>
          <Ionicons name="location-sharp" size={16} color="#3C3C3C" />
          <View style={styles.locationTextWrapper}>
            <Text style={styles.locationPrimaryText}>{primaryLabel}</Text>
            {secondaryLabel ? <Text style={styles.locationSecondaryText}>{secondaryLabel}</Text> : null}
          </View>
          <Ionicons name="chevron-down" size={14} color="#3C3C3C" style={styles.chevronIcon} />
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 0,
  },
  brandColumn: {
    flex: 1,
  },
  brandText: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1F1F1F',
    letterSpacing: 0.3,
  },
  brandSubText: {
    marginTop: 4,
    fontSize: 13,
    color: '#6D6D6D',
    lineHeight: 18,
  },
  actionRow: {
    // flex:1,
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    // backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginRight: 0,
    // shadowColor: '#000',
    // shadowOpacity: 0.05,
    // shadowRadius: 10,
    // shadowOffset: { width: 0, height: 4 },
    // elevation: 2,
    maxWidth: 170,
  },
  locationTextWrapper: {
    marginLeft: 8,
    // flex: 1,
  },
  locationPrimaryText: {
    fontSize: 13,
    color: '#3C3C3C',
    fontFamily: 'Sora-SemiBold',
  },
  locationSecondaryText: {
    fontSize: 12,
    color: '#6D6D6D',
    fontFamily: 'WorkSans-Regular',
    marginTop: 1,
  },
  chevronIcon: {
    marginLeft: 10,
  },
  notificationButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
});

export default React.memo(Header);
