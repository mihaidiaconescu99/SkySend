// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useMapCenterSelectionController } from "@/components/delivery/mobile/map-tap-controller";
import type { MapViewport } from "@/types/map";

const firstViewport: MapViewport = {
  center: { latitude: 44.8565, longitude: 24.8692 },
  zoom: 15,
};

const secondViewport: MapViewport = {
  center: { latitude: 44.8581, longitude: 24.8714 },
  zoom: 16,
};

describe("useMapCenterSelectionController", () => {
  it("does not resolve an address while placement mode is inactive", async () => {
    const onResolve = vi.fn().mockResolvedValue(true);
    const { result } = renderHook(() =>
      useMapCenterSelectionController({ onResolve }),
    );

    await act(async () => {
      await result.current.handleViewportSettled(firstViewport);
    });

    expect(onResolve).not.toHaveBeenCalled();
  });

  it("updates the selected address field and toggles the active pin off", async () => {
    const onResolve = vi.fn().mockResolvedValue(true);
    const { result } = renderHook(() =>
      useMapCenterSelectionController({ onResolve }),
    );

    act(() => result.current.toggleField("pickup"));
    await act(async () => {
      await result.current.handleViewportSettled(firstViewport);
    });

    expect(onResolve).toHaveBeenCalledWith(
      "pickup",
      firstViewport,
      expect.any(AbortSignal),
    );
    expect(result.current.feedback).toContain("ridicare");

    act(() => result.current.toggleField("pickup"));
    expect(result.current.activeField).toBeNull();
  });

  it("switches directly from pickup to dropoff", async () => {
    const onResolve = vi.fn().mockResolvedValue(true);
    const { result } = renderHook(() =>
      useMapCenterSelectionController({ onResolve }),
    );

    act(() => result.current.toggleField("pickup"));
    act(() => result.current.toggleField("dropoff"));
    await act(async () => {
      await result.current.handleViewportSettled(secondViewport);
    });

    expect(onResolve).toHaveBeenCalledWith(
      "dropoff",
      secondViewport,
      expect.any(AbortSignal),
    );
  });

  it("aborts an older reverse-geocoding request when the map moves again", async () => {
    const requests: Array<{
      signal: AbortSignal;
      resolve: (value: boolean) => void;
    }> = [];
    const onResolve = vi.fn(
      (_field, _viewport, signal: AbortSignal) =>
        new Promise<boolean>((resolve) => requests.push({ signal, resolve })),
    );
    const { result } = renderHook(() =>
      useMapCenterSelectionController({ onResolve }),
    );

    act(() => result.current.toggleField("pickup"));
    act(() => {
      void result.current.handleViewportSettled(firstViewport);
    });
    act(() => {
      void result.current.handleViewportSettled(secondViewport);
    });

    expect(requests).toHaveLength(2);
    expect(requests[0]?.signal.aborted).toBe(true);
    expect(requests[1]?.signal.aborted).toBe(false);

    await act(async () => {
      requests[0]?.resolve(true);
      requests[1]?.resolve(true);
      await Promise.resolve();
    });

    expect(result.current.feedback).toContain("actualizată");
  });

  it("shows a non-blocking message when the center cannot be resolved", async () => {
    const onResolve = vi.fn().mockResolvedValue(false);
    const { result } = renderHook(() =>
      useMapCenterSelectionController({ onResolve }),
    );

    act(() => result.current.toggleField("dropoff"));
    await act(async () => {
      await result.current.handleViewportSettled(firstViewport);
    });

    expect(result.current.activeField).toBe("dropoff");
    expect(result.current.feedback).toContain("adresă sigură");
  });
});
