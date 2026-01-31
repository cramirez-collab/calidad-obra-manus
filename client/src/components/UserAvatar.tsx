import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface UserAvatarProps {
  name?: string | null;
  fotoUrl?: string | null;
  size?: "xs" | "sm" | "md" | "lg";
  showName?: boolean;
  className?: string;
  nameClassName?: string;
}

const sizeClasses = {
  xs: "h-4 w-4 min-w-[16px] text-[7px]",
  sm: "h-5 w-5 min-w-[20px] text-[8px]",
  md: "h-6 w-6 min-w-[24px] text-[9px]",
  lg: "h-8 w-8 min-w-[32px] text-xs",
};

export function UserAvatar({ 
  name, 
  fotoUrl, 
  size = "sm", 
  showName = true,
  className,
  nameClassName 
}: UserAvatarProps) {
  const initials = name
    ?.split(' ')
    .map(n => n.charAt(0))
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'U';

  return (
    <div className={cn("flex items-center gap-2 min-w-0", className)}>
      <Avatar className={cn("border shrink-0 flex-shrink-0", sizeClasses[size])}>
        <AvatarImage 
          src={fotoUrl || ''} 
          alt={name || 'Usuario'} 
          className="object-cover"
        />
        <AvatarFallback className="bg-primary text-primary-foreground font-medium">
          {initials}
        </AvatarFallback>
      </Avatar>
      {showName && name && (
        <span className={cn("truncate min-w-0 flex-1", nameClassName)}>{name}</span>
      )}
    </div>
  );
}
