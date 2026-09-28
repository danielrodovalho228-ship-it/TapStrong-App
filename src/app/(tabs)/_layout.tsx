import { Tabs } from 'expo-router/js-tabs';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/ui';
import { derive } from '@/features/onboarding/derived';
import { useOnboardingStore } from '@/features/onboarding/store';
import { fonts, useColors } from '@/theme';

/**
 * Main tabs (mockups 06/07). The Coach tab joins with the ongoing coach chat.
 */
export default function TabsLayout() {
  const colors = useColors();
  const { t } = useTranslation();
  // 60+ mode keeps to the simple screens (SPEC §11.10): no body-map tab.
  const senior = derive(useOnboardingStore())?.mode === 'senior';
  const bottom = Math.max(useSafeAreaInsets().bottom, 8);
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        // Theme v2: the active tab is coral (the AA text coral for the label).
        tabBarActiveTintColor: colors.accentText,
        tabBarInactiveTintColor: colors.muted,
        // Room under the labels and the phone's home indicator; the bar's own
        // height, so the screen never runs 2 px past the window (QA R6 P2).
        tabBarStyle: {
          backgroundColor: colors.tabBar,
          borderTopColor: colors.line,
          height: TAB_BAR_HEIGHT + bottom,
          paddingTop: 4,
          paddingBottom: bottom,
        },
        // Five tabs at 390 px: no side padding so "BIBLIOTECA" / "PROGRESSO"
        // get the whole item width (QA R4 P2).
        tabBarItemStyle: { paddingHorizontal: 0 },
        // Our own label text (QA R5-07, 4th round): the navigator's web label
        // box was 10 px high with overflow hidden whatever style we passed.
        tabBarLabel: ({ color, children }) => (
          <Text
            numberOfLines={1}
            style={[styles.label, senior && styles.labelSenior, { color }]}
            testID="tab-label"
          >
            {children}
          </Text>
        ),
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

/** Icon, gap and one label line above the bottom padding. */
const TAB_BAR_HEIGHT = 56;

const styles = StyleSheet.create({
  label: {
    fontFamily: fonts.headingSemi,
    fontSize: 13,
    lineHeight: 17,
    minHeight: 17,
    letterSpacing: 0,
    textTransform: 'uppercase',
    textAlign: 'center',
    overflow: 'visible',
    includeFontPadding: false,
  },
  labelSenior: { fontSize: 14, lineHeight: 18, minHeight: 18 },
});
