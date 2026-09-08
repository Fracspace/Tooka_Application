import React from 'react';
import { ImageSourcePropType, Text, useWindowDimensions, View } from 'react-native';

import ProfileAvatar from './ProfileAvatar';
import { colors, styles } from '../styles';
import Icon from 'react-native-vector-icons/Ionicons';

const AVATAR = {
  uri: 'https://duixj37yn5405.cloudfront.net/appImages/profile11.png',
};

type Props = {
  name: string;
  email: string;
  phone: string;
  avatarSource?: ImageSourcePropType;
  onEditPress?: () => void;
};

function UserInfoCard({ name, email, phone, avatarSource, onEditPress }: Props): React.ReactElement {
  const { width } = useWindowDimensions();
  const compact = width < 390;
  // console.log("User Profile: ", name, email, phone, avatarSource);

  return (
    <View style={[styles.userCard, compact && styles.compactUserCard]}>
      <View style={styles.userCardInner}>
        <ProfileAvatar source={avatarSource ?? AVATAR} compact={compact} onEditPress={onEditPress} />
        <View style={[styles.userMeta, compact && styles.compactMeta]}>
          <Text style={styles.userName} numberOfLines={1}>
            {name}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 5 }}>
            <Icon name={'mail-outline'} size={15} color={colors.primary}/>
            <Text style={styles.userEmail} numberOfLines={1}>
              {email}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Icon name={'call-outline'} size={15} color={colors.primary}/>
            <Text style={styles.userPhone} numberOfLines={1}>
              {phone}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

export default React.memo(UserInfoCard);
