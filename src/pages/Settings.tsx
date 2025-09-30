import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect } from "react";
import { User, Mail, Shield, Lock } from "lucide-react";
import { z } from "zod";

const passwordSchema = z.object({
  currentPassword: z.string().min(1, "Súčasné heslo je povinné"),
  newPassword: z
    .string()
    .min(8, "Heslo musí mať aspoň 8 znakov")
    .max(72, "Heslo je príliš dlhé")
    .regex(/[A-Z]/, "Heslo musí obsahovať aspoň jedno veľké písmeno")
    .regex(/[a-z]/, "Heslo musí obsahovať aspoň jedno malé písmeno")
    .regex(/[0-9]/, "Heslo musí obsahovať aspoň jedno číslo"),
  confirmPassword: z.string().min(1, "Potvrdenie hesla je povinné"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Heslá sa nezhodujú",
  path: ["confirmPassword"],
});

const Settings = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordErrors, setPasswordErrors] = useState<{
    currentPassword?: string;
    newPassword?: string;
    confirmPassword?: string;
  }>({});

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      const { data: userRole } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();

      if (profile) {
        setFullName(profile.full_name);
        setEmail(profile.email);
      }
      if (userRole) {
        setRole(userRole.role);
      }
    } catch (error: any) {
      toast({
        title: "Chyba pri načítaní profilu",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from("profiles")
        .update({ full_name: fullName })
        .eq("id", user.id);

      if (error) throw error;

      toast({
        title: "Profil aktualizovaný",
        description: "Vaše údaje boli úspešne uložené.",
      });
    } catch (error: any) {
      toast({
        title: "Chyba pri aktualizácii profilu",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordErrors({});
    setPasswordLoading(true);

    try {
      const validationData = {
        currentPassword,
        newPassword,
        confirmPassword,
      };

      const result = passwordSchema.safeParse(validationData);
      
      if (!result.success) {
        const fieldErrors: any = {};
        result.error.errors.forEach((err) => {
          if (err.path[0]) {
            fieldErrors[err.path[0]] = err.message;
          }
        });
        setPasswordErrors(fieldErrors);
        setPasswordLoading(false);
        return;
      }

      // First verify current password
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) throw new Error("Používateľ nie je prihlásený");

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });

      if (signInError) {
        setPasswordErrors({ currentPassword: "Nesprávne súčasné heslo" });
        setPasswordLoading(false);
        return;
      }

      // Update password
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) throw updateError;

      toast({
        title: "Heslo zmenené",
        description: "Vaše heslo bolo úspešne aktualizované.",
      });

      // Clear form
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error: any) {
      toast({
        title: "Chyba pri zmene hesla",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setPasswordLoading(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <p className="text-muted-foreground">Načítavam...</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Nastavenia</h1>
          <p className="text-muted-foreground mt-1">Spravujte svoj účet a nastavenia</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Profil používateľa
            </CardTitle>
            <CardDescription>Aktualizujte svoje osobné informácie</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">Celé meno</Label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Vaše celé meno"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground">
                  Email nie je možné zmeniť
                </p>
              </div>

              <Button type="submit">Uložiť zmeny</Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Rola používateľa
            </CardTitle>
            <CardDescription>Vaša aktuálna rola v systéme</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label>Rola</Label>
              <Input
                value={role.toUpperCase()}
                disabled
                className="bg-muted font-medium"
              />
              <p className="text-xs text-muted-foreground">
                Rolu je možné zmeniť len cez administrátora
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Zmena hesla
            </CardTitle>
            <CardDescription>Aktualizujte svoje prihlasovacie heslo</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="currentPassword">Súčasné heslo</Label>
                <Input
                  id="currentPassword"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => {
                    setCurrentPassword(e.target.value);
                    if (passwordErrors.currentPassword) 
                      setPasswordErrors({ ...passwordErrors, currentPassword: undefined });
                  }}
                  placeholder="••••••••"
                  className={passwordErrors.currentPassword ? "border-destructive" : ""}
                />
                {passwordErrors.currentPassword && (
                  <p className="text-sm text-destructive">{passwordErrors.currentPassword}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="newPassword">Nové heslo</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value);
                    if (passwordErrors.newPassword) 
                      setPasswordErrors({ ...passwordErrors, newPassword: undefined });
                  }}
                  placeholder="••••••••"
                  className={passwordErrors.newPassword ? "border-destructive" : ""}
                />
                {passwordErrors.newPassword && (
                  <p className="text-sm text-destructive">{passwordErrors.newPassword}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Heslo musí mať aspoň 8 znakov, obsahovať veľké a malé písmená a číslo
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Potvrďte nové heslo</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (passwordErrors.confirmPassword) 
                      setPasswordErrors({ ...passwordErrors, confirmPassword: undefined });
                  }}
                  placeholder="••••••••"
                  className={passwordErrors.confirmPassword ? "border-destructive" : ""}
                />
                {passwordErrors.confirmPassword && (
                  <p className="text-sm text-destructive">{passwordErrors.confirmPassword}</p>
                )}
              </div>

              <Button type="submit" disabled={passwordLoading}>
                {passwordLoading ? "Mení sa..." : "Zmeniť heslo"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default Settings;
