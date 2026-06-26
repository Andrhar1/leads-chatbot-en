"use client";
import { io, type Socket } from "socket.io-client";
import { API_BASE } from "./api";

let socket: Socket | null = null;
export function getSocket(): Socket {
  if (!socket) socket = io(API_BASE, { transports: ["websocket"] });
  return socket;
}
