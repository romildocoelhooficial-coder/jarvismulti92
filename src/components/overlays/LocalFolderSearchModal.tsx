import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  FolderSearch,
  FolderOpen,
  FolderPlus,
  Copy,
  Terminal,
  FileCode,
  FileText,
  Search,
  Sparkles,
  CheckCircle,
  Eye,
  File,
  Play,
  RotateCw,
  Folder,
  ArrowRight,
} from 'lucide-react';
import { Palette } from '../../constants/theme';

export interface IndexedFile {
  name: string;
  path: string;
  size: number;
  type: string;
  content?: string;
}

interface LocalFolderSearchModalProps {
  palette: Palette;
  onSelectFileForJarvis: (file: IndexedFile) => void;
  onClose: () => void;
}

export const LocalFolderSearchModal: React.FC<LocalFolderSearchModalProps> = ({
  palette,
  onSelectFileForJarvis,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'explorer' | 'desktop' | 'python'>('explorer');

  // Explorer State
  const [folderName, setFolderName] = useState<string>('');
  const [files, setFiles] = useState<IndexedFile[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchInContent, setSearchInContent] = useState(true);
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<IndexedFile | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);

  // Desktop Ops State
  const [newFolderName, setNewFolderName] = useState('');
  const [copySource, setCopySource] = useState('');
  const [copyDest, setCopyDest] = useState('');
  const [desktopNotice, setDesktopNotice] = useState<string | null>(null);
  const [desktopFiles, setDesktopFiles] = useState<any[]>([]);

  // Python Terminal State
  const [pythonCode, setPythonCode] = useState<string>(
`# Automação de Desktop & Arquivos via Python 3
import os, sys, platform

print(f"Sistema: {platform.system()} // Python {platform.python_version()}")
print("Diretório Atual:", os.getcwd())

# Listar itens no workspace
itens = os.listdir('.')
print(f"Total de itens no workspace: {len(itens)}")
for item in itens[:10]:
    tipo = "DIR " if os.path.isdir(item) else "ARQ "
    print(f"  [{tipo}] {item}")
`
  );
  const [pythonOutput, setPythonOutput] = useState<{ stdout: string; stderr: string; time?: number } | null>(null);
  const [runningPython, setRunningPython] = useState(false);

  // Fetch Desktop Files on load
  const loadDesktopFiles = async () => {
    try {
      const resp = await fetch('/api/desktop/file-operation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'list_files' }),
      });
      if (resp.ok) {
        const data = await resp.json();
        setDesktopFiles(data.files || []);
      }
    } catch (_) {}
  };

  useEffect(() => {
    loadDesktopFiles();
  }, []);

  // Modern File System Access API or Directory input fallback
  const handleSelectDirectory = async () => {
    if ('showDirectoryPicker' in window) {
      try {
        setLoading(true);
        const dirHandle = await (window as any).showDirectoryPicker();
        setFolderName(dirHandle.name);
        const collected: IndexedFile[] = [];

        const readEntries = async (handle: any, currentPath = '') => {
          for await (const entry of handle.values()) {
            if (entry.kind === 'file') {
              const file = await entry.getFile();
              const ext = file.name.split('.').pop()?.toLowerCase() || '';
              let textContent = '';

              if (
                file.size < 2 * 1024 * 1024 &&
                ['ts', 'tsx', 'js', 'jsx', 'json', 'py', 'php', 'html', 'css', 'md', 'txt', 'sql', 'csv', 'env', 'log'].includes(ext)
              ) {
                try {
                  textContent = await file.text();
                } catch (_) {}
              }

              collected.push({
                name: file.name,
                path: `${currentPath}/${file.name}`,
                size: file.size,
                type: file.type || ext,
                content: textContent,
              });
            } else if (entry.kind === 'directory') {
              if (entry.name !== 'node_modules' && entry.name !== '.git' && entry.name !== 'dist') {
                await readEntries(entry, `${currentPath}/${entry.name}`);
              }
            }
          }
        };

        await readEntries(dirHandle, dirHandle.name);
        setFiles(collected);
        setLoading(false);
        return;
      } catch (err: any) {
        if (err.name === 'AbortError') {
          setLoading(false);
          return;
        }
      }
    }
    folderInputRef.current?.click();
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    setLoading(true);
    const collected: IndexedFile[] = [];
    const firstPath = fileList[0].webkitRelativePath || '';
    const rootName = firstPath.split('/')[0] || 'Pasta Selecionada';
    setFolderName(rootName);

    Array.from(fileList).forEach((file: any) => {
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      const reader = new FileReader();

      if (
        file.size < 2 * 1024 * 1024 &&
        ['ts', 'tsx', 'js', 'jsx', 'json', 'py', 'php', 'html', 'css', 'md', 'txt', 'sql', 'csv', 'env', 'log'].includes(ext)
      ) {
        reader.onload = (event) => {
          const content = (event.target?.result as string) || '';
          collected.push({
            name: file.name,
            path: file.webkitRelativePath || file.name,
            size: file.size,
            type: file.type || ext,
            content,
          });
          if (collected.length === fileList.length) {
            setFiles([...collected]);
            setLoading(false);
          }
        };
        reader.readAsText(file);
      } else {
        collected.push({
          name: file.name,
          path: file.webkitRelativePath || file.name,
          size: file.size,
          type: file.type || ext,
        });
        if (collected.length === fileList.length) {
          setFiles([...collected]);
          setLoading(false);
        }
      }
    });
  };

  // Create folder action
  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    try {
      const resp = await fetch('/api/desktop/file-operation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create_folder', name: newFolderName.trim() }),
      });
      const data = await resp.json();
      if (resp.ok && data.success) {
        setDesktopNotice(`✓ Pasta "${newFolderName}" criada com sucesso no Desktop Workspace!`);
        setNewFolderName('');
        loadDesktopFiles();
      } else {
        setDesktopNotice(`✕ Erro: ${data.error || 'Falha ao criar pasta'}`);
      }
    } catch (err: any) {
      setDesktopNotice(`✕ Erro de conexão: ${err.message}`);
    }
    setTimeout(() => setDesktopNotice(null), 5000);
  };

  // Copy file action
  const handleCopyFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!copySource.trim() || !copyDest.trim()) return;
    try {
      const resp = await fetch('/api/desktop/file-operation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'copy_file', source: copySource.trim(), destination: copyDest.trim() }),
      });
      const data = await resp.json();
      if (resp.ok && data.success) {
        setDesktopNotice(`✓ Arquivo "${copySource}" copiado para "${copyDest}" com sucesso!`);
        setCopySource('');
        setCopyDest('');
        loadDesktopFiles();
      } else {
        setDesktopNotice(`✕ Erro: ${data.error || 'Falha na cópia'}`);
      }
    } catch (err: any) {
      setDesktopNotice(`✕ Erro de conexão: ${err.message}`);
    }
    setTimeout(() => setDesktopNotice(null), 5000);
  };

  // Run Python script
  const handleRunPython = async () => {
    if (!pythonCode.trim() || runningPython) return;
    setRunningPython(true);
    setPythonOutput(null);
    try {
      const resp = await fetch('/api/desktop/python-exec', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: pythonCode }),
      });
      const data = await resp.json();
      setPythonOutput({
        stdout: data.stdout || '',
        stderr: data.stderr || '',
        time: data.executionTimeMs,
      });
      loadDesktopFiles();
    } catch (err: any) {
      setPythonOutput({
        stdout: '',
        stderr: `Erro de rede ao executar Python: ${err.message}`,
      });
    } finally {
      setRunningPython(false);
    }
  };

  const filteredFiles = files.filter((f) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    const nameMatch = f.name.toLowerCase().includes(term) || f.path.toLowerCase().includes(term);
    const contentMatch = searchInContent && f.content && f.content.toLowerCase().includes(term);
    return nameMatch || contentMatch;
  });

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
      <div
        className="w-full max-w-4xl rounded-2xl border shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        style={{
          backgroundColor: `${palette.PANEL2}fa`,
          borderColor: palette.BORDER_B,
          boxShadow: `0 0 35px ${palette.PRI}33`,
        }}
      >
        {/* Header */}
        <div
          className="p-4 border-b flex items-center justify-between font-mono text-xs"
          style={{ borderColor: palette.BORDER }}
        >
          <div className="flex items-center gap-2.5">
            <FolderSearch className="w-5 h-5 text-cyan-400" />
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm tracking-widest uppercase text-white">
                  CENTRO DE ARQUIVOS, DESKTOP & AUTOMAÇÃO PYTHON
                </h3>
                <span className="text-[9px] px-1.5 py-0.2 rounded font-bold uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  MARK LVI INTEGRADO
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Indexação de arquivos, criação de pastas no desktop, cópia/cola e execução Python 3
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 text-muted-foreground hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div
          className="px-4 py-2 border-b bg-black/40 flex items-center gap-2 font-mono text-xs overflow-x-auto"
          style={{ borderColor: palette.BORDER }}
        >
          <button
            onClick={() => setActiveTab('explorer')}
            className={`px-3 py-1.5 rounded-lg font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all ${
              activeTab === 'explorer' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50' : 'text-muted-foreground hover:text-white'
            }`}
          >
            <FolderOpen className="w-3.5 h-3.5" />
            <span>1. BUSCA & INDEXADOR NO PC</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('desktop');
              loadDesktopFiles();
            }}
            className={`px-3 py-1.5 rounded-lg font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all ${
              activeTab === 'desktop' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50' : 'text-muted-foreground hover:text-white'
            }`}
          >
            <FolderPlus className="w-3.5 h-3.5" />
            <span>2. OPERAÇÕES DESKTOP (PASTAS & CÓPIA)</span>
          </button>

          <button
            onClick={() => setActiveTab('python')}
            className={`px-3 py-1.5 rounded-lg font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all ${
              activeTab === 'python' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50' : 'text-muted-foreground hover:text-white'
            }`}
          >
            <Terminal className="w-3.5 h-3.5 text-amber-400" />
            <span>3. TERMINAL PYTHON 3</span>
          </button>
        </div>

        {/* TAB 1: INDEXADOR DE PASTAS LOCAIS */}
        {activeTab === 'explorer' && (
          <>
            <div
              className="p-3 border-b bg-black/20 flex flex-wrap items-center justify-between gap-3 font-mono text-xs"
              style={{ borderColor: palette.BORDER }}
            >
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSelectDirectory}
                  disabled={loading}
                  className="px-3.5 py-1.5 rounded-lg font-bold text-xs uppercase tracking-wider flex items-center gap-2 transition-all shadow"
                  style={{ backgroundColor: palette.PRI, color: '#000' }}
                >
                  <FolderOpen className="w-3.5 h-3.5" />
                  <span>{loading ? 'INDEXANDO ARQUIVOS...' : 'SELECIONAR PASTA NO PC'}</span>
                </button>

                {folderName && (
                  <span className="text-xs text-cyan-300 bg-black/50 px-2.5 py-1 rounded-lg border border-white/10">
                    📁 <strong>{folderName}</strong> ({files.length} arquivos)
                  </span>
                )}

                <input
                  type="file"
                  // @ts-ignore
                  webkitdirectory=""
                  directory=""
                  multiple
                  ref={folderInputRef}
                  onChange={handleFileInputChange}
                  className="hidden"
                />
              </div>

              <div className="flex items-center gap-2 flex-1 max-w-md">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Pesquisar por nome ou código..."
                    className="w-full bg-black/50 border rounded-lg pl-8 pr-3 py-1.5 text-xs outline-none font-mono"
                    style={{ borderColor: palette.BORDER }}
                  />
                </div>
                <label className="flex items-center gap-1.5 text-[10px] text-muted-foreground cursor-pointer select-none whitespace-nowrap">
                  <input
                    type="checkbox"
                    checked={searchInContent}
                    onChange={(e) => setSearchInContent(e.target.checked)}
                    className="rounded bg-black/50"
                  />
                  <span>No conteúdo</span>
                </label>
              </div>
            </div>

            <div className="flex-1 grid grid-cols-1 md:grid-cols-12 overflow-hidden">
              <div className="md:col-span-7 border-r border-white/10 p-3 overflow-y-auto space-y-1.5 max-h-[500px]">
                {filteredFiles.length === 0 ? (
                  <div className="text-center py-16 text-muted-foreground font-mono text-xs space-y-2">
                    <FolderSearch className="w-8 h-8 mx-auto opacity-30 text-cyan-400" />
                    <p>Nenhum arquivo indexado ou correspondente à busca.</p>
                    <p className="text-[10px] text-muted-foreground/60">
                      Clique em "Selecionar Pasta no PC" para indexar pastas locais pelo navegador.
                    </p>
                  </div>
                ) : (
                  filteredFiles.map((f, i) => (
                    <div
                      key={i}
                      onClick={() => setSelectedFile(f)}
                      className={`p-2 rounded-lg border cursor-pointer transition-all flex items-center justify-between gap-2 text-xs font-mono ${
                        selectedFile?.path === f.path ? 'bg-cyan-500/15 border-cyan-500/50' : 'bg-black/30 border-white/5 hover:bg-white/5'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        {f.content ? <FileCode className="w-4 h-4 text-cyan-400 flex-shrink-0" /> : <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
                        <div className="truncate">
                          <div className="font-semibold text-white truncate">{f.name}</div>
                          <div className="text-[10px] text-muted-foreground truncate">{f.path}</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-[10px] text-muted-foreground">{formatSize(f.size)}</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectFileForJarvis(f);
                            onClose();
                          }}
                          className="px-2 py-1 rounded border border-cyan-500/40 hover:bg-cyan-500/20 text-cyan-400 text-[10px] uppercase font-bold"
                        >
                          Analisar
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="md:col-span-5 p-4 flex flex-col justify-between overflow-hidden bg-black/40">
                {selectedFile ? (
                  <div className="flex flex-col h-full space-y-3">
                    <div className="border-b border-white/10 pb-2">
                      <h4 className="font-bold text-white text-xs truncate">{selectedFile.name}</h4>
                      <span className="text-[10px] text-muted-foreground">{selectedFile.path}</span>
                    </div>

                    <div className="flex-1 overflow-y-auto p-2.5 rounded-lg bg-black/70 border border-white/5 font-mono text-[10px] leading-relaxed text-cyan-300/90 whitespace-pre-wrap select-text max-h-[350px]">
                      {selectedFile.content || 'Arquivo binário ou pré-visualização não suportada como texto.'}
                    </div>

                    <button
                      onClick={() => {
                        onSelectFileForJarvis(selectedFile);
                        onClose();
                      }}
                      className="w-full py-2 rounded-lg font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow"
                      style={{ backgroundColor: palette.PRI, color: '#000' }}
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>ANALISAR COM O JARVIS</span>
                    </button>
                  </div>
                ) : (
                  <div className="text-center py-24 text-muted-foreground font-mono text-xs">
                    Selecione um arquivo da lista para pré-visualizar seu código ou texto.
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* TAB 2: OPERAÇÕES NO DESKTOP (CRIAR PASTAS, COPIAR & COLAR) */}
        {activeTab === 'desktop' && (
          <div className="p-4 overflow-y-auto space-y-5 font-mono text-xs">
            {desktopNotice && (
              <div className="p-3 rounded-lg border border-cyan-500/40 bg-cyan-950/40 text-cyan-200 text-xs flex items-center gap-2 animate-in fade-in">
                <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span>{desktopNotice}</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Criar Pasta */}
              <div className="p-4 rounded-xl border bg-black/40 space-y-3" style={{ borderColor: palette.BORDER }}>
                <div className="flex items-center gap-2">
                  <FolderPlus className="w-4 h-4 text-cyan-400" />
                  <h4 className="font-bold text-white uppercase tracking-wider text-xs">
                    Criar Nova Pasta no Desktop
                  </h4>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Gera um novo diretório no sistema. Você também pode pedir por voz: <em>"JARVIS, crie uma pasta chamada Projetos"</em>.
                </p>
                <form onSubmit={handleCreateFolder} className="space-y-2">
                  <input
                    type="text"
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    placeholder="Nome da pasta (ex: Documentos_2026)"
                    className="w-full bg-black/60 border rounded-lg px-3 py-2 text-xs outline-none font-mono"
                    style={{ borderColor: palette.BORDER }}
                  />
                  <button
                    type="submit"
                    disabled={!newFolderName.trim()}
                    className="w-full py-2 rounded-lg font-bold text-xs uppercase tracking-wider transition-all disabled:opacity-40"
                    style={{ backgroundColor: palette.PRI, color: '#000' }}
                  >
                    Criar Pasta Agora
                  </button>
                </form>
              </div>

              {/* Copiar e Colar Arquivos */}
              <div className="p-4 rounded-xl border bg-black/40 space-y-3" style={{ borderColor: palette.BORDER }}>
                <div className="flex items-center gap-2">
                  <Copy className="w-4 h-4 text-emerald-400" />
                  <h4 className="font-bold text-white uppercase tracking-wider text-xs">
                    Copiar e Colar Arquivo
                  </h4>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Copia arquivos entre diretórios. Também acessível por comando: <em>"JARVIS, copie o arquivo dados.txt para Backup"</em>.
                </p>
                <form onSubmit={handleCopyFile} className="space-y-2">
                  <input
                    type="text"
                    value={copySource}
                    onChange={(e) => setCopySource(e.target.value)}
                    placeholder="Arquivo de origem (ex: relatorio.txt)"
                    className="w-full bg-black/60 border rounded-lg px-3 py-1.5 text-xs outline-none font-mono"
                    style={{ borderColor: palette.BORDER }}
                  />
                  <input
                    type="text"
                    value={copyDest}
                    onChange={(e) => setCopyDest(e.target.value)}
                    placeholder="Destino ou pasta de destino (ex: Backup/)"
                    className="w-full bg-black/60 border rounded-lg px-3 py-1.5 text-xs outline-none font-mono"
                    style={{ borderColor: palette.BORDER }}
                  />
                  <button
                    type="submit"
                    disabled={!copySource.trim() || !copyDest.trim()}
                    className="w-full py-2 rounded-lg font-bold text-xs uppercase tracking-wider transition-all disabled:opacity-40"
                    style={{ backgroundColor: palette.GREEN, color: '#000' }}
                  >
                    Executar Cópia de Arquivo
                  </button>
                </form>
              </div>
            </div>

            {/* Lista de Pastas e Arquivos no Desktop Workspace */}
            <div className="p-4 rounded-xl border bg-black/30 space-y-3" style={{ borderColor: palette.BORDER }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Folder className="w-4 h-4 text-cyan-400" />
                  <h4 className="font-bold text-white uppercase tracking-wider text-xs">
                    Estrutura de Pastas & Arquivos no Desktop Workspace
                  </h4>
                </div>
                <button
                  onClick={loadDesktopFiles}
                  className="px-2.5 py-1 rounded border border-white/10 hover:bg-white/10 text-[10px] flex items-center gap-1 text-cyan-300"
                >
                  <RotateCw className="w-3 h-3" />
                  <span>Atualizar</span>
                </button>
              </div>

              <div className="max-h-56 overflow-y-auto space-y-1 p-2 rounded-lg bg-black/60 border border-white/5">
                {desktopFiles.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground text-xs">
                    Nenhum arquivo ou pasta criado no workspace desktop ainda.
                  </div>
                ) : (
                  desktopFiles.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between p-1.5 rounded hover:bg-white/5 text-[11px]">
                      <div className="flex items-center gap-2">
                        {item.type === 'directory' ? (
                          <Folder className="w-3.5 h-3.5 text-amber-400" />
                        ) : (
                          <FileText className="w-3.5 h-3.5 text-cyan-400" />
                        )}
                        <span className={item.type === 'directory' ? 'font-bold text-amber-200' : 'text-white'}>
                          {item.name}
                        </span>
                      </div>
                      <span className="text-[10px] text-muted-foreground">
                        {item.type === 'directory' ? 'Pasta' : formatSize(item.size || 0)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: TERMINAL PYTHON 3 */}
        {activeTab === 'python' && (
          <div className="p-4 overflow-y-auto space-y-4 font-mono text-xs max-h-[620px]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-amber-400" />
                <h4 className="font-bold text-white uppercase tracking-wider text-xs">
                  Terminal de Automação Python 3.10
                </h4>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                PYTHON NATIVO ONLINE
              </span>
            </div>

            <p className="text-[10px] text-muted-foreground">
              Execute scripts Python diretamente para automação de desktop, manipulação de arquivos, cálculos científicos ou processamento de dados. Você também pode instruir o JARVIS por voz: <em>"JARVIS, execute um script python para listar arquivos"</em>.
            </p>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                <span>Editor de Código Python:</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPythonCode(`import os\nos.makedirs("Pasta_Python", exist_ok=True)\nprint("Pasta criada via Python os.makedirs!")`)}
                    className="underline hover:text-cyan-300"
                  >
                    Ex: Criar Pasta
                  </button>
                  <button
                    onClick={() => setPythonCode(`import math\nprint(f"PI: {math.pi}")\nprint(f"Fatorial de 8: {math.factorial(8)}")`)}
                    className="underline hover:text-cyan-300"
                  >
                    Ex: Cálculo
                  </button>
                </div>
              </div>
              <textarea
                value={pythonCode}
                onChange={(e) => setPythonCode(e.target.value)}
                rows={9}
                className="w-full bg-black/80 border rounded-xl p-3 text-xs font-mono text-amber-200 outline-none leading-relaxed border-white/10 focus:border-amber-500/50"
              />
            </div>

            <button
              onClick={handleRunPython}
              disabled={runningPython || !pythonCode.trim()}
              className="w-full py-2.5 rounded-lg font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow disabled:opacity-40"
              style={{ backgroundColor: palette.ACC, color: '#000' }}
            >
              <Play className="w-3.5 h-3.5 fill-black" />
              <span>{runningPython ? 'EXECUTANDO SCRIPT PYTHON...' : 'EXECUTAR SCRIPT NO SISTEMA (PYTHON 3)'}</span>
            </button>

            {/* Console Output */}
            {pythonOutput && (
              <div className="p-3 rounded-xl border bg-black/90 space-y-2 border-white/10 animate-in fade-in">
                <div className="flex items-center justify-between text-[10px] border-b border-white/10 pb-1">
                  <span className="font-bold text-emerald-400">SAÍDA DO CONSOLE:</span>
                  <span className="text-muted-foreground">{pythonOutput.time} ms</span>
                </div>
                {pythonOutput.stdout && (
                  <pre className="text-emerald-300 text-[11px] whitespace-pre-wrap select-all font-mono">
                    {pythonOutput.stdout}
                  </pre>
                )}
                {pythonOutput.stderr && (
                  <pre className="text-red-400 text-[11px] whitespace-pre-wrap select-all font-mono">
                    {pythonOutput.stderr}
                  </pre>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
