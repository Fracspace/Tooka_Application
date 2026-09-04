import { useMemo } from 'react';

export const useCallTimer = (durationInSeconds: number) => {
  const formattedTime = useMemo(() => {
    // PR-4: mm:ss rendered a 100-minute call as "100:00". Roll over to h:mm:ss.
    const total = Math.max(0, Math.floor(durationInSeconds || 0));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    const pad = (n: number) => n.toString().padStart(2, '0');

    return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
  }, [durationInSeconds]);

  return formattedTime;
};
