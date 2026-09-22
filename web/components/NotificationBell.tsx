"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BellIcon } from "./icons";
import { Button } from "./ui/Button";
import { Badge } from "./ui/Badge";
import { Card } from "./ui/Card";

type Notification = {
  id: string;
  type: "INFO" | "SUCCESS" | "WARNING" | "ERROR";
  category: string;
  title: string;
  message: string;
  target_url: string | null;
  metadata: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
};

const TYPE_COLORS: Record<string, string> = {
  INFO: "bg-blue-100 text-blue-700",
  SUCCESS: "bg-green-100 text-green-700",
  WARNING: "bg-amber-100 text-amber-700",
  ERROR: "bg-red-100 text-red-700",
};

const CATEGORY_LABELS: Record<string, string> = {
  VEHICLE: "Vehicle",
  REPORT: "Report",
  CRM: "CRM",
  INTEGRATION: "Integration",
  SYSTEM: "System",
  SAAS: "SaaS",
};

export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [error, setError] = useState("");
  const panelRef = useRef<HTMLDivElement>(null);

  // Close panel when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  // Load notifications when panel opens
  useEffect(() => {
    if (open) {
      loadNotifications();
    }
  }, [open]);

  // Load unread count periodically
  useEffect(() => {
    loadUnreadCount();

    const interval = setInterval(loadUnreadCount, 30000); // Every 30 seconds

    return () => clearInterval(interval);
  }, []);

  const loadNotifications = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch("/api/notifications?limit=20");

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to load notifications");
      }

      setNotifications(result.notifications || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load notifications");
    } finally {
      setLoading(false);
    }
  };

  const loadUnreadCount = async () => {
    try {
      const response = await fetch("/api/notifications/unread-count");

      const result = await response.json();

      if (response.ok && result.success) {
        setUnreadCount(result.count || 0);
      }
    } catch {
      // Silent failure for unread count
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      const response = await fetch(`/api/notifications/${notificationId}`, {
        method: "PATCH",
      });

      if (response.ok) {
        setNotifications((prev) =>
          prev.filter((n) => n.id !== notificationId)
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch {
      // Silent failure
    }
  };

  const markAllAsRead = async () => {
    try {
      const response = await fetch("/api/notifications/mark-all-read", {
        method: "POST",
      });

      if (response.ok) {
        setNotifications([]);
        setUnreadCount(0);
      }
    } catch {
      // Silent failure
    }
  };


  const handleNotificationClick = (notification: Notification) => {
    markAsRead(notification.id);

    if (notification.target_url) {
      router.push(notification.target_url);
      setOpen(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label="Notifications"
        title="Notifications"
        className="relative rounded-md p-2 text-neutral-400 transition-colors hover:bg-white/[0.06] hover:text-white"
      >
        <BellIcon className="h-5 w-5" />

        {unreadCount > 0 && (
          <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[10px] font-semibold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-label="Close notifications"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 cursor-default"
          />

          <Card className="absolute right-0 z-50 mt-2 w-80 max-h-[500px] overflow-hidden border border-neutral-200 bg-white shadow-xl">
            <div className="border-b border-neutral-200 p-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-neutral-900">Notifications</h3>

                {unreadCount > 0 && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={markAllAsRead}
                    className="!border-gray-300 !bg-white !text-gray-700 hover:!bg-gray-50 text-[10px]"
                  >
                    Mark all read
                  </Button>
                )}
              </div>
            </div>

            <div className="overflow-y-auto max-h-[400px]">
              {loading ? (
                <div className="p-4 text-center">
                  <p className="text-xs text-neutral-500">Loading...</p>
                </div>
              ) : error ? (
                <div className="p-4 text-center">
                  <p className="text-xs text-red-400">{error}</p>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={loadNotifications}
                    className="mt-2"
                  >
                    Retry
                  </Button>
                </div>
              ) : notifications.length === 0 ? (
                <div className="p-6 text-center">
                  <p className="text-xs text-neutral-500">No notifications</p>
                </div>
              ) : (
                <div className="divide-y divide-neutral-100">
                  {notifications.map((notification) => (
                    <div
                      onClick={() => handleNotificationClick(notification)}
                      role="button"
                      tabIndex={0}
                      key={notification.id}
                      className={`cursor-pointer p-3 transition-colors hover:bg-white/[0.08] ${
                        !notification.read_at ? "bg-neutral-50" : ""
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge
                              variant="secondary"
                              className={`text-[10px] ${TYPE_COLORS[notification.type] || TYPE_COLORS.INFO}`}
                            >
                              {CATEGORY_LABELS[notification.category] || notification.category}
                            </Badge>

                            {!notification.read_at && (
                              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                            )}
                          </div>

                          <p className="text-xs font-medium text-neutral-900 truncate">
                            {notification.title}
                          </p>

                          <p className="mt-0.5 text-[10px] text-neutral-600 line-clamp-2">
                            {notification.message}
                          </p>

                          <p className="mt-1 text-[10px] text-neutral-400">
                            {formatDate(notification.created_at)}
                          </p>
                        </div>

                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
