import React, { useEffect } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';

export default function IndexRedirect() {
  const { user, token, isLoading } = useAuth();

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

  return (
    <View style={styles.container}>
      <View style={styles.logoBadge}>
        <Ionicons name="business" size={48} color="#F59E0B" />
      </View>
      <Text style={styles.title}>TA LUXURY HOTEL</Text>
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
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#F8FAFC',
    letterSpacing: 2,
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#F59E0B',
    letterSpacing: 1.5,
    marginTop: 6,
  },
});
