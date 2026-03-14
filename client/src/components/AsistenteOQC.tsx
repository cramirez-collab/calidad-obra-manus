import { useState, useRef, useEffect, useCallback } from 'react';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/_core/hooks/useAuth';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Headset, ThumbsUp, ThumbsDown, Send, X, Image as ImageIcon, Mic, MicOff, Loader2 } from 'lucide-react';
import { Streamdown } from 'streamdown';

interface Message {
  id?: number;
  role: 'user' | 'assistant';
  content: string;
  categoria?: string;
  conversacionId?: number;
  feedbackGiven?: boolean;
  imagePreview?: string;
  isVoice?: boolean;
}

interface AsistenteOQCProps {
  proyectoId?: number;
}

const SUGERENCIAS = [
  '¿Cómo creo un nuevo ítem?',
  '¿Cómo subo mi programa semanal?',
  '¿Cómo reporto un incidente?',
  '¿Cómo funciona el corte de programa?',
];

export default function AsistenteOQC({ proyectoId }: AsistenteOQCProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [pulse, setPulse] = useState(true);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageMimeType, setImageMimeType] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const chatMutation = trpc.asistente.chat.useMutation();
  const feedbackMutation = trpc.asistente.feedback.useMutation();

  const firstName = user?.name?.split(' ')[0] || 'Usuario';

  useEffect(() => {
    if (open) setPulse(false);
  }, [open]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Cleanup recording on unmount
  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const handleImageSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      alert('La imagen es muy grande. Máximo 10MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setImagePreview(result);
      const base64 = result.split(',')[1];
      setImageBase64(base64);
      setImageMimeType(file.type);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }, []);

  const clearImage = useCallback(() => {
    setImagePreview(null);
    setImageBase64(null);
    setImageMimeType(null);
  }, []);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        if (audioBlob.size > 16 * 1024 * 1024) {
          alert('El audio es muy largo. Máximo 16MB.');
          return;
        }
        const reader = new FileReader();
        reader.onload = () => {
          const base64 = (reader.result as string).split(',')[1];
          sendMessage('🎤 Nota de voz', undefined, base64);
        };
        reader.readAsDataURL(audioBlob);
      };
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch {
      alert('No se pudo acceder al micrófono. Verifica los permisos.');
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  }, []);

  const sendMessage = async (text: string, imgOverride?: { base64: string; mime: string } | undefined, audioBase64?: string) => {
    if ((!text.trim() && !imageBase64 && !audioBase64) || isLoading) return;

    const imgB64 = imgOverride?.base64 || imageBase64;
    const imgMime = imgOverride?.mime || imageMimeType;

    const userMsg: Message = {
      role: 'user',
      content: text.trim() || (imgB64 ? '📷 Imagen enviada' : '🎤 Nota de voz'),
      imagePreview: imagePreview || undefined,
      isVoice: !!audioBase64,
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    clearImage();
    setIsLoading(true);

    try {
      const historial = messages.map(m => ({ role: m.role, content: m.content }));
      const result = await chatMutation.mutateAsync({
        pregunta: text.trim() || (imgB64 ? 'Analiza esta imagen' : 'Transcribe y responde'),
        proyectoId,
        historial,
        imagenBase64: imgB64 || undefined,
        imagenMimeType: imgMime || undefined,
        audioBase64: audioBase64 || undefined,
      });
      const assistantMsg: Message = {
        role: 'assistant',
        content: result.respuesta,
        categoria: result.categoria,
        conversacionId: result.conversacionId,
        feedbackGiven: false,
      };
      // If voice was transcribed, show the transcription
      if (result.preguntaTranscrita && audioBase64) {
        setMessages(prev => {
          const updated = [...prev];
          const lastUser = updated.findLastIndex(m => m.role === 'user');
          if (lastUser >= 0) {
            updated[lastUser] = { ...updated[lastUser], content: `🎤 "${result.preguntaTranscrita}"` };
          }
          return [...updated, assistantMsg];
        });
      } else {
        setMessages(prev => [...prev, assistantMsg]);
      }
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Lo siento ${firstName}, hubo un error. Intenta de nuevo.`,
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFeedback = async (msgIndex: number, util: boolean) => {
    const msg = messages[msgIndex];
    if (!msg.conversacionId || msg.feedbackGiven) return;
    try {
      await feedbackMutation.mutateAsync({ conversacionId: msg.conversacionId, util });
      setMessages(prev => prev.map((m, i) => i === msgIndex ? { ...m, feedbackGiven: true } : m));
    } catch { /* ignore */ }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          className="fixed bottom-5 left-4 z-50 flex items-center gap-2 rounded-full shadow-xl transition-all duration-300 hover:scale-110 active:scale-95"
          style={{ background: 'linear-gradient(135deg, #7C3AED 0%, #9333EA 50%, #A855F7 100%)' }}
          title="Asistente OQC"
        >
          {pulse && (
            <span className="absolute inset-0 rounded-full animate-ping opacity-30" style={{ background: '#9333EA' }} />
          )}
          <span className="relative flex items-center gap-2 px-3.5 py-2.5 sm:px-4 sm:py-3">
            <Headset className="h-5 w-5 sm:h-6 sm:w-6 text-white drop-shadow-sm" strokeWidth={2.2} />
            <span className="hidden sm:inline text-sm font-semibold text-white tracking-wide">Asistente</span>
          </span>
        </button>
      </SheetTrigger>
      <SheetContent side="left" className="w-full sm:w-[420px] p-0 flex flex-col h-full [&>button]:hidden">
        {/* Header */}
        <div className="text-white px-4 py-3 flex items-center gap-3 shrink-0" style={{ background: 'linear-gradient(135deg, #7C3AED 0%, #9333EA 100%)' }}>
          <div className="rounded-full p-2" style={{ background: 'rgba(255,255,255,0.15)' }}>
            <Headset className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <SheetHeader className="p-0 space-y-0">
              <SheetTitle className="text-white text-base font-semibold">Asistente OQC</SheetTitle>
            </SheetHeader>
            <p className="text-purple-200 text-xs">Texto, fotos y notas de voz</p>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setOpen(false)} className="text-white hover:bg-purple-700/50">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
          {messages.length === 0 && (
            <div className="text-center py-8">
              <div className="rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4" style={{ background: '#F3E8FF' }}>
                <Headset className="h-8 w-8" style={{ color: '#7C3AED' }} />
              </div>
              <p className="font-semibold text-gray-800">{'\u00a1'}Hola {firstName}! 👋</p>
              <p className="text-sm text-gray-500 mt-1">
                Soy tu asistente experto en ObjetivaQC. Pregúntame lo que sea: por texto, foto o nota de voz.
              </p>
              <div className="mt-6 space-y-2">
                {SUGERENCIAS.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => sendMessage(s)}
                    className="w-full text-left px-4 py-2.5 bg-white rounded-lg border border-gray-200 text-sm text-gray-700 hover:border-purple-300 transition-colors"
                    onMouseEnter={e => (e.currentTarget.style.background = '#FAF5FF')}
                    onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
                msg.role === 'user'
                  ? 'text-white rounded-br-md'
                  : 'bg-white border border-gray-200 text-gray-800 rounded-bl-md shadow-sm'
              }`} style={msg.role === 'user' ? { background: 'linear-gradient(135deg, #7C3AED, #9333EA)' } : undefined}>
                {msg.role === 'user' && msg.imagePreview && (
                  <img src={msg.imagePreview} alt="Imagen enviada" className="rounded-lg mb-2 max-h-40 w-auto" />
                )}
                {msg.role === 'assistant' ? (
                  <>
                    {msg.categoria && (
                      <span className="inline-block text-[10px] px-2 py-0.5 rounded-full mb-1.5" style={{ background: '#F3E8FF', color: '#7C3AED' }}>
                        {msg.categoria}
                      </span>
                    )}
                    <div className="text-sm prose prose-sm max-w-none [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5 [&_li]:my-0.5 [&_strong]:text-purple-700">
                      <Streamdown>{msg.content}</Streamdown>
                    </div>
                    {msg.conversacionId && !msg.feedbackGiven && (
                      <div className="flex items-center gap-1 mt-2 pt-1 border-t border-gray-100">
                        <span className="text-[10px] text-gray-400">¿Te fue útil?</span>
                        <button onClick={() => handleFeedback(i, true)} className="p-1 hover:bg-purple-50 rounded" title="Sí, útil">
                          <ThumbsUp className="h-3.5 w-3.5 text-gray-400 hover:text-purple-500" />
                        </button>
                        <button onClick={() => handleFeedback(i, false)} className="p-1 hover:bg-red-50 rounded" title="No me ayudó">
                          <ThumbsDown className="h-3.5 w-3.5 text-gray-400 hover:text-red-500" />
                        </button>
                      </div>
                    )}
                    {msg.feedbackGiven && (
                      <p className="text-[10px] mt-1" style={{ color: '#7C3AED' }}>Gracias por tu feedback</p>
                    )}
                  </>
                ) : (
                  <p className="text-sm">{msg.content}</p>
                )}
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
                <div className="flex gap-1">
                  <span className="w-2 h-2 rounded-full animate-bounce" style={{ background: '#9333EA', animationDelay: '0ms' }} />
                  <span className="w-2 h-2 rounded-full animate-bounce" style={{ background: '#9333EA', animationDelay: '150ms' }} />
                  <span className="w-2 h-2 rounded-full animate-bounce" style={{ background: '#9333EA', animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Image preview */}
        {imagePreview && (
          <div className="px-3 py-2 bg-purple-50 border-t flex items-center gap-2">
            <img src={imagePreview} alt="Preview" className="h-12 w-12 rounded-lg object-cover border border-purple-200" />
            <span className="text-xs text-purple-700 flex-1">Imagen adjunta</span>
            <button onClick={clearImage} className="p-1 hover:bg-purple-100 rounded">
              <X className="h-4 w-4 text-purple-500" />
            </button>
          </div>
        )}

        {/* Recording indicator */}
        {isRecording && (
          <div className="px-3 py-2 bg-red-50 border-t flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
            <span className="text-sm text-red-700 flex-1">Grabando... {formatTime(recordingTime)}</span>
            <button onClick={stopRecording} className="px-3 py-1 bg-red-500 text-white rounded-full text-xs font-medium hover:bg-red-600">
              Enviar
            </button>
          </div>
        )}

        {/* Input */}
        <div className="border-t bg-white p-3 shrink-0">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleImageSelect}
          />
          <div className="flex gap-2 items-end">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading || isRecording}
              className="shrink-0 p-2 rounded-full hover:bg-purple-50 transition-colors disabled:opacity-40"
              title="Enviar imagen o screenshot"
            >
              <ImageIcon className="h-5 w-5" style={{ color: '#7C3AED' }} />
            </button>
            <button
              onClick={isRecording ? stopRecording : startRecording}
              disabled={isLoading}
              className={`shrink-0 p-2 rounded-full transition-colors ${isRecording ? 'bg-red-100 hover:bg-red-200' : 'hover:bg-purple-50'}`}
              title={isRecording ? 'Detener grabación' : 'Grabar nota de voz'}
            >
              {isRecording ? (
                <MicOff className="h-5 w-5 text-red-500" />
              ) : (
                <Mic className="h-5 w-5" style={{ color: '#7C3AED' }} />
              )}
            </button>
            <Textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Pregunta lo que sea, ${firstName}...`}
              className="min-h-[40px] max-h-[100px] resize-none text-sm flex-1"
              rows={1}
              disabled={isRecording}
            />
            <Button
              size="icon"
              onClick={() => sendMessage(input)}
              disabled={(!input.trim() && !imageBase64) || isLoading || isRecording}
              className="shrink-0 text-white disabled:opacity-40"
              style={{ background: '#7C3AED' }}
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
