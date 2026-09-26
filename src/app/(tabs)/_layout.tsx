import { Tabs } from 'expo-router/js-tabs';
import { useTranslation } from 'react-i18next';

import { Icon } from '@/components/ui';
import { derive } from '@/features/onboarding/derived';
import { useOnboardingStore } from '@/features/onboarding/store';
import { colors, fonts } from '@/theme';

/**
 * Main tabs (mockups 06/07). The Coach tab joins with the ongoing coach chat.
 */
export default function TabsLayout() {
  const { t } = useTranslation();
  // 60+ mode keeps to the simple screens (SPEC §11.10): no body-map tab.
  const senior = derive(useOnboardingStore())?.mode === 'senior';
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.ink,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.line },
        tabBarLabelStyle: {
          fontFamily: fonts.headingSemi,
          fontSize: senior ? 15 : 13,
          letterSpacing: 1,
          textTransform: 'uppercase',
        },
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: t('tabs.home'),
          tabBarIcon: ({ color }) => <Icon name="home" color={color as string} />,
        }}
      />
      <Tabs.Screen
        name="body"
        options={{
          href: senior ? null : undefined,
          title: t('tabs.body'),
          tabBarIcon: ({ color }) => <Icon name="body" color={color as string} />,
        }}
      />
      <Tabs.Screen
        name="progress"
        options={{
          title: t('tabs.progress'),
          tabBarIcon: ({ color }) => <Icon name="progress" color={color as string} />,
        }}
      />
      <Tabs.Screen
        name="family"
        options={{
          title: t('tabs.family'),
          tabBarIcon: ({ color }) => <Icon name="family" color={color as string} />,
        }}
      />
    </Tabs>
  );
}
