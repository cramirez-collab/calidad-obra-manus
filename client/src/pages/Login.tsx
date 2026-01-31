import { useState, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, LogIn, Mail, Lock, AlertCircle } from "lucide-react";

const STORAGE_KEY = "oqc_login_remember";

export default function Login() {
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  
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
      // Limpiar el parámetro de error de la URL
      window.history.replaceState({}, "", "/login");
    }
  }, [searchString]);
  
  const loginMutation = trpc.auth.loginWithPassword.useMutation({
    onSuccess: () => {
      // Guardar o eliminar datos según la opción de recordar
      if (rememberMe) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ email, password }));
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
      // Recargar la página para obtener la sesión
      window.location.href = "/";
    },
    onError: (err) => {
      setError(err.message || "Error al iniciar sesión");
    },
  });
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    
    if (!email || !password) {
      setError("Por favor ingresa email y contraseña");
      return;
    }
    
    loginMutation.mutate({ email, password });
  };
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <Card className="w-full max-w-md shadow-xl border-0">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-4">
            <img 
              src="/logo-objetiva.png" 
              alt="Objetiva" 
              className="h-12 mx-auto"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>
          <CardTitle className="text-2xl font-bold text-[#002C63]">OQC</CardTitle>
          <CardDescription>Control de Calidad de Obra</CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
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
                  disabled={loginMutation.isPending}
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
                  disabled={loginMutation.isPending}
                  autoComplete="off"
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
                <span>{error}</span>
              </div>
            )}
            
            <Button 
              type="submit" 
              className="w-full bg-[#02B381] hover:bg-[#029a6e] text-white"
              disabled={loginMutation.isPending}
            >
              {loginMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Iniciando sesión...
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
