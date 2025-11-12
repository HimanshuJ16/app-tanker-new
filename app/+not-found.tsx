import { Link, Stack, useRouter } from 'expo-router';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import * as Haptics from 'expo-haptics';

export default function NotFoundScreen() {
  const router = useRouter();

  const handleGoBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  };

  const handleGoHome = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.replace('/');
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          {/* Error Illustration */}
          <View style={styles.illustrationContainer}>
            <View style={styles.illustration}>
              <View style={styles.circle}>
                <Text style={styles.errorCode}>404</Text>
              </View>
              <View style={styles.iconWrapper}>
                <Ionicons name="alert-circle" size={80} color="#EF4444" />
              </View>
            </View>
          </View>

          {/* Error Message */}
          <View style={styles.messageContainer}>
            <Text style={styles.title}>Oops! Page Not Found</Text>
            <Text style={styles.subtitle}>
              The screen you're looking for doesn't exist or has been moved.
            </Text>
          </View>

          {/* Helpful Suggestions */}
          <View style={styles.suggestionsContainer}>
            <Text style={styles.suggestionsTitle}>Here's what you can do:</Text>
            <View style={styles.suggestionItem}>
              <Ionicons name="checkmark-circle" size={20} color="#10B981" />
              <Text style={styles.suggestionText}>Check the URL for typos</Text>
            </View>
            <View style={styles.suggestionItem}>
              <Ionicons name="checkmark-circle" size={20} color="#10B981" />
              <Text style={styles.suggestionText}>Go back to the previous page</Text>
            </View>
            <View style={styles.suggestionItem}>
              <Ionicons name="checkmark-circle" size={20} color="#10B981" />
              <Text style={styles.suggestionText}>Return to the home screen</Text>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleGoHome}
              activeOpacity={0.7}
            >
              <Ionicons name="home" size={20} color="white" />
              <Text style={styles.primaryButtonText}>Go to Home</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={handleGoBack}
              activeOpacity={0.7}
            >
              <Ionicons name="arrow-back" size={20} color="#3B82F6" />
              <Text style={styles.secondaryButtonText}>Go Back</Text>
            </TouchableOpacity>
          </View>

          {/* Support Link */}
          <View style={styles.supportContainer}>
            <Text style={styles.supportText}>
              Still having issues?{' '}
              <Link href="/" style={styles.supportLink}>
                Contact Support
              </Link>
            </Text>
          </View>
        </View>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 40,
    justifyContent: 'center',
  },
  illustrationContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  illustration: {
    position: 'relative',
    width: 200,
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  circle: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
    opacity: 0.5,
  },
  errorCode: {
    fontSize: 72,
    fontWeight: 'bold',
    color: '#EF4444',
    opacity: 0.3,
  },
  iconWrapper: {
    zIndex: 1,
  },
  messageContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 12,
    textAlign: 'center',
    fontFamily: 'Jakarta-Bold',
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 16,
    fontFamily: 'Jakarta-Regular',
  },
  suggestionsContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  suggestionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16,
    fontFamily: 'Jakarta-SemiBold',
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  suggestionText: {
    fontSize: 14,
    color: '#4B5563',
    marginLeft: 12,
    fontFamily: 'Jakarta-Regular',
  },
  buttonContainer: {
    gap: 12,
    marginBottom: 24,
  },
  primaryButton: {
    backgroundColor: '#3B82F6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
    fontFamily: 'Jakarta-SemiBold',
  },
  secondaryButton: {
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#3B82F6',
  },
  secondaryButtonText: {
    color: '#3B82F6',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
    fontFamily: 'Jakarta-SemiBold',
  },
  supportContainer: {
    alignItems: 'center',
  },
  supportText: {
    fontSize: 14,
    color: '#6B7280',
    fontFamily: 'Jakarta-Regular',
  },
  supportLink: {
    color: '#3B82F6',
    fontWeight: '600',
    fontFamily: 'Jakarta-SemiBold',
  },
});
