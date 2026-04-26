import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Alert, Platform, StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import SeatPicker from '../../components/passenger/SeatPicker';
import Button from '../../components/common/Button';
import Card from '../../components/common/Card';
import ScreenHeader from '../../components/common/ScreenHeader';
import { useApp } from '../../context/AppContext';
import { COLORS } from '../../constants/colors';

const BookingScreen = ({ route, navigation }) => {
  const { bus } = route.params;
  const { walletBalance, updateBalance, addBooking } = useApp();
  const [selectedSeat, setSelectedSeat] = useState(null);
  const [loading, setLoading] = useState(false);

  const price = parseFloat(bus.price);
  const insufficientBalance = walletBalance < price;
  const availableSeats = bus.totalSeats - bus.bookedSeats;

  const handleConfirm = async () => {
    if (!selectedSeat) {
      Alert.alert('No Seat Selected', 'Please choose a seat to continue.');
      return;
    }
    if (insufficientBalance) {
      Alert.alert(
        'Insufficient Balance',
        `You need $${bus.price} but only have $${walletBalance.toFixed(2)} in your wallet.`,
        [
          { text: 'Top Up Wallet', onPress: () => navigation.navigate('Wallet') },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
      return;
    }
    Alert.alert(
      'Confirm Booking',
      `Book seat ${selectedSeat} on ${bus.name} for $${bus.price}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            setLoading(true);
            try {
              const newBooking = {
                _id: Date.now().toString(),
                bus, seatId: selectedSeat,
                price, date: new Date().toISOString(),
                status: 'upcoming',
              };
              addBooking(newBooking);
              updateBalance(walletBalance - price);
              navigation.replace('Ticket', { booking: newBooking });
            } catch {
              Alert.alert('Error', 'Something went wrong. Please try again.');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <ScreenHeader title="Book a Seat" subtitle={bus.name} onBack={() => navigation.goBack()} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* Route Card */}
        <View style={styles.routeCard}>
          {/* Bus header */}
          <View style={styles.busHeaderRow}>
            <View style={styles.busIcon}>
              <Ionicons name="bus" size={22} color={COLORS.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.busName}>{bus.name}</Text>
              <Text style={styles.busRoute}>{bus.route}</Text>
            </View>
            <View style={styles.durationBadge}>
              <Ionicons name="time-outline" size={12} color={COLORS.primary} />
              <Text style={styles.durationText}>{bus.duration}</Text>
            </View>
          </View>

          {/* Journey */}
          <View style={styles.journeyWrap}>
            <View style={styles.journeyStop}>
              <View style={styles.journeyDotGreen} />
              <View>
                <Text style={styles.journeyLabel}>FROM</Text>
                <Text style={styles.journeyPlace}>{bus.origin}</Text>
                <Text style={styles.journeyTime}>{bus.departureTime}</Text>
              </View>
            </View>

            <View style={styles.journeyCenter}>
              <View style={styles.journeyLine} />
              <View style={styles.journeyBusChip}>
                <Ionicons name="bus-outline" size={13} color={COLORS.primary} />
              </View>
              <View style={styles.journeyLine} />
            </View>

            <View style={[styles.journeyStop, { alignItems: 'flex-end' }]}>
              <View style={[styles.journeyDotGreen, { backgroundColor: COLORS.danger }]} />
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.journeyLabel}>TO</Text>
                <Text style={styles.journeyPlace}>{bus.destination}</Text>
                <Text style={styles.journeyTime}>{bus.arrivalTime}</Text>
              </View>
            </View>
          </View>

          {/* Price + Balance row */}
          <View style={styles.priceRow}>
            <View style={styles.priceItem}>
              <Text style={styles.priceLabel}>Ticket Price</Text>
              <Text style={styles.priceValue}>${bus.price}</Text>
            </View>
            <View style={styles.priceDivider} />
            <View style={styles.priceItem}>
              <Text style={styles.priceLabel}>Your Balance</Text>
              <Text style={[styles.priceValue, insufficientBalance && { color: COLORS.danger }]}>
                ${walletBalance?.toFixed(2) ?? '0.00'}
              </Text>
            </View>
          </View>

          {/* Insufficient warning */}
          {insufficientBalance && (
            <View style={styles.warningBanner}>
              <Ionicons name="warning-outline" size={15} color={COLORS.danger} />
              <Text style={styles.warningText}>
                Insufficient balance — please top up your wallet before booking.
              </Text>
            </View>
          )}
        </View>

        {/* Seat Picker Card */}
        <Card style={styles.seatCard}>
          <View style={styles.seatCardHeader}>
            <View>
              <Text style={styles.seatCardTitle}>Choose Your Seat</Text>
              <Text style={styles.seatCardSub}>{availableSeats} of {bus.totalSeats} seats free</Text>
            </View>
            <View style={styles.seatCountBadge}>
              <Text style={styles.seatCountText}>{availableSeats} left</Text>
            </View>
          </View>

          {/* Legend */}
          <View style={styles.legend}>
            {[
              { color: COLORS.seatAvailable, label: 'Available', border: COLORS.secondaryMid },
              { color: COLORS.seatSelected,  label: 'Selected',  border: COLORS.primary      },
              { color: COLORS.seatBooked,    label: 'Booked',    border: COLORS.dangerMid    },
            ].map(l => (
              <View key={l.label} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: l.color, borderColor: l.border }]} />
                <Text style={styles.legendText}>{l.label}</Text>
              </View>
            ))}
          </View>

          <SeatPicker
            totalSeats={bus.totalSeats}
            bookedSeats={Array.from({ length: bus.bookedSeats }, (_, i) => `A${i + 1}`)}
            onSelect={setSelectedSeat}
          />
        </Card>

        <View style={{ height: 110 }} />
      </ScrollView>

      {/* Bottom Bar */}
      <View style={styles.bottomBar}>
        <View style={styles.bottomInfo}>
          <Text style={styles.bottomLabel}>Seat</Text>
          <Text style={styles.bottomValue}>{selectedSeat || '—'}</Text>
        </View>
        <View style={styles.bottomDivider} />
        <View style={styles.bottomInfo}>
          <Text style={styles.bottomLabel}>Total</Text>
          <Text style={[styles.bottomValue, { color: COLORS.primary }]}>${bus.price}</Text>
        </View>
        <Button
          title="Book Now"
          onPress={handleConfirm}
          loading={loading}
          disabled={!selectedSeat || insufficientBalance}
          style={styles.bookBtn}
          size="lg"
          icon={<Ionicons name="checkmark-circle-outline" size={18} color={COLORS.white} />}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: 16 },

  /* Route Card */
  routeCard: {
    backgroundColor: COLORS.white, borderRadius: 20,
    padding: 18, marginBottom: 12,
    shadowColor: '#64748B', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1, shadowRadius: 12, elevation: 4,
  },
  busHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 18 },
  busIcon: {
    width: 50, height: 50, borderRadius: 15,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  busName: { fontSize: 17, fontWeight: '800', color: COLORS.textPrimary, letterSpacing: -0.2 },
  busRoute: { fontSize: 12, color: COLORS.textMuted, marginTop: 2, fontWeight: '500' },
  durationBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: COLORS.primaryLight, borderRadius: 999,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  durationText: { fontSize: 12, fontWeight: '700', color: COLORS.primary },

  /* Journey */
  journeyWrap: {
    flexDirection: 'row', alignItems: 'center',
    paddingBottom: 18, marginBottom: 16,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  journeyStop: { flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  journeyDotGreen: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: COLORS.secondary, marginTop: 16,
  },
  journeyLabel: {
    fontSize: 10, fontWeight: '700', color: COLORS.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  journeyPlace: { fontSize: 14, fontWeight: '800', color: COLORS.textPrimary, marginTop: 2 },
  journeyTime: { fontSize: 12, color: COLORS.textSecondary, marginTop: 1, fontWeight: '500' },
  journeyCenter: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8 },
  journeyLine: { width: 14, height: 1.5, backgroundColor: COLORS.border },
  journeyBusChip: {
    width: 28, height: 28, borderRadius: 9,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },

  /* Price row */
  priceRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.background, borderRadius: 14, padding: 14,
  },
  priceItem: { flex: 1, alignItems: 'center' },
  priceLabel: { fontSize: 11, color: COLORS.textMuted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.3 },
  priceValue: { fontSize: 18, fontWeight: '800', color: COLORS.textPrimary, marginTop: 3 },
  priceDivider: { width: 1, height: 36, backgroundColor: COLORS.border, marginHorizontal: 12 },

  warningBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: COLORS.dangerLight, borderRadius: 12,
    padding: 12, marginTop: 12, borderWidth: 1, borderColor: COLORS.dangerMid,
  },
  warningText: { flex: 1, fontSize: 12, color: COLORS.danger, fontWeight: '600', lineHeight: 18 },

  /* Seat card */
  seatCard: { marginBottom: 12 },
  seatCardHeader: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 12,
  },
  seatCardTitle: { fontSize: 16, fontWeight: '800', color: COLORS.textPrimary, letterSpacing: -0.2 },
  seatCardSub: { fontSize: 12, color: COLORS.textMuted, marginTop: 2, fontWeight: '500' },
  seatCountBadge: {
    backgroundColor: COLORS.primaryLight, borderRadius: 999,
    paddingHorizontal: 12, paddingVertical: 5,
  },
  seatCountText: { fontSize: 12, fontWeight: '700', color: COLORS.primary },
  legend: { flexDirection: 'row', gap: 16, marginBottom: 16 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 14, height: 14, borderRadius: 4, borderWidth: 1.5 },
  legendText: { fontSize: 11, color: COLORS.textSecondary, fontWeight: '600' },

  /* Bottom bar */
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.white,
    paddingHorizontal: 16, paddingVertical: 12,
    paddingBottom: Platform.OS === 'ios' ? 28 : 16,
    borderTopWidth: 1, borderTopColor: COLORS.border,
    gap: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08, shadowRadius: 12, elevation: 10,
  },
  bottomInfo: { alignItems: 'center', minWidth: 52 },
  bottomLabel: { fontSize: 11, color: COLORS.textMuted, fontWeight: '600' },
  bottomValue: { fontSize: 18, fontWeight: '800', color: COLORS.textPrimary, marginTop: 1 },
  bottomDivider: { width: 1, height: 36, backgroundColor: COLORS.border },
  bookBtn: { flex: 1 },
});

export default BookingScreen;
