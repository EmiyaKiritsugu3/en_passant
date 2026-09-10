"use client";

import { useEffect } from "react";

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      if (process.env.NODE_ENV === "development" || window.location.hostname === "localhost") {
        navigator.serviceWorker.getRegistrations().then((registrations) => {
          for (const reg of registrations) {
            reg.unregister();
          }
        });
        if ("caches" in window) {
          caches.keys().then((keys) => {
            for (const key of keys) caches.delete(key);
          });
        }
      } else {
        navigator.serviceWorker.register("/sw.js").catch(() => {});
      }
    }
  }, []);

  return null;
}
