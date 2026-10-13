import React, { useMemo } from 'react';
import { View, Text, ScrollView, StatusBar } from 'react-native';
import { RouteProp, useRoute } from '@react-navigation/native';
import { Header } from './components/Header';
import { HeroImage } from './components/HeroImage';
import { CategoryPill } from './components/CategoryPill';
import { BenefitCard } from './components/BenefitCard';
import { DidYouKnowCard } from './components/DidYouKnowCard';
import { ArticleSection } from './components/ArticleSection';
import { SAMPLE_ARTICLES } from './data';
import { WellnessArticle } from './types';
import { styles } from './styles';

type RouteParams = {
  params: {
    articleId?: string;
    article?: WellnessArticle;
  };
};

export const WellnessArticleScreen: React.FC = () => {
  const route = useRoute<RouteProp<RouteParams, 'params'>>();
  
  // Resolve article from either passed object or id
  const article = useMemo(() => {
    if (route.params?.article) return route.params.article;
    const id = route.params?.articleId || '1'; // Defaulting to 1 for demo
    return SAMPLE_ARTICLES.find(a => a.id === id) || SAMPLE_ARTICLES[0];
  }, [route.params]);

  if (!article) return null; // Or a loading/error state

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      
      
      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.contentContainer}
      >
        <Header title="Wellness Insight" />
        <HeroImage source={article.heroImage} />
        
        <ArticleSection>
          <CategoryPill category={article.category} />
          <Text style={styles.title}>{article.title}</Text>
          <Text style={styles.subtitle}>{article.subtitle}</Text>
          <Text style={styles.body}>{article.body}</Text>
        </ArticleSection>

        {article.benefits && article.benefits.length > 0 && (
          <ArticleSection>
            <View style={styles.benefitsContainer}>
              {article.benefits.map((benefit) => (
                <BenefitCard key={benefit.id} benefit={benefit} />
              ))}
            </View>
          </ArticleSection>
        )}

        {article.didYouKnow && (
          <DidYouKnowCard content={article.didYouKnow} />
        )}

      </ScrollView>
    </View>
  );
};
