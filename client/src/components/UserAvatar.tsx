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
  xs: "h-5 w-5 text-[8px]",
  sm: "h-6 w-6 text-[10px]",
  md: "h-8 w-8 text-xs",
  lg: "h-10 w-10 text-sm",
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
    <div className={cn("flex items-center gap-1.5", className)}>
      <Avatar className={cn("border shrink-0", sizeClasses[size])}>
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
        <span className={cn("truncate", nameClassName)}>{name}</span>
      )}
    </div>
  );
}
