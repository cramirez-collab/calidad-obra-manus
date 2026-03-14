import { useState, useRef, useEffect } from 'react';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/_core/hooks/useAuth';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { MessageCircle, ThumbsUp, ThumbsDown, Send, X } from 'lucide-react';
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
  const scrollRef = useRef<HTMLDivElement>(null);

  const chatMutation = trpc.asistente.chat.useMutation();
  const feedbackMutation = trpc.asistente.feedback.useMutation();

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
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-full px-4 py-3 shadow-lg transition-all duration-200 hover:scale-105"
          title="Abrir Asistente OQC"
        >
          <MessageCircle className="h-5 w-5" />
          <span className="hidden sm:inline text-sm font-medium">Asistente</span>
        </button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:w-[420px] p-0 flex flex-col h-full [&>button]:hidden">
        {/* Header */}
        <div className="bg-emerald-500 text-white px-4 py-3 flex items-center gap-3 shrink-0">
          <div className="bg-emerald-300/30 rounded-full p-2">
            <MessageCircle className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <SheetHeader className="p-0 space-y-0">
              <SheetTitle className="text-white text-base font-semibold">Asistente OQC</SheetTitle>
            </SheetHeader>
            <p className="text-emerald-100 text-xs">Pregunta lo que necesites sobre la app</p>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setOpen(false)} className="text-white hover:bg-emerald-600">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
          {messages.length === 0 && (
            <div className="text-center py-8">
              <div className="bg-emerald-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <MessageCircle className="h-8 w-8 text-emerald-500" />
              </div>
              <p className="font-semibold text-gray-800">Hola {user?.name?.split(' ')[0] || 'Usuario'}</p>
              <p className="text-sm text-gray-500 mt-1">Soy tu asistente inteligente. Pregunta cualquier duda sobre cómo usar la aplicación.</p>
              <div className="mt-6 space-y-2">
                {SUGERENCIAS.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => sendMessage(s)}
                    className="w-full text-left px-4 py-2.5 bg-white rounded-lg border border-gray-200 text-sm text-gray-700 hover:bg-emerald-50 hover:border-emerald-200 transition-colors"
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
                  ? 'bg-emerald-500 text-white rounded-br-md'
                  : 'bg-white border border-gray-200 text-gray-800 rounded-bl-md shadow-sm'
              }`}>
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
                        <button onClick={() => handleFeedback(i, true)} className="p-1 hover:bg-emerald-50 rounded" title="Sí, útil">
                          <ThumbsUp className="h-3.5 w-3.5 text-gray-400 hover:text-emerald-500" />
                        </button>
                        <button onClick={() => handleFeedback(i, false)} className="p-1 hover:bg-red-50 rounded" title="No me ayudó">
                          <ThumbsDown className="h-3.5 w-3.5 text-gray-400 hover:text-red-500" />
                        </button>
                      </div>
                    )}
                    {msg.feedbackGiven && (
                      <p className="text-[10px] text-emerald-500 mt-1">Gracias por tu feedback</p>
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
                  <span className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
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
              className="bg-emerald-500 hover:bg-emerald-600 shrink-0"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
