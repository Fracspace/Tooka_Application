import React from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

const CategoryCard = ({ icon, label, onPress, selected }) => {
  return (
    <Pressable onPress={onPress} style={[styles.card, selected && styles.selectedCard]}>
      {/* <View style={[styles.iconWrapper, selected && styles.selectedIconWrapper]}> */}
        <Ionicons name={icon} size={20} color={selected ? '#FFF' : '#735C3A'} />
      {/* </View> */}
      <Text style={[styles.label, selected && styles.selectedLabel]}>{label}</Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    // width: 96,
    // height: 104,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    paddingHorizontal: 15,
    paddingVertical:8,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    flexDirection:'row',
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  selectedCard: {
    backgroundColor: '#FFB02E',
  },
  iconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: '#F4EFE8',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  selectedIconWrapper: {
    backgroundColor: '#FFFFFF',
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#3C3C3C',
    textAlign: 'center',
    marginLeft:5
  },
  selectedLabel: {
    color: '#FFFFFF',
  },
});

export default React.memo(CategoryCard);
