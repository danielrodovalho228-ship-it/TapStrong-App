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
        // Tighter tracking so "PROGRESSO" / "FAMILIA" fit at 60+ size (QA round 1).
        // Five tabs at 390 px: "BIBLIOTECA" / "PROGRESSO" need the whole item
        // width, so no side padding and no extra tracking (QA R4 P2).
        tabBarItemStyle: { paddingHorizontal: 0 },
        tabBarLabelStyle: {
          fontFamily: fonts.headingSemi,
          fontSize: senior ? 13 : 11,
          // Room for the full line so labels are never clipped (QA round 2):
          // an explicit height too, or web renders a 10 px box (QA R3).
          lineHeight: senior ? 18 : 16,
          height: senior ? 18 : 16,
          includeFontPadding: false,
          letterSpacing: 0,
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
        name="library"
        options={{
          title: t('tabs.library'),
          tabBarIcon: ({ color }) => <Icon name="library" color={color as string} />,
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
