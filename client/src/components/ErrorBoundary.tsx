import { cn } from "@/lib/utils";
import { AlertTriangle, RotateCcw, Home } from "lucide-react";
import { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    // Log error to console for debugging (server-side only in production)
    console.error("[ErrorBoundary] Error capturado:", error);
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error details for debugging (only visible in console, not to user)
    console.error("[ErrorBoundary] Detalles del error:", {
      error: error.message,
      componentStack: errorInfo.componentStack,
    });
  }

  render() {
    if (this.state.hasError) {
      // MENSAJE LIMPIO PARA EL USUARIO - SIN CÓDIGO TÉCNICO
      return (
        <div className="flex items-center justify-center min-h-screen p-8 bg-slate-50">
          <div className="flex flex-col items-center w-full max-w-md p-8 bg-white rounded-xl shadow-lg">
            <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mb-6">
              <AlertTriangle
                size={32}
                className="text-red-500"
              />
            </div>

            <h2 className="text-xl font-semibold text-gray-900 mb-2 text-center">
              Ocurrió un error inesperado
            </h2>
            
            <p className="text-gray-500 text-center mb-6">
              Lo sentimos, algo salió mal. Por favor intenta recargar la página o volver al inicio.
            </p>

            <div className="flex gap-3 w-full">
              <button
                onClick={() => window.location.href = '/'}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg",
                  "bg-gray-100 text-gray-700",
                  "hover:bg-gray-200 cursor-pointer transition-colors"
                )}
              >
                <Home size={18} />
                Inicio
              </button>
              
              <button
                onClick={() => window.location.reload()}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg",
                  "bg-[#02B381] text-white",
                  "hover:bg-[#02B381]/90 cursor-pointer transition-colors"
                )}
              >
                <RotateCcw size={18} />
                Recargar
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
