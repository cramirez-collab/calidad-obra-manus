import { useState, useRef } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { Camera, Loader2, User } from "lucide-react";
import { toast } from "sonner";

interface UserProfileProps {
  user: {
    id: number;
    name?: string | null;
    email?: string | null;
    role?: string;
    fotoUrl?: string | null;
    fotoBase64?: string | null;
  };
  size?: "sm" | "md" | "lg";
  editable?: boolean;
}

const sizeClasses = {
  sm: "h-8 w-8",
  md: "h-10 w-10",
  lg: "h-16 w-16",
};

const roleColors: Record<string, string> = {
  superadmin: "bg-purple-500",
  admin: "bg-blue-500",
  supervisor: "bg-green-500",
  jefe_residente: "bg-orange-500",
  residente: "bg-gray-500",
  desarrollador: "bg-cyan-500",
};

export function UserAvatar({ user, size = "md" }: UserProfileProps) {
  const initial = user.name?.charAt(0).toUpperCase() || "U";
  const bgColor = roleColors[user.role || "residente"] || "bg-gray-500";
  
  // Priorizar fotoBase64 sobre fotoUrl
  const imageUrl = user.fotoBase64 || (user.fotoUrl ? `/api/image/${user.fotoUrl}` : '');

  return (
    <Avatar className={`${sizeClasses[size]} border`}>
      {imageUrl ? (
        <AvatarImage src={imageUrl} alt={user.name || "Usuario"} className="object-cover" />
      ) : null}
      <AvatarFallback className={`${bgColor} text-white text-xs font-medium`}>
        {initial}
      </AvatarFallback>
    </Avatar>
  );
}

export function UserProfileEditor({ user, onUpdate }: { user: UserProfileProps["user"]; onUpdate?: () => void }) {
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const utils = trpc.useUtils();

  const updateFotoMutation = trpc.users.updateFoto.useMutation({
    onSuccess: (data) => {
      toast.success("Foto de perfil actualizada");
      // Actualizar el preview con la nueva foto
      if (data.fotoBase64) {
        setPreviewUrl(data.fotoBase64);
      }
      utils.auth.me.invalidate();
      utils.users.getMiPerfil.invalidate();
      onUpdate?.();
      setOpen(false);
    },
    onError: (error) => {
      toast.error("Error al actualizar foto: " + error.message);
    },
    onSettled: () => {
      setUploading(false);
    },
  });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar tamaño (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("La imagen no puede superar 5MB");
      return;
    }

    // Validar tipo
    if (!file.type.startsWith("image/")) {
      toast.error("Solo se permiten imágenes");
      return;
    }

    setUploading(true);

    // Convertir a base64
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setPreviewUrl(base64); // Mostrar preview inmediato
      updateFotoMutation.mutate({ fotoBase64: base64 });
    };
    reader.onerror = () => {
      toast.error("Error al leer la imagen");
      setUploading(false);
    };
    reader.readAsDataURL(file);
  };

  // Usar preview si existe, sino usar la foto actual del usuario
  const currentImageUrl = previewUrl || user.fotoBase64 || (user.fotoUrl ? `/api/image/${user.fotoUrl}` : '');
  const hasPhoto = !!currentImageUrl;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      setOpen(isOpen);
      if (!isOpen) setPreviewUrl(null); // Limpiar preview al cerrar
    }}>
      <DialogTrigger asChild>
        <button className="relative group">
          <UserAvatar user={{ ...user, fotoBase64: previewUrl || user.fotoBase64 }} size="lg" />
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
            <Camera className="h-5 w-5 text-white" />
          </div>
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Mi Foto de Perfil
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4 py-4">
          <Avatar className="h-24 w-24 border-2">
            {currentImageUrl ? (
              <AvatarImage src={currentImageUrl} alt={user.name || "Usuario"} className="object-cover" />
            ) : null}
            <AvatarFallback className={`${roleColors[user.role || "residente"]} text-white text-2xl font-medium`}>
              {user.name?.charAt(0).toUpperCase() || "U"}
            </AvatarFallback>
          </Avatar>
          <p className="text-sm text-muted-foreground text-center">
            {hasPhoto ? "Haz clic para cambiar tu foto" : "Sube una foto para que te reconozcan"}
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />
          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="w-full"
          >
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Subiendo...
              </>
            ) : (
              <>
                <Camera className="h-4 w-4 mr-2" />
                {hasPhoto ? "Cambiar Foto" : "Subir Foto"}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default UserAvatar;
