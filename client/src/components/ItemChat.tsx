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
  Image as ImageIcon
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fotoInputRef = useRef<HTMLInputElement>(null);
  const utils = trpc.useUtils();
  
  // Lightbox
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  
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
    { retry: 3, retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000) }
  );
  const { data: usuarios } = trpc.users.listForMentions.useQuery(
    selectedProjectId ? { proyectoId: selectedProjectId } : undefined
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
    onError: (error) => {
      console.error('[ItemChat] Error al enviar mensaje:', error);
      if (error.data?.code === 'INTERNAL_SERVER_ERROR' || error.message.includes('fetch')) {
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
      utils.mensajes.byItem.invalidate({ itemId });
      toast.success("Foto enviada");
      setTimeout(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
      }, 100);
    },
    onError: (error: any) => {
      toast.error("Error al enviar foto: " + error.message);
    }
  });

  const deleteMensaje = trpc.mensajes.delete.useMutation({
    onSuccess: () => {
      toast.success("Mensaje eliminado");
      utils.mensajes.byItem.invalidate({ itemId });
    },
    onError: (error) => {
      toast.error("Error al eliminar: " + error.message);
    }
  });

  // Mutation para transcribir audio
  const transcribirMutation = trpc.comentarios.transcribir.useMutation({
    onSuccess: (data) => {
      setVoiceState('ready');
      setMensaje(data.summary_bullets);
      toast.success('Dictado completado');
      setTimeout(() => setVoiceState('idle'), 2000);
    },
    onError: (error) => {
      setVoiceState('error');
      setVoiceError(error.message);
      toast.error('Error al transcribir: ' + error.message);
    }
  });

  // Foto handler
  const handleFotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error("La foto no debe superar 10MB");
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      enviarFoto.mutate({ itemId, fotoBase64: base64 });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

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
      const mentionedUser = usuarios?.find(u => 
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

  // Enviar con Enter (Shift+Enter para nueva línea)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Filtrar usuarios para menciones
  const filteredUsers = usuarios?.filter(u => 
    u.name?.toLowerCase().includes(mentionSearch) && u.id !== user?.id
  ).slice(0, 5);

  // Formatear texto con menciones resaltadas
  const formatMessageText = (text: string) => {
    const parts = text.split(/(@\w+\s?\w*)/g);
    return parts.map((part, i) => {
      if (part.startsWith("@")) {
        return <span key={i} className="text-[#02B381] font-semibold">{part}</span>;
      }
      return part;
    });
  };

  // Verificar si el usuario puede editar/eliminar mensajes
  const canModifyMessages = user && ['superadmin', 'admin', 'supervisor'].includes(user.role);

  const getInitials = (name: string | null | undefined) => {
    if (!name) return "U";
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };

  const getRoleColor = (role: string | undefined) => {
    switch (role) {
      case 'superadmin': return 'bg-red-600';
      case 'admin': return 'bg-[#002C63]';
      case 'supervisor': return 'bg-[#02B381]';
      case 'jefe_residente': return 'bg-amber-600';
      case 'residente': return 'bg-blue-500';
      case 'segurista': return 'bg-orange-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="flex flex-col h-full bg-background border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b bg-[#002C63]/5">
        <MessageCircle className="h-4 w-4 text-[#002C63]" />
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm text-[#002C63]">Chat del Ítem</h3>
          {itemCodigo && <p className="text-[10px] text-muted-foreground">{itemCodigo}</p>}
        </div>
        <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
          {mensajes?.length || 0} msgs
        </span>
      </div>

      {/* Mensajes */}
      <ScrollArea className="flex-1 p-3" ref={scrollRef as any}>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
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
          <div className="space-y-3">
            {mensajes.map((msg: any) => {
              const isOwn = msg.usuarioId === user?.id;
              const isFoto = msg.tipo === 'foto';
              return (
                <div 
                  key={msg.id} 
                  className={`flex gap-2 ${isOwn ? 'flex-row-reverse' : ''}`}
                >
                  <Avatar className={`h-7 w-7 shrink-0 ${getRoleColor(msg.usuario?.role)}`}>
                    <AvatarFallback className="text-white text-[10px] font-semibold">
                      {getInitials(msg.usuario?.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className={`max-w-[80%] ${isOwn ? 'items-end' : 'items-start'} flex flex-col`}>
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-[10px] font-medium text-[#002C63]">
                        {msg.usuario?.name || 'Usuario'}
                      </span>
                      <span className="text-[9px] text-muted-foreground">
                        {format(new Date(msg.createdAt), "d MMM HH:mm", { locale: es })}
                      </span>
                      {msg.editado && <span className="text-[8px] text-muted-foreground italic">(editado)</span>}
                    </div>
                    <div className={`rounded-xl px-3 py-2 text-sm ${
                      isOwn 
                        ? 'bg-[#02B381] text-white rounded-tr-sm' 
                        : 'bg-muted rounded-tl-sm'
                    }`}>
                      {isFoto && msg.fotoUrl ? (
                        <div className="space-y-1">
                          <img 
                            src={msg.fotoUrl} 
                            alt="Foto" 
                            className="max-w-[200px] max-h-[200px] rounded-lg cursor-pointer object-cover border border-white/20"
                            onClick={() => setLightboxUrl(msg.fotoUrl)}
                          />
                          {msg.texto && msg.texto !== '[Foto]' && (
                            <p className="text-xs mt-1">{formatMessageText(msg.texto)}</p>
                          )}
                        </div>
                      ) : (
                        <p className="whitespace-pre-wrap break-words text-[13px]">{formatMessageText(msg.texto)}</p>
                      )}
                    </div>
                    {/* Acciones de mensaje */}
                    {canModifyMessages && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-5 w-5 mt-0.5 opacity-40 hover:opacity-100">
                            <MoreVertical className="h-3 w-3" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align={isOwn ? "end" : "start"}>
                          <DropdownMenuItem 
                            className="text-destructive"
                            onClick={() => deleteMensaje.mutate({ id: msg.id })}
                          >
                            <Trash2 className="h-3 w-3 mr-2" /> Eliminar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
            <MessageCircle className="h-8 w-8 mb-2 opacity-30" />
            <p className="text-sm">No hay mensajes aún</p>
            <p className="text-xs">Sé el primero en comentar</p>
          </div>
        )}
      </ScrollArea>

      {/* Input de mensaje */}
      <div className="p-2.5 border-t bg-muted/20">
        <div className="relative">
          {/* Popover de menciones */}
          {showMentions && filteredUsers && filteredUsers.length > 0 && (
            <div className="absolute bottom-full left-0 right-0 mb-1 bg-popover border rounded-lg shadow-lg p-1 z-50 max-h-40 overflow-y-auto">
              {filteredUsers.map((u: any) => (
                <button
                  key={u.id}
                  className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-muted rounded text-left text-sm"
                  onClick={() => insertMention(u.id, u.name || 'Usuario')}
                >
                  <Avatar className={`h-6 w-6 ${getRoleColor(u.role)}`}>
                    <AvatarFallback className="text-white text-[9px] font-semibold">
                      {getInitials(u.name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-xs truncate">{u.name}</span>
                  <span className="text-[9px] text-muted-foreground ml-auto capitalize">
                    {u.role?.replace('_', ' ')}
                  </span>
                </button>
              ))}
            </div>
          )}
          
          <div className="flex gap-1.5 items-end">
            {/* Botón de foto */}
            <input
              ref={fotoInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleFotoSelect}
            />
            <Button 
              variant="ghost" 
              size="icon"
              className="h-9 w-9 shrink-0 text-[#002C63] hover:bg-[#002C63]/10"
              onClick={() => fotoInputRef.current?.click()}
              disabled={enviarFoto.isPending}
              title="Enviar foto"
            >
              {enviarFoto.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Camera className="h-4 w-4" />
              )}
            </Button>
            
            <div className="flex-1 relative">
              <Textarea
                ref={textareaRef}
                value={mensaje}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder="Escribe... Usa @ para mencionar"
                className="min-h-[38px] max-h-24 resize-none text-sm pr-8 py-2"
                rows={1}
              />
              <Popover>
                <PopoverTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="absolute right-0.5 top-0.5 h-7 w-7"
                  >
                    <AtSign className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-56 p-1" align="end">
                  <p className="text-[10px] text-muted-foreground px-2 py-1">
                    Mencionar usuario
                  </p>
                  <ScrollArea className="h-40">
                    {usuarios?.filter(u => u.id !== user?.id).map((u: any) => (
                      <button
                        key={u.id}
                        className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-muted rounded text-left text-xs"
                        onClick={() => {
                          setMensaje(prev => prev + `@${u.name} `);
                          setMenciones([...menciones, u.id]);
                        }}
                      >
                        <Avatar className={`h-6 w-6 ${getRoleColor(u.role)}`}>
                          <AvatarFallback className="text-white text-[9px] font-semibold">
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
            
            {/* Botón de micrófono */}
            <Button 
              onClick={toggleRecording}
              disabled={voiceState === 'transcribing' || voiceState === 'summarizing'}
              variant={voiceState === 'recording' ? 'destructive' : 'ghost'}
              size="icon"
              className={`h-9 w-9 shrink-0 ${voiceState === 'recording' ? 'animate-pulse' : 'text-[#002C63] hover:bg-[#002C63]/10'}`}
              title={voiceState === 'recording' ? 'Detener' : 'Dictar'}
            >
              {voiceState === 'idle' || voiceState === 'ready' || voiceState === 'error' ? (
                <Mic className="h-4 w-4" />
              ) : voiceState === 'recording' ? (
                <MicOff className="h-4 w-4" />
              ) : (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
            </Button>
            
            {/* Botón enviar */}
            <Button 
              onClick={handleSend} 
              disabled={!mensaje.trim() || createMensaje.isPending}
              size="icon"
              className="h-9 w-9 shrink-0 bg-[#02B381] hover:bg-[#029a6e]"
            >
              {createMensaje.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
          
          {/* Estado del dictado */}
          {voiceState !== 'idle' && (
            <div className={`text-[10px] mt-1 flex items-center gap-1 ${
              voiceState === 'error' ? 'text-destructive' : 
              voiceState === 'ready' ? 'text-[#02B381]' : 'text-muted-foreground'
            }`}>
              {voiceState === 'recording' && (
                <><span className="inline-block w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></span> Grabando {recordingTime}s</>
              )}
              {voiceState === 'transcribing' && (
                <><Loader2 className="h-3 w-3 animate-spin" /> Transcribiendo...</>
              )}
              {voiceState === 'summarizing' && (
                <><Loader2 className="h-3 w-3 animate-spin" /> Generando resumen...</>
              )}
              {voiceState === 'ready' && <>Resumen listo - revisa y envía</>}
              {voiceState === 'error' && <>{voiceError || 'Error de dictado'}</>}
            </div>
          )}
        </div>
      </div>

      {/* Lightbox para fotos */}
      {lightboxUrl && (
        <div 
          className="fixed inset-0 bg-black/90 z-[9999] flex items-center justify-center p-4"
          onClick={() => setLightboxUrl(null)}
        >
          <button 
            className="absolute top-4 right-4 text-white bg-black/50 rounded-full p-2 hover:bg-black/70 z-10"
            onClick={() => setLightboxUrl(null)}
          >
            <X className="h-6 w-6" />
          </button>
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
