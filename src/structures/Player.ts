import { EventEmitter } from "events";
import { Manager } from "./Manager";
import { Node } from "./Node";
import { LavaLinkOptions, PlayerOptions, VoiceChannelStruct } from "../types";

/**
 * The Player class, this handles everything to do with the guild sides of things, like playing, stoping, pausing, resuming etc
 * @prop { Manager } manager - Manager class
 * @prop { Node } node - Node class
 * @prop { Guild } guildId - The guild for the player.
 * @prop { VoiceChannel } voiceChannel - The voice channel for the player.
 * @prop { TextChannel } textChannel - The text channel for the player.
 * @prop { state } state -
 * @prop { TrackRepeat } trackRepeat -
 * @prop { QueueRepeat } queueRepeat -
 * @prop { Playing } playing -
 * @prop { Paused } paused -
 * @prop { Track } track -
 * @prop { VoiceUpdateState } VoiceUpdateState -
 * @prop { Position } position -
 * @prop { Volume } volume -
 * @prop { Queue } queue -
 * @prop { Bands } bands -
 */
export class Player extends EventEmitter {
  public manager: Manager;
  public node: Node;

  public guild: string | object;
  public voiceChannel?: string | object;
  public textChannel?: string | object;

  public position: number;
  public volume: number;
  public paused: boolean;
  public playing: boolean;

  // eslint-disable-next-line @typescript-eslint/ban-types
  public track: {};
  public queue: string[];

  public trackRepeat: boolean;
  public queueRepeat: boolean;

  public state: {
    volume: number;
    equalizer: number[];
  };

  public bands?: number;

  public VoiceUpdateState?: {
    sessionId: string;
    event: unknown;
  };

  constructor(node: Node, options: VoiceChannelStruct, manager: Manager) {
    super();

    this.manager = manager;
    this.node = node;
    this.guild = options.guild?.id ?? options.guild;
    this.voiceChannel = options.voiceChannel?.id ?? options.voiceChannel;
    this.textChannel = options.textChannel ?? null;
    this.state = {
      volume: 100,
      equalizer: [],
    };
    this.trackRepeat = false;
    this.queueRepeat = false;
    this.playing = false;
    this.paused = false;
    this.track = {};
    this.VoiceUpdateState = undefined;
    this.position = 0;
    this.volume = 100;
    this.queue = [];

    this.on("event", (data): void => this.lavalinkEvents(data));
    // this event will be useful for creating web player
    this.on("playerUpdate", (packet): void => {
      this.state = {
        volume: this.state.volume,
        equalizer: this.state.equalizer,
        ...packet.state,
      };
    });
  }

  /**
   * Play a track
   * @param options -
   * @returns {this | null}
   */
  public play(options: PlayerOptions = {}): this | null {
    const sound = this.queue[0];
    if (!sound) {
      return null;
    }
    this.playing = true;
    this.track = sound;
    this.node.send({
      op: "play",
      guildId: this.guild,
      track: (sound as unknown as { track: string }).track,
      startTime: options?.startTime ?? 0,
      volume: options?.volume ?? 100,
      noReplace: options?.noReplace ?? false,
      pause: options?.pause ?? false,
    });
    return this;
  }

  /**
   * Stops the current track
   * @param amount -
   * @returns {this}
   */
  public stop(amount?: number): this {
    if (typeof amount === "number" && amount > 1) {
      if (amount > this.queue.length)
        throw new RangeError("Cannot skip more than the queue length.");

      this.queue.splice(0, amount - 1);
    }

    this.node.send({
      op: "stop",
      guildId: this.guild,
    });

    return this;
  }

  /**
   * Pause/Resume the current track
   * @param state -
   * @returns {this}
   */
  public pause(state: boolean): this {
    if (typeof state !== "boolean")
      throw new RangeError("Pause function must be pass with boolean value.");

    if (this.paused === state || !this.queue.length) return this;

    this.playing = !state;
    this.paused = state;

    this.node.send({
      op: "pause",
      guildId: this.guild,
      pause: state,
    });

    return this;
  }

  /**
   * Seeks the current track to a certain position
   * @param position -
   * @returns {this}
   */
  public seek(position: number): this {
    position = Number(position);

    if (isNaN(position)) throw new RangeError("Position must be a number.");

    this.position = position;
    this.node.send({
      op: "seek",
      guildId: this.guild,
      position,
    });

    return this;
  }

