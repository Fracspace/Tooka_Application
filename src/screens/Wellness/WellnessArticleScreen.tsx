import React from 'react';
import WellnessArticleV4 from './v4/WellnessArticleV4';
import { useWellnessArticle } from '../../hooks/useWellnessArticle';

export const WellnessArticleScreen: React.FC = () => {
  const article = useWellnessArticle();

  if (!article) return null; // Or a loading/error state

  return <WellnessArticleV4 article={article} />;
};
