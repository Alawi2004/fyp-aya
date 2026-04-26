import React from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, Platform, StatusBar } from 'react-native';
import useHeaderInsets from '../../hooks/useHeaderInsets';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants/colors';

const MOCK_NOTIFS = [
  { _id: '1', type: 'arrival', title: 'Bus arriving soon', body: 'Express 101 is 5 minutes away from your stop.', time: '2 min ago', read: false },
  { _id: '2', type: 'delay', title: 'Trip delayed', body: 'City Line 5 is delayed by 10 minutes due to traffic.', time: '15 min ago', read: false },
  { _id: '3', type: 'reward', title: 'Loyalty reward!', body: 'You have completed 10 trips! Enjoy a free ride.', time: '1 hr ago', read: true },
  { _id: '4', type: 'emergency', title: 'Emergency alert', body: 'Emergency reported on Route 5 near Main Street.', time: '2 hrs ago', read: true },
];

const iconMap = {
  arrival: 'bus',
  delay: 'time',
  reward: 'gift',
  emergency: 'warning',
};
const colorMap = {
  arrival: COLORS.success,
  delay: COLORS.warning,
  reward: COLORS.primary,
  emergency: COLORS.danger,
};

const NotificationsScreen = () => {
  const headerInsets = useHeaderInsets();
  const unreadCount = MOCK_NOTIFS.filter(n => !n.read).length;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />

      {/* Page Header */}
      <View style={[styles.pageHeader, headerInsets]}>
        <Text style={styles.pageTitle}>Notifications</Text>
        {unreadCount > 0 && (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadBadgeText}>{unreadCount} new</Text>
          </View>
        )}
      </View>

      <FlatList
        data={MOCK_NOTIFS}
        keyExtractor={i => i._id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.item, !item.read && styles.itemUnread]}
            activeOpacity={0.75}
          >
            <View style={[styles.iconWrap, { backgroundColor: colorMap[item.type] + '18' }]}>
              <Ionicons name={iconMap[item.type]} size={21} color={colorMap[item.type]} />
            </View>
            <View style={styles.itemBody}>
              <View style={styles.itemTop}>
                <Text style={styles.itemTitle}>{item.title}</Text>
                <Text style={styles.itemTime}>{item.time}</Text>
              </View>
              <Text style={styles.itemText}>{item.body}</Text>
            </View>
            {!item.read && <View style={styles.unreadDot} />}
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="notifications-off-outline" size={48} color={COLORS.textMuted} />
            <Text style={styles.emptyText}>No notifications yet</Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },

  pageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLORS.white,
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  pageTitle: { fontSize: 24, fontWeight: '800', color: COLORS.textPrimary },
  unreadBadge: {
    backgroundColor: COLORS.primary,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  unreadBadgeText: { fontSize: 12, fontWeight: '700', color: COLORS.white },

  list: { padding: 16, gap: 8 },

  item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 14,
  },
  itemUnread: { backgroundColor: '#EEF3FF' },
  iconWrap: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  itemBody: { flex: 1 },
  itemTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  itemTitle: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary, flex: 1, marginRight: 8 },
  itemTime: { fontSize: 11, color: COLORS.textMuted, flexShrink: 0 },
  itemText: { fontSize: 13, color: COLORS.textSecondary, lineHeight: 19 },
  unreadDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: COLORS.primary,
    marginTop: 4, flexShrink: 0,
  },

  empty: { alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 12 },
  emptyText: { fontSize: 15, color: COLORS.textMuted, fontWeight: '500' },
});

export default NotificationsScreen;
