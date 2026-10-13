import React from 'react';
import { Pressable, View, Text, StyleSheet, ImageBackground } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

const FeaturedSpaCard = ({ item, onPress, onPressFavorite }) => {
  return (
    <Pressable onPress={onPress} style={styles.card}>
      <ImageBackground resizeMode='cover' source={{ uri: item.image }} style={styles.image} imageStyle={styles.imageStyle}>
        {item.badge ? (
          <View style={styles.badgeContainer}>
            <Text style={styles.badgeText}>{item.badge}</Text>
          </View>
        ) : null}
        {/* <Pressable onPress={onPressFavorite} style={styles.favoriteButton}>
          <Ionicons name={item.favorite ? 'heart' : 'heart-outline'} size={18} color={item.favorite ? '#FF4C4C' : '#FFFFFF'} />
        </Pressable> */}
      </ImageBackground>
      <View style={styles.details}> 
        <View>
          <Text style={styles.spaName}>{item.name}</Text>
          <Text style={styles.spaLocation}>
            {[item.location, item.distance].filter(Boolean).join(' · ')}
          </Text>
        </View>
        <View style={styles.ratingRow}>
          <View style={styles.ratingBadge}>
            <Ionicons name="star" size={12} color="#FFB02E" />
            <Text style={styles.ratingText}>{item.rating}</Text>
          </View>
          <Text style={styles.reviewText}>{item.reviews}</Text>
        </View>
        <View style={styles.priceRow}>
          <View>
            <Text style={styles.priceText}>{item.price}</Text>
            {/* <Text style={styles.oldPrice}>{item.oldPrice}</Text> */}
          </View>
          <Pressable onPress={onPress} style={styles.ctaButton}>
            <Text style={styles.ctaText}>Book Now</Text>
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    width: 250,
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
    marginRight: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  image: {
    width: '100%',
    height: 150,
    justifyContent: 'space-between',
    padding: 0,
  },
  imageStyle: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  badgeContainer: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
    margin:16
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  favoriteButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    margin:16
  },
  details: {
    padding:12
  },
  spaName: {
    fontFamily:'Sora-SemiBold',
    fontSize: 14,
    color: '#222222',
    marginBottom: 6,
  },
  spaLocation: {
    fontSize: 13,
    color: '#7B7B7B',
    lineHeight: 18,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF4DD',
    borderRadius: 14,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  ratingText: {
    marginLeft: 4,
    color: '#3C3C3C',
    fontWeight: '700',
    fontSize: 12,
  },
  reviewText: {
    fontSize: 12,
    color: '#6D6D6D',
  },
  priceRow: {
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priceText: {
    fontSize: 18,
    color: '#212121',
    fontWeight: '800',
  },
  oldPrice: {
    marginTop: 4,
    fontSize: 12,
    color: '#A8A8A8',
    textDecorationLine: 'line-through',
  },
  ctaButton: {
    backgroundColor: '#FFB02E',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  ctaText: {
    color: '#FFF',
    fontWeight: '800',
    fontSize: 13,
  },
});

export default React.memo(FeaturedSpaCard);
