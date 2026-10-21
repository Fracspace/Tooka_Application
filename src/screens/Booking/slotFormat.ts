// Length of a slot in minutes from its "HH:mm[:ss]" start and end, or undefined
// when either time is missing or unreadable.
export const slotMinutes = (
  slot: { startTime?: string; endTime?: string } | null | undefined,
): number | undefined => {
  const toMin = (t?: string) => {
    const [h, m] = (t ?? '').split(':').map(Number);
    return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : NaN;
  };
  const diff = toMin(slot?.endTime) - toMin(slot?.startTime);
  return Number.isFinite(diff) && diff > 0 ? diff : undefined;
};
