import Track from "./structures/Track";
import { Player } from "./structures/Player";

export interface LavalinkResponse {
  tracks: Track[];
  loadType: string;
  playlistInfo: string;
}

export interface TrackOptions {
  track: string;
  info: {
    title: string;
    identifier: string;
    author: string;
    length: number;
    isSeekable: boolean;
    isStream: boolean;
    uri: string;
  };
}

export interface StatsTypes {
  id?: string;
  host: string;
  connected: boolean;
  stats: {
    cpu: {
      systemLoad: number;
      cores: number;
    };
  };
}

export interface VoiceStateUpdate {
  user_id: string;
  channel_id: string;
  guild_id: string;
}

export interface VoiceChannelStruct {
  guild: {
    id: string;
  };
  textChannel: string | object;
  voiceChannel?: {
    id: string;
  };
  selfMute?: boolean;
  selfDeaf?: boolean;
}

export interface PlayerOptions {
  startTime?: number;
  volume?: number;
  noReplace?: boolean;
  pause?: boolean;
}

export interface NodeOptions {
  id?: string;
  host: string;
  port: number;
  password: string;
  secure?: boolean;
  resumeKey: string | null;
  resumeTimeout?: number;
  retryAmount?: number;
  retryDelay?: number;
}

export interface LavaLinkOptions {
  type: string;
  reason: string;
  code: number;
  guildId: string;
}

export interface RoutePlannerReponse {
  class: string;
  details: {
    ipBlock: {
      type: string;
      size: string;
    };
    failingAddresses: [
      {
        address: string;
        failingTimpestamp: number;
        failingTime: string;
      }
    ];
    blockIndex: string;
    currentAddressIndex: string;
  };
}

export interface ManagerOptions {
  send?: Function;
  player?: Player;
}
