import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { FolderOpen, File, Upload, Plus, ChevronRight } from 'lucide-react';
import { api } from '@/lib/api';
import { formatBytes, formatRelative, cn } from '@/lib/utils';
import { toast } from '@/components/ui/toaster';
import { Dialog } from '@/components/ui/dialog';
import type { ApiResponse, PaginatedResponse, Folder, Document } from '@sparqplug/types';

const inputClass = 'flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring';

export function DocumentsPage() {
  const { folderId } = useParams<{ folderId?: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [view, setView] = useState<'grid' | 'list'>('list');
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [folderName, setFolderName] = useState('');

  const { data: foldersData } = useQuery({
    queryKey: ['folders', folderId],
    queryFn: () =>
      api.get<ApiResponse<PaginatedResponse<Folder>>>('/documents/folders', {
        parentId: folderId ?? 'root',
      }),
  });

  const { data: docsData, isLoading } = useQuery({
    queryKey: ['documents', folderId],
    queryFn: () =>
      api.get<ApiResponse<PaginatedResponse<Document>>>('/documents', {
        folderId: folderId ?? 'root',
        limit: 50,
      }),
  });

  const folders = foldersData?.data?.items ?? [];
  const docs = docsData?.data?.items ?? [];

  const createFolderMutation = useMutation({
    mutationFn: (name: string) => api.post('/documents/folders', { name, parentId: folderId ?? 'root' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['folders'] });
      toast({ title: 'Folder created', variant: 'success' });
      setShowNewFolder(false);
      setFolderName('');
    },
    onError: () => toast({ title: 'Failed to create folder', variant: 'destructive' }),
  });

  return (
    <div className="p-6 space-y-4 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Documents</h1>
          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
            <span className="hover:text-foreground cursor-pointer">Root</span>
            {folderId && <><ChevronRight className="h-3 w-3" /><span>{folderId}</span></>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowNewFolder(true)} className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors">
            <Plus className="h-4 w-4" />
            New Folder
          </button>
          <button
            onClick={() => {
              const input = document.createElement('input');
              input.type = 'file';
              input.multiple = true;
              input.onchange = async () => {
                if (!input.files?.length) return;
                const formData = new FormData();
                Array.from(input.files).forEach((f) => formData.append('files', f));
                if (folderId) formData.append('folderId', folderId);
                try {
                  await api.post('/documents/upload', formData);
                  queryClient.invalidateQueries({ queryKey: ['documents'] });
                  toast({ title: `${input.files.length} file(s) uploaded`, variant: 'success' });
                } catch {
                  toast({ title: 'Upload failed', variant: 'destructive' });
                }
              };
              input.click();
            }}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Upload className="h-4 w-4" />
            Upload
          </button>
        </div>
      </div>

      {/* Folders */}
      {folders.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Folders</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {folders.map((folder) => (
              <div
                key={folder.id}
                onClick={() => navigate(`/documents/${folder.id}`)}
                className="flex flex-col items-center gap-2 rounded-lg border border-border bg-card p-4 text-center hover:bg-muted/30 transition-colors cursor-pointer"
              >
                <FolderOpen className="h-8 w-8 text-yellow-500" />
                <span className="text-xs font-medium text-foreground truncate w-full">{folder.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Files */}
      <div>
        {folders.length > 0 && <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Files</p>}
        {isLoading ? (
          <div className="rounded-lg border border-border bg-card divide-y divide-border">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <div className="h-8 w-8 rounded bg-muted animate-pulse shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-4 bg-muted animate-pulse rounded w-1/3" />
                  <div className="h-3 bg-muted animate-pulse rounded w-1/5" />
                </div>
              </div>
            ))}
          </div>
        ) : docs.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border py-16 text-center text-muted-foreground">
            <Upload className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No files here</p>
            <p className="text-sm mt-1">Upload files to get started</p>
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Name</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden md:table-cell">Type</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground hidden lg:table-cell">Size</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden xl:table-cell">Modified</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {docs.map((doc) => (
                  <tr key={doc.id} className="hover:bg-muted/30 transition-colors cursor-pointer">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <File className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="font-medium text-foreground truncate max-w-[200px]">{doc.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-muted-foreground text-xs">{doc.mimeType}</td>
                    <td className="px-4 py-3 hidden lg:table-cell text-right text-muted-foreground text-xs">{formatBytes(doc.size)}</td>
                    <td className="px-4 py-3 hidden xl:table-cell text-muted-foreground text-xs">{formatRelative(doc.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={showNewFolder} onOpenChange={setShowNewFolder} title="New Folder">
        <form onSubmit={(e) => { e.preventDefault(); createFolderMutation.mutate(folderName); }} className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Folder name *</label>
            <input required autoFocus className={inputClass} value={folderName} onChange={(e) => setFolderName(e.target.value)} placeholder="My Documents" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setShowNewFolder(false)} className="h-9 px-4 rounded-md border border-border text-sm hover:bg-muted transition-colors">Cancel</button>
            <button type="submit" disabled={createFolderMutation.isPending} className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm hover:bg-primary/90 transition-colors disabled:opacity-50">
              {createFolderMutation.isPending ? 'Creating…' : 'Create Folder'}
            </button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
