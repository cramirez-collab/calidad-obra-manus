import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface UserAvatarProps {
  name?: string | null;
  fotoUrl?: string | null;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  showName?: boolean;
  className?: string;
  nameClassName?: string;
}

// Tamaños aumentados 30% para mejor visibilidad
const sizeClasses = {
  xs: "h-5 w-5 min-w-[20px] text-[8px]",      // Era h-4 w-4 (16px) → ahora 20px
  sm: "h-7 w-7 min-w-[28px] text-[10px]",     // Era h-5 w-5 (20px) → ahora 28px
  md: "h-8 w-8 min-w-[32px] text-[11px]",     // Era h-6 w-6 (24px) → ahora 32px
  lg: "h-10 w-10 min-w-[40px] text-sm",       // Era h-8 w-8 (32px) → ahora 40px
  xl: "h-12 w-12 min-w-[48px] text-base",     // Nuevo tamaño extra grande
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
      <Avatar className={cn(
        "border-2 border-primary/20 shrink-0 flex-shrink-0 shadow-sm", 
        sizeClasses[size]
      )}>
        <AvatarImage 
          src={fotoUrl || ''} 
          alt={name || 'Usuario'} 
          className="object-cover"
        />
        <AvatarFallback className="bg-primary text-primary-foreground font-semibold">
          {initials}
        </AvatarFallback>
      </Avatar>
      {showName && name && (
        <span className={cn("truncate min-w-0 flex-1 font-medium", nameClassName)}>{name}</span>
      )}
    </div>
  );
}
