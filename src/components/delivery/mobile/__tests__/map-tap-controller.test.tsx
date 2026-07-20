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
  it("does not resolve an address while placement mode is inactive", () => {
    const onResolve = vi.fn().mockResolvedValue(true);
    const { result } = renderHook(() =>
      useMapCenterSelectionController({ onResolve }),
    );

    act(() => result.current.handleViewportSettled(firstViewport));

    expect(onResolve).not.toHaveBeenCalled();
  });

  it("waits for an explicit confirmation before updating the selected address", async () => {
    const onResolve = vi.fn().mockResolvedValue(true);
    const { result } = renderHook(() =>
      useMapCenterSelectionController({ onResolve }),
    );

    act(() => result.current.toggleField("pickup"));
    act(() => result.current.handleViewportSettled(firstViewport));

    expect(onResolve).not.toHaveBeenCalled();
    expect(result.current.canConfirm).toBe(true);
    expect(result.current.feedback).toContain("ridicare");

    await act(async () => {
      await result.current.confirmPendingViewport();
    });

    expect(onResolve).toHaveBeenCalledWith(
      "pickup",
      firstViewport,
      expect.any(AbortSignal),
    );
    expect(result.current.canConfirm).toBe(false);

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
    act(() => result.current.handleViewportSettled(secondViewport));
    await act(async () => {
      await result.current.confirmPendingViewport();
    });

    expect(onResolve).toHaveBeenCalledWith(
      "dropoff",
      secondViewport,
      expect.any(AbortSignal),
    );
  });

  it("uses only the latest map position when confirmation is requested", async () => {
    const onResolve = vi.fn().mockResolvedValue(true);
    const { result } = renderHook(() =>
      useMapCenterSelectionController({ onResolve }),
    );

    act(() => result.current.toggleField("pickup"));
    act(() => result.current.handleViewportSettled(firstViewport));
    act(() => result.current.handleViewportSettled(secondViewport));

    await act(async () => {
      await result.current.confirmPendingViewport();
    });

    expect(onResolve).toHaveBeenCalledTimes(1);
    expect(onResolve).toHaveBeenCalledWith(
      "pickup",
      secondViewport,
      expect.any(AbortSignal),
    );
  });

  it("shows a non-blocking message when the center cannot be resolved", async () => {
    const onResolve = vi.fn().mockResolvedValue(false);
    const { result } = renderHook(() =>
      useMapCenterSelectionController({ onResolve }),
    );

    act(() => result.current.toggleField("dropoff"));
    act(() => result.current.handleViewportSettled(firstViewport));
    await act(async () => {
      await result.current.confirmPendingViewport();
    });

    expect(result.current.activeField).toBe("dropoff");
    expect(result.current.feedback).toContain("adresă sigură");
  });
});
