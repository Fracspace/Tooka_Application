type Listener = (spaId: string) => void;

const listeners = new Set<Listener>();

/**
 * The spotlight pager reports the spa it is showing, so Home's carousel sits
 * on that same card when the pager closes.
 */
export const reportSpotlightSpa = (spaId: string) => listeners.forEach((listener) => listener(spaId));

export function onSpotlightSpa(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
