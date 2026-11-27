"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
  INFO: "bg-gray-100 text-gray-700",
  SUCCESS: "bg-gray-100 text-gray-700",
  WARNING: "bg-gray-100 text-gray-700",
  ERROR: "bg-gray-100 text-gray-700",
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
  const loadNotifications = useCallback(async () => {
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
      setError(
        err instanceof Error ? err.message : "Failed to load notifications",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const loadUnreadCount = useCallback(async () => {
    try {
      const response = await fetch("/api/notifications/unread-count");
      const result = await response.json();

      if (response.ok && result.success) {
        setUnreadCount(result.count || 0);
      }
    } catch {
      // Silent failure for unread count
    }
  }, []);

  // Load notifications when panel opens
  useEffect(() => {
    if (!open) return;

    const task = queueMicrotask(() => {
      void loadNotifications();
    });

    return () => {
      void task;
    };
  }, [open, loadNotifications]);

  // Load unread count periodically
  useEffect(() => {
    const task = queueMicrotask(() => {
      void loadUnreadCount();
    });

    const interval = setInterval(() => {
      void loadUnreadCount();
    }, 30000);

    return () => {
      void task;
      clearInterval(interval);
    };
  }, [loadUnreadCount]);

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
        className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900"
      >
        <BellIcon className="h-6 w-6" />

        {unreadCount > 0 && (
          <span className="absolute right-0 top-0 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-gray-900 text-[9px] font-semibold text-white">
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

          <Card className="absolute right-0 top-full z-[60] mt-1.5 min-w-[260px] w-[calc(100vw-16px)] sm:w-72 max-h-[calc(100vh-64px)] overflow-hidden border border-gray-200 bg-white shadow-[0_4px_16px_0_rgba(0,0,0,0.08),0_0_0_1px_rgba(255,255,255,0.5)]">
            <div className="flex max-h-[calc(100vh-64px)] flex-col">
              <div className="shrink-0 border-b border-gray-200 p-2">
                <div className="flex min-w-0 items-center justify-between gap-2">
                  <h3 className="shrink-0 whitespace-nowrap text-[10px] font-semibold text-gray-900">Notifications</h3>

                  {unreadCount > 0 && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={markAllAsRead}
                      className="shrink-0 text-[10px]"
                    >
                      Mark all read
                    </Button>
                    )}
                  </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto">
                {loading ? (
                  <div className="p-3 text-center">
                    <p className="text-[10px] text-gray-500">Loading...</p>
                  </div>
                ) : error ? (
                  <div className="p-3 text-center">
                    <p className="text-[10px] text-gray-700">{error}</p>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={loadNotifications}
                      className="mt-2"
                    >
                      Retry
                    </Button>
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="p-4 text-center">
                    <p className="text-[10px] text-gray-500">No notifications</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {notifications.map((notification) => (
                      <div
                        onClick={() => handleNotificationClick(notification)}
                        role="button"
                        tabIndex={0}
                        key={notification.id}
                        className={`cursor-pointer p-2 transition-colors hover:bg-gray-50 ${
                          !notification.read_at ? "bg-gray-50" : ""
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <Badge
                                variant="subtle"
                                className={`text-[10px] ${TYPE_COLORS[notification.type] || TYPE_COLORS.INFO}`}
                              >
                                {CATEGORY_LABELS[notification.category] || notification.category}
                              </Badge>

                              {!notification.read_at && (
                                <span className="h-1 w-1 rounded-full bg-gray-900" />
                              )}
                            </div>

                            <p className="text-[10px] font-medium text-gray-900 truncate">
                              {notification.title}
                            </p>

                            <p className="mt-0.5 text-[10px] text-gray-600">
                              {notification.message}
                            </p>

                            <p className="mt-1 text-[10px] text-gray-400">
                              {formatDate(notification.created_at)}
                            </p>
                          </div>

                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}





