import type { TextInputProps } from 'react-native';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { COLORS } from '@/constants/theme';

type Props = TextInputProps & {
  label: string;
  error?: string | null;
};

export function FormField({ label, error, style, ...props }: Props) {
  return (
    <View style={styles.group}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={COLORS.subtle}
        selectionColor={COLORS.primary}
        style={[styles.input, error ? styles.inputError : null, style]}
        {...props}
      />
      {error ? (
        <Text accessibilityLiveRegion="polite" style={styles.error}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: 8 },
  label: { color: COLORS.ink, fontSize: 14, fontWeight: '700' },
  input: {
    minHeight: 52,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
    color: COLORS.ink,
    fontSize: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  inputError: { borderColor: COLORS.accent, borderWidth: 2 },
  error: { color: COLORS.accentPressed, fontSize: 13, lineHeight: 18, fontWeight: '600' },
});
