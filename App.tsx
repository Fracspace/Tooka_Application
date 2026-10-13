import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { sync, useStallionUpdate, withStallion } from 'react-native-stallion';

import AppNavigator from './src/navigation/AppNavigator';
import { AuthProvider } from './src/context/AuthContext';
import { LocationProvider } from './src/context/LocationContext';
import { NearbySpaProvider } from './src/context/NearbySpaContext';
import { ProfileProvider } from './src/context/ProfileContext';
import { PaymentProvider } from './src/context/PaymentContext';
import { SocketProvider } from './src/context/SocketContext';
import { CallProvider } from './src/context/CallContext';
import { ActiveCallBar } from './src/screens/Call/components/ActiveCallBar';
import { OtaRestartManager } from './src/components/OtaRestartManager';

function App() {
  const { isRestartRequired } = useStallionUpdate();

  // Check for OTA updates when the app starts
  useEffect(() => {
    if (!__DEV__) {
      sync();
    }
  }, []);

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
                      {/* Applies a downloaded OTA bundle on the next background,
                          never during a call or payment. */}
                      <OtaRestartManager restartRequired={isRestartRequired} />
                      {/* PR-5: a minimised call is always reachable again. The bar
                          sits above the navigator only while a call is live. */}
                      <ActiveCallBar>
                        <AppNavigator />
                      </ActiveCallBar>
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