import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useVenueContext } from '@/context/VenueContext';
import { useCities } from '@/api/cities';
import { Skeleton } from '../ui/Skeleton';
import { ErrorState } from '../ui/States';

export function CitySelector() {
  const { selectedCity, setSelectedCity } = useVenueContext();
  const { data: cities = [], isLoading, isError, refetch } = useCities();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`Change city. Currently ${selectedCity}.`}
        className="flex-row items-center gap-1 rounded-full bg-crawl-card px-4 py-2">
        <Ionicons name="location" size={16} color="#a855f7" />
        <Text className="text-sm font-medium text-white">{selectedCity}</Text>
        <Ionicons name="chevron-down" size={14} color="#9ca3af" />
      </Pressable>

      <Modal visible={open} animationType="fade" transparent onRequestClose={() => setOpen(false)}>
        <Pressable
          onPress={() => setOpen(false)}
          className="flex-1 items-center justify-center bg-black/70 px-6">
          <Pressable
            onPress={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-2xl bg-crawl-card p-4">
            <Text className="mb-3 text-base font-semibold text-white">Select city</Text>
            <ScrollView className="max-h-80" showsVerticalScrollIndicator={false}>
              {isLoading ? (
                <View>
                  {[0, 1, 2, 3].map((i) => (
                    <Skeleton key={i} className="mb-2 h-10 w-full rounded-lg" />
                  ))}
                </View>
              ) : isError ? (
                <ErrorState
                  title="Couldn't load cities"
                  message="Check your connection."
                  onRetry={() => refetch()}
                />
              ) : cities.length === 0 ? (
                <Text className="py-2 text-sm text-crawl-text-muted">No cities available yet.</Text>
              ) : (
                cities.map((c) => {
                  const isSelected = c.displayName === selectedCity;
                  return (
                    <Pressable
                      key={c.id}
                      onPress={() => {
                        setSelectedCity(c.displayName);
                        setOpen(false);
                      }}
                      className="flex-row items-center justify-between rounded-lg px-3 py-3 active:bg-white/5">
                      <Text
                        className={
                          isSelected
                            ? 'text-base font-semibold text-crawl-purple'
                            : 'text-base text-white'
                        }>
                        {c.displayName}
                      </Text>
                      {isSelected ? <Ionicons name="checkmark" size={18} color="#a855f7" /> : null}
                    </Pressable>
                  );
                })
              )}
            </ScrollView>
            <Pressable
              onPress={() => setOpen(false)}
              className="mt-3 items-center rounded-lg bg-white/5 py-3">
              <Text className="text-sm font-medium text-white">Close</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
