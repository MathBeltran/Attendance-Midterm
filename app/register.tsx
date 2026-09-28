import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton } from '@/components/AppButton';
import { FormField } from '@/components/FormField';
import { StatusMessage } from '@/components/StatusMessage';
import { COLORS } from '@/constants/theme';
import { signUp } from '@/lib/auth';
import type { Role } from '@/lib/profiles';

export default function RegisterScreen() {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('student');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleRegister = async () => {
    if (!fullName.trim() || !email.trim() || password.length < 6) {
      setError('Enter a name, email, and password with at least 6 characters.');
      return;
    }
    setError(null);
    setSuccess(null);
    setLoading(true);
    const { data, error: authError } = await signUp(email.trim(), password, fullName.trim(), role);
    setLoading(false);
    if (authError) setError(authError.message);
    else if (data?.session) router.replace('/(tabs)');
    else setSuccess('Check your email to confirm your account.');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
        <View style={styles.form}>
          <Text accessibilityRole="header" style={styles.title}>Create account</Text>
          <FormField label="Full name" value={fullName} onChangeText={setFullName} autoComplete="name" textContentType="name" />
          <FormField label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="emailAddress" />
          <FormField label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" textContentType="newPassword" />
          <View style={styles.roleGroup}>
            <Text style={styles.label}>Role</Text>
            <View style={styles.roleRow}>
              {(['student', 'teacher'] as Role[]).map((item) => (
                <Pressable
                  key={item}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: role === item }}
                  onPress={() => setRole(item)}
                  style={({ pressed }) => [styles.role, role === item && styles.roleActive, pressed && styles.pressed]}
                >
                  <Text style={[styles.roleText, role === item && styles.roleTextActive]}>{item === 'student' ? 'Student' : 'Teacher'}</Text>
                </Pressable>
              ))}
            </View>
          </View>
          {error ? <StatusMessage text={error} /> : null}
          {success ? <StatusMessage text={success} success /> : null}
          <AppButton label="Create account" onPress={handleRegister} loading={loading} />
          <Link href="/login" asChild>
            <Text accessibilityRole="link" style={styles.link}>Back to sign in</Text>
          </Link>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  container: { flex: 1, justifyContent: 'center', padding: 24 },
  form: { width: '100%', maxWidth: 460, alignSelf: 'center', gap: 16 },
  title: { color: COLORS.ink, fontSize: 32, fontWeight: '800', marginBottom: 4 },
  roleGroup: { gap: 8 },
  label: { color: COLORS.ink, fontSize: 14, fontWeight: '700' },
  roleRow: { flexDirection: 'row', gap: 10 },
  role: { flex: 1, minHeight: 50, borderRadius: 10, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.card },
  roleActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  roleText: { color: COLORS.ink, fontSize: 15, fontWeight: '700' },
  roleTextActive: { color: COLORS.inverted },
  pressed: { opacity: 0.7 },
  link: { minHeight: 48, padding: 12, textAlign: 'center', color: COLORS.ink, fontSize: 15, fontWeight: '700', textDecorationLine: 'underline' },
});
