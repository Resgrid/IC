import { useRouter } from 'expo-router';
import { ClipboardList, MapPin, Users } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { OnboardingScreen } from '@/components/onboarding/onboarding-screen';
import { useAuthStore } from '@/lib/auth';
import { useIsFirstTime } from '@/lib/storage';

const SLIDES = [
  {
    titleKey: 'onboarding.boardTitle',
    descriptionKey: 'onboarding.boardDescription',
    icon: <ClipboardList size={56} color="#FF7B1A" />,
  },
  {
    titleKey: 'onboarding.awarenessTitle',
    descriptionKey: 'onboarding.awarenessDescription',
    icon: <MapPin size={56} color="#FF7B1A" />,
  },
  {
    titleKey: 'onboarding.coordinateTitle',
    descriptionKey: 'onboarding.coordinateDescription',
    icon: <Users size={56} color="#FF7B1A" />,
  },
];

export default function Onboarding() {
  const { t } = useTranslation();
  const [, setIsFirstTime] = useIsFirstTime();
  const setIsOnboarding = useAuthStore((state) => state.setIsOnboarding);
  const router = useRouter();
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    setIsOnboarding();
  }, [setIsOnboarding]);

  const finish = useCallback(() => {
    setIsFirstTime(false);
    router.replace('/login');
  }, [setIsFirstTime, router]);

  const slide = SLIDES[currentIndex];
  return (
    <OnboardingScreen
      title={t(slide.titleKey)}
      description={t(slide.descriptionKey)}
      icon={slide.icon}
      currentIndex={currentIndex}
      total={SLIDES.length}
      skipLabel={t('onboarding.skip', { defaultValue: 'Skip' })}
      nextLabel={t('onboarding.next', { defaultValue: 'Next' })}
      finishLabel={t('onboarding.getStarted', { defaultValue: "Let's Get Started" })}
      onSkip={finish}
      onFinish={finish}
      onNext={() => setCurrentIndex((index) => Math.min(index + 1, SLIDES.length - 1))}
      onSlideChange={setCurrentIndex}
    />
  );
}
