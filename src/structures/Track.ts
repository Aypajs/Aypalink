import { TrackOptions } from "../types";

export default class Track {
  public track: string;
  public title: string;
  public identifier: string;
  public author: string;
  public duration: number;
  public isSeekable: boolean;
  public isStream: boolean;
  public uri: string;
  public thumbnail: string | null;
  public requester: unknown | null;

  constructor(data: TrackOptions) {
    this.track = data.track;
    this.title = data.info.title;
    this.identifier = data.info.identifier;
    this.author = data.info.author;
    this.duration = data.info.length;
    this.isSeekable = data.info.isSeekable;
    this.isStream = data.info.isStream;
    this.uri = data.info.uri;
    this.thumbnail = `https://i.ytimg.com/vi/${data.info.identifier}/maxresdefault.jpg`;
    this.requester;
  }
}
