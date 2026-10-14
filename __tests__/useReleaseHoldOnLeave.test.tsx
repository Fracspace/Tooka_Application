import React from 'react';
import ReactTestRenderer from 'react-test-renderer';

const mockReleaseSlotHold = jest.fn();
jest.mock('../src/services/slotHold', () => ({
  releaseSlotHold: (...args: unknown[]) => mockReleaseSlotHold(...args),
}));

import { useReleaseHoldOnLeave } from '../src/hooks/useReleaseHoldOnLeave';

let keepHold: () => void;
function Harness({ resultType }: { resultType: string }) {
  keepHold = useReleaseHoldOnLeave({ resultType, bookingId: 'b1', paymentId: 'p1' });
  return null;
}

const mountThenLeave = async (resultType: string, beforeLeaving?: () => void) => {
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(<Harness resultType={resultType} />);
  });
  beforeLeaving?.();
  await ReactTestRenderer.act(async () => {
    renderer.unmount();
  });
};

beforeEach(() => mockReleaseSlotHold.mockReset());

describe('useReleaseHoldOnLeave', () => {
  it.each(['cancelled', 'failure'])('releases the slot when leaving a %s result', async (type) => {
    await mountThenLeave(type);
    expect(mockReleaseSlotHold).toHaveBeenCalledWith('b1', 'p1');
  });

  it.each(['success', 'processing', 'timeout', 'refunded'])(
    'never releases after a %s result',
    async (type) => {
      await mountThenLeave(type);
      expect(mockReleaseSlotHold).not.toHaveBeenCalled();
    },
  );

  it('keeps the slot when the user retries the payment', async () => {
    await mountThenLeave('cancelled', () => keepHold());
    expect(mockReleaseSlotHold).not.toHaveBeenCalled();
  });

  it('uses the latest result: a Retry check that finds the payment went through', async () => {
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(<Harness resultType="cancelled" />);
    });
    await ReactTestRenderer.act(async () => {
      renderer.update(<Harness resultType="success" />);
    });
    await ReactTestRenderer.act(async () => {
      renderer.unmount();
    });
    expect(mockReleaseSlotHold).not.toHaveBeenCalled();
  });
});
