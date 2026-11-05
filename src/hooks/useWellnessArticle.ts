import { useMemo } from 'react';
import { useRoute, type RouteProp } from '@react-navigation/native';

import { SAMPLE_ARTICLES } from '../screens/Wellness/data';
import type { WellnessArticle } from '../screens/Wellness/types';

type RouteParams = {
  params: {
    articleId?: string;
    article?: WellnessArticle;
  };
};

/** The article to show: the one passed in, else the one with the given id. */
export function useWellnessArticle(): WellnessArticle | undefined {
  const route = useRoute<RouteProp<RouteParams, 'params'>>();

  // Resolve article from either passed object or id
  return useMemo(() => {
    if (route.params?.article) return route.params.article;
    const id = route.params?.articleId || '1'; // Defaulting to 1 for demo
    return SAMPLE_ARTICLES.find(a => a.id === id) || SAMPLE_ARTICLES[0];
  }, [route.params]);
}
