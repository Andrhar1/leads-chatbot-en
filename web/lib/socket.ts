"use client";
import { io, type Socket } from "socket.io-client";
import { API_BASE } from "./api";

// Socket.io path. In production the API is served same-origin under /api,
// so the socket lives at /api/socket.io. In local dev API_BASE is an absolute
// URL (http://localhost:4000) and the path is the default /socket.io.
const SOCKET_PATH = process.env.NEXT_PUBLIC_SOCKET_PATH || "/socket.io";

let socket: Socket | null = null;
export function getSocket(): Socket {
  if (!socket) {
    // Absolute API_BASE (dev) -> connect to that origin. Relative/empty
    // API_BASE (prod, same-origin) -> connect to current origin with a path.
    const target = /^https?:\/\//.test(API_BASE) ? API_BASE : "/";
    socket = io(target, { path: SOCKET_PATH, transports: ["websocket"] });
  }
  return socket;
}
