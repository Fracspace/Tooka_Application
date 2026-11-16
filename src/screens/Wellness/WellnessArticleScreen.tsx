import React from 'react';
import WellnessArticleView from './WellnessArticleView';
import { useWellnessArticle } from '../../hooks/useWellnessArticle';

export const WellnessArticleScreen: React.FC = () => {
  const article = useWellnessArticle();

  if (!article) return null; // Or a loading/error state

  return <WellnessArticleView article={article} />;
};
