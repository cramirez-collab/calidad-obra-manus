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
  reconnect: () => void;
}

let globalSocket: Socket | null = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 20;

export function useSocket(): UseSocketReturn {
  const { user, isAuthenticated } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [usersCount, setUsersCount] = useState(0);
  const [connectedUsers, setConnectedUsers] = useState<ConnectedUser[]>([]);
  const socketRef = useRef<Socket | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const clearTimers = useCallback(() => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  const createSocket = useCallback(() => {
    if (!isAuthenticated || !user) return null;

    // Limpiar socket anterior si existe
    if (globalSocket) {
      globalSocket.removeAllListeners();
      globalSocket.disconnect();
      globalSocket = null;
    }

    console.log('[Socket] Creando nueva conexión...');
    
    const socket = io({
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: MAX_RECONNECT_ATTEMPTS,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
      timeout: 30000,
      forceNew: false,
      autoConnect: true,
    });

    return socket;
  }, [isAuthenticated, user]);

  const setupSocketListeners = useCallback((socket: Socket) => {
    if (!user) return;

    socket.on('connect', () => {
      setIsConnected(true);
      reconnectAttempts = 0;
      console.log('[Socket] Conectado - ID:', socket.id);
      
      // Autenticar usuario
      socket.emit('auth', {
        userId: user.id,
        name: user.name || 'Usuario',
        role: user.role || 'user',
      });

      // Iniciar ping para mantener conexión activa
      clearTimers();
      pingIntervalRef.current = setInterval(() => {
        if (socket.connected) {
          socket.emit('ping');
        }
      }, 20000);
    });

    socket.on('disconnect', (reason) => {
      setIsConnected(false);
      console.log('[Socket] Desconectado:', reason);
      clearTimers();

      // Reconexión manual si fue desconexión del servidor
      if (reason === 'io server disconnect' || reason === 'transport close') {
        reconnectAttempts++;
        if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
          console.log(`[Socket] Reintentando en ${delay}ms (intento ${reconnectAttempts})`);
          reconnectTimeoutRef.current = setTimeout(() => {
            socket.connect();
          }, delay);
        }
      }
    });

    socket.on('connect_error', (error) => {
      console.log('[Socket] Error de conexión:', error.message);
      setIsConnected(false);
    });

    socket.on('reconnect', (attemptNumber) => {
      console.log('[Socket] Reconectado después de', attemptNumber, 'intentos');
      reconnectAttempts = 0;
    });

    socket.on('reconnect_attempt', (attemptNumber) => {
      console.log('[Socket] Intento de reconexión:', attemptNumber);
    });

    socket.on('reconnect_error', (error) => {
      console.log('[Socket] Error en reconexión:', error.message);
    });

    socket.on('reconnect_failed', () => {
      console.log('[Socket] Reconexión fallida después de todos los intentos');
    });

    socket.on('users-count', (data: { count: number; users: ConnectedUser[] }) => {
      setUsersCount(data.count);
      setConnectedUsers(data.users);
    });

    socket.on('pong', () => {
      // Conexión activa confirmada
    });

    // Escuchar cambios de proyecto activo
    socket.on('proyecto-activo-changed', (data: { proyectoId: number | null; userId: number }) => {
      window.dispatchEvent(new CustomEvent('proyecto-activo-changed', { detail: data }));
    });
  }, [user, clearTimers]);

  useEffect(() => {
    if (!isAuthenticated || !user) {
      clearTimers();
      return;
    }

    // Reusar conexión global si existe y está conectada
    if (globalSocket?.connected) {
      socketRef.current = globalSocket;
      setIsConnected(true);
      return;
    }

    // Crear nueva conexión
    const socket = createSocket();
    if (!socket) return;

    globalSocket = socket;
    socketRef.current = socket;
    setupSocketListeners(socket);

    return () => {
      clearTimers();
    };
  }, [isAuthenticated, user, createSocket, setupSocketListeners, clearTimers]);

  // Reconexión manual cuando vuelve la conexión a internet
  useEffect(() => {
    const handleOnline = () => {
      console.log('[Socket] Internet restaurado, reconectando...');
      if (socketRef.current && !socketRef.current.connected) {
        socketRef.current.connect();
      }
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, []);

  const emit = useCallback((event: string, data?: any) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit(event, data);
    } else {
      console.log('[Socket] No conectado, no se puede emitir:', event);
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

  const reconnect = useCallback(() => {
    console.log('[Socket] Reconexión manual solicitada');
    reconnectAttempts = 0;
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current.connect();
    }
  }, []);

  return {
    isConnected,
    usersCount,
    connectedUsers,
    emit,
    on,
    off,
    joinRoom,
    leaveRoom,
    reconnect,
  };
}

export default useSocket;
