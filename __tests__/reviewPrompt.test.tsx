// Modules are reset per test (== app launch), so React and the renderer are required fresh too.
let act: (cb: () => any) => any;

const visit = (id: string, spa: string) => ({
  booking_id: id,
  booking_ref: `REF-${id}`,
  appointment_at: '2026-10-23T14:30:00.000Z',
  status: 'checked_in' as const,
  spa_id: `spa-${id}`,
  spa_name: spa,
  spa_photo_url: null,
  service_name: 'Swedish Massage',
});

const myReview = {
  id: 'r1',
  booking_id: 'b1',
  spa_id: 'spa-b1',
  rating: '4.0',
  rating_cleanliness: null,
  rating_staff: null,
  rating_ambience: null,
  rating_value: null,
  comment: 'Nice',
  is_anonymous: false,
  response_text: null,
  responded_at: null,
  created_at: '2026-10-23T15:00:00.000Z',
};

const apiError = (code: string, message = code) =>
  Object.assign(new Error(message), {
    isAxiosError: true,
    response: { status: 400, data: { error: { code, message } } },
  });

let auth = { isLoggedIn: true };
let modalProps: any;
let ctx: any;
let api: {
  getPending: jest.Mock;
  submit: jest.Mock;
  getForBooking: jest.Mock;
};

// Fresh module state per test == a fresh app launch.
function launchApp() {
  jest.resetModules();
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

  jest.doMock('react-native-toast-message', () => ({ show: jest.fn() }));
  jest.doMock('../src/context/AuthContext', () => ({ useAuth: () => auth }));
  jest.doMock('../src/components/SpaFeedbackModal', () => ({
    __esModule: true,
    default: (props: any) => {
      modalProps = props;
      return null;
    },
  }));
  jest.doMock('axios', () => ({
    __esModule: true,
    default: { isAxiosError: (e: any) => Boolean(e?.isAxiosError) },
  }));
  jest.doMock('../src/api/authAxiosClient', () => ({}));

  const ReviewApiModule = require('../src/api/ReviewApi');
  api = {
    getPending: jest.fn().mockResolvedValue([]),
    submit: jest.fn().mockResolvedValue(myReview),
    getForBooking: jest.fn().mockResolvedValue(null),
  };
  Object.assign(ReviewApiModule.ReviewApi, api);

  const { ReviewPromptProvider, useReviewPrompt } = require('../src/context/ReviewPromptContext');

  const Probe = () => {
    ctx = useReviewPrompt();
    return null;
  };

  const React = require('react');
  const ReactTestRenderer = require('react-test-renderer');
  act = ReactTestRenderer.act;

  let renderer: any;
  const render = () =>
    React.createElement(ReviewPromptProvider, null, React.createElement(Probe));
  act(() => {
    renderer = ReactTestRenderer.create(render());
  });

  return {
    rerender: () => act(() => renderer.update(render())),
  };
}

const flush = () => act(async () => {});

beforeEach(() => {
  auth = { isLoggedIn: true };
  modalProps = undefined;
});

