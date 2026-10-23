import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { DeviceEventEmitter } from 'react-native';
import Toast from 'react-native-toast-message';

import { useAuth } from './AuthContext';
import ReviewApi, { toReviewApiError } from '../api/ReviewApi';
import SpaFeedbackModal, { type FeedbackDraft } from '../components/SpaFeedbackModal';
import type { MyReview } from '../types/review';
import {
  REVIEW_PENDING_REFRESH_EVENT,
  REVIEW_REQUEST_EVENT,
  consumeQueuedReviewRequest,
} from '../services/reviewRequestBus';

// Session-only state (resets on app restart). The backend has no dismiss endpoint.
// - handledThisSession: visits submitted or closed here; never auto-prompt them again.
// - promptDismissedThisSession: after "Not now", stop auto-prompting for the rest of the session.
const handledThisSession = new Set<string>();
let promptDismissedThisSession = false;
let appOpenCheckDone = false;

interface ReviewTarget {
  bookingId: string;
  spaName: string;
  serviceName?: string | null;
}

interface ReviewPromptContextValue {
  /** Shows the "rate your visit" prompt if GET /reviews/pending has a visit not handled this session. */
  checkPending: () => Promise<void>;
  /** checkPending, but only the first time per app launch (Home focus = "app open"). */
  checkPendingOnAppOpen: () => void;
  /** Opens the rating form, or the submitted feedback if the visit was already rated. */
  openReviewForBooking: (bookingId: string, fallback?: Omit<ReviewTarget, 'bookingId'>) => Promise<void>;
  /** Bumps whenever feedback is submitted, so booking cards can refetch. */
  reviewsVersion: number;
}

const ReviewPromptContext = createContext<ReviewPromptContextValue | null>(null);

