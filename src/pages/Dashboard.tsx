import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/hooks/use-toast";
import { Plus, FileText, Calendar, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { sk } from "date-fns/locale";

interface Claim {
  id: string;
  claim_number: string;
  client_name: string;
  policy_number: string;
  claim_type: string;
  status: string;
  created_at: string;
}

export default function Dashboard() {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [newClaim, setNewClaim] = useState({
    claim_number: "",
    client_name: "",
    policy_number: "",
    claim_type: "",
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchClaims();
    checkAdminRole();
  }, []);

  const checkAdminRole = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      setIsAdmin(!!data);
    }
  };

  const fetchClaims = async () => {
    try {
      const { data, error } = await supabase
        .from("claims")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setClaims(data || []);
    } catch (error: any) {
      toast({
        title: "Chyba pri načítaní",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      const { error } = await supabase.from("claims").insert({
        ...newClaim,
        created_by: user.id,
      });

      if (error) throw error;

      toast({
        title: "Úspech",
        description: "Poistná udalosť bola vytvorená",
      });

      setDialogOpen(false);
      setNewClaim({
        claim_number: "",
        client_name: "",
        policy_number: "",
        claim_type: "",
      });
      fetchClaims();
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

  const handleDeleteClaim = async (claimId: string) => {
    try {
      const { error } = await supabase
        .from("claims")
        .delete()
        .eq("id", claimId);

      if (error) throw error;

      toast({
        title: "Claim zmazaný",
        description: "Poistná udalosť bola úspešne odstránená",
      });

      fetchClaims();
    } catch (error: any) {
      toast({
        title: "Chyba pri mazaní",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
            <p className="text-muted-foreground mt-1">
              Správa poistných udalostí
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nová poistná udalosť
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nová poistná udalosť</DialogTitle>
                <DialogDescription>
                  Vytvorte novú poistnú udalosť
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateClaim} className="space-y-4">
                <div>
                  <Label htmlFor="claim_number">Číslo poistnej udalosti</Label>
                  <Input
                    id="claim_number"
                    value={newClaim.claim_number}
                    onChange={(e) =>
                      setNewClaim({ ...newClaim, claim_number: e.target.value })
                    }
                    required
                    placeholder="PU-2025-001"
                  />
                </div>
                <div>
                  <Label htmlFor="client_name">Meno klienta</Label>
                  <Input
                    id="client_name"
                    value={newClaim.client_name}
                    onChange={(e) =>
                      setNewClaim({ ...newClaim, client_name: e.target.value })
                    }
                    required
                    placeholder="Jan Novák"
                  />
                </div>
                <div>
                  <Label htmlFor="policy_number">Číslo poistky</Label>
                  <Input
                    id="policy_number"
                    value={newClaim.policy_number}
                    onChange={(e) =>
                      setNewClaim({ ...newClaim, policy_number: e.target.value })
                    }
                    required
                    placeholder="POL-123456"
                  />
                </div>
                <div>
                  <Label htmlFor="claim_type">Typ poistnej udalosti</Label>
                  <Select
                    value={newClaim.claim_type}
                    onValueChange={(value) =>
                      setNewClaim({ ...newClaim, claim_type: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Vyberte typ" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Úraz">Úraz</SelectItem>
                      <SelectItem value="Choroba">Choroba</SelectItem>
                      <SelectItem value="Invalidita">Invalidita</SelectItem>
                      <SelectItem value="Smrť">Smrť</SelectItem>
                      <SelectItem value="Hospitalizácia">Hospitalizácia</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Vytváranie..." : "Vytvoriť"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {loading && !claims.length ? (
          <div className="text-center py-12 text-muted-foreground">
            Načítavam...
          </div>
        ) : claims.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                Zatiaľ nemáte žiadne poistné udalosti
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {claims.map((claim) => (
              <Card key={claim.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <Link to={`/claim/${claim.id}`} className="flex-1">
                      <div>
                        <CardTitle>{claim.claim_number}</CardTitle>
                        <CardDescription className="mt-1">
                          {claim.client_name} • {claim.claim_type}
                        </CardDescription>
                      </div>
                    </Link>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={claim.status} />
                      {isAdmin && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive h-8 w-8"
                              onClick={(e) => e.preventDefault()}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Zmazať claim</AlertDialogTitle>
                              <AlertDialogDescription>
                                Ste si istí, že chcete zmazať claim "{claim.claim_number}"? Táto akcia zmaže aj všetky súvisiace dokumenty a reporty. Táto akcia sa nedá vrátiť späť.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Zrušiť</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeleteClaim(claim.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Zmazať
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <Link to={`/claim/${claim.id}`}>
                  <CardContent>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <FileText className="h-4 w-4" />
                        <span>Poistka: {claim.policy_number}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        <span>
                          {format(new Date(claim.created_at), "d. MMMM yyyy", {
                            locale: sk,
                          })}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Link>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
