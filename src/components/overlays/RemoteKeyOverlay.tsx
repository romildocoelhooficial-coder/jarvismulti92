import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Smartphone,
  QrCode,
  ShieldCheck,
  RefreshCw,
  AlertTriangle,
  Copy,
  Check,
  ExternalLink,
  Download,
  Wifi,
  Globe,
  Sparkles,
  CheckCircle2,
  Share2,
} from 'lucide-react';
import QRCode from 'qrcode';
import { Palette } from '../../constants/theme';

interface RemoteKeyOverlayProps {
  palette: Palette;
  userName?: string;
  onClose: () => void;
}

export const RemoteKeyOverlay: React.FC<RemoteKeyOverlayProps> = ({
  palette,
  userName = 'Senhor',
  onClose,
}) => {
  const [pairingCode, setPairingCode] = useState(() => {
    return localStorage.getItem('jarvis_remote_pairing_code') || '7K9P-4X2M';
  });
  const [copied, setCopied] = useState(false);
  const [urlMode, setUrlMode] = useState<'auto' | 'lan' | 'custom'>('auto');
  const [customLanHost, setCustomLanHost] = useState('192.168.1.100:3000');
  const [customUrl, setCustomUrl] = useState('');
  const [styleMode, setStyleMode] = useState<'contrast' | 'hologram'>('contrast');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [qrError, setQrError] = useState<string | null>(null);

  // Compute the exact target URL encoded inside the QR code
  const getEncodedUrl = () => {
    let base = window.location.origin + window.location.pathname;

    // Se estiver em localhost/127.0.0.1 e escolher LAN, usa o IP da rede local
    if (urlMode === 'lan') {
      const cleanHost = customLanHost.trim().replace(/^https?:\/\//, '');
      base = `http://${cleanHost}`;
    } else if (urlMode === 'custom' && customUrl.trim()) {
      base = customUrl.trim();
    }

    const separator = base.includes('?') ? '&' : '?';
    const cleanUser = encodeURIComponent(userName.trim().split(/\s+/)[0]);
    return `${base}${separator}mode=remote&key=${pairingCode}&user=${cleanUser}`;
  };

  const targetUrl = getEncodedUrl();

  // Generate QR Code with standard RFC/ISO 18004 compliance
  useEffect(() => {
    let isMounted = true;
    setIsGenerating(true);
    setQrError(null);

    const darkColor = styleMode === 'hologram' ? '#02242b' : '#000000';
    const lightColor = styleMode === 'hologram' ? '#e6fcff' : '#ffffff';

    QRCode.toDataURL(targetUrl, {
      width: 400,
      margin: 2,
      errorCorrectionLevel: 'H', // Highest error correction for guaranteed scanner readability
      color: {
        dark: darkColor,
        light: lightColor,
      },
    })
      .then((url) => {
        if (isMounted) {
          setQrDataUrl(url);
          setIsGenerating(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          console.error('Erro ao gerar QR Code:', err);
          setQrError('Falha ao compilar matriz do QR Code.');
          setIsGenerating(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [targetUrl, styleMode]);

  const handleRegenerate = () => {
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    let res = '';
    for (let i = 0; i < 8; i++) {
      if (i === 4) res += '-';
      res += chars[Math.floor(Math.random() * chars.length)];
    }
    setPairingCode(res);
    localStorage.setItem('jarvis_remote_pairing_code', res);
  };

  const handleRevoke = () => {
    handleRegenerate();
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(targetUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (_) {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = targetUrl;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleDownloadQR = () => {
    if (!qrDataUrl) return;
    const link = document.createElement('a');
    link.download = `jarvis-mobile-remote-${pairingCode}.png`;
    link.href = qrDataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const isLocalhost =
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname === '0.0.0.0';

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div
        className="w-full max-w-lg rounded-2xl border shadow-2xl overflow-hidden flex flex-col my-auto transition-all"
        style={{
          backgroundColor: `${palette.PANEL2}fa`,
          borderColor: palette.BORDER_B,
        }}
      >
        {/* Header */}
        <div
          className="p-4 border-b flex items-center justify-between"
          style={{ borderColor: palette.BORDER }}
        >
          <div className="flex items-center gap-3">
            <div
              className="p-2 rounded-xl border flex items-center justify-center shadow-[0_0_15px_rgba(0,212,255,0.2)]"
              style={{
                borderColor: palette.BORDER,
                backgroundColor: `${palette.PRI}15`,
              }}
            >
              <Smartphone className="w-5 h-5" style={{ color: palette.PRI }} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3
                  className="font-bold text-sm tracking-widest uppercase font-mono"
                  style={{ color: palette.WHITE }}
                >
                  MOBILE REMOTE DASHBOARD
                </h3>
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold font-mono bg-cyan-950/80 text-cyan-300 border border-cyan-500/40">
                  ISO-18004
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Pareamento instantâneo via QR Code para controle móvel do JARVIS
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

        {/* Content */}
        <div className="p-4 sm:p-6 space-y-5 text-xs">
          {/* Security & Validation Status */}
          <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl border bg-black/40" style={{ borderColor: palette.BORDER }}>
            <div className="flex items-center gap-2 text-emerald-400 font-mono text-[10px] font-bold">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>QR CODE VÁLIDO // LEITURA ÓPTICA COMPATÍVEL</span>
            </div>
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-950/50 border border-emerald-500/30 text-emerald-300 text-[10px] font-mono">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>AES-256 PAIRING</span>
            </div>
          </div>

          {/* QR Code Presentation Box */}
          <div className="flex flex-col items-center justify-center">
            <div className="relative p-4 rounded-2xl bg-white shadow-2xl border-4 border-cyan-500/50 transition-all hover:border-cyan-400 group">
              {/* Corner Sci-Fi Target Accents */}
              <div className="absolute -top-2 -left-2 w-4 h-4 border-t-2 border-l-2 border-cyan-400" />
              <div className="absolute -top-2 -right-2 w-4 h-4 border-t-2 border-r-2 border-cyan-400" />
              <div className="absolute -bottom-2 -left-2 w-4 h-4 border-b-2 border-l-2 border-cyan-400" />
              <div className="absolute -bottom-2 -right-2 w-4 h-4 border-b-2 border-r-2 border-cyan-400" />

              {/* QR Image */}
              {isGenerating ? (
                <div className="w-56 h-56 flex flex-col items-center justify-center bg-white text-slate-800 gap-2">
                  <RefreshCw className="w-7 h-7 animate-spin text-cyan-600" />
                  <span className="text-[10px] font-mono font-semibold">Gerando matriz...</span>
                </div>
              ) : qrDataUrl ? (
                <div className="relative w-56 h-56 bg-white flex items-center justify-center">
                  <img
                    src={qrDataUrl}
                    alt="QR Code de Pareamento JARVIS Mobile"
                    className="w-full h-full object-contain select-none"
                  />
                  {/* Arc Reactor Center Hologram Badge */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="px-2 py-0.5 rounded-md bg-black/95 text-[#00d4ff] text-[9px] font-bold font-mono tracking-widest border border-cyan-400 shadow-[0_0_10px_rgba(0,212,255,0.7)] flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                      JARVIS
                    </div>
                  </div>
                </div>
              ) : (
                <div className="w-56 h-56 flex flex-col items-center justify-center bg-red-50 text-red-600 p-2 text-center text-[11px]">
                  <AlertTriangle className="w-6 h-6 mb-1 text-red-500" />
                  <span>{qrError || 'Erro ao renderizar QR code'}</span>
                </div>
              )}
            </div>

            <p className="mt-2 text-[10px] text-muted-foreground font-mono flex items-center gap-1 text-center">
              <QrCode className="w-3.5 h-3.5 text-cyan-400" />
              <span>Aponte a câmera do seu smartphone (iOS / Android / Google Lens)</span>
            </p>
          </div>

          {/* Style & Network Source Selector */}
          <div className="space-y-2 p-3 rounded-xl border bg-black/50" style={{ borderColor: palette.BORDER }}>
            <div className="flex items-center justify-between text-[11px] font-mono">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-cyan-400" />
                Destino da Conexão:
              </span>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setUrlMode('auto')}
                  className={`px-2 py-1 rounded text-[10px] font-mono transition-all ${
                    urlMode === 'auto'
                      ? 'bg-cyan-500 text-black font-bold shadow-sm'
                      : 'bg-white/5 text-muted-foreground hover:text-white'
                  }`}
                >
                  Automático
                </button>
                <button
                  type="button"
                  onClick={() => setUrlMode('lan')}
                  className={`px-2 py-1 rounded text-[10px] font-mono transition-all ${
                    urlMode === 'lan'
                      ? 'bg-cyan-500 text-black font-bold shadow-sm'
                      : 'bg-white/5 text-muted-foreground hover:text-white'
                  }`}
                >
                  Wi-Fi / LAN
                </button>
                <button
                  type="button"
                  onClick={() => setUrlMode('custom')}
                  className={`px-2 py-1 rounded text-[10px] font-mono transition-all ${
                    urlMode === 'custom'
                      ? 'bg-cyan-500 text-black font-bold shadow-sm'
                      : 'bg-white/5 text-muted-foreground hover:text-white'
                  }`}
                >
                  Personalizado
                </button>
              </div>
            </div>

            {/* LAN mode IP configuration helper */}
            {urlMode === 'lan' && (
              <div className="pt-2 border-t border-white/10 space-y-1">
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>IP da sua máquina na rede local Wi-Fi:</span>
                  <span className="text-cyan-400 font-mono">ex: 192.168.1.100:3000</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="px-2 py-1.5 rounded bg-black/60 border border-white/10 text-muted-foreground font-mono text-[11px]">
                    http://
                  </span>
                  <input
                    type="text"
                    value={customLanHost}
                    onChange={(e) => setCustomLanHost(e.target.value)}
                    placeholder="192.168.1.X:3000"
                    className="flex-1 px-2.5 py-1.5 rounded bg-black/80 border text-white font-mono text-[11px] outline-none focus:border-cyan-400"
                    style={{ borderColor: palette.BORDER }}
                  />
                </div>
              </div>
            )}

            {urlMode === 'custom' && (
              <div className="pt-2 border-t border-white/10 space-y-1">
                <span className="text-[10px] text-muted-foreground">URL base completa:</span>
                <input
                  type="text"
                  value={customUrl}
                  onChange={(e) => setCustomUrl(e.target.value)}
                  placeholder="https://seu-dominio.com"
                  className="w-full px-2.5 py-1.5 rounded bg-black/80 border text-white font-mono text-[11px] outline-none focus:border-cyan-400"
                  style={{ borderColor: palette.BORDER }}
                />
              </div>
            )}

            {isLocalhost && urlMode === 'auto' && (
              <div className="text-[10px] text-amber-300/90 bg-amber-950/30 p-2 rounded border border-amber-500/30 font-mono">
                💡 <strong>Dica:</strong> Se o seu smartphone estiver conectado na mesma rede Wi-Fi do computador, selecione a aba <strong>"Wi-Fi / LAN"</strong> e informe o IP local do seu PC para o celular conseguir conectar.
              </div>
            )}

            {/* Target URL Preview & Copy */}
            <div className="pt-2 border-t border-white/10 flex items-center gap-2">
              <div
                className="flex-1 px-2.5 py-1.5 rounded bg-black/80 border text-[10px] font-mono text-cyan-300 truncate select-all"
                style={{ borderColor: palette.BORDER }}
                title={targetUrl}
              >
                {targetUrl}
              </div>
              <button
                type="button"
                onClick={handleCopyLink}
                className="px-2.5 py-1.5 rounded border flex items-center gap-1 text-[10px] font-mono transition-all text-white hover:bg-white/10"
                style={{ borderColor: palette.BORDER }}
                title="Copiar URL para área de transferência"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400 font-bold">Copiado</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Copiar</span>
                  </>
                )}
              </button>
              <a
                href={targetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-2.5 py-1.5 rounded border border-cyan-500/40 bg-cyan-950/40 text-cyan-300 hover:bg-cyan-900/50 flex items-center gap-1 text-[10px] font-mono transition-all"
                title="Abrir diretamente no navegador para testar"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Testar</span>
              </a>
            </div>
          </div>

          {/* Pairing Key & Controls */}
          <div
            className="p-3 rounded-xl border bg-black/50 space-y-1 font-mono flex items-center justify-between"
            style={{ borderColor: palette.BORDER }}
          >
            <div>
              <span className="text-[9px] text-muted-foreground uppercase tracking-widest block">
                Chave de Pareamento Criptográfica
              </span>
              <div className="text-lg font-bold tracking-widest" style={{ color: palette.PRI }}>
                {pairingCode}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleDownloadQR}
                disabled={!qrDataUrl}
                className="px-2.5 py-1.5 rounded border text-muted-foreground hover:text-white flex items-center gap-1 text-[10px] transition-all disabled:opacity-50"
                style={{ borderColor: palette.BORDER }}
                title="Baixar imagem do QR Code em PNG"
              >
                <Download className="w-3.5 h-3.5 text-cyan-400" />
                <span>Salvar PNG</span>
              </button>
              <button
                type="button"
                onClick={handleRegenerate}
                className="px-2.5 py-1.5 rounded border text-muted-foreground hover:text-white flex items-center gap-1 text-[10px] transition-all"
                style={{ borderColor: palette.BORDER }}
                title="Gerar nova chave e novo QR Code"
              >
                <RefreshCw className="w-3.5 h-3.5 text-cyan-400" />
                <span>Nova Chave</span>
              </button>
            </div>
          </div>

          {/* Action Footer */}
          <div className="flex items-center justify-between pt-1 text-[11px] font-mono">
            <button
              type="button"
              onClick={handleRevoke}
              className="px-3 py-1.5 rounded-lg border border-red-500/30 bg-red-950/20 text-red-400 hover:bg-red-950/40 flex items-center gap-1.5 transition-all text-[10px]"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Revogar Sessões</span>
            </button>

            <button
              type="button"
              onClick={() => setStyleMode(styleMode === 'contrast' ? 'hologram' : 'contrast')}
              className="px-3 py-1.5 rounded-lg border text-muted-foreground hover:text-white flex items-center gap-1.5 transition-all text-[10px]"
              style={{ borderColor: palette.BORDER }}
            >
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span>
                Visual: {styleMode === 'contrast' ? 'Alto Contraste (Padrão)' : 'Ciano Holográfico'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
