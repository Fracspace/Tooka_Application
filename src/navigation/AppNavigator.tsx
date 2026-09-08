import React, { useRef } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import type { NavigatorScreenParams } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import HomeScreen from '../screens/Home/HomeScreen';
import SpaDetailsScreen from '../screens/Home/SpaDetailsScreen';
import AllBookingScreen from '../screens/Booking/AllBooking';
import BookingScreen from '../screens/Booking/BookingScreen';
import BookingResultScreen from '../screens/Booking/BookingResultScreen';
import PaymentScreen from '../screens/Payment/PaymentScreen';
import BottomNavigation from './BottomNavigation';
import type { BottomTabParamList } from './BottomNavigation';
import SplashScreen from '../screens/Splash/SplashScreen';
import OnboardingScreen from '../screens/Onboarding/OnboardingScreen';
import ExploreScreen from '../screens/Explore/ExploreScreen';
import PaymentHistoryScreen from '../screens/Payment/PaymentHistoryScreen';
import EditProfileScreen from '../screens/Profile/EditProfile/EditProfileScreen';
import AuthenticationScreen from '../authentication/screens/AuthenticationScreen';
import TermsScreen from '../screens/Legal/TermsScreen';
import PrivacyPolicyScreen from '../screens/Legal/PrivacyPolicyScreen';
import RefundPolicyScreen from '../screens/Legal/RefundPolicyScreen';

import {
  navigationRef,
  getActiveRouteName,
} from './NavigationService';

import { Analytics } from '../services/firebase/analytics';
import { Crashlytics, CrashlyticsKeys } from '../services/firebase/crashlytics';
import useNotifications from '../hooks/useNotifications';
import { WellnessArticleScreen } from '../screens/Wellness';
import CallScreen from '../screens/Call/CallScreen';
import IncomingCallScreen from '../screens/Call/IncomingCallScreen';

import LocationSelectionScreen from '../screens/Home/LocationSelectionScreen';

// ─────────────────────────────────────────────────────────────────────────────
// RootStackParamList — single source of navigation type truth.
//
// IMPORTANT: ProfileScreen is NOT registered here. It lives exclusively
// inside BottomNavigation's tab stack and is reached via the Profile tab,
// never via stack navigation.
// ─────────────────────────────────────────────────────────────────────────────

