"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export function useCurrentRoute() {
  const pathname = usePathname();
  const [hash, setHash] = useState("");

  useEffect(() => {
    const syncHash = () => {
      setHash(window.location.hash);
    };

    syncHash();
    window.addEventListener("hashchange", syncHash);

    return () => {
      window.removeEventListener("hashchange", syncHash);
    };
  }, [pathname]);

  return `${pathname}${hash}`;
}
