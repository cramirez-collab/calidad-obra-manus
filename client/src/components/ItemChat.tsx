import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { trpc } from "@/lib/trpc";

// Estados del dictado por voz
type VoiceState = 'idle' | 'recording' | 'transcribing' | 'summarizing' | 'ready' | 'error';
import { useAuth } from "@/_core/hooks/useAuth";
import { useProject } from "@/contexts/ProjectContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { UserAvatar } from "@/components/UserAvatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Send, 
  AtSign, 
  MoreVertical, 
  Pencil, 
  Trash2,
  MessageCircle,
  X,
  Mic,
  MicOff,
  Loader2,
  Camera,
  Image as ImageIcon,
  SmilePlus,
  Images,
  FileText,
  Download
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const QUICK_REACTIONS = ["👍", "✅", "❌", "👀", "🔧", "⚠️"];

interface ItemChatProps {
  itemId: number;
  itemCodigo?: string;
}

export function ItemChat({ itemId, itemCodigo }: ItemChatProps) {
  const { user } = useAuth();
  const { selectedProjectId } = useProject();
  const [mensaje, setMensaje] = useState("");
  const [menciones, setMenciones] = useState<number[]>([]);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionSearch, setMentionSearch] = useState("");
  const [cursorPosition, setCursorPosition] = useState(0);
  const [showGallery, setShowGallery] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [sendingPhoto, setSendingPhoto] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const utils = trpc.useUtils();
  
  // Estados para dictado por voz
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [recordingTime, setRecordingTime] = useState(0);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Queries
  const { data: mensajes, isLoading, isError, error: queryError, refetch } = trpc.mensajes.byItem.useQuery(
    { itemId },
    { retry: 3, retryDelay: (attempt: number) => Math.min(1000 * 2 ** attempt, 10000) }
  );
  const { data: usuarios } = trpc.users.listForMentions.useQuery(
    selectedProjectId ? { proyectoId: selectedProjectId } : undefined
  );

  // Reacciones query
  const mensajeIds = useMemo(() => mensajes?.map((m: any) => m.id) || [], [mensajes]);
  const { data: reacciones } = trpc.mensajes.reacciones.useQuery(
    { mensajeIds },
    { enabled: mensajeIds.length > 0 }
  );

  // Galería de fotos
  const { data: fotosGaleria } = trpc.mensajes.fotosByItem.useQuery(
    { itemId },
    { enabled: showGallery }
  );

  // Mutations
  const createMensaje = trpc.mensajes.create.useMutation({
    onSuccess: () => {
      setMensaje("");
      setMenciones([]);
      utils.mensajes.byItem.invalidate({ itemId });
      setTimeout(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
      }, 100);
    },
    onError: (error: any) => {
      console.error('[ItemChat] Error al enviar mensaje:', error);
      if (error.data?.code === 'INTERNAL_SERVER_ERROR' || error.message?.includes('fetch')) {
        toast.error("Error de conexión. Reintentando...");
        setTimeout(() => {
          if (mensaje.trim()) {
            createMensaje.mutate({ itemId, texto: mensaje, menciones: menciones.length > 0 ? menciones : undefined });
          }
        }, 2000);
      } else {
        toast.error("Error al enviar mensaje: " + error.message);
      }
    }
  });

  const enviarFoto = trpc.mensajes.enviarFoto.useMutation({
    onSuccess: () => {
      setSendingPhoto(false);
      utils.mensajes.byItem.invalidate({ itemId });
      if (showGallery) utils.mensajes.fotosByItem.invalidate({ itemId });
      toast.success("Foto enviada");
      setTimeout(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
      }, 100);
    },
    onError: (error: any) => {
      setSendingPhoto(false);
      toast.error("Error al enviar foto: " + error.message);
    }
  });

  const deleteMensaje = trpc.mensajes.delete.useMutation({
    onSuccess: () => {
      toast.success("Mensaje eliminado");
      utils.mensajes.byItem.invalidate({ itemId });
    },
    onError: (error: any) => {
      toast.error("Error al eliminar: " + error.message);
    }
  });

  const toggleReaccion = trpc.mensajes.toggleReaccion.useMutation({
    onSuccess: () => {
      utils.mensajes.reacciones.invalidate({ mensajeIds });
    },
    onError: (error: any) => {
      toast.error("Error: " + error.message);
    }
  });

  // Mutation para transcribir audio
  const transcribirMutation = trpc.comentarios.transcribir.useMutation({
    onSuccess: (data: any) => {
      setVoiceState('ready');
      setMensaje(data.summary_bullets);
      toast.success('Dictado completado');
      setTimeout(() => setVoiceState('idle'), 2000);
    },
    onError: (error: any) => {
      setVoiceState('error');
      setVoiceError(error.message);
      toast.error('Error al transcribir: ' + error.message);
    }
  });

  // Iniciar grabación de audio
  const startRecording = async () => {
    try {
      setVoiceError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop());
        if (recordingTimerRef.current) {
          clearInterval(recordingTimerRef.current);
        }
        
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        if (audioBlob.size < 1000) {
          setVoiceState('error');
          setVoiceError('Audio muy corto o vacío');
          return;
        }
        
        setVoiceState('transcribing');
        
        try {
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64Data = reader.result as string;
            setVoiceState('summarizing');
            transcribirMutation.mutate({ 
              audioBase64: base64Data, 
              mimeType: 'audio/webm',
              language: 'es-MX' 
            });
          };
          reader.onerror = () => {
            setVoiceState('error');
            setVoiceError('Error al procesar audio');
          };
          reader.readAsDataURL(audioBlob);
        } catch (err) {
          setVoiceState('error');
          setVoiceError('Error al procesar audio');
        }
      };
      
      mediaRecorder.start();
      setVoiceState('recording');
      setRecordingTime(0);
      
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(prev => {
          if (prev >= 30) {
            stopRecording();
            return 30;
          }
          return prev + 1;
        });
      }, 1000);
      
    } catch (err) {
      setVoiceState('error');
      setVoiceError('Permiso de micrófono denegado');
      toast.error('No se pudo acceder al micrófono');
    }
  };
  
  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
    }
  };
  
  const toggleRecording = () => {
    if (voiceState === 'recording') {
      stopRecording();
    } else if (voiceState === 'idle' || voiceState === 'error' || voiceState === 'ready') {
      startRecording();
    }
  };

  // Manejar selección de foto
  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (file.size > 10 * 1024 * 1024) {
      toast.error("La foto no debe exceder 10MB");
      return;
    }
    
    setSendingPhoto(true);
    
    try {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = (reader.result as string).split(',')[1];
        enviarFoto.mutate({
          itemId,
          fotoBase64: base64,
          mimeType: file.type || 'image/jpeg',
          texto: "Foto adjunta",
        });
      };
      reader.onerror = () => {
        setSendingPhoto(false);
        toast.error("Error al leer la foto");
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setSendingPhoto(false);
      toast.error("Error al procesar la foto");
    }
    
    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Scroll al final cuando cargan los mensajes
  useEffect(() => {
    if (mensajes && scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight });
    }
  }, [mensajes]);

  // Detectar @ para mostrar lista de menciones
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    const position = e.target.selectionStart || 0;
    setMensaje(value);
    setCursorPosition(position);

    const textBeforeCursor = value.substring(0, position);
    const lastAtIndex = textBeforeCursor.lastIndexOf("@");
    
    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);
      if (!textAfterAt.includes(" ")) {
        setMentionSearch(textAfterAt.toLowerCase());
        setShowMentions(true);
        return;
      }
    }
    setShowMentions(false);
  };

  // Insertar mención
  const insertMention = useCallback((userId: number, userName: string) => {
    const textBeforeCursor = mensaje.substring(0, cursorPosition);
    const lastAtIndex = textBeforeCursor.lastIndexOf("@");
    const textAfterCursor = mensaje.substring(cursorPosition);
    
    const newText = mensaje.substring(0, lastAtIndex) + `@${userName} ` + textAfterCursor;
    setMensaje(newText);
    setMenciones([...menciones, userId]);
    setShowMentions(false);
    
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 0);
  }, [mensaje, cursorPosition, menciones]);

  // Enviar mensaje
  const handleSend = () => {
    if (!mensaje.trim()) return;
    
    const mentionRegex = /@(\w+\s?\w*)/g;
    const foundMentions: number[] = [];
    let match;
    
    while ((match = mentionRegex.exec(mensaje)) !== null) {
      const mentionName = match[1].trim().toLowerCase();
      const mentionedUser = usuarios?.find((u: any) => 
        u.name?.toLowerCase().includes(mentionName)
      );
      if (mentionedUser && !foundMentions.includes(mentionedUser.id)) {
        foundMentions.push(mentionedUser.id);
      }
    }

    createMensaje.mutate({
      itemId,
      texto: mensaje,
      menciones: foundMentions.length > 0 ? foundMentions : undefined
    });
  };

  // Enviar con Enter
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Filtrar usuarios para menciones
  const filteredUsers = usuarios?.filter((u: any) => 
    u.name?.toLowerCase().includes(mentionSearch) && u.id !== user?.id
  ).slice(0, 5);

  // Formatear texto con menciones resaltadas
  const formatMessageText = (text: string) => {
    const parts = text.split(/(@\w+\s?\w*)/g);
    return parts.map((part, i) => {
      if (part.startsWith("@")) {
        return (
          <span key={i} className="text-white italic font-semibold">
            {part}
          </span>
        );
      }
      return part;
    });
  };

  // Obtener reacciones agrupadas por mensaje
  const getReaccionesForMsg = (msgId: number) => {
    if (!reacciones) return [];
    const msgReacciones = reacciones.filter((r: any) => r.mensajeId === msgId);
    // Agrupar por emoji
    const grouped: Record<string, { emoji: string; count: number; userIds: number[]; myReaction: boolean }> = {};
    msgReacciones.forEach((r: any) => {
      if (!grouped[r.emoji]) {
        grouped[r.emoji] = { emoji: r.emoji, count: 0, userIds: [], myReaction: false };
      }
      grouped[r.emoji].count++;
      grouped[r.emoji].userIds.push(r.usuarioId);
      if (r.usuarioId === user?.id) grouped[r.emoji].myReaction = true;
    });
    return Object.values(grouped);
  };

  const canModifyMessages = user && ['superadmin', 'admin', 'supervisor'].includes(user.role);

  // Exportar chat a PDF
  const exportChatPDF = () => {
    if (!mensajes || mensajes.length === 0) {
      toast.error("No hay mensajes para exportar");
      return;
    }
    
    const win = window.open('', '_blank');
    if (!win) { toast.error("Permite ventanas emergentes"); return; }
    
    const removeAccents = (str: string) => str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    
    const rows = mensajes.map((msg: any) => {
      const fecha = format(new Date(msg.createdAt), "dd/MM/yyyy HH:mm", { locale: es });
      const nombre = removeAccents(msg.usuario?.name || 'Usuario');
      const tipo = msg.tipo === 'foto' ? 'Foto' : 'Texto';
      const texto = removeAccents(msg.texto || '');
      return `<tr>
        <td style="padding:6px 10px;border:1px solid #ddd;font-size:12px;white-space:nowrap">${fecha}</td>
        <td style="padding:6px 10px;border:1px solid #ddd;font-size:12px;font-weight:600">${nombre}</td>
        <td style="padding:6px 10px;border:1px solid #ddd;font-size:12px;text-align:center">${tipo}</td>
        <td style="padding:6px 10px;border:1px solid #ddd;font-size:12px">${texto}${msg.tipo === 'foto' && msg.fotoUrl ? `<br/><img src="${msg.fotoUrl}" style="max-width:200px;max-height:150px;margin-top:4px;border-radius:4px"/>` : ''}</td>
      </tr>`;
    }).join('');
    
    const codigo = removeAccents(itemCodigo || `Item-${itemId}`);
    
    win.document.write(`<!DOCTYPE html><html><head><title>Chat ${codigo}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; color: #333; }
        @media print { body { margin: 10px; } .no-print { display: none; } }
      </style></head><body>
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;border-bottom:3px solid #02B381;padding-bottom:12px">
        <div>
          <h1 style="margin:0;font-size:20px;color:#002C63">Conversacion del Item ${codigo}</h1>
          <p style="margin:4px 0 0;font-size:13px;color:#666">Exportado: ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: es })} | Total mensajes: ${mensajes.length}</p>
        </div>
      </div>
      <table style="width:100%;border-collapse:collapse;margin-top:10px">
        <thead><tr style="background:#002C63;color:white">
          <th style="padding:8px 10px;text-align:left;font-size:12px">Fecha</th>
          <th style="padding:8px 10px;text-align:left;font-size:12px">Usuario</th>
          <th style="padding:8px 10px;text-align:center;font-size:12px">Tipo</th>
          <th style="padding:8px 10px;text-align:left;font-size:12px">Mensaje</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="no-print" style="margin-top:20px;text-align:center">
        <button onclick="window.print()" style="padding:10px 24px;background:#02B381;color:white;border:none;border-radius:6px;cursor:pointer;font-size:14px">Imprimir / Guardar PDF</button>
      </div>
    </body></html>`);
    win.document.close();
    toast.success("PDF generado");
  };

  const getInitials = (name: string | null | undefined) => {
    if (!name) return "U";
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'superadmin': return 'bg-purple-500';
      case 'admin': return 'bg-blue-500';
      case 'supervisor': return 'bg-emerald-500';
      case 'jefe_residente': return 'bg-amber-500';
      default: return 'bg-gray-500';
    }
  };

  // Galería de fotos
  if (showGallery) {
    return (
      <div className="flex flex-col h-full bg-background border rounded-lg overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b bg-muted/30">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowGallery(false)}>
            <X className="h-4 w-4" />
          </Button>
          <Images className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-sm">Galería de Fotos</h3>
          <span className="ml-auto text-xs text-muted-foreground">
            {fotosGaleria?.length || 0} fotos
          </span>
        </div>
        <ScrollArea className="flex-1 p-3">
          {!fotosGaleria || fotosGaleria.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
              <ImageIcon className="h-8 w-8 mb-2 opacity-50" />
              <p className="text-sm">No hay fotos en este chat</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {fotosGaleria.map((foto: any) => (
                <div key={foto.id} className="relative group cursor-pointer" onClick={() => setLightboxUrl(foto.fotoUrl)}>
                  <img 
                    src={foto.fotoUrl} 
                    alt={foto.texto}
                    className="w-full h-32 object-cover rounded-lg border"
                  />
                  <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs p-1.5 rounded-b-lg">
                    <p className="truncate font-medium">{foto.usuarioNombre}</p>
                    <p className="opacity-75">{format(new Date(foto.createdAt), "d MMM HH:mm", { locale: es })}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Lightbox */}
        {lightboxUrl && (
          <div 
            className="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center p-4"
            onClick={() => setLightboxUrl(null)}
          >
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-4 right-4 text-white hover:bg-white/20 z-10"
              onClick={() => setLightboxUrl(null)}
            >
              <X className="h-6 w-6" />
            </Button>
            <img 
              src={lightboxUrl} 
              alt="Foto ampliada"
              className="max-w-full max-h-full object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b bg-muted/30">
        <MessageCircle className="h-5 w-5 text-primary" />
        <div>
          <h3 className="font-semibold text-sm">Chat del Ítem</h3>
          {itemCodigo && <p className="text-xs text-muted-foreground">{itemCodigo}</p>}
        </div>
        <div className="ml-auto flex items-center gap-1">
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8"
            onClick={exportChatPDF}
            title="Exportar chat a PDF"
          >
            <Download className="h-4 w-4 text-muted-foreground" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8"
            onClick={() => setShowGallery(true)}
            title="Galería de fotos"
          >
            <Images className="h-4 w-4 text-muted-foreground" />
          </Button>
          <span className="text-xs text-muted-foreground">
            {mensajes?.length || 0}
          </span>
        </div>
      </div>

      {/* Mensajes */}
      <ScrollArea className="flex-1 p-4" ref={scrollRef as any}>
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
            <p className="text-sm text-destructive mb-2">Error al cargar mensajes</p>
            <p className="text-xs text-muted-foreground mb-3">{queryError?.message || 'Intenta de nuevo'}</p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Reintentar
            </Button>
          </div>
        ) : mensajes && mensajes.length > 0 ? (
          <div className="space-y-4">
            {mensajes.map((msg: any) => {
              const isOwn = msg.usuarioId === user?.id;
              const msgReacciones = getReaccionesForMsg(msg.id);
              return (
                <div 
                  key={msg.id} 
                  className={`flex gap-2 ${isOwn ? 'flex-row-reverse' : ''}`}
                >
                  <UserAvatar 
                    name={msg.usuario?.name} 
                    fotoUrl={msg.usuario?.fotoUrl}
                    fotoBase64={(msg.usuario as any)?.fotoBase64}
                    size="lg"
                    showName={false}
                  />
                  
                  <div className={`flex flex-col max-w-[75%] ${isOwn ? 'items-end' : ''}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium">
                        {msg.usuario?.name || 'Usuario'}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(msg.createdAt), "d MMM HH:mm", { locale: es })}
                      </span>
                      {msg.editado && (
                        <span className="text-xs text-muted-foreground italic">(editado)</span>
                      )}
                    </div>
                    
                    <div className={`group relative rounded-lg px-3 py-2 ${
                      isOwn 
                        ? 'bg-primary text-primary-foreground' 
                        : 'bg-muted'
                    }`}>
                      {/* Foto si es mensaje tipo foto */}
                      {msg.tipo === 'foto' && msg.fotoUrl && (
                        <img 
                          src={msg.fotoUrl} 
                          alt="Foto"
                          className="max-w-full max-h-48 rounded-md mb-1 cursor-pointer hover:opacity-90 transition-opacity"
                          onClick={() => setLightboxUrl(msg.fotoUrl)}
                        />
                      )}
                      
                      {/* Texto del mensaje (ocultar si es solo "Foto adjunta") */}
                      {!(msg.tipo === 'foto' && msg.texto === 'Foto adjunta') && (
                        <p className="text-sm whitespace-pre-wrap break-words">
                          {formatMessageText(msg.texto)}
                        </p>
                      )}
                      
                      {/* Acciones del mensaje */}
                      <div className={`absolute -right-8 top-0 flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity ${
                        isOwn ? '-left-8 -right-auto' : ''
                      }`}>
                        {/* Botón de reacción */}
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-6 w-6">
                              <SmilePlus className="h-3 w-3" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-1" align={isOwn ? "start" : "end"}>
                            <div className="flex gap-1">
                              {QUICK_REACTIONS.map(emoji => (
                                <button
                                  key={emoji}
                                  className="text-lg hover:bg-muted rounded p-1 transition-colors"
                                  onClick={() => toggleReaccion.mutate({ mensajeId: msg.id, emoji })}
                                >
                                  {emoji}
                                </button>
                              ))}
                            </div>
                          </PopoverContent>
                        </Popover>
                        
                        {canModifyMessages && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-6 w-6">
                                <MoreVertical className="h-3 w-3" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align={isOwn ? "start" : "end"}>
                              <DropdownMenuItem 
                                className="text-destructive"
                                onClick={() => deleteMensaje.mutate({ id: msg.id })}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Eliminar
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    </div>
                    
                    {/* Reacciones debajo del mensaje */}
                    {msgReacciones.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {msgReacciones.map((r) => (
                          <button
                            key={r.emoji}
                            className={`flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded-full border transition-colors ${
                              r.myReaction 
                                ? 'bg-primary/10 border-primary/30 text-primary' 
                                : 'bg-muted border-border hover:bg-muted/80'
                            }`}
                            onClick={() => toggleReaccion.mutate({ mensajeId: msg.id, emoji: r.emoji })}
                          >
                            <span>{r.emoji}</span>
                            <span className="font-medium">{r.count}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
            <MessageCircle className="h-8 w-8 mb-2 opacity-50" />
            <p className="text-sm">No hay mensajes aún</p>
            <p className="text-xs">Sé el primero en comentar</p>
          </div>
        )}
      </ScrollArea>

      {/* Lightbox */}
      {lightboxUrl && (
        <div 
          className="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightboxUrl(null)}
        >
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-4 right-4 text-white hover:bg-white/20 z-10"
            onClick={() => setLightboxUrl(null)}
          >
            <X className="h-6 w-6" />
          </Button>
          <img 
            src={lightboxUrl} 
            alt="Foto ampliada"
            className="max-w-full max-h-full object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* Input de mensaje */}
      <div className="p-3 border-t bg-muted/30">
        <div className="relative">
          {/* Popover de menciones */}
          {showMentions && filteredUsers && filteredUsers.length > 0 && (
            <div className="absolute bottom-full left-0 right-0 mb-1 bg-popover border rounded-lg shadow-lg p-1 z-50">
              {filteredUsers.map((u: any) => (
                <button
                  key={u.id}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted rounded text-left text-sm"
                  onClick={() => insertMention(u.id, u.name || 'Usuario')}
                >
                  <Avatar className={`h-8 w-8 ${getRoleColor(u.role)}`}>
                    <AvatarFallback className="text-white text-sm font-semibold">
                      {getInitials(u.name)}
                    </AvatarFallback>
                  </Avatar>
                  <span>{u.name}</span>
                  <span className="text-xs text-muted-foreground ml-auto capitalize">
                    {u.role?.replace('_', ' ')}
                  </span>
                </button>
              ))}
            </div>
          )}
          
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Textarea
                ref={textareaRef}
                value={mensaje}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder="Escribe un mensaje... Usa @ para mencionar"
                className="min-h-[44px] max-h-32 resize-none pr-10"
                rows={1}
              />
              <Popover>
                <PopoverTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="absolute right-1 top-1 h-8 w-8"
                  >
                    <AtSign className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-1" align="end">
                  <p className="text-xs text-muted-foreground px-2 py-1 mb-1">
                    Mencionar usuario
                  </p>
                  <ScrollArea className="h-48">
                    {usuarios?.filter((u: any) => u.id !== user?.id).map((u: any) => (
                      <button
                        key={u.id}
                        className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-muted rounded text-left text-sm"
                        onClick={() => {
                          setMensaje(prev => prev + `@${u.name} `);
                          setMenciones([...menciones, u.id]);
                        }}
                      >
                        <Avatar className={`h-8 w-8 ${getRoleColor(u.role)}`}>
                          <AvatarFallback className="text-white text-sm font-semibold">
                            {getInitials(u.name)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="truncate">{u.name}</span>
                      </button>
                    ))}
                  </ScrollArea>
                </PopoverContent>
              </Popover>
            </div>
            
            {/* Botón de foto */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handlePhotoSelect}
            />
            <Button 
              variant="outline"
              className="h-[44px] px-3"
              onClick={() => fileInputRef.current?.click()}
              disabled={sendingPhoto}
              title="Enviar foto"
            >
              {sendingPhoto ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Camera className="h-4 w-4" />
              )}
            </Button>
            
            {/* Botón de micrófono para dictado por voz */}
            <Button 
              onClick={toggleRecording}
              disabled={voiceState === 'transcribing' || voiceState === 'summarizing'}
              variant={voiceState === 'recording' ? 'destructive' : 'outline'}
              className={`h-[44px] px-3 relative ${voiceState === 'recording' ? 'animate-pulse' : ''}`}
              title={voiceState === 'recording' ? 'Detener grabación' : 'Dictar mensaje'}
            >
              {voiceState === 'idle' || voiceState === 'ready' || voiceState === 'error' ? (
                <Mic className="h-4 w-4" />
              ) : voiceState === 'recording' ? (
                <>
                  <MicOff className="h-4 w-4" />
                  <span className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground text-xs rounded-full px-1.5 py-0.5 min-w-[20px]">
                    {recordingTime}s
                  </span>
                </>
              ) : (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
            </Button>
            
            <Button 
              onClick={handleSend} 
              disabled={!mensaje.trim() || createMensaje.isPending}
              className="h-[44px] px-4"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          
          {/* Estado del dictado */}
          {voiceState !== 'idle' && (
            <div className={`text-xs mt-1 flex items-center gap-1 ${
              voiceState === 'error' ? 'text-destructive' : 
              voiceState === 'ready' ? 'text-green-600' : 'text-muted-foreground'
            }`}>
              {voiceState === 'recording' && (
                <><span className="inline-block w-2 h-2 bg-red-500 rounded-full animate-pulse"></span> Grabando... (máx 30s)</>
              )}
              {voiceState === 'transcribing' && (
                <><Loader2 className="h-3 w-3 animate-spin" /> Transcribiendo audio...</>
              )}
              {voiceState === 'summarizing' && (
                <><Loader2 className="h-3 w-3 animate-spin" /> Generando resumen técnico...</>
              )}
              {voiceState === 'ready' && (
                <>Resumen listo - revisa y envía</>
              )}
              {voiceState === 'error' && (
                <>{voiceError || 'Error de dictado'}</>
              )}
            </div>
          )}
          
          <p className="text-xs text-muted-foreground mt-1">
            Enter enviar · Shift+Enter nueva línea
          </p>
        </div>
      </div>
    </div>
  );
}
