import React from 'react';
import { Pressable, View, Text, StyleSheet } from 'react-native';

const OfferCard = ({ item, onPress }) => {
  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={styles.info}>
        <Text style={styles.label}>{item.label}</Text>
        <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}>
            <View>
                <Text style={styles.title}>{item.title}</Text>
                <Text style={styles.subtitle}>{item.subtitle}</Text>
            </View>
            <View style={styles.ctaButton}>
                <Text style={styles.ctaText}>{item.cta}</Text>
            </View>
        </View>
      </View>
      
      {/* <View style={styles.iconCircle}>
        <Ionicons name="star" size={20} color="#FFB02E" />
      </View> */}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#232724',
    borderRadius: 16,
    padding: 22,
    marginBottom: 24,
    overflow: 'hidden',
  },
  info: {
    marginBottom: 0,
  },
  label: {
    color: '#C7C7C7',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.4,
    marginBottom: 10,
  },
  title: {
    fontFamily:'Sora-Bold',
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 28,
  },
  subtitle: {
    fontFamily:'WorkSans-Medium',
    color: '#D8D6CF',
    fontSize: 13,
    lineHeight: 20,
  },
  ctaButton: {
    backgroundColor: '#ffb53f51',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 14,
    alignSelf: 'flex-start',
  },
  ctaText: {
    color: '#FFF7EE',
    fontWeight: '600',
    fontSize: 14,
  },
  iconCircle: {
    position: 'absolute',
    right: 20,
    top: 22,
    width: 44,
    height: 44,
    borderRadius: 18,
    backgroundColor: '#FFF4DD',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default React.memo(OfferCard);
