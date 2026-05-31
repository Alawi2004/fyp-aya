import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { COLORS } from '../../constants/colors';
import { THEME } from '../../constants/theme';

const SeatPicker = ({ totalSeats = 40, bookedSeats = [], onSelect, multiSelect = false }) => {
  const [selected, setSelected] = useState(multiSelect ? [] : null);
  const rows = Math.ceil(totalSeats / 4);

  const handleSeat = (seatId) => {
    if (bookedSeats.includes(seatId)) return;
    if (multiSelect) {
      const next = selected.includes(seatId)
        ? selected.filter(s => s !== seatId)
        : [...selected, seatId];
      setSelected(next);
      onSelect(next);
    } else {
      const next = selected === seatId ? null : seatId;
      setSelected(next);
      onSelect(next);
    }
  };

  const getSeatStatus = (id) => {
    if (multiSelect ? selected.includes(id) : id === selected) return 'selected';
    if (bookedSeats.includes(id)) return 'booked';
    return 'available';
  };

  const seatStyles = {
    available: { bg: COLORS.seatAvailable, border: COLORS.success,     text: COLORS.success     },
    booked:    { bg: COLORS.seatBooked,    border: COLORS.danger,      text: COLORS.danger      },
    selected:  { bg: COLORS.seatSelected,  border: COLORS.primaryDark, text: COLORS.white       },
  };

  const hasSelection = multiSelect ? selected.length > 0 : !!selected;

  return (
    <View style={styles.container}>
      {/* Legend */}
      <View style={styles.legend}>
        {['available', 'booked', 'selected'].map(s => (
          <View key={s} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: seatStyles[s].bg, borderColor: seatStyles[s].border }]} />
            <Text style={styles.legendText}>{s.charAt(0).toUpperCase() + s.slice(1)}</Text>
          </View>
        ))}
      </View>

      {/* Bus front */}
      <View style={styles.busFront}>
        <Text style={styles.busFrontText}>🚌 Front</Text>
      </View>

      {/* Seats */}
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.seatsGrid}>
          {Array.from({ length: rows }, (_, rowIdx) => (
            <View key={rowIdx} style={styles.row}>
              {['A', 'B', '', 'C', 'D'].map((col, colIdx) => {
                if (col === '') return <View key={colIdx} style={styles.aisle} />;
                const seatNum = rowIdx * 4 + (['A', 'B'].indexOf(col) !== -1 ? ['A', 'B'].indexOf(col) : ['C', 'D'].indexOf(col) + 2) + 1;
                if (seatNum > totalSeats) return <View key={colIdx} style={styles.emptySeat} />;
                const seatId = `${col}${rowIdx + 1}`;
                const status = getSeatStatus(seatId);
                const s = seatStyles[status];
                return (
                  <TouchableOpacity
                    key={colIdx}
                    style={[styles.seat, { backgroundColor: s.bg, borderColor: s.border }]}
                    onPress={() => handleSeat(seatId)}
                    activeOpacity={status === 'booked' ? 1 : 0.8}
                  >
                    <Text style={[styles.seatText, { color: s.text }]}>{seatId}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </View>
      </ScrollView>

      {hasSelection && (
        <View style={styles.selectedInfo}>
          <Text style={styles.selectedText}>
            Selected:{' '}
            <Text style={styles.selectedSeat}>
              {multiSelect ? selected.join(', ') : selected}
            </Text>
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { padding: THEME.spacing.md },
  legend: { flexDirection: 'row', justifyContent: 'center', gap: 20, marginBottom: 16 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 14, height: 14, borderRadius: 4, borderWidth: 1.5 },
  legendText: { fontSize: 12, color: COLORS.textSecondary },
  busFront: { alignItems: 'center', backgroundColor: COLORS.primaryLight, borderRadius: 12, padding: 8, marginBottom: 16 },
  busFrontText: { fontSize: 13, fontWeight: '600', color: COLORS.primary },
  seatsGrid: { gap: 8 },
  row: { flexDirection: 'row', justifyContent: 'center', gap: 8 },
  seat: { width: 50, height: 44, borderRadius: 8, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  seatText: { fontSize: 11, fontWeight: '700' },
  emptySeat: { width: 50, height: 44 },
  aisle: { width: 24 },
  selectedInfo: { marginTop: 16, alignItems: 'center', backgroundColor: COLORS.primaryLight, borderRadius: 10, padding: 10 },
  selectedText: { fontSize: 14, color: COLORS.textSecondary },
  selectedSeat: { fontWeight: '700', color: COLORS.primary },
});

export default SeatPicker;
