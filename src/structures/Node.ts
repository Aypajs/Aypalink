import WebSocket from "ws";
import { Manager } from "./Manager";
import { NodeOptions } from "../types";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { name, version } = require("../../package.json");

/**
 *
 * @prop { ID } id -
 * @prop { Host } host -
 * @prop { Port } port -
 * @prop { Password } password -
 * @prop { Secure } secure -
 * @prop { RetryAmount } retryAmount -
 * @prop { RetryDelay } retryDelay -
 * @prop { ResumeKey } resumeKey -
 * @prop { ResumeTimeout } resumeTimeout -
 * @prop { Stats } stats -
 * @prop { Connected } connected -
 * @prop { Retry } retry -
 * @prop { WS } ws -
 * @prop { PacketQueue } packetQueue -
 * @prop { Manager } manager -
 */
export class Node {
  public id?: string;
  public host: string;
  public port: number;
  public password: string;
  public secure: boolean;
  public resumeKey: string | null;
  public resumeTimeout: number;
  public retryAmount: number;
  public retryDelay: number;

  public stats: {
    players: number;
    playingPlayers: number;
    uptime: number;
    memory: {
      free: number;
      used: number;
      allocated: number;
      reservable: number;
    };
    cpu: {
      cores: number;
      systemLoad: number;
      lavalinkLoad: number;
    };
    frameStats: {
      sent: number;
      nulled: number;
      deficit: number;
    };
  };

  public connected: boolean;

  public retry?: ReturnType<typeof setTimeout>;

  public ws?: WebSocket;
  public packetQueue: string[];

  public manager: Manager;

  constructor(
    manager: Manager,
    options: NodeOptions = {
      host: "",
      port: 2333,
      password: "youshallnotpass",
      resumeKey: null,
    }
  ) {
    this.manager = manager;
    this.id = options?.id ?? this.generateRandomNode(10);
    this.host = options.host;
    this.port = options.port;
    this.password = options?.password ?? "";
    this.secure = options?.secure ?? false;
    this.retryDelay = options?.retryDelay ?? 30e3;
    this.resumeKey = options?.resumeKey ?? null;
    this.retryAmount = 5;
    this.resumeTimeout = options?.resumeTimeout ?? 120;

    this.stats = {
      players: 0,
      playingPlayers: 0,
      uptime: 0,
      memory: {
        free: 0,
        used: 0,
        allocated: 0,
        reservable: 0,
      },
      cpu: {
        cores: 0,
        systemLoad: 0,
        lavalinkLoad: 0,
      },
      frameStats: {
        sent: 0,
        nulled: 0,
        deficit: 0,
      },
    };
    this.connected = false;
    this.ws = undefined;
    this.packetQueue = [];
  }

  public connect(): void {
    if (this.ws) this.ws.close();

    const headers = {
      Authorization: this.password,
      "User-Id": this.manager.user,
      "Client-Name": `${name}/${version}`,
    };

    if (this.resumeKey)
      Object.assign(headers, { "Resume-Key": this.resumeKey });

    this.ws = new WebSocket(
      `ws${this.secure ? "s" : ""}:${this.host}:${this.port}/`,
      { headers }
    );

    this.ws.on("open", this.open.bind(this));
    this.ws.on("error", this.error.bind(this));
    this.ws.on("message", this.message.bind(this));
    this.ws.on("close", this.close.bind(this));
  }

  /**
   * {Private}
   */
  private open() {
    if (this.retry) clearTimeout(this.retry);

    if (this.resumeKey) {
      this.send({
        op: "configureResuming",
        key: this.resumeKey,
        timeout: this.resumeTimeout,
      });
    }

    /**
     *
     * @event ready
     */
    this.manager.emit("ready", this);
    this.connected = true;
  }

  /**
   * {Private}
   * @param payload
   */
  private message(payload: Buffer): void {
    if (Array.isArray(payload)) payload = Buffer.concat(payload);
    else if (payload instanceof ArrayBuffer) payload = Buffer.from(payload);

    const packet = JSON.parse(payload as unknown as string);
    if (packet.op && packet.op === "stats") {
      this.stats = { ...packet };
    }

    const player = this.manager.players.get(packet.guildId);
    if (packet.guildId && player) player.emit(packet.op, packet);

    packet.node = this;

    /**
     *
     * @event raw
     */
    this.manager.emit("raw", packet);
  }

  /**
   *
   * @param code
   * @returns {void}
   */
  private close(code: number): void {
    this.manager.emit("disconnect", code, this);
    if (code !== 1000) return this.reconnect();
  }

  /**
   * {Private}
   * @param code
   * @returns {void}
   */
  private error(code: number): void {
    this.manager.emit("error", this, code);
    this.reconnect();
    return;
  }

  /**
   * Reconnect to the websocket
   */
  public reconnect(): void {
    this.retry = setTimeout(() => {
      this.connected = false;
      this.ws?.removeAllListeners();
      this.ws = undefined;
      this.manager.emit("reconnecting", this);
      this.connect();
    }, this.retryDelay);
  }

  /**
   *
   * @param reason
   */
  public destroy(reason = "destroy"): void {
    this.ws?.close(1000, reason);
    this.ws = undefined;
    this.manager.nodes.delete(this.host ?? this.id);
  }

  /**
   * JSON Stringify all packets and push the to the queue
   * @param payload - An object but can be anything
   * @returns {number | void}
   */
  public send(payload: object): number | void {
    const packet = JSON.stringify(payload);
    if (!this.connected) return this.packetQueue.push(packet);

    return this.sendPacket(packet);
  }

  /**
   * {Private}
   * @param payload
   */
  private sendPacket(payload: string): void {
    this.ws?.send(payload, (e) => {
      if (e) return e;
      return null;
    });
  }

  private generateRandomNode(length: number): string {
    const characters =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    const charactersLength = characters.length;
    let reuslt = "Node ";
    for (let i = 0; i < length - 4; i++) {
      reuslt += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return reuslt;
  }
}
