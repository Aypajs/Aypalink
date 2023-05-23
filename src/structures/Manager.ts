import { EventEmitter } from "events";
import {
  NodeOptions,
  ManagerOptions,
  VoiceChannelStruct,
  VoiceStateUpdate,
  StatsTypes,
  LavalinkResponse,
  RoutePlannerReponse,
} from "../types";
import { Player } from "./Player";
import { Node } from "./Node";
import Response from "./Response";
import http, { type IncomingMessage, RequestOptions } from "http";
import https from "https";

/**
 *
 * @prop { Client } client -
 * @prop { ListOfNodes } listOfNodes - {Private}
 * @prop { Nodes } nodes -
 * @prop { Players } players -
 * @prop { VoiceStates } voiceStates -
 * @prop { VoiceServers } voiceServers -
 * @prop { User } user -
 * @prop { Send } send -
 * @prop { Player } player -
 */
export class Manager extends EventEmitter {
  public readonly client: unknown;

  private listOfNodes: Array<string>;

  public nodes: Map<string, NodeOptions>;
  public players: Map<string, Player>;
  public voiceStates: Map<string, unknown>;
  public voiceServers: Map<string, unknown>;
  public user?: string;
  public send: Function;
  public player?: Player;

  constructor(
    client: unknown,
    nodes: string[],
    options: ManagerOptions = {
      send: undefined,
    }
  ) {
    super();
    if (!client)
      throw new Error("Parameter Client is missing or an error occurred.");
    if (!options.send)
      throw new Error("Send is a required function inside manager class.");

    this.client = client;
    this.listOfNodes = nodes;

    this.nodes = new Map<string, NodeOptions>();
    this.players = new Map<string, Player>();
    this.voiceStates = new Map<string, unknown>();
    this.voiceServers = new Map<string, unknown>();

    this.user = undefined;
    this.send = options.send;
  }

  /**
   *
   * @param options
   * @returns {Node}
   */
  public init(options: NodeOptions): Node {
    const node = new Node(this, options);
    if (options.id) {
      this.nodes.set(options.id, node);
      node.connect();
      return node;
    }
    this.nodes.set(options.host, node);
    node.connect();
    return node;
  }

  /**
   *
   * @param data -
   * @returns {Player | NodeOptions}
   */
  public create(
    data: VoiceChannelStruct = { guild: { id: "" }, textChannel: "" }
  ): Player | NodeOptions {
    const player = this.players.get(data.guild?.id ?? data.guild);
    if (player) return player;
    this.send({
      op: 4,
      d: {
        guild_id: data.guild?.id ?? data.guild,
        channel_id: data.voiceChannel?.id ?? data.voiceChannel,
        self_mute: data.selfMute ?? false,
        self_deaf: data.selfDeaf ?? false,
      },
    });

    return this.spawnPlayer(data);
  }

  /**
   *
   * @param botID
   */
  public start(botID?: string): void {
    if (!botID) throw new Error("BotID must be a string");
    if (typeof botID !== "string")
      throw new TypeError("BotID must be a string.");
    this.user = botID;
    this.listOfNodes?.forEach((node) =>
      this.init(node as unknown as NodeOptions)
    );
  }

  /**
   *
   * @param data
   * @returns {boolean}
   */
  public voiceServersUpdate(data: { guild_id: string }): boolean {
    this.voiceServers.set(data.guild_id, data);
    return this.connectionProcess(data.guild_id);
  }

  /**
   *
   * @param data
   * @returns {boolean | void}
   */
  public voiceStateUpdate(data: VoiceStateUpdate): boolean | void {
    if (data.user_id !== this.user) return;
    if (data.channel_id) {
      this.voiceStates.set(data.guild_id, data);

      return this.connectionProcess(data.guild_id);
    }
    this.voiceServers.delete(data.guild_id);
    this.voiceStates.delete(data.guild_id);
  }
  /**
   *
   * @param packet
   * @return {void}
   */
  public packetUpdate(packet: { t: string; d: VoiceStateUpdate }): void {
    if (packet.t === "VOICE_SERVER_UPDATE") this.voiceServersUpdate(packet.d);
    if (packet.t === "VOICE_STATE_UPDATE") this.voiceStateUpdate(packet.d);
  }

  /**
   *
   * @param guildId
   * @returns {boolean}
   */
  public connectionProcess(guildId: string): boolean {
    const server = this.voiceServers.get(guildId);
    const state = this.voiceStates.get(guildId) as { session_id: string };

    if (!server) return false;
    const player = this.players.get(guildId) as Player;
    if (!player) return false;

    player.connect({
      sessionId: state ? state.session_id : player.VoiceUpdateState!.sessionId,
      event: server,
    });

    return true;
  }

  /**
   *
   * @returns {NodeOptions[]}
   */
  public get leastUsedNodes(): NodeOptions[] {
    return [...this.nodes.values()]
      .filter((node) => (node as Node as { connected: boolean }).connected)
      .sort((a, b) => {
        const aLoad: number = (a as unknown as StatsTypes).stats.cpu
          ? ((a as unknown as StatsTypes).stats.cpu.systemLoad /
              (a as unknown as StatsTypes).stats.cpu.cores) *
            100
          : 0;
        const bLoad: number = (b as unknown as StatsTypes).stats.cpu
          ? ((b as unknown as StatsTypes).stats.cpu.systemLoad /
              (b as unknown as StatsTypes).stats.cpu.cores) *
            100
          : 0;

        return aLoad - bLoad;
      });
  }

