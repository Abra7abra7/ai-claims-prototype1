import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Shield } from "lucide-react";
import { z } from "zod";

const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Email je povinný")
    .email("Neplatná emailová adresa")
    .max(255, "Email je príliš dlhý"),
  password: z
    .string()
    .min(1, "Heslo je povinné"),
});

const signupSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Email je povinný")
    .email("Neplatná emailová adresa")
    .max(255, "Email je príliš dlhý"),
  password: z
    .string()
    .min(8, "Heslo musí mať aspoň 8 znakov")
    .max(72, "Heslo je príliš dlhé")
    .regex(/[A-Z]/, "Heslo musí obsahovať aspoň jedno veľké písmeno")
    .regex(/[a-z]/, "Heslo musí obsahovať aspoň jedno malé písmeno")
    .regex(/[0-9]/, "Heslo musí obsahovať aspoň jedno číslo"),
  fullName: z
    .string()
    .trim()
    .min(2, "Meno musí mať aspoň 2 znaky")
    .max(100, "Meno je príliš dlhé")
    .optional(),
});

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [errors, setErrors] = useState<{
    email?: string;
    password?: string;
    fullName?: string;
  }>({});
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate("/");
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        navigate("/");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setLoading(true);

    try {
      const trimmedEmail = email.trim();
      if (!trimmedEmail || !trimmedEmail.includes("@")) {
        setErrors({ email: "Zadajte platnú emailovú adresu" });
        setLoading(false);
        return;
      }

      const { error } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
        redirectTo: `${window.location.origin}/settings`,
      });

      if (error) throw error;

      toast({
        title: "Email odoslaný",
        description: "Skontrolujte svoju emailovú schránku pre pokyny na reset hesla.",
      });
      setShowResetPassword(false);
      setEmail("");
    } catch (error: any) {
      toast({
        title: "Chyba",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setLoading(true);

    try {
      const schema = isLogin ? loginSchema : signupSchema;
      const validationData = isLogin 
        ? { email: email.trim(), password }
        : { email: email.trim(), password, fullName: fullName.trim() };

      const result = schema.safeParse(validationData);
      
      if (!result.success) {
        const fieldErrors: any = {};
        result.error.errors.forEach((err) => {
          if (err.path[0]) {
            fieldErrors[err.path[0]] = err.message;
          }
        });
        setErrors(fieldErrors);
        setLoading(false);
        return;
      }

      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email: result.data.email,
          password: result.data.password,
        });

        if (error) throw error;

        toast({
          title: "Úspešné prihlásenie",
          description: "Vitajte späť!",
        });
      } else {
        const signupData = result.data as z.infer<typeof signupSchema>;
        const { error } = await supabase.auth.signUp({
          email: signupData.email,
          password: signupData.password,
          options: {
            data: {
              full_name: signupData.fullName || "",
            },
            emailRedirectTo: `${window.location.origin}/`,
          },
        });

        if (error) throw error;

        toast({
          title: "Úspešná registrácia",
          description: "Váš účet bol vytvorený.",
        });
      }
    } catch (error: any) {
      toast({
        title: "Chyba",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <Shield className="h-12 w-12 text-primary" />
          </div>
          <CardTitle>{isLogin ? "Prihlásenie" : "Registrácia"}</CardTitle>
          <CardDescription>
            {isLogin
              ? "Prihláste sa do Claims Dashboard"
              : "Vytvorte si nový účet"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {showResetPassword ? (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <Label htmlFor="reset-email">Email</Label>
                <Input
                  id="reset-email"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (errors.email) setErrors({ ...errors, email: undefined });
                  }}
                  required
                  placeholder="jan.novak@example.com"
                  className={errors.email ? "border-destructive" : ""}
                />
                {errors.email && (
                  <p className="text-sm text-destructive mt-1">{errors.email}</p>
                )}
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Odosiela sa..." : "Odoslať reset email"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => {
                  setShowResetPassword(false);
                  setErrors({});
                }}
              >
                Späť na prihlásenie
              </Button>
            </form>
          ) : (
            <form onSubmit={handleAuth} className="space-y-4">
              {!isLogin && (
                <div>
                  <Label htmlFor="fullName">Celé meno</Label>
                  <Input
                    id="fullName"
                    type="text"
                    value={fullName}
                    onChange={(e) => {
                      setFullName(e.target.value);
                      if (errors.fullName) setErrors({ ...errors, fullName: undefined });
                    }}
                    required
                    placeholder="Jan Novák"
                    className={errors.fullName ? "border-destructive" : ""}
                  />
                  {errors.fullName && (
                    <p className="text-sm text-destructive mt-1">{errors.fullName}</p>
                  )}
                </div>
              )}
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (errors.email) setErrors({ ...errors, email: undefined });
                  }}
                  required
                  placeholder="jan.novak@example.com"
                  className={errors.email ? "border-destructive" : ""}
                />
                {errors.email && (
                  <p className="text-sm text-destructive mt-1">{errors.email}</p>
                )}
              </div>
              <div>
                <Label htmlFor="password">Heslo</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errors.password) setErrors({ ...errors, password: undefined });
                  }}
                  required
                  placeholder="••••••••"
                  className={errors.password ? "border-destructive" : ""}
                />
                {errors.password && (
                  <p className="text-sm text-destructive mt-1">{errors.password}</p>
                )}
                {!isLogin && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Heslo musí mať aspoň 8 znakov, obsahovať veľké a malé písmená a číslo
                  </p>
                )}
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading
                  ? "Spracovávam..."
                  : isLogin
                  ? "Prihlásiť sa"
                  : "Registrovať sa"}
              </Button>
              {isLogin && (
                <Button
                  type="button"
                  variant="link"
                  className="w-full"
                  onClick={() => {
                    setShowResetPassword(true);
                    setErrors({});
                  }}
                >
                  Zabudli ste heslo?
                </Button>
              )}
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => setIsLogin(!isLogin)}
              >
                {isLogin
                  ? "Nemáte účet? Registrujte sa"
                  : "Máte účet? Prihláste sa"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