export function ReviewPromptProvider({ children }: { children: React.ReactNode }) {
  const { isLoggedIn } = useAuth();
  const [target, setTarget] = useState<ReviewTarget | null>(null);
  const [review, setReview] = useState<MyReview | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [reviewsVersion, setReviewsVersion] = useState(0);

  const targetRef = useRef<ReviewTarget | null>(null);
  targetRef.current = target;
  const checkingRef = useRef(false);

  const open = useCallback((next: ReviewTarget, submitted: MyReview | null = null) => {
    setErrorMessage(null);
    setReview(submitted);
    setTarget(next);
  }, []);

  const close = useCallback(() => {
    setTarget(null);
    setReview(null);
    setErrorMessage(null);
  }, []);

  const checkPending = useCallback(async () => {
    if (
      !isLoggedIn ||
      promptDismissedThisSession ||
      targetRef.current ||
      checkingRef.current
    ) {
      if (__DEV__) {
        console.log('[ReviewPrompt] pending check skipped', {
          isLoggedIn,
          promptDismissedThisSession,
          popupOpen: Boolean(targetRef.current),
          alreadyChecking: checkingRef.current,
        });
      }
      return;
    }

    checkingRef.current = true;
    try {
      const pending = await ReviewApi.getPending();
      if (__DEV__) {
        console.log(
          '[ReviewPrompt] pending visits',
          pending.map(item => ({ id: item.booking_id, spa: item.spa_name, status: item.status, at: item.appointment_at })),
          'handled this session',
          [...handledThisSession],
        );
      }
      // Re-check: the guest may have dismissed/submitted or opened another prompt meanwhile.
      const visit = pending.find(item => !handledThisSession.has(item.booking_id));
      if (visit && !targetRef.current && !promptDismissedThisSession) {
        open({
          bookingId: visit.booking_id,
          spaName: visit.spa_name,
          serviceName: visit.service_name,
        });
      }
    } catch (error) {
      if (__DEV__) {
        console.log('[ReviewPrompt] pending check failed', toReviewApiError(error));
      }
    } finally {
      checkingRef.current = false;
    }
  }, [isLoggedIn, open]);

  const checkPendingOnAppOpen = useCallback(() => {
    if (appOpenCheckDone || !isLoggedIn) {
      return;
    }
    appOpenCheckDone = true;
    void checkPending();
  }, [isLoggedIn, checkPending]);

  const openReviewForBooking = useCallback<ReviewPromptContextValue['openReviewForBooking']>(
    async (bookingId, fallback) => {
      if (fallback) {
        open({ bookingId, ...fallback });
        return;
      }

      try {
        const pending = await ReviewApi.getPending();
        const visit = pending.find(item => item.booking_id === bookingId);
        if (visit) {
          open({ bookingId, spaName: visit.spa_name, serviceName: visit.service_name });
          return;
        }

        // Not pending any more: the guest has most likely rated it already.
        const existing = await ReviewApi.getForBooking(bookingId);
        if (existing) {
          open({ bookingId, spaName: 'Your feedback' }, existing);
        }
      } catch (error) {
        if (__DEV__) {
          console.log('[ReviewPrompt] open for booking failed', toReviewApiError(error));
        }
      }
    },
    [open],
  );

  const handleSubmit = useCallback(
    async (draft: FeedbackDraft) => {
      const current = targetRef.current;
      if (!current) {
        return;
      }

      setSubmitting(true);
      setErrorMessage(null);
      try {
        await ReviewApi.submit({ booking_id: current.bookingId, ...draft });
        handledThisSession.add(current.bookingId);
        close();
        setReviewsVersion(v => v + 1);
        Toast.show({ type: 'success', text1: 'Thanks for your feedback!' });
      } catch (error) {
        const apiError = toReviewApiError(error);
        switch (apiError.code) {
          case 'ALREADY_REVIEWED': {
            handledThisSession.add(current.bookingId);
            const existing = await ReviewApi.getForBooking(current.bookingId).catch(() => null);
            setReviewsVersion(v => v + 1);
            if (existing) {
              setReview(existing);
            } else {
              close();
            }
            break;
          }
          case 'NOT_CHECKED_IN':
            setErrorMessage("You can rate this visit after you've checked in.");
            break;
          case 'REVIEW_WINDOW_CLOSED':
          case 'BOOKING_NOT_FOUND':
          case 'FORBIDDEN':
            handledThisSession.add(current.bookingId);
            close();
            setReviewsVersion(v => v + 1);
            Toast.show({ type: 'info', text1: apiError.message });
            break;
          case 'UNAUTHORIZED':
            close();
            break;
          default:
            setErrorMessage(apiError.message);
        }
      } finally {
        setSubmitting(false);
      }
    },
    [close],
  );

  const handleDismiss = useCallback(() => {
    const current = targetRef.current;
    if (current && !review) {
      handledThisSession.add(current.bookingId);
      promptDismissedThisSession = true;
    }
    close();
  }, [close, review]);

  // Login: honour a push tap queued while logged out / launching. Automatic prompts
  // come only from Home and Bookings focus, so they never cover Splash, Login or payment.
  useEffect(() => {
    if (!isLoggedIn) {
      // A different account may log in next; start its session fresh.
      handledThisSession.clear();
      promptDismissedThisSession = false;
      appOpenCheckDone = false;
      close();
      return;
    }

    const queued = consumeQueuedReviewRequest();
    if (queued) {
      void openReviewForBooking(queued);
    }
  }, [isLoggedIn, close, openReviewForBooking]);

  useEffect(() => {
    const requestSub = DeviceEventEmitter.addListener(REVIEW_REQUEST_EVENT, () => {
      // Logged-out taps stay queued until login.
      if (!isLoggedIn) {
        return;
      }
      const queued = consumeQueuedReviewRequest();
      if (queued) {
        void openReviewForBooking(queued);
      }
    });
    const refreshSub = DeviceEventEmitter.addListener(REVIEW_PENDING_REFRESH_EVENT, () => {
      void checkPending();
    });

    return () => {
      requestSub.remove();
      refreshSub.remove();
    };
  }, [isLoggedIn, checkPending, openReviewForBooking]);

  const value = useMemo(
    () => ({ checkPending, checkPendingOnAppOpen, openReviewForBooking, reviewsVersion }),
    [checkPending, checkPendingOnAppOpen, openReviewForBooking, reviewsVersion],
  );

  return (
    <ReviewPromptContext.Provider value={value}>
      {children}
      <SpaFeedbackModal
        visible={Boolean(target)}
        spaName={target?.spaName ?? ''}
        serviceName={target?.serviceName}
        review={review}
        submitting={submitting}
        errorMessage={errorMessage}
        onSubmit={handleSubmit}
        onDismiss={handleDismiss}
      />
    </ReviewPromptContext.Provider>
  );
}

export function useReviewPrompt(): ReviewPromptContextValue {
  const context = useContext(ReviewPromptContext);
  if (!context) {
    throw new Error('useReviewPrompt must be used within ReviewPromptProvider');
  }
  return context;
}
