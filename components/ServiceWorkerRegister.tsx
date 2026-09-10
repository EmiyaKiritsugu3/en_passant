"use client";

import { useEffect } from "react";

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      if (process.env.NODE_ENV === "development" || window.location.hostname === "localhost") {
        navigator.serviceWorker
          .getRegistrations()
          .then((registrations) => {
            void Promise.allSettled(registrations.map((reg) => reg.unregister()));
          })
          .catch(() => {});
        if ("caches" in window) {
          caches
            .keys()
            .then((keys) => {
              void Promise.allSettled(keys.map((key) => caches.delete(key)));
            })
            .catch(() => {});
        }
      } else {
        navigator.serviceWorker.register("/sw.js").catch(() => {});
      }
    }
  }, []);

  return null;
}
