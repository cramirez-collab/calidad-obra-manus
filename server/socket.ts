import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';

let io: Server | null = null;

// Almacén de usuarios conectados (en memoria, sin BD)
const connectedUsers = new Map<string, { 
  oderId: number; 
  name: string; 
  role: string;
  socketId: string;
  lastActivity: Date;
}>();

export function initializeSocket(httpServer: HttpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
    // === OPTIMIZADO PARA 20+ USUARIOS EN 3G ===
    pingTimeout: 120000,       // 2min timeout (3G puede ser lento)
    pingInterval: 45000,       // Ping cada 45s (no 25s, ahorra bandwidth)
    transports: ['websocket', 'polling'], // WebSocket primero
    upgradeTimeout: 30000,     // 30s para upgrade a WS
    maxHttpBufferSize: 1e6,    // 1MB max payload por mensaje
    perMessageDeflate: {       // Comprimir mensajes WS
      threshold: 1024,         // Solo >1KB
    },
    allowUpgrades: true,
    httpCompression: {
      threshold: 1024,
    },
  });

  io.on('connection', (socket: Socket) => {
    // Autenticar usuario
    socket.on('auth', (userData: { userId: number; name: string; role: string }) => {
      connectedUsers.set(socket.id, {
        oderId: userData.userId,
        name: userData.name,
        role: userData.role,
        socketId: socket.id,
        lastActivity: new Date(),
      });
      
      // Notificar a todos los usuarios conectados
      broadcastUserCount();
    });

    // Unirse a sala específica (por empresa, unidad, etc.)
    socket.on('join-room', (room: string) => {
      socket.join(room);
    });

    // Salir de sala
    socket.on('leave-room', (room: string) => {
      socket.leave(room);
    });

    // Ping para mantener conexión activa (solo actualizar en memoria, NO en BD)
    socket.on('ping', () => {
      const user = connectedUsers.get(socket.id);
      if (user) {
        user.lastActivity = new Date();
      }
      socket.emit('pong');
    });

    // Desconexión
    socket.on('disconnect', (reason) => {
      const user = connectedUsers.get(socket.id);
      if (user) {
        connectedUsers.delete(socket.id);
        broadcastUserCount();
      }
    });
  });

  // Limpiar usuarios inactivos cada 60 segundos (no 30s)
  setInterval(() => {
    const now = new Date();
    const timeout = 3 * 60 * 1000; // 3 minutos (no 2, más tolerante en 3G)
    let changed = false;
    
    connectedUsers.forEach((user, socketId) => {
      if (now.getTime() - user.lastActivity.getTime() > timeout) {
        connectedUsers.delete(socketId);
        changed = true;
      }
    });
    
    // Solo broadcast si hubo cambios
    if (changed) broadcastUserCount();
  }, 60000);

  return io;
}

// Obtener instancia de Socket.io
export function getIO(): Server | null {
  return io;
}

// Broadcast de conteo de usuarios (throttled)
let lastBroadcast = 0;
function broadcastUserCount() {
  const now = Date.now();
  // Throttle: max 1 broadcast cada 2 segundos
  if (now - lastBroadcast < 2000) return;
  lastBroadcast = now;
  
  if (io) {
    io.emit('users-count', {
      count: connectedUsers.size,
      users: Array.from(connectedUsers.values()).map(u => ({
        name: u.name,
        role: u.role,
      })),
    });
  }
}

// Emitir evento a todos los usuarios
export function emitToAll(event: string, data: any) {
  if (io) {
    io.emit(event, data);
  }
}

// Emitir evento a una sala específica
export function emitToRoom(room: string, event: string, data: any) {
  if (io) {
    io.to(room).emit(event, data);
  }
}

// Emitir evento a usuarios con rol específico
export function emitToRole(role: string, event: string, data: any) {
  if (io) {
    connectedUsers.forEach((user) => {
      if (user.role === role) {
        io!.to(user.socketId).emit(event, data);
      }
    });
  }
}

// Emitir evento a un usuario específico por ID
export function emitToUser(userId: number, event: string, data: any) {
  if (io) {
    connectedUsers.forEach((user) => {
      if (user.oderId === userId) {
        io!.to(user.socketId).emit(event, data);
      }
    });
  }
}

// Eventos específicos de la aplicación
export const socketEvents = {
  // Emitir a usuario específico
  emitToUser: (userId: number, event: string, data: any) => {
    emitToUser(userId, event, data);
  },
  
  // Cuando se crea un nuevo ítem
  itemCreated: (item: any) => {
    emitToAll('item:created', item);
    emitToRole('jefe_residente', 'item:pending-review', item);
  },

  // Cuando se actualiza un ítem
  itemUpdated: (item: any) => {
    emitToAll('item:updated', item);
  },

  // Cuando se sube foto después
  itemPhotoUploaded: (item: any) => {
    emitToAll('item:photo-uploaded', item);
    emitToRole('supervisor', 'item:pending-approval', item);
  },

  // Cuando se aprueba un ítem
  itemApproved: (item: any) => {
    emitToAll('item:approved', item);
  },

  // Cuando se rechaza un ítem
  itemRejected: (item: any) => {
    emitToAll('item:rejected', item);
  },

  // Notificación general
  notification: (userId: number, notification: any) => {
    connectedUsers.forEach((user) => {
      if (user.oderId === userId) {
        io?.to(user.socketId).emit('notification', notification);
      }
    });
  },

  // Estadísticas actualizadas
  statsUpdated: () => {
    emitToAll('stats:updated', { timestamp: new Date() });
  },
};

// Obtener usuarios conectados
export function getConnectedUsers() {
  return {
    count: connectedUsers.size,
    users: Array.from(connectedUsers.values()).map(u => ({
      name: u.name,
      role: u.role,
    })),
  };
}
