import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { BarWithScore } from '../types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Exported so the parent screen can derive snap/scroll metrics consistently.
export const CARD_WIDTH = Math.round(SCREEN_WIDTH * 0.78);
export const CARD_MARGIN = 8;
export const SNAP_INTERVAL = CARD_WIDTH + CARD_MARGIN * 2;

interface Props {
  bar: BarWithScore;
  isSelected: boolean;
  onPress: () => void;
  /** Number of global votes remaining for the user today. */
  votesRemaining: number;
  onVote: () => void;
}

const TYPE_LABELS: Record<string, string> = {
  bar: 'BAR',
  nightclub: 'CLUB',
  lounge: 'LOUNGE',
  sports_bar: 'SPORTS',
};

const TYPE_COLORS: Record<string, string> = {
  bar: '#3B82F6',
  nightclub: '#8B5CF6',
  lounge: '#EC4899',
  sports_bar: '#10B981',
};

function priceLabel(range: number) {
  return '$'.repeat(range);
}

function scoreColor(score: number) {
  if (score >= 80) return '#EF4444';
  if (score >= 60) return '#F59E0B';
  if (score >= 40) return '#8B5CF6';
  return '#6B7280';
}

/**
 * Compact bar card displayed in the horizontal bottom carousel.
 * Tapping the card opens the full BarDetailSheet.
 * The inline vote button allows voting without leaving the map view.
 */
export default function BarCard({ bar, isSelected, onPress, votesRemaining, onVote }: Props) {
  const canVote = votesRemaining > 0 && !bar.userVoted;
  const barColor = scoreColor(bar.popularityScore);

  return (
    <TouchableOpacity
      style={[styles.card, isSelected && styles.selectedCard]}
      onPress={onPress}
      activeOpacity={0.88}
    >
      {/* ── Header ─────────────────────────────────────────── */}
      <View style={styles.header}>
        <Text style={styles.name} numberOfLines={1}>
          {bar.name}
        </Text>
        <View style={[styles.typeBadge, { backgroundColor: TYPE_COLORS[bar.type] }]}>
          <Text style={styles.typeText}>{TYPE_LABELS[bar.type]}</Text>
        </View>
      </View>

      {/* ── Sub-header: neighborhood + status ────────────────── */}
      <View style={styles.subHeader}>
        <Text style={styles.neighborhood}>
          {bar.neighborhood} · {priceLabel(bar.priceRange)}
        </Text>
        <View style={[styles.statusDot, { backgroundColor: bar.isOpen ? '#10B981' : '#6B7280' }]} />
      </View>

      {/* ── Popularity bar ───────────────────────────────────── */}
      <View style={styles.popularityRow}>
        <View style={styles.popularityTrack}>
          <View
            style={[
              styles.popularityFill,
              { width: `${bar.popularityScore}%`, backgroundColor: barColor },
            ]}
          />
        </View>
        <Text style={[styles.popularityLabel, { color: barColor }]}>{bar.popularityScore}%</Text>
      </View>

      {/* ── Footer: vote count + vote button ─────────────────── */}
      <View style={styles.footer}>
        <Text style={styles.voteCount}>{bar.voteCount.toLocaleString()} votes</Text>
        <TouchableOpacity
          style={[styles.voteBtn, !canVote && styles.voteBtnDisabled]}
          onPress={(e) => {
            e.stopPropagation();
            if (canVote) onVote();
          }}
          activeOpacity={0.75}
          disabled={!canVote}
        >
          <Text style={styles.voteBtnText}>
            {bar.userVoted ? '✓ Voted' : votesRemaining === 0 ? 'Used up' : '🔥 Vote'}
          </Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    backgroundColor: '#1A2235',
    borderRadius: 18,
    padding: 16,
    marginHorizontal: CARD_MARGIN,
    borderWidth: 1.5,
    borderColor: '#2A3550',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  selectedCard: {
    borderColor: '#F59E0B',
    shadowColor: '#F59E0B',
    shadowOpacity: 0.25,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 8,
  },
  name: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
  },
  typeBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 5,
  },
  typeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  subHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  neighborhood: {
    color: '#9CA3AF',
    fontSize: 12,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  popularityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  popularityTrack: {
    flex: 1,
    height: 5,
    backgroundColor: '#2A3550',
    borderRadius: 3,
    overflow: 'hidden',
  },
  popularityFill: {
    height: '100%',
    borderRadius: 3,
  },
  popularityLabel: {
    fontSize: 12,
    fontWeight: '700',
    minWidth: 36,
    textAlign: 'right',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  voteCount: {
    color: '#6B7280',
    fontSize: 11,
  },
  voteBtn: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
  },
  voteBtnDisabled: {
    backgroundColor: '#2A3550',
  },
  voteBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
});
