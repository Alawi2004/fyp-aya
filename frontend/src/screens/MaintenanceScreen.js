import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  StatusBar, Animated, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/colors';

/**
 * MaintenanceScreen
 *
 * Shown when the backend returns HTTP 503 with code "MAINTENANCE_MODE".
 * Lets the user retry manually — the app will automatically exit maintenance
 * mode as soon as any API call succeeds again.
 *
 * Props:
 *   message   — optional custom message from the backend
 *   onRetry   — callback to fire a retry ping
 */
const MaintenanceScreen = ({ message, onRetry }) => {
  const gearAnim   = useRef(new Animated.Value(0)).current;
  const fadeAnim   = useRef(new Animated.Value(0)).current;
  const slideAnim  = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    // Gear rotation loop
    Animated.loop(
      Animated.timing(gearAnim, {
        toValue:         1,
        duration:        6000,
        useNativeDriver: true,
      })
    ).start();

    // Fade + slide in the text content
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 600, delay: 200, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 600, delay: 200, useNativeDriver: true }),
    ]).start();
  }, []);

  const rotate = gearAnim.interpolate({
    inputRange:  [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const displayMessage =
    message ??
    'We are performing scheduled maintenance to improve your experience. We will be back shortly.';

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />

      {/* Gear icon */}
      <View style={styles.iconOuter}>
        <View style={styles.iconInner}>
          <Animated.View style={{ transform: [{ rotate }] }}>
            <Ionicons name="settings-sharp" size={64} color={COLORS.primary} />
          </Animated.View>
        </View>
        {/* Decorative rings */}
        {[0.6, 0.4].map((opacity, i) => (
          <View
            key={i}
            style={[styles.ring, {
              width:   140 + i * 50,
              height:  140 + i * 50,
              borderRadius: 70 + i * 25,
              opacity,
            }]}
          />
        ))}
      </View>

      {/* Text content */}
      <Animated.View style={[styles.content, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        <Text style={styles.title}>Under Maintenance</Text>
        <Text style={styles.subtitle}>Yalla Transit</Text>
        <Text style={styles.message}>{displayMessage}</Text>

        {/* Divider */}
        <View style={styles.divider} />

        <View style={styles.infoRow}>
          <Ionicons name="time-outline" size={16} color={COLORS.primary} />
          <Text style={styles.infoText}>
            Our team is working hard to restore service.
          </Text>
        </View>
        <View style={styles.infoRow}>
          <Ionicons name="shield-checkmark-outline" size={16} color={COLORS.secondary} />
          <Text style={styles.infoText}>
            Your wallet balance and bookings are safe.
          </Text>
        </View>
      </Animated.View>

      {/* Retry button */}
      {onRetry && (
        <Animated.View style={{ opacity: fadeAnim, width: '100%', paddingHorizontal: 32 }}>
          <TouchableOpacity style={styles.retryBtn} onPress={onRetry} activeOpacity={0.8}>
            <Ionicons name="refresh-outline" size={18} color={COLORS.white} />
            <Text style={styles.retryText}>Try Again</Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      <Animated.Text style={[styles.footer, { opacity: fadeAnim }]}>
        Yalla Transit · Scheduled Maintenance
      </Animated.Text>
    </View>
  );
};

export default MaintenanceScreen;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingTop: Platform.OS === 'ios' ? 44 : 24,
  },

  iconOuter: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 40,
    position: 'relative',
  },
  iconInner: {
    width:  120,
    height: 120,
    borderRadius: 60,
    backgroundColor: COLORS.primaryLight,
    borderWidth: 2,
    borderColor: COLORS.primaryMid,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  ring: {
    position: 'absolute',
    borderWidth: 1.5,
    borderColor: COLORS.primary,
  },

  content: {
    alignItems: 'center',
    width: '100%',
    marginBottom: 32,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: COLORS.textPrimary,
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.primary,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 18,
  },
  message: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
    maxWidth: 300,
  },
  divider: {
    width: 48,
    height: 2,
    backgroundColor: COLORS.primaryMid,
    borderRadius: 1,
    marginBottom: 20,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
    width: '100%',
  },
  infoText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    flex: 1,
    lineHeight: 19,
  },

  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 15,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: 28,
  },
  retryText: { fontSize: 15, fontWeight: '700', color: COLORS.white },

  footer: {
    position: 'absolute',
    bottom: 32,
    fontSize: 11,
    color: COLORS.textMuted,
    letterSpacing: 0.3,
  },
});
