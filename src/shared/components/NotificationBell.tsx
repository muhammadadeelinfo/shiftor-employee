import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useEffect, useRef } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNotifications } from '@shared/context/NotificationContext';

export const NotificationBell = () => {
  const { toggle, unreadCount, open } = useNotifications();
  const glow = useRef(new Animated.Value(0)).current;
  const animationRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    animationRef.current?.stop();
    glow.setValue(0);
    if (!unreadCount || open) {
      animationRef.current = null;
      return;
    }

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(glow, {
          toValue: 0,
          duration: 900,
          useNativeDriver: true,
        }),
      ])
    );
    animationRef.current = animation;
    animation.start();
    return () => animation.stop();
  }, [glow, unreadCount, open]);

  const glowStyle = {
    opacity: glow.interpolate({
      inputRange: [0, 1],
      outputRange: [0, 0.5],
    }),
  };

  return (
    <TouchableOpacity
      style={styles.button}
      onPress={toggle}
      activeOpacity={0.85}
      accessibilityLabel="Notifications"
    >
      <Animated.View style={[styles.glow, glowStyle]} />
      <LinearGradient
        colors={['#3b82f6', '#2563eb']}
        start={[0, 0]}
        end={[1, 1]}
        style={styles.gradient}
      >
        <Ionicons name="notifications-outline" size={18} color="#fff" />
      </LinearGradient>
      {unreadCount > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    width: 44,
    height: 44,
    borderRadius: 999,
    overflow: 'visible',
  },
  gradient: {
    width: 44,
    height: 44,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
  },
  glow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 999,
    backgroundColor: '#2563eb',
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -6,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#dc2626',
    borderWidth: 1.5,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
});
