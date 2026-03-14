import { useState, useRef, useEffect } from 'react';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/_core/hooks/useAuth';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Headset, ThumbsUp, ThumbsDown, Send, X } from 'lucide-react';
import { Streamdown } from 'streamdown';

interface Message {
  id?: number;
  role: 'user' | 'assistant';
  content: string;
  categoria?: string;
  conversacionId?: number;
  feedbackGiven?: boolean;
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
  const scrollRef = useRef<HTMLDivElement>(null);

  const chatMutation = trpc.asistente.chat.useMutation();
  const feedbackMutation = trpc.asistente.feedback.useMutation();

  // Stop pulse animation after first open
  useEffect(() => {
    if (open) setPulse(false);
  }, [open]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;
    const userMsg: Message = { role: 'user', content: text.trim() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const historial = messages.map(m => ({ role: m.role, content: m.content }));
      const result = await chatMutation.mutateAsync({
        pregunta: text.trim(),
        proyectoId,
        historial,
      });
      const assistantMsg: Message = {
        role: 'assistant',
        content: result.respuesta,
        categoria: result.categoria,
        conversacionId: result.conversacionId,
        feedbackGiven: false,
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Lo siento, hubo un error al procesar tu pregunta. Intenta de nuevo.',
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

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          className="fixed bottom-5 left-4 z-50 flex items-center gap-2 rounded-full shadow-xl transition-all duration-300 hover:scale-110 active:scale-95 group"
          style={{
            background: 'linear-gradient(135deg, #7C3AED 0%, #9333EA 50%, #A855F7 100%)',
            padding: '0',
          }}
          title="Asistente OQC"
        >
          {/* Pulse ring animation */}
          {pulse && (
            <span className="absolute inset-0 rounded-full animate-ping opacity-30" style={{ background: '#9333EA' }} />
          )}
          {/* Button content */}
          <span className="relative flex items-center gap-2 px-3.5 py-2.5 sm:px-4 sm:py-3">
            <Headset className="h-5 w-5 sm:h-6 sm:w-6 text-white drop-shadow-sm" strokeWidth={2.2} />
            <span className="hidden sm:inline text-sm font-semibold text-white tracking-wide">Asistente</span>
          </span>
        </button>
      </SheetTrigger>
      <SheetContent side="left" className="w-full sm:w-[420px] p-0 flex flex-col h-full [&>button]:hidden">
        {/* Header - Purple theme */}
        <div className="text-white px-4 py-3 flex items-center gap-3 shrink-0" style={{ background: 'linear-gradient(135deg, #7C3AED 0%, #9333EA 100%)' }}>
          <div className="rounded-full p-2" style={{ background: 'rgba(255,255,255,0.15)' }}>
            <Headset className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <SheetHeader className="p-0 space-y-0">
              <SheetTitle className="text-white text-base font-semibold">Asistente OQC</SheetTitle>
            </SheetHeader>
            <p className="text-purple-200 text-xs">Pregunta lo que necesites sobre la app</p>
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
              <p className="font-semibold text-gray-800">Hola {user?.name?.split(' ')[0] || 'Usuario'}</p>
              <p className="text-sm text-gray-500 mt-1">Soy tu asistente inteligente. Pregunta cualquier duda sobre cómo usar la aplicación.</p>
              <div className="mt-6 space-y-2">
                {SUGERENCIAS.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => sendMessage(s)}
                    className="w-full text-left px-4 py-2.5 bg-white rounded-lg border border-gray-200 text-sm text-gray-700 hover:border-purple-300 transition-colors"
                    style={{ ['--tw-hover-bg' as string]: '#FAF5FF' }}
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
                {msg.role === 'assistant' ? (
                  <>
                    {msg.categoria && (
                      <span className="text-[10px] text-gray-400 block mb-1">Categoría: {msg.categoria}</span>
                    )}
                    <div className="text-sm prose prose-sm max-w-none [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5 [&_li]:my-0.5">
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

        {/* Input */}
        <div className="border-t bg-white p-3 shrink-0">
          <div className="flex gap-2 items-end">
            <Textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Escribe tu pregunta..."
              className="min-h-[40px] max-h-[100px] resize-none text-sm"
              rows={1}
            />
            <Button
              size="icon"
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || isLoading}
              className="shrink-0 text-white"
              style={{ background: '#7C3AED' }}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
