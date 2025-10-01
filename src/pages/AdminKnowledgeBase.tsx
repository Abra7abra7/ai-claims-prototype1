import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft, Upload, Trash2, Database, FileText, CheckCircle2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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

interface UploadFile {
  file: File;
  status: 'pending' | 'processing' | 'success' | 'error';
  progress: number;
  message?: string;
  result?: any;
}

const AdminKnowledgeBase = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [entries, setEntries] = useState<KnowledgeEntry[]>([]);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [uploadFiles, setUploadFiles] = useState<UploadFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);

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

  const handleFileSelect = useCallback((files: FileList | null) => {
    if (!files) return;

    const validFiles = Array.from(files).filter(file => {
      const ext = file.name.split('.').pop()?.toLowerCase();
      return ['pdf', 'txt', 'md', 'docx'].includes(ext || '');
    });

    if (validFiles.length === 0) {
      toast({
        title: "Chyba",
        description: "Podporované sú len súbory: PDF, TXT, MD, DOCX",
        variant: "destructive",
      });
      return;
    }

    const newUploadFiles: UploadFile[] = validFiles.map(file => ({
      file,
      status: 'pending',
      progress: 0
    }));

    setUploadFiles(prev => [...prev, ...newUploadFiles]);
    processFiles(newUploadFiles);
  }, []);

  const processFiles = async (filesToProcess: UploadFile[]) => {
    for (const uploadFile of filesToProcess) {
      await processFile(uploadFile);
    }
    
    await fetchEntries();
  };

  const processFile = async (uploadFile: UploadFile) => {
    const updateFileStatus = (updates: Partial<UploadFile>) => {
      setUploadFiles(prev => prev.map(f => 
        f.file === uploadFile.file ? { ...f, ...updates } : f
      ));
    };

    try {
      updateFileStatus({ status: 'processing', progress: 20, message: 'Nahrávam súbor...' });

      const formData = new FormData();
      formData.append('file', uploadFile.file);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Nie ste prihlásený');

      updateFileStatus({ progress: 40, message: 'Spracovávam dokument...' });

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-knowledge-document`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: formData,
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Spracovanie zlyhalo');
      }

      updateFileStatus({ progress: 80, message: 'Generujem embeddings...' });

      const result = await response.json();

      updateFileStatus({ 
        status: 'success', 
        progress: 100, 
        message: `Úspešne spracovaných ${result.chunks_processed} chunkov`,
        result 
      });

      toast({
        title: "Úspech",
        description: `${uploadFile.file.name}: ${result.chunks_processed} chunkov`,
      });

    } catch (error) {
      console.error('File processing error:', error);
      updateFileStatus({ 
        status: 'error', 
        progress: 0,
        message: error instanceof Error ? error.message : 'Nepodarilo sa spracovať súbor'
      });

      toast({
        title: "Chyba",
        description: `${uploadFile.file.name}: ${error instanceof Error ? error.message : 'Chyba spracovania'}`,
        variant: "destructive",
      });
    }
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files);
  }, [handleFileSelect]);

  const clearUploadFiles = () => {
    setUploadFiles([]);
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
              Nahrať dokumenty
            </CardTitle>
            <CardDescription>
              Nahrajte PDF, TXT, MD alebo DOCX súbory. Všetko ostatné sa spracuje automaticky.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`
                border-2 border-dashed rounded-lg p-8 text-center transition-colors
                ${isDragging ? 'border-primary bg-primary/5' : 'border-border'}
                hover:border-primary/50 cursor-pointer
              `}
              onClick={() => document.getElementById('file-input')?.click()}
            >
              <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-lg font-medium mb-2">
                Presuňte súbory sem alebo kliknite pre výber
              </p>
              <p className="text-sm text-muted-foreground">
                Podporované formáty: PDF, TXT, MD, DOCX
              </p>
              <input
                id="file-input"
                type="file"
                multiple
                accept=".pdf,.txt,.md,.docx"
                onChange={(e) => handleFileSelect(e.target.files)}
                className="hidden"
              />
            </div>

            {uploadFiles.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium">Spracovávané súbory ({uploadFiles.length})</h3>
                  <Button variant="ghost" size="sm" onClick={clearUploadFiles}>
                    Vyčistiť
                  </Button>
                </div>
                
                {uploadFiles.map((uploadFile, idx) => (
                  <Card key={idx}>
                    <CardContent className="pt-6">
                      <div className="space-y-3">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2">
                            {uploadFile.status === 'success' && (
                              <CheckCircle2 className="h-5 w-5 text-green-500" />
                            )}
                            {uploadFile.status === 'error' && (
                              <XCircle className="h-5 w-5 text-destructive" />
                            )}
                            {uploadFile.status === 'processing' && (
                              <Loader2 className="h-5 w-5 animate-spin text-primary" />
                            )}
                            <div>
                              <p className="font-medium">{uploadFile.file.name}</p>
                              <p className="text-sm text-muted-foreground">
                                {(uploadFile.file.size / 1024).toFixed(1)} KB
                              </p>
                            </div>
                          </div>
                          <Badge variant={
                            uploadFile.status === 'success' ? 'default' :
                            uploadFile.status === 'error' ? 'destructive' :
                            uploadFile.status === 'processing' ? 'secondary' : 'outline'
                          }>
                            {uploadFile.status === 'success' && 'Hotovo'}
                            {uploadFile.status === 'error' && 'Chyba'}
                            {uploadFile.status === 'processing' && 'Spracováva sa'}
                            {uploadFile.status === 'pending' && 'Čaká'}
                          </Badge>
                        </div>
                        
                        {uploadFile.status === 'processing' && (
                          <Progress value={uploadFile.progress} className="h-2" />
                        )}
                        
                        {uploadFile.message && (
                          <p className={`text-sm ${
                            uploadFile.status === 'error' ? 'text-destructive' : 'text-muted-foreground'
                          }`}>
                            {uploadFile.message}
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
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
                      {chunks[0].source_document && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <FileText className="h-4 w-4" />
                          <span>{chunks[0].source_document}</span>
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
