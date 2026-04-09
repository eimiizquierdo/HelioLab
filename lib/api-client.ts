/**
 * CONSIDERATIONS
 * 
 * All functions must take in as a parameter an object called `parameters`,
 * which shall include the minimum number of parameters to make the
 * corresponding request to the API endpoint
 * 
 */

import type {
  User,
  Prototype,
  Reading,
  Comment,
  Chat,
  FollowedChat,
  Notification,
  Connection,
} from "./types/backend-types";
import type { ChatAsHighlight, ChatAsPost, UserLocal } from "./types/frontend-types";

export function apiEndpoint(route: string): string | URL {
  const host = process.env["HOST"];
  
  // Client-side: HOST not available, return route as-is
  if (!host) {
    return route;
  }
  
  // Server-side: Construct full URL
  console.log({ host, route });
  return new URL(route, host);
}

// ── Read operations ────────────────────────────────────────────────

export async function getCurrentUser(parameters: {}): Promise<UserLocal | null> {
  try {
    const response = await fetch(apiEndpoint("/api/get_current_user"), {
      method: "POST",
      credentials: "include",
    });

    if (!response.ok) return null;

    return await response.json() as UserLocal;
  } catch {
    return null;
  }
}

export async function getAllPrototypesData(startTime?: Date, endTime?: Date): Promise<PrototypeData[]> {
  const body: any = {};
  if (startTime) body.start_time = startTime.toISOString();
  if (endTime) body.end_time = endTime.toISOString();

  const response = await fetch(apiEndpoint("/api/prototypes/get_all_data"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`getAllPrototypesData failed: ${response.status}`);
  }

  const data = await response.json();
  return data.prototypes as PrototypeData[];
}

export async function getReadings(parameters: {
  prototypeId: string;
  latestDate?: string;
  startTime?: Date;
  endTime?: Date;
}): Promise<(Omit<Reading, "date"> & { date: string })[]> {
  const body: any = {
    latest_date: parameters.latestDate,
  };
  if (parameters.startTime) body.start_time = parameters.startTime.toISOString();
  if (parameters.endTime) body.end_time = parameters.endTime.toISOString();

  const response = await fetch(
    apiEndpoint(`/api/prototype/${parameters.prototypeId}/get_latest_data`),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );

  if (!response.ok)
    throw new Error(`Failed to fetch readings: ${response.status}`);
  return response.json().then(function(object) {
    return object.readings;
  });
}

export async function getComments(prototypeId?: string): Promise<Comment[]> {
  return [];
}

// ── Write operations ───────────────────────────────────────────────

export async function addConnection(
  conn: Omit<Connection, "id">,
): Promise<Connection> {
  // const newConn: Connection = {
  //   ...conn,
  //   id: `cn${Date.now()}`,
  // };
  // connections = [...connections, newConn];
  // return newConn;
  return {
    id: "",
    link: "",
    owner: "",
    icon: "",
    name: ""
  };
}

export async function getConnections(researcher: string): Promise<Connection[]> {
  return [];
}

export async function removeConnection(connId: string): Promise<void> {
  // connections = connections.filter((c) => c.id !== connId);
}

export async function unfollowChat(
  userId: string,
  chatId: string,
): Promise<void> {
  // followedChats = followedChats.filter(
  //   (fc) => !(fc.owner === userId && fc.chat === chatId),
  // );
}

export async function markAllNotificationsRead(): Promise<void> {
  // notifications = notifications.map((n) => ({ ...n, has_been_read: true }));
}

export async function authenticateUser(parameters: {
  email: string;
  password: string;
}): Promise<UserLocal | null> {
  const response = await fetch(apiEndpoint("/api/login"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(parameters),
  });

  if (!response.ok) return null;
  return response.json();
}

export async function addChatMessage(parameters: {
  userId: string;
  chatId: string;
  comment: string;
}): Promise<Comment> {
  const response = await fetch(
    apiEndpoint(`/api/researcher/${parameters.userId}/comment_in_chat`),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat: parameters.chatId,
        comment: parameters.comment,
      }),
    },
  );

  if (!response.ok)
    throw new Error(`Failed to add message: ${response.status}`);
  return response.json();
}

