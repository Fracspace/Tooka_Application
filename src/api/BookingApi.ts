import authAxiosClient from './authAxiosClient';
import type {
  BackendBookingListItem,
  BookingListResult,
  BookingStatus,
  BookingSlot,
  BookingSlotStatus,
  DirectBookingResponse,
  MyBookingsApiResponse,
  MyBookingsResult,
} from '../types/booking';

type AvailabilityStatus = BookingSlotStatus | string | null | undefined;

interface AvailabilityApiSlot {
  slot_id?: string | number;
  id?: string | number;
  slot_date?: string;
  date?: string;
  slot_start?: string;
  start_time?: string;
  slot_end?: string;
  end_time?: string;
  status?: AvailabilityStatus;
}

interface ApiEnvelope<T> {
  data?: T;
  slots?: T;
  availability?: T;
  bookings?: T;
  results?: T;
  items?: T;
  meta?: {
    page?: number;
    current_page?: number;
    total_pages?: number;
    has_more?: boolean;
  };
  pagination?: {
    page?: number;
    current_page?: number;
    total_pages?: number;
    has_more?: boolean;
  };
}

export interface BookingAvailabilityParams {
  spaId: string;
  date: string;
  signal?: AbortSignal;
}

export interface CreateDirectBookingPayload {
  spa_id: string;
  slot_id: string;
  appointment_at: string;
  guest_name: string;
  guest_phone: string;
  guest_count: number;
}

export interface BookingListParams {
  status: BookingStatus;
  page?: number;
  limit?: number;
  signal?: AbortSignal;
}

type BackendBookingRecord = Record<string, unknown>;

const normalizeStatus = (status: AvailabilityStatus): BookingSlotStatus => {
  if (status === 'booked' || status === 'blocked') {
    return status;
  }

  return 'available';
};

const toSlot = (slot: AvailabilityApiSlot): BookingSlot | null => {
  const slotId = String(slot.slot_id ?? slot.id ?? '');
  const date = String(slot.slot_date ?? slot.date ?? '');
  const startTime = String(slot.slot_start ?? slot.start_time ?? '');
  const endTime = String(slot.slot_end ?? slot.end_time ?? '');

  if (!slotId || !date || !startTime) {
    return null;
  }

  return {
    slotId,
    date,
    startTime,
    endTime,
    status: normalizeStatus(slot.status),
  };
};

const unwrapList = (
  payload: AvailabilityApiSlot[] | ApiEnvelope<AvailabilityApiSlot[]>,
): AvailabilityApiSlot[] => {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (Array.isArray(payload?.data)) {
    return payload.data;
  }

  if (Array.isArray(payload?.slots)) {
    return payload.slots;
  }

  if (Array.isArray(payload?.availability)) {
    return payload.availability;
  }

  return [];
};

const unwrapBooking = (
  payload: DirectBookingResponse | ApiEnvelope<DirectBookingResponse>,
): DirectBookingResponse => {
  if (
    payload &&
    'data' in payload &&
    payload.data &&
    !Array.isArray(payload.data)
  ) {
    return payload.data as DirectBookingResponse;
  }

  return payload as DirectBookingResponse;
};

const unwrapBookingRecords = (
  payload: BackendBookingRecord[] | ApiEnvelope<BackendBookingRecord[]>,
): BackendBookingRecord[] => {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (Array.isArray(payload?.data)) {
    return payload.data;
  }

  if (Array.isArray(payload?.bookings)) {
    return payload.bookings;
  }

  if (Array.isArray(payload?.results)) {
    return payload.results;
  }

  if (Array.isArray(payload?.items)) {
    return payload.items;
  }

  return [];
};

const asString = (value: unknown): string | undefined => {
  if (typeof value === 'string' && value.trim()) {
    return value;
  }

  if (typeof value === 'number') {
    return String(value);
  }

  return undefined;
};

const asRecord = (value: unknown): BackendBookingRecord | undefined =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as BackendBookingRecord)
    : undefined;

const asBackendStatus = (value: unknown): string => {
  const status = asString(value);
  return status ?? 'unknown';
};

const dedupeBookings = (
  items: BackendBookingListItem[],
): BackendBookingListItem[] => {
  const seen = new Set<string>();

  return items.filter(item => {
    if (seen.has(item.id)) {
      return false;
    }

    seen.add(item.id);
    return true;
  });
};

const formatDisplayDate = (value: string | undefined): string => {
  if (!value) {
    return 'To be scheduled';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value.slice(0, 10);
  }

  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const formatDisplayTime = (value: string | undefined): string => {
  if (!value) {
    return 'Time pending';
  }

  const date = new Date(value);
  if (!Number.isNaN(date.getTime())) {
    return date.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  }

  const [hoursRaw, minutesRaw = '00'] = value.split(':');
  const hours = Number(hoursRaw);
  const minutes = Number(minutesRaw);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return value;
  }

  const period = hours >= 12 ? 'PM' : 'AM';
  const twelveHour = hours % 12 || 12;
  return `${String(twelveHour).padStart(2, '0')}:${String(minutes).padStart(
    2,
    '0',
  )} ${period}`;
};

