import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, Image } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useAppTheme } from '../contexts/ThemeContext';

export default function IndexRedirect() {
  const { user, token, isLoading } = useAuth();
  const { colors, hotelName, hotelLogoUrl } = useAppTheme();
  const [logoError, setLogoError] = useState(false);

  useEffect(() => {
    setLogoError(false);
  }, [hotelLogoUrl]);

  useEffect(() => {
    if (isLoading) return;

    if (!token || !user) {
      router.replace('/login');
    } else {
      // Điều hướng thông minh theo vai trò tác nghiệp
      if (user.role === 'service_staff') {
        router.replace('/(tabs)/services');
      } else if (user.role === 'technician') {
        router.replace('/(tabs)/maintenance');
      } else {
        router.replace('/(tabs)/housekeeping');
      }
    }
  }, [isLoading, token, user]);

  const showDynamicLogo = Boolean(hotelLogoUrl) && !logoError;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.logoBadge, showDynamicLogo && styles.logoBadgeImage]}>
        {showDynamicLogo ? (
          <Image
            source={{ uri: hotelLogoUrl! }}
            style={styles.logoImage}
            resizeMode="cover"
            onError={() => setLogoError(true)}
          />
        ) : (
          <Ionicons name="business" size={44} color="#F59E0B" />
        )}
      </View>
      <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
        {(hotelName || 'TA LUXURY HOTEL').toUpperCase()}
      </Text>
      <Text style={styles.subtitle}>HỆ THỐNG TÁC NGHIỆP HIỆN TRƯỜNG</Text>
      <ActivityIndicator size="large" color="#F59E0B" style={{ marginTop: 24 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  logoBadge: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#1E293B',
    borderWidth: 2,
    borderColor: '#F59E0B',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    overflow: 'hidden',
  },
  logoBadgeImage: {
    backgroundColor: '#FFFFFF',
  },
  logoImage: {
    width: '100%',
    height: '100%',
  },
  title: {
    fontSize: 21,
    fontWeight: '800',
    color: '#F8FAFC',
    letterSpacing: 1.5,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#F59E0B',
    letterSpacing: 1.4,
    marginTop: 6,
  },
});
