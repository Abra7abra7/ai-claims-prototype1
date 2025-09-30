import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect } from "react";
import { User, Mail, Shield } from "lucide-react";

const Settings = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");

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
              <Mail className="h-5 w-5" />
              Účet
            </CardTitle>
            <CardDescription>Správa vášho účtu</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Pre zmenu hesla alebo zmazanie účtu kontaktujte administrátora.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default Settings;
