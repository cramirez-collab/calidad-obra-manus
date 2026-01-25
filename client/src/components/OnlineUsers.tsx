import { useSocket } from '@/hooks/useSocket';
import { Users } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function OnlineUsers() {
  const { isConnected, usersCount, connectedUsers } = useSocket();

  if (!isConnected || usersCount <= 1) return null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <Users className="h-3 w-3" />
          <span className="font-medium">{usersCount}</span>
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-[200px]">
        <p className="text-xs font-medium mb-1">{usersCount} usuarios conectados</p>
        <div className="text-xs text-muted-foreground space-y-0.5">
          {connectedUsers.slice(0, 5).map((user, i) => (
            <div key={i} className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              {user.name}
            </div>
          ))}
          {connectedUsers.length > 5 && (
            <div className="text-muted-foreground/70">
              +{connectedUsers.length - 5} más
            </div>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

export default OnlineUsers;
