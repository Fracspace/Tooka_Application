import React from 'react';
import { AppState } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';

const mockRestart = jest.fn();
jest.mock('react-native-stallion', () => ({ restart: () => mockRestart() }), { virtual: true });

let mockCallState = 'IDLE';
let mockPaymentFlowState = 'IDLE';
jest.mock('../src/context/CallContext', () => ({
  useCallContext: () => ({ callState: mockCallState }),
}));
jest.mock('../src/context/PaymentContext', () => ({
  usePaymentContext: () => ({ context: { flowState: mockPaymentFlowState } }),
}));

import { OtaRestartManager } from '../src/components/OtaRestartManager';

let appStateHandler: ((state: string) => void) | undefined;

beforeEach(() => {
  mockRestart.mockClear();
  mockCallState = 'IDLE';
  mockPaymentFlowState = 'IDLE';
  appStateHandler = undefined;
  (globalThis as any).__DEV__ = false; // the manager is a no-op in dev builds
  jest.spyOn(AppState, 'addEventListener').mockImplementation(((_: string, handler: any) => {
    appStateHandler = handler;
    return { remove: jest.fn() };
  }) as any);
});

afterEach(() => {
  (globalThis as any).__DEV__ = true;
  jest.restoreAllMocks();
});

const render = async (restartRequired: boolean) => {
  await ReactTestRenderer.act(async () => {
    ReactTestRenderer.create(<OtaRestartManager restartRequired={restartRequired} />);
  });
};

describe('OtaRestartManager', () => {
  it('does not restart the moment an update is ready, only on background', async () => {
    await render(true);
    expect(mockRestart).not.toHaveBeenCalled();

    appStateHandler?.('inactive');
    expect(mockRestart).not.toHaveBeenCalled();

    appStateHandler?.('background');
    expect(mockRestart).toHaveBeenCalledTimes(1);
  });

  it('waits while a call is live', async () => {
    mockCallState = 'CONNECTED';
    await render(true);
    appStateHandler?.('background');
    expect(mockRestart).not.toHaveBeenCalled();
  });

  it('waits while the user is paying in a UPI app', async () => {
    mockPaymentFlowState = 'SDK_OPEN';
    await render(true);
    appStateHandler?.('background');
    expect(mockRestart).not.toHaveBeenCalled();
  });

  it('does nothing when no update is pending', async () => {
    await render(false);
    expect(appStateHandler).toBeUndefined();
  });
});
