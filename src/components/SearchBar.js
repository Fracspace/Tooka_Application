import React from 'react';
import { View, TextInput, StyleSheet, Pressable } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

const SearchBar = ({ value, onChangeText, onPressClear, onPressSearch }) => {
  return (
    <View style={styles.searchSection}>
      <Pressable onPress={onPressSearch} style={styles.searchLeft}>
        <Ionicons name="search" size={20} color="#B2B2B2" />
      </Pressable>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder="Search for spas, services..."
        placeholderTextColor="#A9A9A9"
        style={styles.searchInput}
        returnKeyType="search"
      />
      {/* <View style={{borderLeftWidth:1,height:28,borderColor:'#3c3c3c'}}/> */}
      {value.length > 0 &&
        <Pressable onPress={onPressClear} style={styles.filterButton}>
          <Ionicons name="close-outline" size={20} color="#3C3C3C" />
        </Pressable>
      }
    </View>
  );
};

const styles = StyleSheet.create({
  searchSection: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 15,
    paddingHorizontal: 10,
    paddingVertical:0,
    height: 45,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
    marginTop:10
  },
  searchLeft: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    color: '#333333',
    fontSize: 15,
    fontWeight: '500',
  },
  filterButton: {
    width: 44,
    height: 44,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default React.memo(SearchBar);
