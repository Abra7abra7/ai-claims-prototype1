import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Edit, Trash2, ArrowLeft } from "lucide-react";

interface AnalysisType {
  id: string;
  name: string;
  description: string;
  system_prompt: string;
  is_active: boolean;
  created_at: string;
}

export default function AdminAnalysisTypes() {
  const navigate = useNavigate();
  const [analysisTypes, setAnalysisTypes] = useState<AnalysisType[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingType, setEditingType] = useState<AnalysisType | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    system_prompt: "",
    is_active: true,
  });
  const { toast } = useToast();

  useEffect(() => {
    checkAdminRole();
    fetchAnalysisTypes();
  }, []);

  const checkAdminRole = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/");
      return;
    }

    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    const isAdmin = roles?.some(r => r.role === "admin");
    if (!isAdmin) {
      toast({
        title: "Prístup zamietnutý",
        description: "Nemáte oprávnenie na prístup k tejto stránke",
        variant: "destructive",
      });
      navigate("/");
    }
  };

  const fetchAnalysisTypes = async () => {
    try {
      const { data, error } = await supabase
        .from("analysis_types")
        .select("*")
        .order("name");

      if (error) throw error;
      setAnalysisTypes(data || []);
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

  const handleOpenDialog = (type?: AnalysisType) => {
    if (type) {
      setEditingType(type);
      setFormData({
        name: type.name,
        description: type.description,
        system_prompt: type.system_prompt,
        is_active: type.is_active,
      });
    } else {
      setEditingType(null);
      setFormData({
        name: "",
        description: "",
        system_prompt: "",
        is_active: true,
      });
    }
    setDialogOpen(true);
  };

  const handleSave = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      if (editingType) {
        const { error } = await supabase
          .from("analysis_types")
          .update(formData)
          .eq("id", editingType.id);

        if (error) throw error;

        toast({
          title: "Úspech",
          description: "Typ analýzy bol aktualizovaný",
        });
      } else {
        const { error } = await supabase
          .from("analysis_types")
          .insert({
            ...formData,
            created_by: user.id,
          });

        if (error) throw error;

        toast({
          title: "Úspech",
          description: "Typ analýzy bol vytvorený",
        });
      }

      setDialogOpen(false);
      fetchAnalysisTypes();
    } catch (error: any) {
      toast({
        title: "Chyba",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Naozaj chcete zmazať tento typ analýzy?")) return;

    try {
      const { error } = await supabase
        .from("analysis_types")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Úspech",
        description: "Typ analýzy bol zmazaný",
      });

      fetchAnalysisTypes();
    } catch (error: any) {
      toast({
        title: "Chyba",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="text-center py-12">Načítavam...</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" onClick={() => navigate("/")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Typy analýz</h1>
              <p className="text-muted-foreground mt-1">Správa typov AI analýz</p>
            </div>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => handleOpenDialog()}>
                <Plus className="h-4 w-4 mr-2" />
                Nový typ
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingType ? "Upraviť typ analýzy" : "Nový typ analýzy"}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">Názov</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Napr. Štandardná analýza"
                  />
                </div>
                <div>
                  <Label htmlFor="description">Popis</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Krátky popis typu analýzy"
                    rows={3}
                  />
                </div>
                <div>
                  <Label htmlFor="system_prompt">Systémový prompt</Label>
                  <Textarea
                    id="system_prompt"
                    value={formData.system_prompt}
                    onChange={(e) => setFormData({ ...formData, system_prompt: e.target.value })}
                    placeholder="Detailný prompt pre AI model"
                    rows={12}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="is_active">Aktívny</Label>
                  <Switch
                    id="is_active"
                    checked={formData.is_active}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleSave} className="flex-1">
                    {editingType ? "Uložiť zmeny" : "Vytvoriť"}
                  </Button>
                  <Button variant="outline" onClick={() => setDialogOpen(false)} className="flex-1">
                    Zrušiť
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-4">
          {analysisTypes.map((type) => (
            <Card key={type.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="flex items-center gap-2">
                      {type.name}
                      {!type.is_active && (
                        <span className="text-xs bg-muted px-2 py-1 rounded">Neaktívny</span>
                      )}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">{type.description}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="icon" onClick={() => handleOpenDialog(type)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleDelete(type.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Label>Systémový prompt:</Label>
                  <div className="p-3 bg-muted rounded-md text-sm whitespace-pre-wrap font-mono">
                    {type.system_prompt}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </Layout>
  );
}
