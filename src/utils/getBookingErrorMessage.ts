import axios from 'axios';

export const getBookingErrorMessage = (error: unknown): string => {
  if (axios.isCancel(error)) {
    return '';
  }

  if (error instanceof Error && error.message.trim()) {
    if (
      error.message === 'Unexpected booking response.' ||
      error.message.startsWith('Unable to load bookings')
    ) {
      return error.message;
    }
  }

  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    // Older backends only send error.message.
    const apiMessage = error.response?.data?.message ?? error.response?.data?.error?.message;

    if (typeof apiMessage === 'string' && apiMessage.trim()) {
      return apiMessage;
    }

    if (status === 401) {
      return 'Session expired. Please login again.';
    }

    if (status === 403) {
      return 'You do not have permission to view these bookings.';
    }

    if (status === 404) {
      return 'Bookings were not found.';
    }

    if (status && status >= 500) {
      return 'Server error. Please try again later.';
    }

    if (error.code === 'ECONNABORTED') {
      return 'Request timed out. Please try again.';
    }

    if (error.message.toLowerCase().includes('network')) {
      return 'You are offline. Please check your internet connection.';
    }
  }

  return 'Unable to load bookings. Please try again.';
};
