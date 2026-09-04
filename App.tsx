import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { ACTIVE_RELEASE_HASH, addEventListener, removeEventListener, restart, sync, useStallionUpdate, withStallion } from 'react-native-stallion';

import AppNavigator from './src/navigation/AppNavigator';
import { AuthProvider } from './src/context/AuthContext';
import { LocationProvider } from './src/context/LocationContext';
import { NearbySpaProvider } from './src/context/NearbySpaContext';
import { ProfileProvider } from './src/context/ProfileContext';
import { PaymentProvider } from './src/context/PaymentContext';
import { SocketProvider } from './src/context/SocketContext';
import { CallProvider } from './src/context/CallContext';
import { ActiveCallBar } from './src/screens/Call/components/ActiveCallBar';

function App() {
  const { isRestartRequired, currentlyRunningBundle, newReleaseBundle } = useStallionUpdate();

  // Check for OTA updates when the app starts
  useEffect(() => {
    if (!__DEV__) {
      sync();
    }
  }, []);

  useEffect(() => {
    console.log('=== Stallion Debug ===');
    console.log('isRestartRequired:', isRestartRequired);
    if (!__DEV__ && isRestartRequired) {
      // console.log('newReleaseBundle:', newReleaseBundle);
      console.log('currentlyRunningBundle:', currentlyRunningBundle); 
      restart();
    }
  }, [isRestartRequired]);

  // Restart automatically once a new bundle has been downloaded
  // useEffect(() => {
  //   console.log('=== Stallion Debug ===');
  //   console.log('isRestartRequired:', isRestartRequired);
  //   // console.log('newReleaseBundle:', newReleaseBundle);
  //   console.log('currentlyRunningBundle:', currentlyRunningBundle); 

  //   if (isRestartRequired) {
  //     restart();
  //   }
  // }, [isRestartRequired]);

  return (
    <GestureHandlerRootView style={styles.gestureRoot}>
      <SafeAreaProvider>
        <AuthProvider>
          <SocketProvider>
            <LocationProvider>
              <ProfileProvider>
                <NearbySpaProvider>
                  <PaymentProvider>
                    <CallProvider>
                      <AppNavigator />
                      {/* PR-5: overlays every screen, so a minimised call is always
                          reachable again. Renders nothing unless a call is live. */}
                      <ActiveCallBar />
                    </CallProvider>
                  </PaymentProvider>
                </NearbySpaProvider>
              </ProfileProvider>
            </LocationProvider>
          </SocketProvider>
        </AuthProvider>
        <Toast />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  gestureRoot: {
    flex: 1,
  },
});

export default withStallion(App);