describe('review prompt edge cases', () => {
  it('shows the pending visit on app open, only once per launch', async () => {
    launchApp();
    api.getPending.mockResolvedValue([visit('b1', 'Lavender Petal Spa')]);

    await act(async () => ctx.checkPendingOnAppOpen());
    expect(modalProps.visible).toBe(true);
    expect(modalProps.spaName).toBe('Lavender Petal Spa');

    // Close via submit, then come back to Home: no second app-open check.
    await act(async () => modalProps.onSubmit({ rating: 4 }));
    await act(async () => ctx.checkPendingOnAppOpen());
    expect(api.getPending).toHaveBeenCalledTimes(1);
  });

  it('after submit, the visit never re-appears this session even if pending is stale', async () => {
    launchApp();
    api.getPending.mockResolvedValue([visit('b1', 'Lavender Petal Spa')]);

    await act(async () => ctx.checkPending());
    await act(async () => modalProps.onSubmit({ rating: 5, comment: 'Great' }));
    expect(api.submit).toHaveBeenCalledWith({ booking_id: 'b1', rating: 5, comment: 'Great' });
    expect(modalProps.visible).toBe(false);

    // Bookings focus while the server still (briefly) lists it.
    await act(async () => ctx.checkPending());
    expect(modalProps.visible).toBe(false);
  });

  it('after submit, booking cards are told to refresh', async () => {
    launchApp();
    api.getPending.mockResolvedValue([visit('b1', 'Spa')]);
    await act(async () => ctx.checkPending());
    const before = ctx.reviewsVersion;
    await act(async () => modalProps.onSubmit({ rating: 3 }));
    expect(ctx.reviewsVersion).toBe(before + 1);
  });

  it('after "Not now", nothing auto-prompts again this session (even other visits)', async () => {
    launchApp();
    api.getPending.mockResolvedValue([visit('b1', 'Spa A'), visit('b2', 'Spa B')]);

    await act(async () => ctx.checkPending());
    expect(modalProps.spaName).toBe('Spa A');
    act(() => modalProps.onDismiss());
    expect(modalProps.visible).toBe(false);

    await act(async () => ctx.checkPending()); // Bookings focus
    await act(async () => ctx.checkPending()); // Bookings focus again
    expect(modalProps.visible).toBe(false);
  });

  it('a dismissed visit comes back on the next app launch', async () => {
    launchApp();
    api.getPending.mockResolvedValue([visit('b1', 'Spa A')]);
    await act(async () => ctx.checkPendingOnAppOpen());
    act(() => modalProps.onDismiss());

    launchApp(); // app restarted
    api.getPending.mockResolvedValue([visit('b1', 'Spa A')]);
    await act(async () => ctx.checkPendingOnAppOpen());
    expect(modalProps.visible).toBe(true);
    expect(modalProps.spaName).toBe('Spa A');
  });

  it('"Rate this visit" on a booking card still opens after "Not now"', async () => {
    launchApp();
    api.getPending.mockResolvedValue([visit('b1', 'Spa A')]);
    await act(async () => ctx.checkPending());
    act(() => modalProps.onDismiss());

    await act(async () =>
      ctx.openReviewForBooking('b1', { spaName: 'Spa A', serviceName: null }),
    );
    expect(modalProps.visible).toBe(true);
    expect(modalProps.review).toBeNull();
  });

  it('ALREADY_REVIEWED shows the existing rating instead of an error', async () => {
    launchApp();
    api.getPending.mockResolvedValue([visit('b1', 'Spa A')]);
    api.submit.mockRejectedValue(apiError('ALREADY_REVIEWED'));
    api.getForBooking.mockResolvedValue(myReview);

    await act(async () => ctx.checkPending());
    await act(async () => modalProps.onSubmit({ rating: 4 }));
    expect(modalProps.visible).toBe(true);
    expect(modalProps.review).toEqual(myReview);
    expect(modalProps.errorMessage).toBeNull();
  });

  it('NOT_CHECKED_IN keeps the form open with the doc message', async () => {
    launchApp();
    api.getPending.mockResolvedValue([visit('b1', 'Spa A')]);
    api.submit.mockRejectedValue(apiError('NOT_CHECKED_IN'));

    await act(async () => ctx.checkPending());
    await act(async () => modalProps.onSubmit({ rating: 4 }));
    expect(modalProps.visible).toBe(true);
    expect(modalProps.errorMessage).toBe("You can rate this visit after you've checked in.");
  });

  it('REVIEW_WINDOW_CLOSED closes and does not re-prompt', async () => {
    launchApp();
    api.getPending.mockResolvedValue([visit('b1', 'Spa A')]);
    api.submit.mockRejectedValue(apiError('REVIEW_WINDOW_CLOSED', 'Window closed'));

    await act(async () => ctx.checkPending());
    await act(async () => modalProps.onSubmit({ rating: 4 }));
    expect(modalProps.visible).toBe(false);
    await act(async () => ctx.checkPending());
    expect(modalProps.visible).toBe(false);
  });

  it('a pending-list failure (e.g. 404 before deploy) shows nothing', async () => {
    launchApp();
    api.getPending.mockRejectedValue(apiError('NOT_FOUND'));
    await act(async () => ctx.checkPending());
    expect(modalProps.visible).toBe(false);
  });

  it('does nothing when logged out', async () => {
    auth = { isLoggedIn: false };
    launchApp();
    api.getPending.mockResolvedValue([visit('b1', 'Spa A')]);
    await act(async () => ctx.checkPendingOnAppOpen());
    await act(async () => ctx.checkPending());
    expect(api.getPending).not.toHaveBeenCalled();
    expect(modalProps.visible).toBe(false);
  });

  it('logout closes the popup and a fresh login prompts again', async () => {
    const app = launchApp();
    api.getPending.mockResolvedValue([visit('b1', 'Spa A')]);
    await act(async () => ctx.checkPending());
    act(() => modalProps.onDismiss());

    auth = { isLoggedIn: false };
    app.rerender();
    auth = { isLoggedIn: true };
    app.rerender();
    await flush();

    await act(async () => ctx.checkPendingOnAppOpen());
    expect(modalProps.visible).toBe(true);
  });

  it('a push tap from a killed app opens that booking after login', async () => {
    auth = { isLoggedIn: false };
    const app = launchApp();
    api.getPending.mockResolvedValue([visit('b2', 'Spa B'), visit('b1', 'Spa A')]);

    require('../src/services/reviewRequestBus').requestReviewForBooking('b1');
    await flush();
    expect(modalProps.visible).toBe(false);

    auth = { isLoggedIn: true };
    app.rerender();
    await flush();
    expect(modalProps.visible).toBe(true);
    expect(modalProps.spaName).toBe('Spa A');
  });

  it('a push tap for an already-rated visit shows the existing rating', async () => {
    launchApp();
    api.getPending.mockResolvedValue([]);
    api.getForBooking.mockResolvedValue(myReview);

    require('../src/services/reviewRequestBus').requestReviewForBooking('b1');
    await flush();
    expect(modalProps.visible).toBe(true);
    expect(modalProps.review).toEqual(myReview);
  });
});
