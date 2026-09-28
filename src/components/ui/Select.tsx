import { useRef, useState } from 'react';
import { FlatList, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, makeStyles, radius, sizes, spacing, useColors } from '@/theme';

import { AppText } from './AppText';
import { Icon } from './Icon';
import { IconButton } from './IconButton';

export type SelectOption<T> = { value: T; label: string };

export type SelectProps<T> = {
  label: string;
  placeholder: string;
  options: SelectOption<T>[];
  value: T | undefined;
  onChange: (value: T) => void;
};

/** Dropdown field that opens a full-screen list (mockup 02 month / year). */
export function Select<T extends string | number>({
  label,
  placeholder,
  options,
  value,
  onChange,
}: SelectProps<T>) {
  const colors = useColors();
  const styles = useStyles();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const listRef = useRef<FlatList<SelectOption<T>>>(null);
  const selectedIndex = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );
  const current = options.find((o) => o.value === value);

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${current?.label ?? placeholder}`}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.field, pressed && styles.pressed]}
      >
        <AppText color={current ? colors.ink : colors.muted} numberOfLines={1} style={styles.value}>
          {current?.label ?? placeholder}
        </AppText>
        <Icon name="chevron-down" size={20} />
      </Pressable>

      <Modal
        visible={open}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setOpen(false)}
      >
        <SafeAreaView style={styles.sheet} edges={['top', 'bottom']}>
          <View style={styles.sheetHeader}>
            <AppText variant="h3" accessibilityRole="header" style={styles.sheetTitle}>
              {label}
            </AppText>
            <IconButton
              icon="close"
              accessibilityLabel={t('common.close')}
              onPress={() => setOpen(false)}
            />
          </View>
          <FlatList
            data={options}
            keyExtractor={(o) => String(o.value)}
            ref={listRef}
            // Web (react-native-web) skips the rows above initialScrollIndex, so
            // there the list scrolls after layout instead (QA B-04).
            initialScrollIndex={Platform.OS === 'web' ? undefined : selectedIndex}
            onLayout={() => {
              if (Platform.OS === 'web' && selectedIndex > 0)
                listRef.current?.scrollToOffset({ offset: selectedIndex * ROW, animated: false });
            }}
            getItemLayout={(_, index) => ({ length: ROW, offset: ROW * index, index })}
            renderItem={({ item }) => {
              const selected = item.value === value;
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={item.label}
                  accessibilityState={{ selected }}
                  onPress={() => {
                    onChange(item.value);
                    setOpen(false);
                  }}
                  style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                >
                  <AppText variant={selected ? 'bodyStrong' : 'body'}>{item.label}</AppText>
                  {selected ? <Icon name="check" color={colors.accentText} /> : null}
                </Pressable>
              );
            }}
          />
        </SafeAreaView>
      </Modal>
    </>
  );
}

const ROW = 56;

const useStyles = makeStyles(() => ({
  field: {
    flex: 1,
    minHeight: sizes.primaryButtonHeight - 6,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  pressed: { borderColor: colors.ink },
  value: { flex: 1 },
  sheet: { flex: 1, backgroundColor: colors.background },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  sheetTitle: { flex: 1 },
  row: {
    height: ROW,
    paddingHorizontal: spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  rowPressed: { backgroundColor: colors.line },
}));
