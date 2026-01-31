import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { trpc } from "@/lib/trpc";

// Estados del dictado por voz
type VoiceState = 'idle' | 'recording' | 'transcribing' | 'summarizing' | 'ready' | 'error';
import { useAuth } from "@/_core/hooks/useAuth";
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
  Loader2
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
  const [mensaje, setMensaje] = useState("");
  const [menciones, setMenciones] = useState<number[]>([]);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionSearch, setMentionSearch] = useState("");
  const [cursorPosition, setCursorPosition] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const utils = trpc.useUtils();
  
  // Estados para dictado por voz
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [recordingTime, setRecordingTime] = useState(0);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Queries
  const { data: mensajes, isLoading } = trpc.mensajes.byItem.useQuery({ itemId });
  const { data: usuarios } = trpc.users.list.useQuery();

  // Mutations
  const createMensaje = trpc.mensajes.create.useMutation({
    onSuccess: () => {
      setMensaje("");
      setMenciones([]);
      utils.mensajes.byItem.invalidate({ itemId });
      // Scroll al final
      setTimeout(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
      }, 100);
    },
    onError: (error) => {
      toast.error("Error al enviar mensaje: " + error.message);
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
      // Pegar el resumen en el input sin enviarlo
      setMensaje(data.summary_bullets);
      toast.success('Dictado completado');
      // Reset después de 2 segundos
      setTimeout(() => setVoiceState('idle'), 2000);
    },
    onError: (error) => {
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
        
        // Subir audio a S3 y transcribir
        try {
          const formData = new FormData();
          formData.append('file', audioBlob, 'audio.webm');
          
          const uploadResponse = await fetch('/api/upload', {
            method: 'POST',
            body: formData,
          });
          
          if (!uploadResponse.ok) {
            throw new Error('Error al subir audio');
          }
          
          const { url } = await uploadResponse.json();
          
          setVoiceState('summarizing');
          transcribirMutation.mutate({ audioUrl: url, language: 'es-MX' });
        } catch (err) {
          setVoiceState('error');
          setVoiceError('Error al procesar audio');
        }
      };
      
      mediaRecorder.start();
      setVoiceState('recording');
      setRecordingTime(0);
      
      // Contador de tiempo
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
  
  // Detener grabación
  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
    }
  };
  
  // Toggle grabación
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

    // Buscar si hay un @ antes del cursor
    const textBeforeCursor = value.substring(0, position);
    const lastAtIndex = textBeforeCursor.lastIndexOf("@");
    
    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);
      // Si no hay espacios después del @, mostrar sugerencias
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
    
    // Focus en el textarea
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 0);
  }, [mensaje, cursorPosition, menciones]);

  // Enviar mensaje
  const handleSend = () => {
    if (!mensaje.trim()) return;
    
    // Extraer menciones del texto
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
        return (
          <span key={i} className="text-primary font-medium bg-primary/10 px-1 rounded">
            {part}
          </span>
        );
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

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'superadmin': return 'bg-purple-500';
      case 'admin': return 'bg-blue-500';
      case 'supervisor': return 'bg-emerald-500';
      case 'jefe_residente': return 'bg-amber-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="flex flex-col h-full bg-background border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b bg-muted/30">
        <MessageCircle className="h-5 w-5 text-primary" />
        <div>
          <h3 className="font-semibold text-sm">Chat del Ítem</h3>
          {itemCodigo && <p className="text-xs text-muted-foreground">{itemCodigo}</p>}
        </div>
        <span className="ml-auto text-xs text-muted-foreground">
          {mensajes?.length || 0} mensajes
        </span>
      </div>

      {/* Mensajes */}
      <ScrollArea className="flex-1 p-4" ref={scrollRef as any}>
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          </div>
        ) : mensajes && mensajes.length > 0 ? (
          <div className="space-y-4">
            {mensajes.map((msg: any) => {
              const isOwn = msg.usuarioId === user?.id;
              return (
                <div 
                  key={msg.id} 
                  className={`flex gap-2 ${isOwn ? 'flex-row-reverse' : ''}`}
                >
                  <UserAvatar 
                    name={msg.usuario?.name} 
                    fotoUrl={msg.usuario?.fotoUrl}
                    size="md"
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
                      <p className="text-sm whitespace-pre-wrap break-words">
                        {formatMessageText(msg.texto)}
                      </p>
                      
                      {/* Acciones del mensaje */}
                      {canModifyMessages && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className={`absolute -right-8 top-0 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity ${
                                isOwn ? '-left-8 -right-auto' : ''
                              }`}
                            >
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
                  <Avatar className={`h-6 w-6 ${getRoleColor(u.role)}`}>
                    <AvatarFallback className="text-white text-xs">
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
                    {usuarios?.filter(u => u.id !== user?.id).map((u: any) => (
                      <button
                        key={u.id}
                        className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-muted rounded text-left text-sm"
                        onClick={() => {
                          setMensaje(prev => prev + `@${u.name} `);
                          setMenciones([...menciones, u.id]);
                        }}
                      >
                        <Avatar className={`h-6 w-6 ${getRoleColor(u.role)}`}>
                          <AvatarFallback className="text-white text-xs">
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
                <>✅ Resumen listo - revisa y envía</>
              )}
              {voiceState === 'error' && (
                <>❌ {voiceError || 'Error de dictado'}</>
              )}
            </div>
          )}
          
          <p className="text-xs text-muted-foreground mt-1">
            Enter para enviar · Shift+Enter para nueva línea · 🎙️ Dictar mensaje
          </p>
        </div>
      </div>
    </div>
  );
}
