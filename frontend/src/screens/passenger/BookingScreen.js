import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Alert, Platform, StatusBar, TouchableOpacity,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import SeatPicker from '../../components/passenger/SeatPicker';
import Button from '../../components/common/Button';
import Card from '../../components/common/Card';
import ScreenHeader from '../../components/common/ScreenHeader';
import { useApp } from '../../context/AppContext';
import { createBookingApi } from '../../api/bookingApi';
import { getBusDetailsApi } from '../../api/busApi';
import { COLORS } from '../../constants/colors';

const csvToSeats = (csv) => String(csv ?? '').split(',').map((s) => s.trim()).filter(Boolean);

const BookingScreen = ({ route, navigation }) => {
  const { bus } = route.params;
  const { walletBalance, updateBalance, addBooking, refreshBookings } = useApp();
  const [selectedSeats, setSelectedSeats] = useState([]);
  const [loading, setLoading] = useState(false);

  // The `bus` passed in via navigation comes from the buses list, which can
  // go stale the moment another passenger books a seat. Re-fetch the trip's
  // live seat map every time this screen gains focus so booked seats stay
  // in sync with the DB instead of showing whatever was true when the list
  // was last loaded.
  const [bookedSeats, setBookedSeats] = useState(() => csvToSeats(bus.bookedSeatsCsv));
  const [totalSeats, setTotalSeats]   = useState(bus.totalSeats);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      getBusDetailsApi(bus._id)
        .then((res) => {
          if (cancelled || !res.data) return;
          setBookedSeats(csvToSeats(res.data.bookedSeatsCsv));
          setTotalSeats(res.data.totalSeats ?? bus.totalSeats);
        })
        .catch(() => {});
      return () => { cancelled = true; };
    }, [bus._id])
  );

  const unitPrice           = parseFloat(bus.price);
  const totalPrice          = selectedSeats.length * unitPrice;
  const price               = unitPrice; // kept for display in route card
  const insufficientBalance = selectedSeats.length > 0 && walletBalance < totalPrice;
  const shortfall           = Math.max(0, totalPrice - walletBalance).toFixed(2);
  const availableSeats      = totalSeats - bookedSeats.length;

  const handleConfirm = async () => {
    if (selectedSeats.length === 0) {
      Alert.alert('No Seat Selected', 'Please choose at least one seat to continue.');
      return;
    }
    if (insufficientBalance) {
      Alert.alert(
        'Insufficient Balance',
        `You need $${totalPrice.toFixed(2)} for ${selectedSeats.length} seat(s) but only have $${walletBalance.toFixed(2)} in your wallet.`,
        [
          { text: 'Top Up Wallet', onPress: () => navigation.navigate('Wallet') },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
      return;
    }
    const seatLabel = selectedSeats.length === 1 ? `seat ${selectedSeats[0]}` : `${selectedSeats.length} seats (${selectedSeats.join(', ')})`;
    Alert.alert(
      'Confirm Booking',
      `Book ${seatLabel} on ${bus.name} for $${totalPrice.toFixed(2)}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            setLoading(true);
            try {
              const res = await createBookingApi({ trip_id: bus._id, seats: selectedSeats });
              const { tickets, total, newBalance } = res.data;
              const newBooking = {
                _id: tickets[0]?.ticket_id?.toString() ?? Date.now().toString(),
                bus,
                tickets,
                seatId: tickets[0]?.seat_number,
                seats: tickets.map((t) => t.seat_number),
                price: total,
                date: tickets[0]?.created_at ?? new Date().toISOString(),
                status: 'upcoming',
              };
              addBooking(newBooking);
              updateBalance(newBalance);
              refreshBookings(); // sync "Upcoming Trips" with the DB-confirmed booking
              navigation.replace('Ticket', { booking: newBooking });
            } catch (err) {
              const msg = err?.response?.data?.error || 'Something went wrong. Please try again.';
              Alert.alert('Booking Failed', msg);
              // Someone may have grabbed the seat first (409 conflict) — refresh
              // the live seat map so the picker reflects what's actually free now.
              setSelectedSeats([]);
              getBusDetailsApi(bus._id)
                .then((res) => {
                  if (!res.data) return;
                  setBookedSeats(csvToSeats(res.data.bookedSeatsCsv));
                  setTotalSeats(res.data.totalSeats ?? bus.totalSeats);
                })
                .catch(() => {});
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
              <Text style={styles.priceLabel}>Price / Seat</Text>
              <Text style={styles.priceValue}>${unitPrice.toFixed(2)}</Text>
            </View>
            <View style={styles.priceDivider} />
            <View style={styles.priceItem}>
              <Text style={styles.priceLabel}>Your Balance</Text>
              <Text style={[styles.priceValue, insufficientBalance && { color: COLORS.danger }]}>
                ${walletBalance?.toFixed(2) ?? '0.00'}
              </Text>
            </View>
          </View>

          {/* Insufficient balance warning */}
          {insufficientBalance && (
            <View style={styles.warningCard}>
              <View style={styles.warningTop}>
                <Ionicons name="wallet-outline" size={18} color={COLORS.danger} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.warningTitle}>Insufficient Balance</Text>
                  <Text style={styles.warningText}>
                    You need{' '}
                    <Text style={{ fontWeight: '800' }}>${shortfall} more</Text>
                    {' '}to book {selectedSeats.length} seat(s).
                  </Text>
                </View>
              </View>
              <View style={styles.warningRow}>
                <View style={styles.warningAmt}>
                  <Text style={styles.warningAmtLabel}>Total ({selectedSeats.length}×)</Text>
                  <Text style={styles.warningAmtVal}>${totalPrice.toFixed(2)}</Text>
                </View>
                <Ionicons name="remove-outline" size={14} color={COLORS.textMuted} />
                <View style={styles.warningAmt}>
                  <Text style={styles.warningAmtLabel}>Your balance</Text>
                  <Text style={[styles.warningAmtVal, { color: COLORS.danger }]}>
                    ${walletBalance.toFixed(2)}
                  </Text>
                </View>
                <Ionicons name="remove-outline" size={14} color={COLORS.textMuted} />
                <View style={styles.warningAmt}>
                  <Text style={styles.warningAmtLabel}>Shortfall</Text>
                  <Text style={[styles.warningAmtVal, { color: COLORS.danger, fontWeight: '900' }]}>
                    ${shortfall}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.topUpInlineBtn}
                onPress={() => navigation.navigate('Wallet')}
                activeOpacity={0.85}
              >
                <Ionicons name="add-circle-outline" size={16} color={COLORS.white} />
                <Text style={styles.topUpInlineBtnText}>Top Up Wallet Now</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Seat Picker Card */}
        <Card style={styles.seatCard}>
          <View style={styles.seatCardHeader}>
            <View>
              <Text style={styles.seatCardTitle}>Choose Your Seat</Text>
              <Text style={styles.seatCardSub}>{availableSeats} of {totalSeats} seats free</Text>
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
            totalSeats={totalSeats}
            bookedSeats={bookedSeats}
            onSelect={setSelectedSeats}
            multiSelect
          />
        </Card>

        <View style={{ height: 110 }} />
      </ScrollView>

      {/* Bottom Bar */}
      <View style={styles.bottomBar}>
        <View style={styles.bottomInfo}>
          <Text style={styles.bottomLabel}>Seats</Text>
          <Text style={styles.bottomValue}>
            {selectedSeats.length === 0 ? '—' : selectedSeats.length === 1 ? selectedSeats[0] : `${selectedSeats.length}×`}
          </Text>
        </View>
        <View style={styles.bottomDivider} />
        <View style={styles.bottomInfo}>
          <Text style={styles.bottomLabel}>Total</Text>
          <Text style={[styles.bottomValue, { color: COLORS.primary }]}>
            ${selectedSeats.length > 0 ? totalPrice.toFixed(2) : unitPrice.toFixed(2)}
          </Text>
        </View>
        <Button
          title="Book Now"
          onPress={handleConfirm}
          loading={loading}
          disabled={selectedSeats.length === 0 || insufficientBalance}
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

  warningCard: {
    backgroundColor: COLORS.dangerLight, borderRadius: 14,
    padding: 14, marginTop: 12, borderWidth: 1.5, borderColor: COLORS.dangerMid,
    gap: 12,
  },
  warningTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  warningTitle: { fontSize: 14, fontWeight: '800', color: COLORS.danger, marginBottom: 2 },
  warningText: { fontSize: 12, color: COLORS.danger, lineHeight: 18 },
  warningRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.white, borderRadius: 10, padding: 10,
  },
  warningAmt: { alignItems: 'center', flex: 1 },
  warningAmtLabel: { fontSize: 10, color: COLORS.textMuted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.3 },
  warningAmtVal: { fontSize: 15, fontWeight: '800', color: COLORS.textPrimary, marginTop: 2 },
  topUpInlineBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: COLORS.danger, borderRadius: 11, paddingVertical: 12,
    shadowColor: COLORS.danger, shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25, shadowRadius: 6, elevation: 3,
  },
  topUpInlineBtnText: { fontSize: 14, fontWeight: '700', color: COLORS.white },

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
