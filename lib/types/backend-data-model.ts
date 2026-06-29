/**
 * BACKEND DATA MODEL
 * Version: 5 (2026.04.08)
 * 
 * ::Description::
 * The following definitions describe the data structures
 * stored in the database; by no means do they restrict
 * the shape of the data that the frontend handles internally
 * nor the data that the backend feeds the frontend with through
 * the API
 */

import { Id, UtilityTimestamp, UtilityGeoPoint, UtilityReference } from "./utility-types";

// ─────────────────────────────────────────────
// Namespace: Machine
// ─────────────────────────────────────────────

export interface Reading {
  id: Id;
  date: UtilityTimestamp;
  current: number;
  voltage: number;
  irradiance: number;
}

export interface Prototype {
  id: Id;
  location: UtilityGeoPoint;
  label: string;
  code: string;
  readings: Reading[];
  owner: UtilityReference;
  lat: number;
  lon: number;
  timezone: number;
  beta: number;
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
  creation_date: UtilityTimestamp;
  last_message_time: UtilityTimestamp;
  creator: UtilityReference;
  first_comment: UtilityReference;
  readings?: Reading[];
  commenters: UtilityReference[];
  followers: UtilityReference[];
  prototype: UtilityReference;
}

export interface Comment {
  id: Id;
  chat: UtilityReference;
  full_name: string;
  creation_date: UtilityTimestamp;
  author: UtilityReference;
  degree: string;
  text: string;
  mentions?: Mention[];
  highlight_start?: UtilityTimestamp;
  highlight_end?: UtilityTimestamp;
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
  last_chat_seen_time: UtilityTimestamp;
  last_interaction_time: UtilityTimestamp;
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
  creation_date: UtilityTimestamp;
  index: number;
  owner: UtilityReference;
  chat: UtilityReference;
  last_message_seen_time: UtilityReference;
  silenced: boolean;
  name: string;
}

export interface Notification {
  id: Id;
  type: string;
  has_been_read: boolean;
  followed_chat?: UtilityReference;
  user: UtilityReference;
  creation_date: UtilityTimestamp;
}

export interface Connection {
    id: Id;
    owner: UtilityReference;
    link: string;
    icon: string;
    name: string;
}