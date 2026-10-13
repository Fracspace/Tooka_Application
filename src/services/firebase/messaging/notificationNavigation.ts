import { navigationRef } from '../../../navigation/NavigationService';
import { NotificationPayload, NotificationType } from './notificationTypes';

/**
 * Routes where the app is still deciding where to start (or the user is logging
 * in). A tap that arrives here - typically one that cold-started the app - is held
 * and delivered once the user reaches a regular screen.
 */
const STARTUP_ROUTES = new Set(['Splash', 'Onboarding', 'Login']);

const KNOWN_TYPES = new Set<string>(Object.values(NotificationType));

/** FCM `data` is a loose string map; turn it into a payload we can switch on. */
export const toNotificationPayload = (
  data?: Record<string, unknown> | null,
): NotificationPayload => {
  const asString = (value: unknown): string | undefined =>
    typeof value === 'string' && value.trim() ? value.trim() : undefined;
  const type = asString(data?.type)?.toUpperCase();

  return {
    type: type && KNOWN_TYPES.has(type) ? (type as NotificationType) : NotificationType.GENERAL,
    bookingId: asString(data?.bookingId ?? data?.booking_id),
    spaId: asString(data?.spaId ?? data?.spa_id),
    paymentId: asString(data?.paymentId ?? data?.payment_id),
  };
};

class NotificationNavigation {
  private pending: NotificationPayload | null = null;

  /** Open the screen a tapped notification is about (was a no-op for every type). */
  navigate(payload: NotificationPayload) {
    if (!this.canNavigate()) {
      this.pending = payload;
      return;
    }
    this.pending = null;
    this.route(payload);
  }

  /** Call on navigation state changes: delivers a tap that arrived during startup. */
  flushPending() {
    if (this.pending && this.canNavigate()) {
      const payload = this.pending;
      this.pending = null;
      this.route(payload);
    }
  }

  private canNavigate(): boolean {
    if (!navigationRef.isReady()) {
      return false;
    }
    const current = navigationRef.getCurrentRoute()?.name;
    return Boolean(current) && !STARTUP_ROUTES.has(current as string);
  }

  private route(payload: NotificationPayload) {
    switch (payload.type) {
      case NotificationType.BOOKING_CONFIRMED:
      case NotificationType.BOOKING_CANCELLED:
      case NotificationType.BOOKING_REMINDER:
      case NotificationType.PAYMENT_SUCCESS:
      case NotificationType.PAYMENT_FAILED:
        navigationRef.navigate('BottomNavigation', { screen: 'Bookings' });
        return;

      case NotificationType.PROFILE_UPDATED:
        navigationRef.navigate('BottomNavigation', { screen: 'Profile' });
        return;

      default:
        // PROMOTION / GENERAL: open the spa when the push names one; otherwise
        // just bringing the app forward is the right behaviour.
        if (payload.spaId) {
          navigationRef.navigate('SpaDetails', { spaId: payload.spaId });
        }
    }
  }
}

export default new NotificationNavigation();
