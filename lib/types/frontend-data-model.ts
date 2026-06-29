/** 
 * FRONTEND DATA MODEL
 * Version: 3.1
 * 
 * ::Description::
 * The following definitions describe data structures that
 * the frontend uses internally, as well as the shape
 * expected to be returned in API endpoints
 */

import { Reading, User } from "./backend-data-model";
import { UtilityReference, UtilityTimestamp, Url, UtcOffset } from "./utility-types";

export type FrontendUser = Omit<User, "hashed_password">;

export type ChatAsPost = {
    chat: UtilityReference;
    creation_date: Date;
    creator: {
        name: string;
        last_name: string;
        degree: string;
        timezone: UtcOffset;
        profile_picture: Url;
    };
    first_comment_text: string;
    commenters: UtilityReference[];
    followers: UtilityReference[];
    readings: Reading[];
    prototype_name: string;
};

export type ChatAsHighlight = {
    chat: UtilityReference;
    creator_profile_picture: Url;
    creator?: {
        name: string;
        profile_picture: Url;
    };
    start_date: Date;
    end_date: Date;
}

export type ChatAsMessage = {
    text: string;
    author: {
        full_name: string;
        degree: string;
        timezone: UtcOffset;
        profile_picture: Url;
    };
    creation_time: UtilityTimestamp;
    is_myself: boolean;
};

export type PrototypeData = {
    prototype: UtilityReference;
    cursor: UtilityTimestamp;

    /**
     * Represents the number of hours of the time window
     */
    time_window: number;
    readings: Reading[];
    highlights: ChatAsHighlight[];
};

export type FrontendPrototype = {
    id: UtilityReference;
    label: string;
    ownerId: UtilityReference;
    owner: {
        name: string;
        full_name: string;
        profile_picture: Url;
    };
    /** Configuracion solar del prototipo */
    solarConfig: {
        lat: number;
        lon: number;
        timezone: number;
        beta: number;
    };
    is_loading: boolean;

    data: {
        window_upper_bound: UtilityTimestamp;
        window_lower_bound: UtilityTimestamp;
        cursor: UtilityTimestamp;
        cursor_updates_automatically: boolean;

        time_window: number;
        readings: Reading[];
        highlights: ChatAsHighlight[];
    };
};

export type UserFeed = {
    chats: ChatAsPost[];
    last_chat_seen: UtilityTimestamp;
};