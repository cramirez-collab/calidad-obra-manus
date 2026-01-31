import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TermsContent } from "@/components/TermsModal";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

export default function Terminos() {
  const [, setLocation] = useLocation();
  
  return (
    <div className="container max-w-4xl py-6">
      <Button 
        variant="ghost" 
        onClick={() => setLocation('/bienvenida')}
        className="mb-4"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Volver
      </Button>
      
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Términos y Condiciones</CardTitle>
        </CardHeader>
        <CardContent>
          <TermsContent />
        </CardContent>
      </Card>
    </div>
  );
}
