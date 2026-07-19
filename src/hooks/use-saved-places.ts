"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@clerk/nextjs";

import { AddressesRepository } from "@/lib/repositories/addresses-repository";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { useCurrentProfile } from "@/lib/profile-context/profile-context";
import type { Address } from "@/types/address";
import type { SavedPlace, SavedPlaceInput } from "@/types/saved-places";

function addressToSavedPlace(address: Address): SavedPlace {
  return {
    id: address.id,
    label: address.label ?? address.formattedAddress,
    address: address.formattedAddress,
    coordinates: {
      latitude: address.latitude,
      longitude: address.longitude,
    },
    notes: "",
    category: "custom",
    preferredMeetingPoint: null,
    createdAt: address.createdAt,
    updatedAt: address.lastUsedAt,
    lastUsedAt: address.lastUsedAt,
  };
}

export function useSavedPlaces(): {
  savedPlaces: SavedPlace[];
  savePlace: (
    input: SavedPlaceInput,
    existingId?: string,
  ) => Promise<SavedPlace | null>;
  deleteSavedPlace: (placeId: string) => Promise<void>;
} {
  const { getToken } = useAuth();
  const { state } = useCurrentProfile();
  const profileId = state.status === "authenticated" ? state.profile.id : null;
  const repo = useMemo<AddressesRepository | null>(() => {
    if (!profileId) return null;
    const supabase = createBrowserSupabaseClient({
      getAccessToken: () => getToken(),
    });
    return new AddressesRepository(supabase);
  }, [profileId, getToken]);
  const [savedPlaces, setSavedPlaces] = useState<SavedPlace[]>([]);

  const refresh = useCallback(async () => {
    if (!repo || !profileId) {
      setSavedPlaces([]);
      return;
    }

    const result = await repo.listByProfileId(profileId, { savedOnly: true });

    if (!result.ok) {
      console.warn("[useSavedPlaces] Supabase read failed:", result.error.message);
      setSavedPlaces([]);
      return;
    }

    setSavedPlaces(
      result.data
        .map(addressToSavedPlace)
        .sort((a, b) => a.label.localeCompare(b.label)),
    );
  }, [repo, profileId]);

  useEffect(() => {
    void Promise.resolve().then(() => refresh());
  }, [refresh]);

  const savePlace = useCallback(
    async (
      input: SavedPlaceInput,
      existingId?: string,
    ): Promise<SavedPlace | null> => {
      if (!repo || !profileId) return null;

      if (existingId) {
        const updated = await repo.updateById(existingId, {
          label: input.label.trim() || null,
          formattedAddress: input.address.trim(),
          latitude: input.coordinates.latitude,
          longitude: input.coordinates.longitude,
          isSaved: true,
        });

        if (!updated.ok) {
          console.warn("[useSavedPlaces] update failed:", updated.error.message);
          return null;
        }

        await refresh();
        return addressToSavedPlace(updated.data);
      }

      const nearby = await repo.findByCoordinates(
        input.coordinates.latitude,
        input.coordinates.longitude,
        profileId,
      );

      if (nearby.ok && nearby.data) {
        const toggled = await repo.toggleSaved(nearby.data.id, true);
        if (!toggled.ok) {
          console.warn("[useSavedPlaces] save existing failed:", toggled.error.message);
          return null;
        }

        const relabeled = await repo.updateById(nearby.data.id, {
          label: input.label.trim() || null,
        });
        await refresh();
        return addressToSavedPlace(relabeled.ok ? relabeled.data : toggled.data);
      }

      const created = await repo.create({
        profileId,
        formattedAddress: input.address.trim(),
        label: input.label.trim() || null,
        latitude: input.coordinates.latitude,
        longitude: input.coordinates.longitude,
        isSaved: true,
      });

      if (!created.ok) {
        console.warn("[useSavedPlaces] create failed:", created.error.message);
        return null;
      }

      await refresh();
      return addressToSavedPlace(created.data);
    },
    [repo, profileId, refresh],
  );

  const deleteSavedPlace = useCallback(
    async (placeId: string) => {
      if (!repo) return;
      const result = await repo.toggleSaved(placeId, false);
      if (!result.ok) {
        console.warn("[useSavedPlaces] delete failed:", result.error.message);
      }
      await refresh();
    },
    [repo, refresh],
  );

  return { savedPlaces, savePlace, deleteSavedPlace };
}
