"use client";

import { useEffect } from "react";

export function BCAutoLoanFavicon() {
  useEffect(() => {
    const existing = document.querySelectorAll<HTMLLinkElement>(
      'link[rel="icon"], link[rel="shortcut icon"]'
    );

    existing.forEach((link) => {
      link.remove();
    });

    const icon = document.createElement("link");
    icon.rel = "icon";
    icon.type = "image/png";
    icon.href = "/bcautoloan/icon.png";

    document.head.appendChild(icon);

    const shortcut = document.createElement("link");
    shortcut.rel = "shortcut icon";
    shortcut.type = "image/png";
    shortcut.href = "/bcautoloan/icon.png";

    document.head.appendChild(shortcut);

    return () => {
      icon.remove();
      shortcut.remove();
    };
  }, []);

  return null;
}
