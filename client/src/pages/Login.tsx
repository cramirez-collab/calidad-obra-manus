import { useState, useEffect, useCallback } from "react";
import { useLocation, useSearch } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, LogIn, Mail, Lock, AlertCircle, RefreshCw } from "lucide-react";

const STORAGE_KEY = "oqc_login_remember";
const MAX_RETRIES = 2;

export default function Login() {
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);
  
  // Cargar datos guardados al iniciar
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const data = JSON.parse(saved);
        if (data.email) setEmail(data.email);
        if (data.password) setPassword(data.password);
        setRememberMe(true);
      }
    } catch (e) {
      // Ignorar errores de localStorage
    }
  }, []);
  
  // Verificar si hay error de OAuth en la URL
  useEffect(() => {
    const params = new URLSearchParams(searchString);
    const oauthError = params.get("error");
    if (oauthError) {
      setError(`Error de autenticación: ${oauthError}`);
      window.history.replaceState({}, "", "/login");
    }
  }, [searchString]);
  
  const loginMutation = trpc.auth.loginWithPassword.useMutation({
    onSuccess: () => {
      // Guardar o eliminar datos según la opción de recordar
      if (rememberMe) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ email: email.trim().toLowerCase(), password }));
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
      // Recargar la página para obtener la sesión
      window.location.href = "/";
    },
    onError: (err) => {
      // Si es error de servidor y no hemos agotado reintentos, reintentar automáticamente
      if (err.data?.code === 'INTERNAL_SERVER_ERROR' && retryCount < MAX_RETRIES) {
        setIsRetrying(true);
        setRetryCount(prev => prev + 1);
        setTimeout(() => {
          setIsRetrying(false);
          doLogin();
        }, 1000 * (retryCount + 1)); // Backoff: 1s, 2s
        return;
      }
      
      setRetryCount(0);
      
      // Mensajes amigables según el tipo de error
      if (err.data?.code === 'UNAUTHORIZED') {
        setError("Email o contraseña incorrectos. Verifica tus datos e intenta de nuevo.");
      } else if (err.data?.code === 'FORBIDDEN') {
        setError("Tu cuenta está inactiva. Contacta al administrador.");
      } else if (err.message?.includes('fetch') || err.message?.includes('network') || err.message?.includes('Failed')) {
        setError("Error de conexión. Verifica tu internet e intenta de nuevo.");
      } else {
        setError(err.message || "Error al iniciar sesión. Intenta de nuevo.");
      }
    },
  });
  
  const doLogin = useCallback(() => {
    if (!email.trim() || !password) return;
    loginMutation.mutate({ email: email.trim().toLowerCase(), password });
  }, [email, password, loginMutation]);
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setRetryCount(0);
    
    const trimmedEmail = email.trim();
    
    if (!trimmedEmail) {
      setError("Por favor ingresa tu email");
      return;
    }
    
    if (!password) {
      setError("Por favor ingresa tu contraseña");
      return;
    }
    
    // Validación básica de formato email
    if (!trimmedEmail.includes('@') || !trimmedEmail.includes('.')) {
      setError("El formato del email no es válido");
      return;
    }
    
    doLogin();
  };
  
  const isPending = loginMutation.isPending || isRetrying;
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <Card className="w-full max-w-md shadow-xl border-0">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-4">
            <img 
              src="/logo-objetiva.png" 
              alt="Objetiva" 
              style={{ maxHeight: '48px', width: 'auto' }}
              className="h-10 sm:h-12 mx-auto object-contain"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>
          <CardTitle className="text-xl sm:text-2xl font-bold text-[#002C63]">OQC</CardTitle>
          <CardDescription>Control de Calidad de Obra</CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-4 sm:space-y-6">
          {/* Formulario de login con contraseña */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">
                Email
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="tu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                  disabled={isPending}
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium">
                Contraseña
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="text"
                  placeholder="Tu contraseña"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10"
                  disabled={isPending}
                  autoComplete="off"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                La contraseña es visible para evitar errores al escribir
              </p>
            </div>
            
            {/* Casilla de recordar datos */}
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="remember" 
                checked={rememberMe}
                onCheckedChange={(checked) => setRememberMe(checked === true)}
              />
              <Label 
                htmlFor="remember" 
                className="text-sm font-normal cursor-pointer select-none"
              >
                Recordar mis datos
              </Label>
            </div>
            
            {error && (
              <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-lg">
                <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <span>{error}</span>
                  {error.includes('conexión') && (
                    <button 
                      type="button"
                      onClick={() => { setError(''); doLogin(); }}
                      className="block mt-1 text-xs text-blue-600 underline"
                    >
                      Reintentar
                    </button>
                  )}
                </div>
              </div>
            )}
            
            {isRetrying && (
              <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 p-3 rounded-lg">
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span>Reintentando conexión... ({retryCount}/{MAX_RETRIES})</span>
              </div>
            )}
            
            <Button 
              type="submit" 
              className="w-full bg-[#02B381] hover:bg-[#029a6e] text-white"
              disabled={isPending}
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isRetrying ? 'Reintentando...' : 'Iniciando sesión...'}
                </>
              ) : (
                <>
                  <LogIn className="mr-2 h-4 w-4" />
                  Iniciar Sesión
                </>
              )}
            </Button>
          </form>
          
          <p className="text-center text-xs text-muted-foreground">
            Si no tienes cuenta, contacta al administrador para que te registre.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
