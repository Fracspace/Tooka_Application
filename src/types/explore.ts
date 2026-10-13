export type ExploreSpa = {
  id: string;
  name: string;
  /** null when the spa has no map pin; such spas get no marker. */
  latitude: number | null;
  longitude: number | null;
  /** null until rated. */
  rating: number | null;
  reviewCount: number;
  image: string;
  address: string;
  /** false = known closed today, null = unknown. */
  isOpen: boolean | null;
  distance: string;
  description: string;
};
