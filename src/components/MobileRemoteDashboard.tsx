import React, { useState, useEffect } from 'react';
import {
  Smartphone,
  Mic,
  MicOff,
  Send,
  Youtube,
  Camera,
  Search,
  Terminal,
  Volume2,
  FolderOpen,
  Monitor,
  CheckCircle2,
  Radio,
  Sparkles,
  RefreshCw,
  LogOut,
  User,
} from 'lucide-react';
import { Palette } from '../constants/theme';
import { DynamicContent } from '../types';

interface MobileRemoteDashboardProps {
  palette: Palette;
  assistantName: string;
  userName: string;
  pairingKey: string;
  isListening: boolean;
  statusText: string;
  lastResponse?: string;
  onSendCommand: (cmd: string) => void;
  onToggleMic: () => void;
  onOpenDesktopHud: () => void;
  onOpenVision?: () => void;
  onOpenFolderSearch?: () => void;
}

export const MobileRemoteDashboard: React.FC<MobileRemoteDashboardProps> = ({
  palette,
  assistantName,
  userName,
  pairingKey,
  isListening,
  statusText,
  lastResponse,
  onSendCommand,
  onToggleMic,
  onOpenDesktopHud,
  onOpenVision,
  onOpenFolderSearch,
}) => {
  const [inputText, setInputText] = useState('');
  const [activeTab, setActiveTab] = useState<'remote' | 'quick' | 'status'>('remote');

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim()) return;
    onSendCommand(inputText.trim());
    setInputText('');
  };

  const handleQuickAction = (cmd: string) => {
    onSendCommand(cmd);
  };

  return (
    <div
      className="min-h-screen w-full flex flex-col font-sans select-none text-white overflow-x-hidden"
      style={{
        background: 'radial-gradient(circle at 50% 20%, #03141f 0%, #02070d 60%, #000000 100%)',
      }}
    >
      {/* Mobile Header */}
      <header
        className="w-full px-4 py-3 border-b flex items-center justify-between backdrop-blur-xl sticky top-0 z-50"
        style={{
          borderColor: palette.BORDER,
          backgroundColor: `${palette.PANEL}ee`,
        }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="w-9 h-9 rounded-xl border flex items-center justify-center shadow-[0_0_15px_rgba(0,212,255,0.4)]"
            style={{
              borderColor: palette.PRI,
              backgroundColor: `${palette.PRI}20`,
            }}
          >
            <Smartphone className="w-5 h-5" style={{ color: palette.PRI }} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-xs tracking-wider" style={{ color: palette.PRI }}>
                {assistantName} REMOTE
              </span>
              <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-emerald-950/80 text-emerald-400 border border-emerald-500/40 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                PAREADO
              </span>
            </div>
            <div className="text-[10px] text-muted-foreground font-mono">
              Chave: <span className="text-cyan-300 font-bold">{pairingKey || '7K9P-4X2M'}</span> • Usuário: <span className="text-white">{userName}</span>
            </div>
          </div>
        </div>

        <button
          onClick={onOpenDesktopHud}
          className="px-2.5 py-1.5 rounded-lg border text-[11px] font-mono flex items-center gap-1.5 transition-all hover:bg-white/10"
          style={{ borderColor: palette.BORDER, color: palette.PRI }}
          title="Alternar para o Painel Completo de Desktop"
        >
          <Monitor className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Modo HUD</span>
        </button>
      </header>

      {/* Main Remote Body */}
      <main className="flex-1 w-full max-w-lg mx-auto p-4 flex flex-col gap-4 pb-28">
        {/* Status Broadcast Bar */}
        <div
          className="p-3 rounded-xl border flex items-center justify-between text-xs font-mono backdrop-blur-md"
          style={{
            borderColor: palette.BORDER,
            backgroundColor: `${palette.PANEL2}cc`,
          }}
        >
          <div className="flex items-center gap-2 overflow-hidden">
            <Radio className="w-4 h-4 shrink-0 text-cyan-400 animate-pulse" />
            <span className="truncate text-[11px] text-cyan-200 uppercase tracking-wider">
              {statusText}
            </span>
          </div>
          <span className="text-[10px] text-muted-foreground font-mono shrink-0">MK-LVI</span>
        </div>

        {/* Big Arc Reactor Center Control (Push-to-Talk) */}
        <div className="flex flex-col items-center justify-center py-4">
          <div className="relative flex items-center justify-center">
            {/* Pulsing ring aura */}
            <div
              className={`absolute inset-0 rounded-full transition-all duration-700 ${
                isListening
                  ? 'animate-ping opacity-60 scale-125'
                  : 'opacity-20 scale-105'
              }`}
              style={{
                backgroundColor: isListening ? '#ff3b30' : palette.PRI,
                filter: 'blur(20px)',
              }}
            />

            <button
              onClick={onToggleMic}
              className="relative w-32 h-32 rounded-full border-4 flex flex-col items-center justify-center shadow-[0_0_40px_rgba(0,212,255,0.4)] transition-all transform active:scale-95"
              style={{
                borderColor: isListening ? '#ff3b30' : palette.PRI,
                backgroundColor: isListening ? '#300a0a' : '#031926',
              }}
              title="Toque para falar com o JARVIS"
            >
              {isListening ? (
                <>
                  <Mic className="w-10 h-10 text-red-400 animate-pulse mb-1" />
                  <span className="text-[10px] font-mono font-bold tracking-widest text-red-300">
                    OUVINDO...
                  </span>
                </>
              ) : (
                <>
                  <MicOff className="w-10 h-10 text-cyan-400 mb-1" />
                  <span className="text-[10px] font-mono font-bold tracking-widest text-cyan-300">
                    PRESSIONE
                  </span>
                </>
              )}
            </button>
          </div>
          <p className="mt-3 text-[11px] text-muted-foreground font-mono text-center">
            {isListening
              ? 'Transmissão de voz ativa. Diga seu comando agora.'
              : 'Toque no reator central para ativar comando por voz'}
          </p>
        </div>

        {/* Quick Tactical Controls Grid */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-mono text-muted-foreground px-1">
            <span>COMANDOS RÁPIDOS NO PAINEL</span>
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => handleQuickAction('Projetar no painel central o trailer de Iron Man 1')}
              className="p-3 rounded-xl border flex items-center gap-2.5 text-left transition-all hover:bg-white/10 active:scale-98"
              style={{ borderColor: palette.BORDER, backgroundColor: `${palette.PANEL}aa` }}
            >
              <Youtube className="w-5 h-5 text-red-500 shrink-0" />
              <div>
                <div className="text-[11px] font-bold font-mono text-white">Vídeo YouTube</div>
                <div className="text-[9px] text-muted-foreground">Projeta no HUD</div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                if (onOpenVision) {
                  onOpenVision();
                } else {
                  handleQuickAction('Interpretar o que vê na câmera');
                }
              }}
              className="p-3 rounded-xl border flex items-center gap-2.5 text-left transition-all hover:bg-white/10 active:scale-98"
              style={{ borderColor: palette.BORDER, backgroundColor: `${palette.PANEL}aa` }}
            >
              <Camera className="w-5 h-5 text-cyan-400 shrink-0" />
              <div>
                <div className="text-[11px] font-bold font-mono text-white">Visão Óptica</div>
                <div className="text-[9px] text-muted-foreground">Interpretar câmera</div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => handleQuickAction('Faça uma pesquisa detalhada sobre os avanços recentes da inteligência artificial')}
              className="p-3 rounded-xl border flex items-center gap-2.5 text-left transition-all hover:bg-white/10 active:scale-98"
              style={{ borderColor: palette.BORDER, backgroundColor: `${palette.PANEL}aa` }}
            >
              <Search className="w-5 h-5 text-amber-400 shrink-0" />
              <div>
                <div className="text-[11px] font-bold font-mono text-white">Pesquisa Web</div>
                <div className="text-[9px] text-muted-foreground">Google Grounding</div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => handleQuickAction('Executar diagnóstico completo de todos os sistemas e subsistemas')}
              className="p-3 rounded-xl border flex items-center gap-2.5 text-left transition-all hover:bg-white/10 active:scale-98"
              style={{ borderColor: palette.BORDER, backgroundColor: `${palette.PANEL}aa` }}
            >
              <Terminal className="w-5 h-5 text-emerald-400 shrink-0" />
              <div>
                <div className="text-[11px] font-bold font-mono text-white">Diagnóstico</div>
                <div className="text-[9px] text-muted-foreground">Status do Mark LVI</div>
              </div>
            </button>
          </div>
        </div>

        {/* Live Feedback Feed */}
        {lastResponse && (
          <div
            className="p-3.5 rounded-xl border space-y-1.5 backdrop-blur-md animate-in fade-in"
            style={{
              borderColor: palette.BORDER,
              backgroundColor: `${palette.PANEL2}e0`,
            }}
          >
            <div className="flex items-center justify-between text-[10px] font-mono text-cyan-400 font-bold">
              <span>RESPOSTA DO {assistantName}:</span>
              <Volume2 className="w-3.5 h-3.5 animate-pulse" />
            </div>
            <p className="text-xs text-white/90 leading-relaxed font-sans max-h-36 overflow-y-auto">
              {lastResponse}
            </p>
          </div>
        )}
      </main>

      {/* Floating Bottom Input Bar for Mobile Remote */}
      <footer
        className="fixed bottom-0 left-0 right-0 p-3 border-t backdrop-blur-xl z-50 max-w-lg mx-auto shadow-2xl pb-[max(0.75rem,env(safe-area-inset-bottom))]"
        style={{
          borderColor: palette.BORDER,
          backgroundColor: `${palette.PANEL}fa`,
        }}
      >
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={`Comandar ${assistantName}...`}
            className="flex-1 px-3.5 py-2.5 rounded-xl bg-black/70 border text-white text-xs font-mono outline-none focus:border-cyan-400 transition-all placeholder:text-muted-foreground"
            style={{ borderColor: palette.BORDER }}
          />

          <button
            type="submit"
            disabled={!inputText.trim()}
            className="p-2.5 rounded-xl border flex items-center justify-center transition-all disabled:opacity-40"
            style={{
              borderColor: palette.PRI,
              backgroundColor: `${palette.PRI}20`,
              color: palette.PRI,
            }}
            title="Enviar Comando Remoto"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </footer>
    </div>
  );
};