export async function followChat(parameters: {
  userId: string;
  chatId: string;
  name: string;
}): Promise<FollowedChat> {
  const response = await fetch(
    apiEndpoint(`/api/researcher/${parameters.userId}/follow_chat`),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat: parameters.chatId,
        name: parameters.name,
      }),
    },
  );

  if (!response.ok)
    throw new Error(`Failed to follow chat: ${response.status}`);
  return response.json();
}

export async function markNotificationRead(parameters: {
  userId: string;
  notificationId: string;
}): Promise<void> {
  const response = await fetch(
    apiEndpoint(`/api/researcher/${parameters.userId}/read_notification`),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notification: parameters.notificationId }),
    },
  );

  if (!response.ok)
    throw new Error(`Failed to mark notification: ${response.status}`);
}

export async function getNotifications(parameters: {
  userId: string;
}): Promise<Notification[]> {
  const response = await fetch(
    apiEndpoint(`/api/researcher/${parameters.userId}/get_notifications`),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    },
  );

  if (!response.ok)
    throw new Error(`Failed to fetch notifications: ${response.status}`);
  return response.json().then(function(object) {
    return object.notifications;
  });
}

export async function getFollowedChats(parameters: {
  userId: string;
}): Promise<FollowedChat[]> {
  const response = await fetch(
    apiEndpoint(`/api/researcher/${parameters.userId}/get_followed_chats`),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    },
  );

  if (!response.ok)
    throw new Error(`Failed to fetch followed chats: ${response.status}`);
  const data = await response.json();
  return data.followed_chats as FollowedChat[];
}

export async function updateUserProfile(parameters: {
  userId: string;
  name?: string;
  last_name?: string;
  degree?: string;
  timezone?: string;
}): Promise<User | null> {
  const { userId, ...body } = parameters;
  const response = await fetch(apiEndpoint(`/api/researcher/${userId}/update_profile_data`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok)
    throw new Error(`Failed to update profile: ${response.status}`);
  return response.json();
}

export async function addComment(parameters: {
  userId: string;
  prototypeId: string;
  startDate: string;
  endDate: string;
  comment: string;
}): Promise<Comment> {
  const response = await fetch(
    apiEndpoint(`/api/researcher/${parameters.userId}/comment_outside_chat`),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prototype: parameters.prototypeId,
        start_date: parameters.startDate,
        end_date: parameters.endDate,
        comment: parameters.comment,
      }),
    },
  );

  if (!response.ok)
    throw new Error(`Failed to add comment: ${response.status}`);
  return response.json();
}

export async function getFeed(parameters: {
  researcherId: string,
  latestChatId?: string
}): Promise<ChatAsPost[]> {
  const { researcherId, latestChatId } = parameters;

  const res = await fetch(apiEndpoint(`/api/researcher/${researcherId}/get_feed`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ latest_chat_id: latestChatId ?? null }),
  });

  if (!res.ok) {
    throw new Error(`getFeed failed: ${res.status}`);
  }

  const data = await res.json();
  return data.chats.map((c: any) => ({
    ...c,
    creation_date: new Date(c.creation_date),
    readings: c.readings.map((r: any) => ({
      ...r,
      date: new Date(r.date),
    })),
  })) as ChatAsPost[];
}

export async function getHighlights(parameters: {
  prototypeId: string
  latestDate?: Date
}): Promise<ChatAsHighlight[]> {
  const res = await fetch(apiEndpoint(`/api/prototype/${parameters.prototypeId}/get_highlights`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ latest_date: parameters.latestDate?.toISOString() ?? null }),
  })

  if (!res.ok) {
    throw new Error(`getHighlights failed: ${res.status}`)
  }

  const data = await res.json()
  return data.highlights.map((h: any) => ({
    ...h,
    start_date: new Date(h.start_date),
    end_date: new Date(h.end_date),
  })) as ChatAsHighlight[]
}