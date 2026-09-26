import { Tabs } from 'expo-router/js-tabs';
import { useTranslation } from 'react-i18next';

import { Icon } from '@/components/ui';
import { colors, fonts } from '@/theme';

/**
 * Main tabs (mockups 06/07). Coach, Progress and Family join in their own
 * phases (SPEC §12: 5, 7 and 6).
 */
export default function TabsLayout() {
  const { t } = useTranslation();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.ink,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.line },
        tabBarLabelStyle: {
          fontFamily: fonts.headingSemi,
          fontSize: 13,
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
          title: t('tabs.body'),
          tabBarIcon: ({ color }) => <Icon name="body" color={color as string} />,
        }}
      />
    </Tabs>
  );
}
