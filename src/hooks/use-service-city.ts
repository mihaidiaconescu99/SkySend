"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@clerk/nextjs";

import { OperationalSettingsRepository } from "@/lib/repositories/operational-settings-repository";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { useCurrentProfile } from "@/lib/profile-context/profile-context";

export type ServiceCityId = "pitesti" | "bucuresti";

export type ServiceCity = {
  id: ServiceCityId;
  label: string;
  hubStatus: "active" | "unavailable";
};

export const serviceCities: readonly ServiceCity[] = [
  { id: "pitesti", label: "Pitești", hubStatus: "active" },
  { id: "bucuresti", label: "București", hubStatus: "unavailable" },
] as const;

export const PITESTI_HUB_COORDS = {
  latitude: 44.8565,
  longitude: 24.8692,
  radiusKm: 6,
} as const;

const FALLBACK_PITESTI: ServiceCity = {
  id: "pitesti",
  label: "Pitești",
  hubStatus: "active",
};

const FALLBACK_CITIES: readonly ServiceCity[] = [
  FALLBACK_PITESTI,
  { id: "bucuresti", label: "București", hubStatus: "unavailable" },
];

const SELECTED_SERVICE_CITY_STORAGE_KEY = "skysend:selected-service-city";
const SERVICE_CITY_CHANGED_EVENT = "skysend:service-city-changed";

function resolveServiceCity(
  cities: readonly ServiceCity[],
  cityId: ServiceCityId | null,
) {
  return cities.find((city) => city.id === cityId) ?? FALLBACK_PITESTI;
}

function readStoredServiceCityId(): ServiceCityId | null {
  if (typeof window === "undefined") {
    return null;
  }

  const storedCityId = window.localStorage.getItem(SELECTED_SERVICE_CITY_STORAGE_KEY);
  return storedCityId === "pitesti" || storedCityId === "bucuresti"
    ? storedCityId
    : null;
}

export function useServiceCity(): {
  selectedCity: ServiceCity;
  setSelectedCity: (cityId: ServiceCityId) => void;
  serviceCities: readonly ServiceCity[];
} {
  const { getToken } = useAuth();
  const { state } = useCurrentProfile();

  const profileId =
    state.status === "authenticated" ? state.profile.id : null;

  const repo = useMemo<OperationalSettingsRepository | null>(() => {
    if (!profileId) return null;
    const supabase = createBrowserSupabaseClient({
      getAccessToken: () => getToken(),
    });
    return new OperationalSettingsRepository(supabase);
  }, [profileId, getToken]);

  const [selectedCity, setSelectedCityState] = useState<ServiceCity>(() =>
    resolveServiceCity(FALLBACK_CITIES, readStoredServiceCityId()),
  );
  const [dynamicCities, setDynamicCities] =
    useState<readonly ServiceCity[]>(FALLBACK_CITIES);

  useEffect(() => {
    if (!repo) return;

    let cancelled = false;

    repo
      .getCurrent()
      .then((result) => {
        if (cancelled) return;

        if (!result.ok) {
          console.warn(
            "[useServiceCity] getCurrent failed, using fallback:",
            result.error.message,
          );
          return;
        }

        const hubStatus: ServiceCity["hubStatus"] = result.data.isActive
          ? "active"
          : "unavailable";

        const pitesti: ServiceCity = {
          id: "pitesti",
          label: "Pitești",
          hubStatus,
        };

        const nextCities = [
          pitesti,
          { id: "bucuresti", label: "București", hubStatus: "unavailable" },
        ] as const;

        setDynamicCities(nextCities);
        setSelectedCityState((currentCity) =>
          resolveServiceCity(nextCities, readStoredServiceCityId() ?? currentCity.id),
        );
      })
      .catch((err) => {
        if (!cancelled) {
          console.warn("[useServiceCity] Unexpected error, using fallback:", err);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [repo]);

  const setSelectedCity = useCallback((cityId: ServiceCityId) => {
    window.localStorage.setItem(SELECTED_SERVICE_CITY_STORAGE_KEY, cityId);
    setSelectedCityState(resolveServiceCity(dynamicCities, cityId));
    window.dispatchEvent(
      new CustomEvent(SERVICE_CITY_CHANGED_EVENT, { detail: { cityId } }),
    );
  }, [dynamicCities]);

  useEffect(() => {
    function syncSelectedCity() {
      setSelectedCityState(resolveServiceCity(dynamicCities, readStoredServiceCityId()));
    }

    window.addEventListener(SERVICE_CITY_CHANGED_EVENT, syncSelectedCity);
    window.addEventListener("storage", syncSelectedCity);

    return () => {
      window.removeEventListener(SERVICE_CITY_CHANGED_EVENT, syncSelectedCity);
      window.removeEventListener("storage", syncSelectedCity);
    };
  }, [dynamicCities]);

  return {
    selectedCity,
    setSelectedCity,
    serviceCities: dynamicCities,
  };
}