  /**
   *
   * @param data
   * @returns {NodeOptions | Player}
   */
  public spawnPlayer(data: VoiceChannelStruct): NodeOptions | Player {
    const guild = data.guild?.id ?? data.guild;
    const spawnedNodes = this.nodes.get(guild as string);
    if (spawnedNodes) return spawnedNodes;
    if (this.leastUsedNodes.length === 0)
      throw new Error("No nodes are connected.");

    const node = this.nodes.get(
      this.leastUsedNodes[0].id || this.leastUsedNodes[0].host
    );
    if (!node) throw new Error("No nodes are connected.");

    const player = new Player(node as Node, data, this);
    this.players.set(guild, player);

    return player;
  }

  /**
   *
   * @param track
   * @param source
   * @returns {Promise<Response>}
   */
  public async resolveTrack(track: string, source: string): Promise<Response> {
    const node = this.leastUsedNodes[0];
    if (!node) throw new Error("No nodes are connected.");

    const regex = /https?:\/\//;
    if (!regex.test(track)) {
      track = `${source || "yt"}search:${track}`;
    }
    const result = await this.request<LavalinkResponse>(
      node as unknown as NodeOptions,
      "loadtracks",
      `identifier=${encodeURIComponent(track)}`
    );

    /**
     *
     * @event debug
     */
    this.emit("debug", result);
    if (!result) throw new Error("No results found.");
    return new Response(result);
  }

  /**
   *
   * @param track -
   * @returns {Promise<unknown>}
   */
  public async decodeTrack(track: string): Promise<unknown> {
    const node = this.leastUsedNodes[0];
    if (!node) throw new Error("No nodes are connected.");

    const result = await this.request<{ status: number }>(
      node as unknown as NodeOptions,
      "decodetrack",
      `track=${track}`
    );

    /**
     *
     * @event debug
     */
    this.emit("debug", result);
    if (result.status === 500) return null;
    return result;
  }

  /**
   *
   * @returns {Promise<RoutePlannerReponse>}
   */
  public async getRoutePlanner(): Promise<RoutePlannerReponse> {
    const node = this.leastUsedNodes[0];
    if (node) throw new Error("No nodes are connected.");

    const result = await this.request<RoutePlannerReponse>(
      node,
      "/routeplanner/status"
    );
    return result;
  }

  /**
   *
   * @param address
   * @returns {Promise<boolean>}
   */
  public async unmarkFailedAddress(address: string): Promise<boolean> {
    const status = await this.routeFreePost(address, "address");
    return status === 204;
  }

  /**
   *
   * @returns {Promise<boolean>}
   */
  public async unmarkAllFailedAddress(): Promise<boolean> {
    const status = await this.routeFreePost("all");
    return status === 204;
  }

  /**
   *
   * @param node
   * @param endpoint
   * @param param
   * @returns {Promise<T>}
   */
  public async request<T>(
    node: NodeOptions,
    endpoint: string,
    param?: string
  ): Promise<T> {
    const httpMod = node.secure ? https : http;
    return new Promise((resolve) => {
      httpMod.get(
        `http${node.secure ? "s" : ""}://${node.host}:${node.port}/${endpoint}${
          param ? `?${param}` : ""
        }`,
        {
          headers: {
            Authorization: node?.password ?? "",
          },
        },
        (cb: IncomingMessage): void => {
          let data = "";
          cb.on("data", (chunk: string): void => {
            data += chunk;
          });
          cb.on("end", (): void => resolve(JSON.parse(data)));
          cb.once("error", (e: Error): Error => {
            throw new Error(
              `Failed to request to the lavalink. \n\nLogs: ${e}.`
            );
          }).on("error", (e: Error): Error => {
            throw new Error(
              `Failed to request to the lavalink. \n\nLogs: ${e}.`
            );
          });
        }
      );
    });
  }

  /**
   *
   * @param address -
   * @param endpoint -
   * @returns {Promise<boolean>}
   */
  public async routeFreePost(
    address?: string,
    endpoint?: string
  ): Promise<number> {
    const node = this.leastUsedNodes[0];
    if (!node) throw new Error("No nodes are connected.");

    const httpMod = node.secure ? https : http;
    const options = {
      hostname: node.host,
      port: node.port,
      path: `/routeplanner/free/${endpoint ?? (address ? "address" : "all")}`,
      headers: {
        authorization: node?.password ?? "",
        "content-type": "application/json",
      },
      body: address
        ? JSON.stringify({
            address,
          })
        : "",
      method: "POST",
    } as RequestOptions;
    return new Promise((resolve) => {
      httpMod.request(options, (cb: IncomingMessage) => {
        resolve(cb.statusCode!);
      });
    });
  }

  /**
   *
   * @param guildId
   * @returns {Player}
   */
  public get(guildId: string): Player {
    return this.players.get(guildId)!;
  }
}