const toBackendBookingListItem = (
  booking: BackendBookingRecord,
): BackendBookingListItem => {
  const spa = asRecord(booking.spa) ?? asRecord(booking.spa_details);
  const service =
    asRecord(booking.service) ?? asRecord(booking.service_details);
  const pricing = asRecord(booking.amount_paid);
  const location =
    asString(booking.location) ??
    asString(spa?.location) ??
    asString(spa?.locality_name) ??
    asString(spa?.city_name) ??
    '';
  const appointmentAt =
    asString(booking.appointment_at) ??
    asString(booking.appointmentAt) ??
    asString(booking.slot_start) ??
    asString(booking.date);
  const guestCountRaw = booking.guest_count ?? booking.guestCount;
  const guestCount =
    typeof guestCountRaw === 'number'
      ? guestCountRaw
      : Number(asString(guestCountRaw) ?? NaN);
  const price =
    booking.price ??
    booking.amount ??
    pricing ??
    // pricing ??
    null;
  const currency =
    asString(booking.currency) ??
    asString(pricing?.currency) ??
    null;

    // console.log('backendBooking: ', appointmentAt, booking.appointment_at);

  return {
    id:
      asString(booking.id) ??
      asString(booking.booking_id) ??
      asString(booking.booking_reference) ??
      `${appointmentAt ?? 'booking'}-${asString(booking.status) ?? 'unknown'}`,
    bookingId: asString(booking.booking_id) ?? asString(booking.id) ?? '',
    bookingReference: asString(booking.booking_reference),
    spaName:
      asString(booking.spa_name) ??
      asString(booking.spaName) ??
      asString(spa?.name) ??
      'Spa unavailable',
    spaImage:
      asString(booking.spa_image) ??
      asString(booking.spaImage) ??
      asString(spa?.cover_photo_url),
    serviceName:
      asString(booking.service_name) ??
      asString(booking.serviceName) ??
      asString(service?.name) ??
      null,
    location,
    guestCount: Number.isFinite(guestCount) ? guestCount : null,
    appointmentAt,
    date: formatDisplayDate(appointmentAt),
    time: formatDisplayTime(appointmentAt),
    status: asBackendStatus(booking.status),
    paymentStatus:
      asString(booking.payment_status) ?? asString(booking.paymentStatus),
    price:
      typeof price === 'number' || typeof price === 'string' ? price : null,
    currency,
    pricing,
    raw: booking,
  };
};

const hasMorePages = (
  payload: BackendBookingRecord[] | ApiEnvelope<BackendBookingRecord[]>,
  page: number,
  itemCount: number,
  limit: number,
): boolean => {
  if (Array.isArray(payload)) {
    return itemCount >= limit;
  }

  const meta = payload.meta ?? payload.pagination;
  if (typeof meta?.has_more === 'boolean') {
    return meta.has_more;
  }

  const currentPage = meta?.current_page ?? meta?.page ?? page;
  if (typeof meta?.total_pages === 'number') {
    return currentPage < meta.total_pages;
  }

  return itemCount >= limit;
};

export const BookingApi = {
  getAvailability: async ({
    spaId,
    date,
    signal,
  }: BookingAvailabilityParams): Promise<BookingSlot[]> => {
    const response = await authAxiosClient.get<
      AvailabilityApiSlot[] | ApiEnvelope<AvailabilityApiSlot[]>
    >('/bookings/availability', {
      params: {
        spa_id: spaId,
        date,
      },
      signal,
    });

    return unwrapList(response.data)
      .map(toSlot)
      .filter((slot): slot is BookingSlot => Boolean(slot));
  },

  createDirectBooking: async (
    payload: CreateDirectBookingPayload,
  ): Promise<DirectBookingResponse> => {
    const response = await authAxiosClient.post<
      DirectBookingResponse | ApiEnvelope<DirectBookingResponse>
    >('/bookings/direct', payload);

    return unwrapBooking(response.data);
  },

  /** Give up the slot a pending_payment booking holds (it becomes "expired"). */
  releaseBooking: async (bookingId: string): Promise<void> => {
    await authAxiosClient.post(`/bookings/${encodeURIComponent(bookingId)}/release`);
  },

  getBookingHistory: async ({
    status,
    page = 1,
    limit = 20,
    signal,
  }: BookingListParams): Promise<BookingListResult> => {
    const response = await authAxiosClient.get<
      BackendBookingRecord[] | ApiEnvelope<BackendBookingRecord[]>
    >(`/bookings/${status}`, {
      params: {
        page,
        limit,
      },
      signal,
    });

    const records = unwrapBookingRecords(response.data);

    return {
      items: records.map(toBackendBookingListItem),
      page,
      hasMore: hasMorePages(response.data, page, records.length, limit),
    };
  },

  getMyBookings: async ({
    signal,
  }: {
    signal?: AbortSignal;
  } = {}): Promise<MyBookingsResult> => {
    const response = await authAxiosClient.get<MyBookingsApiResponse>(
      '/bookings/user/my-bookings',
      { signal },
    );

    const payload = response.data;

    if (payload.success === false) {
      throw new Error(
        typeof payload.message === 'string' && payload.message.trim()
          ? payload.message
          : 'Unable to load bookings.',
      );
    }

    const rows = payload.data?.rows;
    // console.log("Booking history rows: ", rows);

    if (rows == null) {
      return { items: [] };
    }

    if (!Array.isArray(rows)) {
      throw new Error('Unexpected booking response.');
    }

    return {
      items: dedupeBookings(rows.map(toBackendBookingListItem)),
    };
  },
};

export default BookingApi;
