// packages/node-agent/src/connection.ts
import WebSocket from 'ws';
import { EventEmitter } from 'events';

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

type StateCallback = (state: ConnectionState) => void;
type MessageCallback = (message: string) => void;

interface ConnectionOptions {
  reconnectDelay?: number;
  maxReconnectDelay?: number;
}

export class Connection extends EventEmitter {
  private ws: WebSocket | null = null;
  private url: string;
  private _state: ConnectionState = 'disconnected';
  private reconnectDelay: number;
  private maxReconnectDelay: number;
  private currentDelay: number;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private intentionalDisconnect: boolean = false;
  private stateCallbacks: StateCallback[] = [];
  private messageCallbacks: MessageCallback[] = [];

  constructor(url: string, options: ConnectionOptions = {}) {
    super();
    this.url = url;
    this.reconnectDelay = options.reconnectDelay ?? 1000;
    this.maxReconnectDelay = options.maxReconnectDelay ?? 30000;
    this.currentDelay = this.reconnectDelay;
  }

  get state(): ConnectionState {
    return this._state;
  }

  private setState(state: ConnectionState): void {
    this._state = state;
    for (const cb of this.stateCallbacks) {
      cb(state);
    }
    this.emit('stateChange', state);
  }

  onStateChange(callback: StateCallback): void {
    this.stateCallbacks.push(callback);
  }

  onMessage(callback: MessageCallback): void {
    this.messageCallbacks.push(callback);
  }

  connect(): void {
    if (this._state === 'connected' || this._state === 'connecting') {
      return;
    }

    this.intentionalDisconnect = false;
    this.setState('connecting');

    this.ws = new WebSocket(this.url);

    this.ws.on('open', () => {
      this.setState('connected');
      this.currentDelay = this.reconnectDelay; // Reset delay on successful connection
    });

    this.ws.on('message', (data) => {
      const message = data.toString();
      for (const cb of this.messageCallbacks) {
        cb(message);
      }
      this.emit('message', message);
    });

    this.ws.on('close', () => {
      this.ws = null;
      if (!this.intentionalDisconnect) {
        this.scheduleReconnect();
      } else {
        this.setState('disconnected');
      }
    });

    this.ws.on('error', (error) => {
      this.emit('error', error);
    });
  }

  private scheduleReconnect(): void {
    this.setState('reconnecting');

    this.reconnectTimer = setTimeout(() => {
      this.currentDelay = Math.min(this.currentDelay * 2, this.maxReconnectDelay);
      this.connect();
    }, this.currentDelay);
  }

  disconnect(): void {
    this.intentionalDisconnect = true;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.setState('disconnected');
  }

  send(message: string): void {
    if (this.ws && this._state === 'connected') {
      this.ws.send(message);
    }
  }
}
