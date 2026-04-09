// BACKEND-TYPES
// The following definitions describe the data structures
// stored in the database; by no means do they restrict
// the shape of the data that the frontend handles internally
// nor the data that the backend feeds the frontend with through
// the API
// Version: 5

// ─────────────────────────────────────────────
// Namespace: Machine
// ─────────────────────────────────────────────

export interface Reading {
  id: Id;
  date: Timestamp;
  current: number;
  voltage: number;
  irradiance: number;
}

export interface Prototype {
  id: Id;
  location: GeoPoint;
  name: string;
  code: string;
  readings: Reading[];
  owner: Reference;
}

// ─────────────────────────────────────────────
// Namespace: Chatting
// ─────────────────────────────────────────────

export interface Mention {
  // Extend with mention-specific fields as needed
  [key: string]: unknown;
}

export interface Chat {
  id: Id;
  creation_date: Timestamp;
  last_message_time: Timestamp;
  creator: Reference;
  first_comment: Reference;
  readings?: Reading[];
  commenters: Reference[];
  followers: Reference[];
}

export interface Comment {
  id: Id;
  chat: Reference;
  full_name: string;
  creation_date: Timestamp;
  author: Reference;
  degree: string;
  text: string;
  mentions?: Mention[];
  highlight_start?: Timestamp;
  highlight_end?: Timestamp;
}

// ─────────────────────────────────────────────
// Namespace: PersonalInteraction
// ─────────────────────────────────────────────

export interface User {
  id: Id;
  name: string;
  last_name: string;
  hashed_password: string;
  role: string;
  email: string;
  degree: string;
  profile_picture: string;
  last_chat_seen_time: Timestamp;
  last_interaction_time: Timestamp;
  timezone: string;
}

export interface Admin {
  id: Id;
  name: string;
  last_name: string;
  hashed_password: string;
  role: string;
}

export interface FollowedChat {
  id: Id;
  creation_date: Timestamp;
  index: number;
  owner: Reference;
  chat: Reference;
  last_message_seen_time: Reference;
  silenced: boolean;
  name: string;
}

export interface Notification {
  id: Id;
  type: string;
  has_been_read: boolean;
  followed_chat?: Reference;
  user: Reference;
  creation_date: Timestamp;
}

export interface Connection {
    id: Id;
    owner: Reference;
    link: string;
    icon: string;
    name: string;
}
