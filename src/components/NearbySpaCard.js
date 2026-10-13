import React from 'react';
import { Pressable, View, Text, StyleSheet, Image } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

const NearbySpaCard = ({ item, onPress }) => {
  // console.log("Nearby retreats : ", item);
  return (
    <Pressable onPress={onPress} style={styles.card}>
      <Image source={{ uri: item.image }} style={styles.image} />
      <View style={styles.content}>
        <View style={styles.rowTop}>
          <Text style={styles.title}>{item.name}</Text>
          <View style={styles.rateBadge}>
            <Ionicons name="star" size={12} color="#FFB02E" />
            <Text style={styles.rateText}>{item.rating}</Text>
          </View>
        </View>
        <Text style={styles.subtitle}>{item.subtitle}</Text>
        <View style={styles.bottomRow}>
          <View style={styles.tagRow}>
            <Text style={styles.tag}>{item.typeA}</Text>
            <Text style={styles.tag}>{item.typeB}</Text>
          </View>
        </View>
        <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginTop:12}}>
            <View>
                {/* <Text style={{fontFamily:'WorkSans-Regular',fontSize:12,color:'#219C18'}}>Available Now</Text> */}
                {item.price ? (
                  <Text style={{fontFamily:'WorkSans-SemiBold',fontSize:14,color:'#1f1f1f',marginTop:5}}>
                      {item.price} <Text style={{fontFamily:'WorkSans-SemiBold',fontSize:12,}}>onwards</Text>
                  </Text>
                ) : null}
            </View>
            <Pressable onPress={onPress} style={styles.button}>
                <Text style={styles.buttonText}>Book</Text>
            </Pressable>
        </View>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 15,
    padding: 14,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  image: {
    width: 92,
    height: '100%',
    borderRadius: 20,
    marginRight: 16,
  },
  content: {
    flex: 1,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: '#232323',
    flex: 1,
    marginRight: 10,
  },
  rateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF4DD',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  rateText: {
    marginLeft: 4,
    fontSize: 12,
    fontWeight: '700',
    color: '#3C3C3C',
  },
  subtitle: {
    color: '#7A7A7A',
    fontSize: 13,
    marginBottom: 10,
    lineHeight: 18,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tagRow: {
    flexDirection: 'row',
  },
  tag: {
    backgroundColor: '#F4EFE8',
    color: '#4E4E4E',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    marginRight: 8,
    fontSize: 11,
    fontWeight: '700',
  },
  button: {
    backgroundColor: '#FFB02E',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontFamily:'Sora-SemiBold',
    color: '#FFF',
    fontSize: 13,
  },
});

export default React.memo(NearbySpaCard);
