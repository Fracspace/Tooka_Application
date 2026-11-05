import React from 'react';
import { View, Text, ScrollView, StatusBar } from 'react-native';
import { Header } from './components/Header';
import { HeroImage } from './components/HeroImage';
import { CategoryPill } from './components/CategoryPill';
import { BenefitCard } from './components/BenefitCard';
import { DidYouKnowCard } from './components/DidYouKnowCard';
import { ArticleSection } from './components/ArticleSection';
import WellnessArticleV4 from './v4/WellnessArticleV4';
import { isV4 } from '../../config/uiFlags';
import { useWellnessArticle } from '../../hooks/useWellnessArticle';
import { styles } from './styles';

export const WellnessArticleScreen: React.FC = () => {
  const article = useWellnessArticle();

  if (!article) return null; // Or a loading/error state

  if (isV4('wellnessArticle')) {
    return <WellnessArticleV4 article={article} />;
  }

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
