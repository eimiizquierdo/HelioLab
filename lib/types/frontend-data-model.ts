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
import { Reference, Timestamp, Url, UtcOffset } from "./utility-types";

export type FrontendUser = Omit<User, "hashed_password">;

export type ChatAsPost = {
    chat: Reference;
    creation_date: Date;
    creator: {
        name: string;
        last_name: string;
        degree: string;
        timezone: UtcOffset;
        profile_picture: Url;
    };
    first_comment_text: string;
    commenters: Reference[];
    followers: Reference[];
    readings: Reading[];
    prototype_name: string;
};

export type ChatAsHighlight = {
    chat: Reference;
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
    creation_time: Timestamp;
    is_myself: boolean;
};

export type PrototypeData = {
    prototype: Reference;
    cursor: Timestamp;

    /**
     * Represents the number of hours of the time window
     */
    time_window: number;
    readings: Reading[];
    highlights: ChatAsHighlight[];
};

export type FrontendPrototype = {
    id: Reference;
    label: string;
    owner: {
        name: string;
        full_name: string;
        profile_picture: Url;
    };
    data: {
        /** The latest time that the cursor can reach */
        window_upper_bound: Timestamp;
        /** The earliest time that the cursor can reach */
        window_lower_bound: Timestamp;
        cursor: Timestamp;
        cursor_updates_automatically: boolean;

        time_window: number;
        readings: Reading[];
        highlights: ChatAsHighlight[];
    };
};

export type UserFeed = {
    chats: ChatAsPost[];
    last_chat_seen: Timestamp;
};
