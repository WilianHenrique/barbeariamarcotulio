import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Scissors } from "lucide-react";

const Auth = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        navigate("/");
      }
    };
    checkUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        navigate("/");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (isSignUp) {
        // Criar usuário com email interno
        const internalEmail = `${username.toLowerCase()}@barbearia.local`;
        const { data: authData, error: signUpError } = await supabase.auth.signUp({
          email: internalEmail,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`
          }
        });
        
        if (signUpError) throw signUpError;
        
        // Criar perfil com username
        if (authData.user) {
          const { error: profileError } = await supabase
            .from('profiles')
            .insert({
              user_id: authData.user.id,
              username: username.toLowerCase()
            });
          
          if (profileError) {
            // Se falhar ao criar perfil, deletar o usuário criado
            await supabase.auth.admin.deleteUser(authData.user.id);
            throw new Error("Nome de usuário já existe. Escolha outro.");
          }
        }
        
        toast.success("Conta criada com sucesso! Você já pode fazer login.");
        setIsSignUp(false);
      } else {
        // Buscar email pelo username
        const { data: emailData, error: emailError } = await supabase
          .rpc('get_email_by_username', { _username: username.toLowerCase() });
        
        if (emailError || !emailData) {
          throw new Error("Nome de usuário ou senha incorretos");
        }
        
        const { error } = await supabase.auth.signInWithPassword({
          email: emailData,
          password,
        });
        
        if (error) throw new Error("Nome de usuário ou senha incorretos");
        toast.success("Login realizado com sucesso!");
      }
    } catch (error: any) {
      toast.error(error.message || "Erro ao autenticar");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="absolute inset-0 bg-gradient-to-br from-background via-card/50 to-background" />
      
      <Card className="w-full max-w-md relative backdrop-blur-sm barber-card border-primary/30 shadow-glow">
        <CardHeader className="space-y-4 text-center">
          <div className="flex justify-center">
            <div className="bg-gradient-to-br from-primary to-primary/80 rounded-lg p-5 shadow-glow">
              <Scissors className="h-10 w-10 text-primary-foreground" />
            </div>
          </div>
          <CardTitle className="text-4xl font-display font-bold text-primary">
            Barbearia Marco Túlio
          </CardTitle>
          <CardDescription className="text-muted-foreground text-base">
            {isSignUp ? "Criar nova conta" : "Faça login para acessar o sistema"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAuth} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username" className="text-foreground">Nome de Usuário</Label>
              <Input
                id="username"
                type="text"
                placeholder="seu_usuario"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="bg-background border-border focus:border-primary focus:ring-primary"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-foreground">Senha</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="bg-background border-border focus:border-primary focus:ring-primary"
              />
            </div>
            <Button
              type="submit"
              className="w-full barber-button-primary font-semibold"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processando...
                </>
              ) : (
                isSignUp ? "Criar Conta" : "Entrar"
              )}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full text-muted-foreground hover:text-primary hover:bg-primary/5"
              onClick={() => setIsSignUp(!isSignUp)}
            >
              {isSignUp ? "Já tem conta? Faça login" : "Não tem conta? Cadastre-se"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;