import { useEffect, useState, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '@/_core/hooks/useAuth';

interface ConnectedUser {
  name: string;
  role: string;
}

interface UseSocketReturn {
  isConnected: boolean;
  usersCount: number;
  connectedUsers: ConnectedUser[];
  emit: (event: string, data?: any) => void;
  on: (event: string, callback: (data: any) => void) => void;
  off: (event: string, callback?: (data: any) => void) => void;
  joinRoom: (room: string) => void;
  leaveRoom: (room: string) => void;
}

let globalSocket: Socket | null = null;

export function useSocket(): UseSocketReturn {
  const { user, isAuthenticated } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [usersCount, setUsersCount] = useState(0);
  const [connectedUsers, setConnectedUsers] = useState<ConnectedUser[]>([]);
  const socketRef = useRef<Socket | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !user) return;

    // Reusar conexión global si existe
    if (globalSocket?.connected) {
      socketRef.current = globalSocket;
      setIsConnected(true);
      return;
    }

    // Crear nueva conexión
    const socket = io({
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    });

    globalSocket = socket;
    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      console.log('[Socket] Conectado');
      
      // Autenticar usuario
      socket.emit('auth', {
        oderId: user.id,
        name: user.name || 'Usuario',
        role: user.role || 'user',
      });

      // Iniciar ping para mantener conexión
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
      }
      pingIntervalRef.current = setInterval(() => {
        socket.emit('ping');
      }, 25000);
    });

    socket.on('disconnect', (reason) => {
      setIsConnected(false);
      console.log('[Socket] Desconectado:', reason);
      
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
      }
    });

    socket.on('connect_error', (error) => {
      console.log('[Socket] Error de conexión:', error.message);
    });

    socket.on('users-count', (data: { count: number; users: ConnectedUser[] }) => {
      setUsersCount(data.count);
      setConnectedUsers(data.users);
    });

    socket.on('pong', () => {
      // Conexión activa
    });

    return () => {
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
      }
    };
  }, [isAuthenticated, user]);

  const emit = useCallback((event: string, data?: any) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit(event, data);
    }
  }, []);

  const on = useCallback((event: string, callback: (data: any) => void) => {
    socketRef.current?.on(event, callback);
  }, []);

  const off = useCallback((event: string, callback?: (data: any) => void) => {
    if (callback) {
      socketRef.current?.off(event, callback);
    } else {
      socketRef.current?.off(event);
    }
  }, []);

  const joinRoom = useCallback((room: string) => {
    emit('join-room', room);
  }, [emit]);

  const leaveRoom = useCallback((room: string) => {
    emit('leave-room', room);
  }, [emit]);

  return {
    isConnected,
    usersCount,
    connectedUsers,
    emit,
    on,
    off,
    joinRoom,
    leaveRoom,
  };
}

export default useSocket;
