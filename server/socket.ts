import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';

let io: Server | null = null;

// Almacén de usuarios conectados
const connectedUsers = new Map<string, { 
  userId: number; 
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
    pingTimeout: 60000,
    pingInterval: 25000,
    transports: ['websocket', 'polling'],
  });

  io.on('connection', (socket: Socket) => {
    console.log(`[Socket] Cliente conectado: ${socket.id}`);

    // Autenticar usuario
    socket.on('auth', (userData: { userId: number; name: string; role: string }) => {
      connectedUsers.set(socket.id, {
        userId: userData.userId,
        name: userData.name,
        role: userData.role,
        socketId: socket.id,
        lastActivity: new Date(),
      });
      
      // Notificar a todos los usuarios conectados
      broadcastUserCount();
      console.log(`[Socket] Usuario autenticado: ${userData.name} (${userData.role})`);
    });

    // Unirse a sala específica (por empresa, unidad, etc.)
    socket.on('join-room', (room: string) => {
      socket.join(room);
      console.log(`[Socket] ${socket.id} se unió a sala: ${room}`);
    });

    // Salir de sala
    socket.on('leave-room', (room: string) => {
      socket.leave(room);
      console.log(`[Socket] ${socket.id} salió de sala: ${room}`);
    });

    // Ping para mantener conexión activa
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
        console.log(`[Socket] Usuario desconectado: ${user.name} (${reason})`);
        connectedUsers.delete(socket.id);
        broadcastUserCount();
      }
    });
  });

  // Limpiar usuarios inactivos cada 30 segundos
  setInterval(() => {
    const now = new Date();
    const timeout = 2 * 60 * 1000; // 2 minutos
    
    connectedUsers.forEach((user, socketId) => {
      if (now.getTime() - user.lastActivity.getTime() > timeout) {
        connectedUsers.delete(socketId);
      }
    });
  }, 30000);

  return io;
}

// Obtener instancia de Socket.io
export function getIO(): Server | null {
  return io;
}

// Broadcast de conteo de usuarios
function broadcastUserCount() {
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
      if (user.userId === userId) {
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
      if (user.userId === userId) {
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
