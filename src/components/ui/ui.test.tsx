import '@/i18n';

import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { useAppModeStore } from '@/stores/app-mode';
import { colors, fontSizeFor, SENIOR_TYPE_BOOST } from '@/theme';

import { AppText } from './AppText';
import { Button } from './Button';
import { Chip } from './Chip';
import { Header } from './Header';
import { IconButton } from './IconButton';

describe('Button', () => {
  it('fires onPress and exposes the button role', async () => {
    const onPress = jest.fn();
    await render(<Button label="Get started" onPress={onPress} />);
    fireEvent.press(screen.getByRole('button', { name: 'Get started' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not fire when disabled', async () => {
    const onPress = jest.fn();
    await render(<Button label="Go" onPress={onPress} disabled />);
    fireEvent.press(screen.getByRole('button', { name: 'Go' }));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('is at least 54 tall', async () => {
    await render(<Button label="Go" />);
    const flat = Object.assign(
      {},
      ...[screen.getByRole('button').props.style].flat(Infinity).filter(Boolean),
    );
    expect(flat.minHeight).toBeGreaterThanOrEqual(54);
  });
});

describe('Button variants', () => {
  const bg = (label: string) =>
    Object.assign(
      {},
      ...[screen.getByRole('button', { name: label }).props.style].flat(Infinity).filter(Boolean),
    ).backgroundColor;

  it('primary and accent are coral (theme v2)', async () => {
    await render(
      <>
        <Button label="Continue" />
        <Button label="Generate" variant="accent" />
      </>,
    );
    expect(bg('Continue')).toBe(colors.accent);
    expect(bg('Generate')).toBe(colors.accent);
  });
});

describe('Chip', () => {
  it('reports selected state to screen readers', async () => {
    await render(<Chip label="Grow" selected />);
    expect(screen.getByRole('button', { name: 'Grow' })).toBeSelected();
  });
});

describe('IconButton', () => {
  it('has a label and a 44 px target', async () => {
    await render(<IconButton icon="close" accessibilityLabel="Close" />);
    const button = screen.getByRole('button', { name: 'Close' });
    const flat = Object.assign({}, ...[button.props.style].flat(Infinity).filter(Boolean));
    expect(flat.width).toBeGreaterThanOrEqual(44);
    expect(flat.height).toBeGreaterThanOrEqual(44);
  });
});

describe('Header', () => {
  it('renders a translated back button only when onBack is given', async () => {
    const onBack = jest.fn();
    const { rerender } = await render(<Header title="Profile" />);
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
    await rerender(<Header title="Profile" onBack={onBack} />);
    fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    expect(onBack).toHaveBeenCalled();
    expect(screen.getByRole('header', { name: 'Profile' })).toBeTruthy();
  });
});

describe('AppText', () => {
  afterEach(() => act(() => useAppModeStore.setState({ mode: 'adult' })));

  const fontSizeOf = (text: string) =>
    Object.assign({}, ...[screen.getByText(text).props.style].flat(Infinity).filter(Boolean))
      .fontSize;

  it('boosts text two steps in senior mode', async () => {
    await render(<AppText>Hello</AppText>);
    expect(fontSizeOf('Hello')).toBe(fontSizeFor('body'));

    await act(() => useAppModeStore.setState({ mode: 'senior' }));
    await render(<AppText>Senior</AppText>);
    expect(fontSizeOf('Senior')).toBe(fontSizeFor('body', SENIOR_TYPE_BOOST));
  });
});
