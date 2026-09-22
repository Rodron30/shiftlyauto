// lib/notifications.ts
//
// Server-side notification service for creating and managing notifications.
// All notification creation should go through these helpers to ensure
// consistent behavior and proper dealership/user scoping.

import { createSupabaseServerClient } from "./supabaseServer";

export type NotificationType = "INFO" | "SUCCESS" | "WARNING" | "ERROR";
export type NotificationCategory = "VEHICLE" | "REPORT" | "CRM" | "INTEGRATION" | "SYSTEM" | "SAAS";

export interface CreateNotificationOptions {
  dealershipId: string;
  userId?: string | null; // null = dealership-wide notification
  type: NotificationType;
  category: NotificationCategory;
  title: string;
  message: string;
  targetUrl?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * Create a single notification.
 */
export async function createNotification(options: CreateNotificationOptions) {
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.from("notifications").insert({
    dealership_id: options.dealershipId,
    user_id: options.userId || null,
    type: options.type,
    category: options.category,
    title: options.title,
    message: options.message,
    target_url: options.targetUrl || null,
    metadata: options.metadata || {},
  });

  if (error) {
    console.error("Failed to create notification:", error);
    // Notifications are non-critical — we log but don't throw
  }
}

/**
 * Create multiple notifications in a single batch.
 */
export async function createNotifications(options: CreateNotificationOptions[]) {
  if (options.length === 0) return;

  const supabase = await createSupabaseServerClient();

  const notifications = options.map((opt) => ({
    dealership_id: opt.dealershipId,
    user_id: opt.userId || null,
    type: opt.type,
    category: opt.category,
    title: opt.title,
    message: opt.message,
    target_url: opt.targetUrl || null,
    metadata: opt.metadata || {},
  }));

  const { error } = await supabase.from("notifications").insert(notifications);

  if (error) {
    console.error("Failed to create notifications:", error);
  }
}

/**
 * Mark a specific notification as read.
 */
export async function markNotificationRead(notificationId: string) {
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId);

  if (error) {
    console.error("Failed to mark notification as read:", error);
    throw error;
  }
}

/**
 * Mark all notifications for the current user/dealership as read.
 * If userId is provided, marks only user-specific notifications.
 * Otherwise, marks all dealership-wide notifications.
 */
export async function markAllNotificationsRead(userId?: string) {
  const supabase = await createSupabaseServerClient();

  let query = supabase.from("notifications").update({ read_at: new Date().toISOString() });

  if (userId) {
    query = query.eq("user_id", userId);
  } else {
    query = query.is("user_id", null);
  }

  const { error } = await query.is("read_at", null);

  if (error) {
    console.error("Failed to mark all notifications as read:", error);
    throw error;
  }
}

/**
 * Get unread notification count for the current user/dealership.
 */
export async function getUnreadNotificationCount(userId?: string): Promise<number> {
  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .is("read_at", null);

  if (userId) {
    query = query.eq("user_id", userId);
  } else {
    query = query.is("user_id", null);
  }

  const { count, error } = await query;

  if (error) {
    console.error("Failed to get unread notification count:", error);
    return 0;
  }

  return count || 0;
}