  /**
   * Set the volume, only for the current track
   * @param volume - Volume level, by default 100
   * @returns {this}
   */
  public setVolume(volume: number): this {
    volume = Number(volume);

    if (isNaN(volume)) throw new RangeError("Volume level must be a number");

    this.volume = volume;

    this.node.send({
      op: "volume",
      guildId: this.guild,
      volume: this.volume,
    });
    return this;
  }

  /**
   * Enable/Disable track repeat mode
   * @param mode -
   * @returns {this}
   */
  public setTrackRepeat(mode: boolean): this {
    this.trackRepeat = !!mode;
    return this;
  }

  /**
   * Enable/Disable track queue mode
   * @param mode
   * @returns {this}
   */
  public setQueueRepeat(mode: boolean): this {
    this.queueRepeat = !!mode;
    return this;
  }

  /**
   * Disable track and queue repeat mode
   * @returns {this}
   */
  public removeRepeat(): this {
    this.trackRepeat = false;
    this.queueRepeat = false;
    return this;
  }

  /**
   * Sets the player test channel manually. (where messages will be send)
   * @param channel
   * @returns {this}
   */
  public setTextChannel(channel: string): this {
    if (typeof channel !== "string")
      throw new RangeError("Channel must be a non-empty string.");

    this.textChannel = channel;
    return this;
  }

  /**
   * sets the player voice channel manually. (not recommended to use)
   * @param channel
   * @returns {this}
   */
  public setVoiceChannel(channel: string): this {
    if (typeof channel !== "string")
      throw new RangeError("Channel must be a non-empty string.");

    this.voiceChannel = channel;
    return this;
  }

  /**
   * Connect to the voice channel
   * @param data
   * @returns {this}
   */
  public connect(data: { sessionId: string; event: unknown }): this {
    this.VoiceUpdateState = data;
    this.node.send({
      op: "voiceUpdate",
      guildId: this.guild,
      region: "us",
      ...data,
    });
    return this;
  }

  /**
   * Disconnect from the voice channel
   * @returns {this | null}
   */
  public disconnect(): this | null {
    if (!this.voiceChannel) return this;

    if (this.paused) {
      this.pause(false);
    }
    this.manager.send({
      op: 4,
      d: {
        guild_id: this.guild,
        channel_id: null,
        self_mute: false,
        self_deaf: false,
      },
    });

    this.voiceChannel = undefined;
    return this;
  }

  /**
   * Destroy any connection from lavalink
   */
  public destroy(): void {
    this.disconnect();
    this.node.send({
      op: "destroy",
      guildId: this.guild,
    });

    this.manager.emit("playerDestroy", this);
    this.manager.players.delete(this.guild as string);
  }

  /**
   *
   * @param data -
   * @returns
   */
  public lavalinkEvents(data: LavaLinkOptions): void {
    switch (data.type) {
      case "TrackStartEvent":
        this.manager.emit("start", this, this.track);
        break;
      case "TrackEndEvent":
        if (this.trackRepeat) {
          this.play();
          return;
        }
        if (
          this.queueRepeat &&
          this.queue.length <= 1 &&
          data.reason === "FINISHED"
        ) {
          this.play();
          return;
        }
        if (this.queue.length <= 1 && data.reason === "FINISHED") {
          this.manager.emit("end", this, this.track);
          this.queue = [];
          this.stop();
          this.playing = false;
          this.paused = false;
          return;
        }

        /**
         *
         * @event end
         */
        this.manager.emit("end", this, this.track);
        break;
      case "TrackExceptionEvent":
        this.queue.shift();

        /**
         * @event exception
         */
        this.manager.emit("exception", this, this.track, data);
        break;
      case "TrackStuckEvent":
        this.queue.shift();

        /**
         *
         * @event struck
         */
        this.manager.emit("struck", this, this.track, data);
        break;
      case "WebSocketClosedEvent":
        if ([4015, 4009].includes(data.code)) {
          this.manager.send({
            op: 4,
            d: {
              guild_id: data.guildId,
              channel_id:
                (this.voiceChannel as { id?: string })?.id ?? this.voiceChannel,
              self_mute: false,
              self_deaf: false,
            },
          });
        }

        /**
         *
         * @event error
         */

        this.manager.emit("error", this, data);
        break;
      default:
        this.manager.emit(
          "warn",
          `An unknown event was passed, event: ${data.type}`
        );
    }
  }
}
