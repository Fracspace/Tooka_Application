// Static editorial content for the Home screen. There is no API for these yet;
// keep the copy honest about what tapping does (each card opens Explore).

const wellnessMoments = [
  {
    id: 'moment-1',
    title: 'Stress melting away',
    subtitle: 'Find massage spas near you',
    icon: 'snow-outline',
  },
  {
    id: 'moment-2',
    title: 'Glow up today',
    subtitle: 'Explore facial treatments nearby',
    icon: 'sparkles',
  },
  {
    id: 'moment-3',
    title: 'Self-Care Time',
    subtitle: 'Discover spas around you',
    icon: 'flower-outline',
  },
];

// Matches the first article in src/screens/Wellness/data.ts, which the insight
// card opens.
const wellnessInsight = {
  id: 'insight-1',
  title: 'The Art of Hot Stone Therapy',
  description: 'Discover how heated basalt stones can melt away tension, improve circulation, & promote a deeper state of relaxation than traditional massage alone.',
  image: 'https://images.unsplash.com/photo-1515378791036-0648a3ef77b2?auto=format&fit=crop&w=900&q=60',
};

export { wellnessMoments, wellnessInsight };
