import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  Linking,
  Dimensions,
  Pressable,
} from 'react-native';
import { BarWithScore, VoteState } from '../types';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const TYPE_LABELS: Record<string, string> = {
  bar: 'Bar',
  nightclub: 'Nightclub',
  lounge: 'Lounge',
  sports_bar: 'Sports Bar',
};

const TYPE_COLORS: Record<string, string> = {
  bar: '#3B82F6',
  nightclub: '#8B5CF6',
  lounge: '#EC4899',
  sports_bar: '#10B981',
};

interface Props {
  bar: BarWithScore | null;
  visible: boolean;
  onClose: () => void;
  /** barId is passed here; the hook resolves the rest. */
  onVote: (barId: string) => void;
  voteState: VoteState;
}

/**
 * Full-detail bottom sheet shown when a user taps a bar card.
 * Implemented as a transparent Modal with slide animation so it works
 * on both iOS and Android without additional dependencies.
 *
 * TODO: Replace the phone call link with a deep-link to the bar's
 *       booking/reservation flow once that API exists.
 */
export default function BarDetailSheet({ bar, visible, onClose, onVote, voteState }: Props) {
  if (!bar) return null;

  const canVote = voteState.votesRemaining > 0 && !bar.userVoted;
  const fillColor = scoreToColor(bar.popularityScore);

  const handleCall = () => {
    if (bar.phone) Linking.openURL(`tel:${bar.phone}`);
  };

  return (
    <Modal
      animationType="slide"
      transparent
      visible={visible}
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        {/* Tap backdrop to dismiss */}
        <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose} />

        <View style={styles.sheet}>
          {/* ── Drag handle ────────────────────────────────── */}
          <View style={styles.handle} />

          <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
            {/* ── Bar name + type + open status ─────────────── */}
            <View style={styles.header}>
              <View style={styles.headerMain}>
                <Text style={styles.barName} numberOfLines={2}>
                  {bar.name}
                </Text>
                <View style={[styles.typeBadge, { backgroundColor: TYPE_COLORS[bar.type] }]}>
                  <Text style={styles.typeText}>{TYPE_LABELS[bar.type]}</Text>
                </View>
              </View>
              <View
                style={[
                  styles.statusPill,
                  { backgroundColor: bar.isOpen ? '#10B98118' : '#EF444418' },
                ]}
              >
                <View
                  style={[styles.statusDot, { backgroundColor: bar.isOpen ? '#10B981' : '#EF4444' }]}
                />
                <Text
                  style={[styles.statusText, { color: bar.isOpen ? '#10B981' : '#EF4444' }]}
                >
                  {bar.isOpen ? 'Open Now' : 'Closed'}
                </Text>
              </View>
            </View>

            {/* ── Location & hours ────────────────────────── */}
            <Text style={styles.metaLine}>📍 {bar.address} · {bar.neighborhood}</Text>
            <Text style={styles.metaLine}>
              🕐 {bar.hours.open} – {bar.hours.close} · {bar.hours.days}
            </Text>

            {/* ── Popularity ──────────────────────────────── */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>TONIGHT'S HOTNESS</Text>
              <View style={styles.popularityRow}>
                <View style={styles.popularityTrack}>
                  <View
                    style={[
                      styles.popularityFill,
                      { width: `${bar.popularityScore}%`, backgroundColor: fillColor },
                    ]}
                  />
                </View>
                <Text style={[styles.popularityNumber, { color: fillColor }]}>
                  {bar.popularityScore}%
                </Text>
              </View>
              <Text style={styles.voteCountLine}>
                {bar.voteCount.toLocaleString()} votes tonight
              </Text>
            </View>

            {/* ── Quick-stats grid ────────────────────────── */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>DETAILS</Text>
              <View style={styles.statsGrid}>
                <StatTile label="Cover" value={bar.coverCharge ? `$${bar.coverCharge}` : 'Free'} />
                <StatTile label="Price" value={'$'.repeat(bar.priceRange)} />
                <StatTile label="Capacity" value={bar.capacity.toLocaleString()} />
              </View>
            </View>

            {/* ── Tags ────────────────────────────────────── */}
            <View style={styles.tagsRow}>
              {bar.tags.map((tag) => (
                <View key={tag} style={styles.tag}>
                  <Text style={styles.tagText}>{tag}</Text>
                </View>
              ))}
            </View>

            {/* ── Description ─────────────────────────────── */}
            <Text style={styles.description}>{bar.description}</Text>

            {/* ── Phone ───────────────────────────────────── */}
            {bar.phone ? (
              <TouchableOpacity onPress={handleCall} style={styles.phoneRow}>
                <Text style={styles.phoneText}>📞 {bar.phone}</Text>
              </TouchableOpacity>
            ) : null}

            {/* ── Vote CTA ────────────────────────────────── */}
            <View style={styles.voteSection}>
              <TouchableOpacity
                style={[styles.voteButton, !canVote && styles.voteButtonDisabled]}
                onPress={() => { if (canVote) onVote(bar.id); }}
                disabled={!canVote}
                activeOpacity={0.82}
              >
                <Text style={styles.voteButtonText}>
                  {bar.userVoted
                    ? "✓  Voted as Tonight's Hotspot"
                    : voteState.votesRemaining === 0
                    ? 'No Votes Remaining Today'
                    : "🔥  Vote as Tonight's Hotspot"}
                </Text>
              </TouchableOpacity>
              <Text style={styles.votesLeftText}>
                {voteState.votesRemaining} of 2 votes remaining today
              </Text>
            </View>

            {/* bottom safe-area padding */}
            <View style={styles.bottomSpacer} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ── Sub-component ────────────────────────────────────────────────────────────

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <View style={statStyles.tile}>
      <Text style={statStyles.label}>{label}</Text>
      <Text style={statStyles.value}>{value}</Text>
    </View>
  );
}

const statStyles = StyleSheet.create({
  tile: {
    flex: 1,
    backgroundColor: '#1E2A40',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  label: {
    color: '#6B7280',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 5,
  },
  value: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function scoreToColor(score: number): string {
  if (score >= 80) return '#EF4444';
  if (score >= 60) return '#F59E0B';
  if (score >= 40) return '#8B5CF6';
  return '#6B7280';
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#141A2E',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    maxHeight: SCREEN_HEIGHT * 0.88,
    paddingTop: 12,
    borderWidth: 1,
    borderColor: '#2A3550',
    borderBottomWidth: 0,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: '#2A3550',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 18,
  },
  header: {
    paddingHorizontal: 20,
    marginBottom: 10,
    gap: 10,
  },
  headerMain: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  barName: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    flex: 1,
    lineHeight: 28,
  },
  typeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    marginTop: 3,
  },
  typeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  metaLine: {
    color: '#9CA3AF',
    fontSize: 13,
    paddingHorizontal: 20,
    marginBottom: 5,
    lineHeight: 19,
  },
  section: {
    paddingHorizontal: 20,
    marginTop: 20,
  },
  sectionTitle: {
    color: '#4B5563',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: 10,
  },
  popularityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 6,
  },
  popularityTrack: {
    flex: 1,
    height: 9,
    backgroundColor: '#2A3550',
    borderRadius: 5,
    overflow: 'hidden',
  },
  popularityFill: {
    height: '100%',
    borderRadius: 5,
  },
  popularityNumber: {
    fontSize: 20,
    fontWeight: '800',
    minWidth: 46,
    textAlign: 'right',
  },
  voteCountLine: {
    color: '#6B7280',
    fontSize: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    gap: 8,
    marginTop: 18,
  },
  tag: {
    backgroundColor: '#1E2A40',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#2A3550',
  },
  tagText: {
    color: '#9CA3AF',
    fontSize: 12,
    fontWeight: '500',
  },
  description: {
    color: '#D1D5DB',
    fontSize: 14,
    lineHeight: 22,
    paddingHorizontal: 20,
    marginTop: 16,
  },
  phoneRow: {
    paddingHorizontal: 20,
    marginTop: 14,
  },
  phoneText: {
    color: '#F59E0B',
    fontSize: 14,
    fontWeight: '500',
  },
  voteSection: {
    paddingHorizontal: 20,
    marginTop: 24,
  },
  voteButton: {
    backgroundColor: '#F59E0B',
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.45,
    shadowRadius: 14,
    elevation: 8,
    marginBottom: 10,
  },
  voteButtonDisabled: {
    backgroundColor: '#2A3550',
    shadowOpacity: 0,
    elevation: 0,
  },
  voteButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  votesLeftText: {
    color: '#4B5563',
    fontSize: 12,
    textAlign: 'center',
  },
  bottomSpacer: {
    height: 36,
  },
});
