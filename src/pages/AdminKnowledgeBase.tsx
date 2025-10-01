import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft, Upload, Trash2, Database } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface KnowledgeEntry {
  id: string;
  title: string;
  chunk_text: string;
  chunk_index: number;
  policy_types: string[];
  categories: string[];
  source_document: string | null;
  created_at: string;
}

const AdminKnowledgeBase = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [entries, setEntries] = useState<KnowledgeEntry[]>([]);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [policyTypes, setPolicyTypes] = useState("");
  const [categories, setCategories] = useState("");
  const [sourceDocument, setSourceDocument] = useState("");

  useEffect(() => {
    checkAdminRole();
    fetchEntries();
  }, []);

  const checkAdminRole = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/auth");
      return;
    }

    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .single();

    if (!roles) {
      toast({
        title: "Prístup zamietnutý",
        description: "Nemáte oprávnenie na prístup k tejto stránke.",
        variant: "destructive",
      });
      navigate("/dashboard");
    }
  };

  const fetchEntries = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("insurance_knowledge_base")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setEntries(data || []);
    } catch (error) {
      console.error("Error fetching entries:", error);
      toast({
        title: "Chyba",
        description: "Nepodarilo sa načítať znalostné záznamy.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async () => {
    if (!title.trim() || !content.trim()) {
      toast({
        title: "Chýbajúce údaje",
        description: "Vyplňte prosím názov a obsah dokumentu.",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "process-knowledge-document",
        {
          body: {
            title: title.trim(),
            content: content.trim(),
            policyTypes: policyTypes.split(",").map(t => t.trim()).filter(Boolean),
            categories: categories.split(",").map(c => c.trim()).filter(Boolean),
            sourceDocument: sourceDocument.trim() || null,
          },
        }
      );

      if (error) throw error;

      toast({
        title: "Úspešné nahratie",
        description: `Vytvorených ${data.chunks_processed} znalostných chunkov.`,
      });

      // Reset form
      setTitle("");
      setContent("");
      setPolicyTypes("");
      setCategories("");
      setSourceDocument("");

      // Refresh entries
      fetchEntries();
    } catch (error) {
      console.error("Error uploading document:", error);
      toast({
        title: "Chyba nahrávania",
        description: error instanceof Error ? error.message : "Neznáma chyba",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;

    try {
      const { error } = await supabase
        .from("insurance_knowledge_base")
        .update({ is_active: false })
        .eq("id", deleteId);

      if (error) throw error;

      toast({
        title: "Záznam odstránený",
        description: "Znalostný záznam bol deaktivovaný.",
      });

      fetchEntries();
    } catch (error) {
      console.error("Error deleting entry:", error);
      toast({
        title: "Chyba",
        description: "Nepodarilo sa odstrániť záznam.",
        variant: "destructive",
      });
    } finally {
      setDeleteId(null);
    }
  };

  // Group entries by title
  const groupedEntries = entries.reduce((acc, entry) => {
    if (!acc[entry.title]) {
      acc[entry.title] = [];
    }
    acc[entry.title].push(entry);
    return acc;
  }, {} as Record<string, KnowledgeEntry[]>);

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="outline" onClick={() => navigate("/admin")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Späť na admin
        </Button>
        <div className="flex items-center gap-2">
          <Database className="h-6 w-6" />
          <h1 className="text-3xl font-bold">Vektorová znalostná báza</h1>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Nahrať nový dokument
            </CardTitle>
            <CardDescription>
              Dokument bude automaticky rozdelený na chunky a vektorovo indexovaný
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="title">Názov dokumentu *</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Napr. Všeobecné podmienky životného poistenia"
              />
            </div>

            <div>
              <Label htmlFor="content">Obsah dokumentu *</Label>
              <Textarea
                id="content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Vložte celý text dokumentu..."
                rows={8}
              />
            </div>

            <div>
              <Label htmlFor="policyTypes">Typy poistiek (oddelené čiarkou)</Label>
              <Input
                id="policyTypes"
                value={policyTypes}
                onChange={(e) => setPolicyTypes(e.target.value)}
                placeholder="Napr. životné, úrazové, zdravotné"
              />
            </div>

            <div>
              <Label htmlFor="categories">Kategórie (oddelené čiarkou)</Label>
              <Input
                id="categories"
                value={categories}
                onChange={(e) => setCategories(e.target.value)}
                placeholder="Napr. výluky, podmienky, plnenie"
              />
            </div>

            <div>
              <Label htmlFor="source">Zdroj dokumentu</Label>
              <Input
                id="source"
                value={sourceDocument}
                onChange={(e) => setSourceDocument(e.target.value)}
                placeholder="Napr. VP_2024_v1.pdf"
              />
            </div>

            <Button
              onClick={handleUpload}
              disabled={uploading}
              className="w-full"
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Spracúvam...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Nahrať a spracovať
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Štatistiky</CardTitle>
            <CardDescription>
              Prehľad znalostnej bázy
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center p-4 bg-muted rounded-lg">
              <span className="text-sm font-medium">Celkový počet dokumentov</span>
              <Badge variant="secondary">{Object.keys(groupedEntries).length}</Badge>
            </div>
            <div className="flex justify-between items-center p-4 bg-muted rounded-lg">
              <span className="text-sm font-medium">Celkový počet chunkov</span>
              <Badge variant="secondary">{entries.length}</Badge>
            </div>
            <div className="flex justify-between items-center p-4 bg-muted rounded-lg">
              <span className="text-sm font-medium">Priemerná veľkosť chunku</span>
              <Badge variant="secondary">
                {entries.length > 0
                  ? Math.round(
                      entries.reduce((sum, e) => sum + e.chunk_text.length, 0) /
                        entries.length
                    )
                  : 0}{" "}
                znakov
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Existujúce dokumenty</CardTitle>
          <CardDescription>
            Prehľad všetkých dokumentov v znalostnej báze
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : Object.keys(groupedEntries).length === 0 ? (
            <p className="text-center text-muted-foreground p-8">
              Zatiaľ žiadne dokumenty v znalostnej báze
            </p>
          ) : (
            <div className="space-y-4">
              {Object.entries(groupedEntries).map(([title, chunks]) => (
                <Card key={title}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <CardTitle className="text-lg">{title}</CardTitle>
                        <CardDescription>
                          {chunks.length} chunkov | Vytvorené:{" "}
                          {new Date(chunks[0].created_at).toLocaleDateString("sk-SK")}
                        </CardDescription>
                      </div>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => setDeleteId(chunks[0].id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {chunks[0].policy_types.length > 0 && (
                        <div className="flex gap-2 flex-wrap">
                          <span className="text-sm font-medium">Typy poistiek:</span>
                          {chunks[0].policy_types.map((type) => (
                            <Badge key={type} variant="outline">
                              {type}
                            </Badge>
                          ))}
                        </div>
                      )}
                      {chunks[0].categories.length > 0 && (
                        <div className="flex gap-2 flex-wrap">
                          <span className="text-sm font-medium">Kategórie:</span>
                          {chunks[0].categories.map((cat) => (
                            <Badge key={cat} variant="secondary">
                              {cat}
                            </Badge>
                          ))}
                        </div>
                      )}
                      <p className="text-sm text-muted-foreground">
                        {chunks[0].chunk_text.substring(0, 200)}...
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Potvrdiť odstránenie</AlertDialogTitle>
            <AlertDialogDescription>
              Naozaj chcete deaktivovať tento dokument? Všetky jeho chunky budú
              skryté zo znalostnej bázy.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Zrušiť</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Odstrániť</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminKnowledgeBase;