export type RootStackParamList = {
  Splash: undefined;
  Onboarding: undefined;
  BottomNavigation: NavigatorScreenParams<BottomTabParamList> | undefined;
  Home: undefined;
  LocationSelection: undefined;
  Explore: undefined;
  SpaDetails: {
    spaId: string;
    serviceId?: string;
    serviceName?: string;
    openEnquiry?: boolean;
    openBooking?: boolean;
    selectedDateId?: string;
    selectedSlotId?: string;
    fromLogin?: boolean;
    fromScreen?: 'Home' | 'Explore' | string;
  };
  AllBooking: undefined;
  BookingScreen: {
    spaId: string;
    spaName?: string;
    spaImage?: string;
    location?: string;
    serviceId?: string;
    serviceName?: string;
    serviceDurationMinutes?: number | null;
    servicePrice?: number | string | null;
  };
  NoPayment:
    | {
        bookingId?: string;
        bookingReference?: string;
      }
    | undefined;
  BookingResult: {
    type?: 'success' | 'failure' | 'cancelled' | 'refunded' | 'timeout' | 'processing';
    bookingId?: string;
    bookingReference?: string;
    spaName?: string;
    spaImage?: string;
    location?: string;
    serviceName?: string;
    serviceDurationMinutes?: number | null;
    appointmentDate?: string;
    appointmentTime?: string;
    bookingDateAndTime?: string;
    amount?: number | string | null;
    currency?: string;
    paymentStatus?: string;
    paymentId?: string;
    paymentSessionId?: string;
    cashfreeOrderId?: string;
    paymentCompletedAt?: string;
    sdkResult?: 'SUCCESS' | 'FAILED' | 'CANCELLED' | 'UNKNOWN';
    sdkOrderId?: string;
    failureReason?: string;
  };
  PaymentScreen: {
    paymentId: string;
    bookingId: string;
    bookingRef?: string;
    paymentSessionId: string;
    cashfreeOrderId: string;
    amount: number;
    currency: string;
    spaName?: string;
    spaImage?: string;
    location?: string;
    serviceName?: string;
    serviceDurationMinutes?: number | null;
    appointmentDate?: string;
    appointmentTime?: string;
    bookingDateAndTime?: string;
  };
  EditProfile: undefined;
  TermsAndConditions: undefined;
  PrivacyPolicy: undefined;
  RefundPolicy: undefined;
  wellnessArticle?: undefined;
  Login:
    | {
        spaId?: string;
        serviceId?: string;
        serviceName?: string;
        openBooking?: boolean;
        selectedDateId?: string;
        selectedSlotId?: string;
        fromScreen?: 'Home' | 'Explore' | string;
      }
    | undefined;
  Otp:
    | {
        phoneNumber: string;
        spaId?: string;
        serviceId?: string;
        serviceName?: string;
        /**
         * True when the OTP flow was initiated from the Profile tab's embedded
         * LoginScreen (not from a SpaDetails booking flow).
         * After OTP success in this case, we navigate to BottomNavigation
         * instead of SpaDetails or goBack().
         */
        isFromProfileTab?: boolean;
      }
    | undefined;
  CallScreen: {
    bookingId: string;
    spaId: string;
    callType: 'voice' | 'video';
    spaName: string;
    spaAvatar: string;
    isIncoming?: boolean;
  };
  IncomingCall: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const AppNavigator = () => {
  // const routeNameRef = useRef<string>();
  const routeNameRef = useRef<string>(undefined as never);
  useNotifications();
  
  return (
    // <NavigationContainer>
    <NavigationContainer
      ref={navigationRef}
      onReady={() => {
        const route = navigationRef.getCurrentRoute();

        if (route) {
          routeNameRef.current = route.name;

          Analytics.logScreen(route.name);
          Crashlytics.setCustomKey(
            CrashlyticsKeys.SCREEN,
            route.name,
          );
        }
      }}
      onStateChange={() => {
        const previousRoute = routeNameRef.current;

        const currentRoute = navigationRef.getCurrentRoute()?.name;

        if (
          currentRoute &&
          previousRoute !== currentRoute
        ) {
          Analytics.logScreen(currentRoute);

          routeNameRef.current = currentRoute;
        }
      }}
    >
      <Stack.Navigator
        initialRouteName="Splash"
        screenOptions={{
          headerShown: false,
        }}
      >
        <Stack.Screen name="Splash" component={SplashScreen} />

        <Stack.Screen name="BottomNavigation" component={BottomNavigation} />

        <Stack.Screen name="Explore" component={ExploreScreen} />

        <Stack.Screen name="Onboarding" component={OnboardingScreen} />

        <Stack.Screen name="Login" component={AuthenticationScreen} />

        <Stack.Screen name="Home" component={HomeScreen} />

        <Stack.Screen
          name="LocationSelection"
          component={LocationSelectionScreen}
          options={{ presentation: 'modal' }}
        />

        <Stack.Screen name="SpaDetails" component={SpaDetailsScreen} />

        <Stack.Screen name="AllBooking" component={AllBookingScreen} />

        <Stack.Screen name="BookingScreen" component={BookingScreen} />

        <Stack.Screen name="NoPayment" component={PaymentHistoryScreen} />

        <Stack.Screen name="BookingResult" component={BookingResultScreen} />

        <Stack.Screen name="PaymentScreen" component={PaymentScreen} />

        <Stack.Screen name="EditProfile" component={EditProfileScreen} />

        <Stack.Screen name="TermsAndConditions" component={TermsScreen} />

        <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} />

        <Stack.Screen name="RefundPolicy" component={RefundPolicyScreen} />

        <Stack.Screen name="wellnessArticle" component={WellnessArticleScreen} />

        <Stack.Screen
          name="CallScreen"
          component={CallScreen}
          options={{ presentation: 'fullScreenModal' }}
        />

        <Stack.Screen
          name="IncomingCall"
          component={IncomingCallScreen}
          options={{ presentation: 'fullScreenModal' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;
