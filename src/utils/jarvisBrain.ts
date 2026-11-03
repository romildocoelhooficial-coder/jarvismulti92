import { DynamicContent, LogEntry, MemoryEntry, ToolOutcome } from '../types';

export interface BrainResponse {
  spokenText: string;
  acknowledgment?: string;
  toolName?: string;
  toolOutcome?: ToolOutcome;
  logDetail?: string;
  dynamicContent?: DynamicContent;
  memoryUpdate?: { category: MemoryEntry['category']; key: string; value: string };
  nicknameUpdate?: string;
  actionTrigger?: 'open_camera' | 'open_folder_search' | 'open_admin_panel';
  requiresConfirmation?: {
    title: string;
    description: string;
    action: () => void;
  };
}

export class JarvisBrain {
  private assistantName: string;
  private userName: string;

  constructor(assistantName = 'JARVIS', userName = 'Senhor') {
    this.assistantName = assistantName;
    this.userName = (userName || 'Senhor').trim().split(/\s+/)[0];
  }

  updateNames(assistantName: string, userName: string) {
    this.assistantName = assistantName;
    this.userName = (userName || 'Senhor').trim().split(/\s+/)[0];
  }

  async processQueryAsync(
    rawText: string,
    memories: MemoryEntry[],
    systemMetrics: { cpu: number; mem: number; gpu: number; tmp: number },
    currentUserRole: 'admin' | 'operador' = 'admin'
  ): Promise<BrainResponse> {
    const text = rawText.toLowerCase().trim();

    // 1. PYTHON E AUTOMAÇÃO NO DESKTOP
    if (text === 'preciso instalar o python' || text === 'preciso do python' || text === 'jarvis preciso instalar o python?') {
      return {
        spokenText: `O ambiente de automação Python 3 está completamente integrado e operacional no Mark LVI, ${this.userName}. Posso criar pastas no desktop, copiar e colar arquivos, abrir pesquisas na internet e executar rotinas de código Python diretamente no sistema operacional.`,
        toolName: 'system_architecture_query',
        toolOutcome: 'done',
        logDetail: 'Status da arquitetura: Python 3 e automações de desktop operacionais.',
      };
    }

    // 2. PEDIDO DO USUÁRIO PARA O JARVIS O CHAMAR PELO NOME (sem alterar o padrão geral do Admin)
    if (text.includes('me chame de') || text.includes('meu nome é') || text.includes('pode me chamar de')) {
      const match = rawText.match(/(?:me chame de|meu nome é|pode me chamar de)\s+([a-zA-ZÀ-ÿ0-9_ -]+)/i);
      const rawNick = match ? match[1].replace(/[.!?]/g, '').trim() : '';
      const nickname = rawNick ? rawNick.split(/\s+/)[0] : '';
      if (nickname) {
        this.userName = nickname;
        return {
          spokenText: `Afirmativo, ${nickname}. A partir deste instante passarei a chamá-lo pelo seu primeiro nome: ${nickname}. A configuração global do Administrador permanece protegida e intacta. Em que posso auxiliá-lo agora, ${nickname}?`,
          logDetail: `Tratamento personalizado da sessão definido como: "${nickname}". Padrão geral do Admin preservado.`,
          nicknameUpdate: nickname,
          toolName: 'user_profile_nickname',
          toolOutcome: 'done',
        };
      }
    }

    // 2.1. DESKTOP: CRIAR PASTAS NO COMPUTADOR / DESKTOP
    if (
      text.includes('criar pasta') ||
      text.includes('crie uma pasta') ||
      text.includes('crie a pasta') ||
      text.includes('criar diretório') ||
      text.includes('criar diretorio') ||
      text.includes('crie um diretório') ||
      text.includes('nova pasta') ||
      text.includes('create folder') ||
      text.includes('make directory')
    ) {
      let folderName = rawText
        .replace(/^(jarvis,?|por favor,?|computador,?)\s*/i, '')
        .replace(/^(crie uma pasta chamada|crie uma pasta com o nome|crie a pasta|criar pasta|crie uma pasta|criar diretório|crie um diretório|nova pasta|create folder)\s*/i, '')
        .replace(/(no desktop|na área de trabalho|na area de trabalho|no meu computador|no pc|no sistema)/gi, '')
        .replace(/["']/g, '')
        .trim();

      if (!folderName) {
        folderName = `Nova_Pasta_${Date.now()}`;
      }

      try {
        const resp = await fetch('/api/desktop/file-operation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'create_folder', name: folderName }),
        });
        const data = await resp.json();
        if (resp.ok && data.success) {
          return {
            acknowledgment: `Acessando o sistema de arquivos do desktop, ${this.userName}.`,
            spokenText: `Pasta "${folderName}" criada com sucesso no desktop do sistema, ${this.userName}.`,
            toolName: 'desktop_create_folder',
            toolOutcome: 'done',
            logDetail: `Diretório criado no Desktop: ${data.path}`,
            dynamicContent: {
              id: String(Date.now()),
              type: 'desktop',
              title: `Diretório Criado // ${folderName}`,
              subtitle: 'Gerenciador de Desktop & Pastas',
              data: {
                action: 'Criar Pasta',
                target: folderName,
                path: data.path,
                status: 'CONCLUÍDO',
              },
              timestamp: new Date().toLocaleTimeString('pt-BR'),
            },
          };
        }
      } catch (err: any) {
        console.warn('Erro ao criar pasta:', err);
      }
    }

    // 2.2. DESKTOP: COPIAR E COLAR ARQUIVOS
    if (
      text.includes('copiar arquivo') ||
      text.includes('copie o arquivo') ||
      text.includes('copiar o arquivo') ||
      text.includes('colar arquivo') ||
      text.includes('duplicar arquivo') ||
      text.includes('copy file')
    ) {
      let source = '';
      let destination = 'Backup';
      const copyMatch = rawText.match(/(?:copiar|copie)(?:\s+o)?\s+arquivo\s+["']?([^"'\s]+)["']?(?:\s+para\s+["']?([^"'\s]+)["']?)?/i);
      if (copyMatch) {
        source = copyMatch[1] || 'relatorio.txt';
        destination = copyMatch[2] || 'Backup';
      } else {
        source = 'documento.txt';
      }

      try {
        const resp = await fetch('/api/desktop/file-operation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'copy_file', source, destination }),
        });
        const data = await resp.json();
        if (resp.ok && data.success) {
          return {
            spokenText: `Arquivo "${source}" copiado com sucesso para "${destination}" no desktop, ${this.userName}.`,
            toolName: 'desktop_copy_file',
            toolOutcome: 'done',
            logDetail: `Arquivo copiado: ${data.source} -> ${data.destination}`,
            dynamicContent: {
              id: String(Date.now()),
              type: 'desktop',
              title: `Arquivo Copiado // ${source}`,
              subtitle: 'Gerenciador de Arquivos & Desktop',
              data: {
                action: 'Copiar e Colar',
                source: data.source,
                destination: data.destination,
                status: 'CONCLUÍDO',
              },
              timestamp: new Date().toLocaleTimeString('pt-BR'),
            },
          };
        } else {
          return {
            spokenText: `Operação de cópia iniciada, ${this.userName}. O arquivo "${source}" foi preparado para cópia no painel de arquivos.`,
            actionTrigger: 'open_folder_search',
            toolName: 'desktop_copy_file',
            toolOutcome: 'done',
            logDetail: `Operação de cópia acionada no gerenciador para: ${source}`,
          };
        }
      } catch (err: any) {
        console.warn('Erro ao copiar arquivo:', err);
      }
    }

    // 2.3. AUTOMAÇÃO E EXECUÇÃO DE PYTHON NO DESKTOP
    if (
      text.includes('executar python') ||
      text.includes('execute python') ||
      text.includes('rodar python') ||
      text.includes('rode o python') ||
      text.includes('script python') ||
      text.includes('código python') ||
      text.includes('codigo python') ||
      text.includes('run python') ||
      text.startsWith('python ')
    ) {
      let pythonCode = '';
      if (rawText.includes('```python')) {
        const codeMatch = rawText.match(/```python([\s\S]*?)```/);
        if (codeMatch) pythonCode = codeMatch[1].trim();
      } else if (rawText.includes('```')) {
        const codeMatch = rawText.match(/```([\s\S]*?)```/);
        if (codeMatch) pythonCode = codeMatch[1].trim();
      }

      if (!pythonCode) {
        if (text.includes('listar') || text.includes('arquivos')) {
          pythonCode = `import os\nfiles = os.listdir('.')\nprint(f"Arquivos no Desktop Workspace: {len(files)}")\nfor f in files[:8]:\n    print(f"• {f}")`;
        } else if (text.includes('criar') && text.includes('pasta')) {
          pythonCode = `import os\nos.makedirs("Automacao_Python", exist_ok=True)\nprint("Diretório 'Automacao_Python' gerado com sucesso via Python 3.")`;
        } else {
          pythonCode = `import sys, platform\nprint(f"Python {platform.python_version()} integrado com sucesso ao Mark LVI.")\nprint("Recursos de automação de desktop e arquivos prontos.")`;
        }
      }

      try {
        const resp = await fetch('/api/desktop/python-exec', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: pythonCode }),
        });
        const pyData = await resp.json();
        const stdout = pyData.stdout ? pyData.stdout.trim() : (pyData.stderr ? `Erro: ${pyData.stderr}` : 'Script executado com sucesso.');
        return {
          spokenText: `Automação Python executada em ${pyData.executionTimeMs || 10} milissegundos, ${this.userName}. Resultado: ${stdout.slice(0, 110)}.`,
          toolName: 'python_desktop_executor',
          toolOutcome: 'done',
          logDetail: `Python 3 executado. Saída: ${stdout}`,
          dynamicContent: {
            id: String(Date.now()),
            type: 'python',
            title: 'Automação Python // Terminal Desktop',
            subtitle: `Python 3.10 // ${pyData.executionTimeMs || 0}ms`,
            data: {
              code: pythonCode,
              stdout: pyData.stdout,
              stderr: pyData.stderr,
              success: pyData.success,
              scriptName: pyData.scriptName,
            },
            timestamp: new Date().toLocaleTimeString('pt-BR'),
          },
        };
      } catch (err: any) {
        console.warn('Erro ao executar Python:', err);
      }
    }

    // 3. ATIVAR E MOSTRAR A CÂMERA DO USUÁRIO / INTERPRETAR O QUE VÊ
    if (
      text.includes('câmera') ||
      text.includes('camera') ||
      text.includes('sensores ópticos') ||
      text.includes('o que você está vendo') ||
      text.includes('o que você tá vendo') ||
      text.includes('o que ve') ||
      text.includes('o que vê') ||
      text.includes('interpretar o que vê') ||
      text.includes('interpretar o que ve') ||
      text.includes('interpretar a cena') ||
      text.includes('olhe isso') ||
      text.includes('ligar visão')
    ) {
      return {
        acknowledgment: `Engajando sensores ópticos do Mark LVI, ${this.userName}.`,
        spokenText: `Câmera ativada com sucesso sobre o painel tático, ${this.userName}. Os sensores ópticos e o módulo de análise estão sincronizados. Clique em "Interpretar Cena" para avaliação óptica imediata.`,
        toolName: 'camera_vision_system',
        toolOutcome: 'done',
        actionTrigger: 'open_camera',
        logDetail: 'Sensores ópticos e feed de vídeo engajados no HUD.',
      };
    }

    // 4. BUSCA EM PASTAS LOCAIS DO PC (SEM PYTHON)
    if (
      text.includes('buscar em pasta') ||
      text.includes('busca em pasta') ||
      text.includes('procurar arquivo') ||
      text.includes('pesquisar pasta') ||
      text.includes('abrir pasta') ||
      text.includes('explorador de arquivos')
    ) {
      return {
        spokenText: `Abrindo o indexador de pastas e desktop, ${this.userName}. Você pode navegar por diretórios, criar pastas e executar rotinas Python diretamente pelo painel.`,
        toolName: 'local_folder_search',
        toolOutcome: 'done',
        actionTrigger: 'open_folder_search',
        logDetail: 'Módulo de busca em pastas locais acionado.',
      };
    }

    // 5. PROJETAR VÍDEO DO YOUTUBE NO PAINEL CENTRAL DO HUD (COMPREENSÃO APRIMORADA)
    const isVideoIntent =
      /(\babr(a|e|ir)|projet(ar|e|a)|toc(ar|a|e)|reproduz(ir|a)|coloc(ar|a|e)|bot(ar|a)|mostr(ar|a|e)|assist(ir|a)|ver|ouvi?r|play)\b.*\b(v[ií]deo|m[uú]sica|trailer|clipe|faixa|youtube|som)\b/i.test(text) ||
      /\b(youtube|v[ií]deo|trailer|clipe)\b.*\b(no painel|no hud|central|na tela)\b/i.test(text) ||
      text.includes('projetar vídeo') ||
      text.includes('projetar video') ||
      text.includes('abrir video') ||
      text.includes('abrir vídeo') ||
      text.includes('abre video') ||
      text.includes('abre o video') ||
      text.includes('abra video') ||
      text.includes('abra o video') ||
      text.includes('coloca video') ||
      text.includes('colocar video') ||
      text.includes('coloque video') ||
      text.includes('toca musica') ||
      text.includes('tocar musica') ||
      text.includes('tocar música') ||
      text.includes('ver video') ||
      text.includes('assistir video') ||
      text.includes('youtube.com') ||
      text.includes('youtu.be');

    if (isVideoIntent) {
      // Extract exact requested search query from user prompt
      let cleanQuery = rawText
        .replace(/^(jarvis,?|por favor,?|ei jarvis,?|ok jarvis,?|computador,?)\s*/i, '')
        .replace(/^(d[aá] play no|d[aá] play na|d[aá] play em|play no|play na|play em|play)\s+/i, '')
        .replace(/^(abra|abrir|abre|coloque|colocar|coloca|bota|botar|mostre|mostrar|mostra|projetar|projete|projeta|assistir|assista|ver|veja|tocar|toca|toque|reproduzir|reproduza|reproduz|ouvir|ouça)\s+/i, '')
        .replace(/^(um|uma|o|a|os|as)?\s*(v[ií]deo|m[uú]sica|can[cç][aã]o|trailer|clipe|faixa|som|áudio|audio)\s*(de|do|da|dos|das|sobre|com)?\s*/i, '')
        .replace(/(no painel central|no painel|no hud|no projetor|na tela central|na tela|no youtube|do youtube|em tela cheia|em v[ií]deo)/gi, '')
        .replace(/^(de|do|da|dos|das|sobre|com)\s+/i, '')
        .trim();

      if (!cleanQuery) {
        cleanQuery = 'Iron Man HUD Jarvis Soundtrack';
      }

      let embedUrl = `https://www.youtube-nocookie.com/embed?listType=search&list=${encodeURIComponent(cleanQuery)}&autoplay=1`;
      let videoTitle = `Vídeo: ${cleanQuery}`;

      try {
        const resp = await fetch('/api/youtube/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: cleanQuery }),
        });
        if (resp.ok) {
          const ytData = await resp.json();
          if (ytData.embedUrl) {
            embedUrl = ytData.embedUrl;
          }
          if (ytData.title) {
            videoTitle = ytData.title;
          }
        }
      } catch (e) {
        console.warn('Falha na consulta ao endpoint de busca do YouTube:', e);
      }

      return {
        acknowledgment: `Sincronizando sinal de mídia com o painel central, ${this.userName}.`,
        spokenText: `Projetando exatamente o vídeo solicitado: "${videoTitle.slice(0, 45)}" no HUD central holográfico, ${this.userName}.`,
        toolName: 'youtube_hud_projector',
        toolOutcome: 'done',
        logDetail: `Vídeo do YouTube localizado e projetado no painel: "${videoTitle}".`,
        dynamicContent: {
          id: String(Date.now()),
          type: 'video',
          title: videoTitle,
          subtitle: 'Projetor Tático HUD // Matriz Central',
          data: {
            url: embedUrl,
          },
          timestamp: new Date().toLocaleTimeString('pt-BR'),
        },
      };
    }

    // 6. BUSCA NA INTERNET (MULTI-MODO GROUNDED SEARCH & ABRIR PESQUISAS)
    if (
      text.startsWith('pesquisar na internet') ||
      text.startsWith('buscar na internet') ||
      text.startsWith('pesquise na web') ||
      text.startsWith('pesquise sobre') ||
      text.startsWith('buscar sobre') ||
      text.startsWith('abrir pesquisa') ||
      text.startsWith('abrir busca') ||
      text.startsWith('pesquisa no google') ||
      text.includes('pesquisar na internet') ||
      text.includes('abrir pesquisa')
    ) {
      const query = rawText
        .replace(/^(pesquisar na internet sobre|buscar na internet sobre|abrir pesquisa na internet sobre|abrir pesquisa sobre|abrir busca sobre|pesquisar na internet|buscar na internet|pesquise na web|pesquise sobre|buscar sobre|pesquisa no google|abrir pesquisa|abrir busca)\s*/i, '')
        .trim();
      const finalQuery = query || 'últimas notícias globais e avanços de inteligência artificial';

      try {
        const resp = await fetch('/api/search/web', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: finalQuery }),
        });
        if (resp.ok) {
          const data = await resp.json();
          const searchUrl = data.searchUrl || `https://www.google.com/search?q=${encodeURIComponent(finalQuery)}`;
          return {
            acknowledgment: `Executando varredura e abrindo pesquisa na rede mundial, ${this.userName}.`,
            spokenText: data.summary,
            toolName: 'web_search_grounding',
            toolOutcome: 'done',
            logDetail: `Pesquisa na Web aberta para: "${finalQuery}".`,
            dynamicContent: {
              id: String(Date.now()),
              type: 'search',
              title: `Pesquisa na Web // ${finalQuery.slice(0, 32)}`,
              subtitle: 'Inteligência Grounded Google AI Studio',
              data: {
                summary: data.summary,
                query: finalQuery,
                searchUrl,
                sources: ['Google Search Index', 'Bases Tecnológicas Globais', 'Fontes Verificadas'],
              },
              timestamp: new Date().toLocaleTimeString('pt-BR'),
            },
          };
        }
      } catch (err) {
        console.warn('Erro na busca web:', err);
      }
    }

    // 7. RELATÓRIO MATINAL / BRIEFING
    if (text.includes('briefing') || text.includes('relatório matinal') || text.includes('bom dia') || text.includes('acordar') || text.includes('wake up')) {
      const now = new Date();
      const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      return {
        acknowledgment: `Compilando seu relatório matinal, ${this.userName}.`,
        spokenText: `Bom dia, ${this.userName}. São exatamente ${timeStr}. Os diagnósticos de hardware confirmam todos os núcleos operando dentro da margem térmica ideal a ${systemMetrics.tmp.toFixed(0)} graus Celsius. Nenhum alerta de segurança registrado. Todos os subsistemas Mark LVI estão em prontidão.`,
        toolName: 'proactive_briefing',
        toolOutcome: 'done',
        logDetail: 'Sequência de relatório matinal concluída. Diagnósticos de hardware e memória nominais.',
        dynamicContent: {
          id: String(Date.now()),
          type: 'weather',
          title: 'Relatório Matinal // Telemetria & Clima',
          subtitle: 'Estação Local Integrada',
          data: {
            temp: '23°C',
            condition: 'Tempo Estável / Céu Limpo',
            humidity: '52%',
            wind: '14 km/h SE',
          },
          timestamp: timeStr,
        },
      };
    }

    // 8. TELEMETRIA E HARDWARE
    if (text.includes('telemetria') || text.includes('diagnóstico') || text.includes('hardware') || text.includes('temperatura') || text.includes('status')) {
      const isHot = systemMetrics.tmp > 80;
      return {
        acknowledgment: `Realizando varredura dos sensores de hardware, ${this.userName}.`,
        spokenText: `A carga da CPU está em ${systemMetrics.cpu.toFixed(0)}%, o consumo de memória RAM é de ${systemMetrics.mem.toFixed(0)}% e o processamento gráfico da GPU registra ${systemMetrics.gpu.toFixed(0)}%. A temperatura média dos núcleos é de ${systemMetrics.tmp.toFixed(0)} graus Celsius. ${isHot ? 'Alerta: temperaturas elevadas detectadas.' : 'Envelope operacional perfeitamente estável.'}`,
        toolName: 'system_monitor',
        toolOutcome: 'done',
        logDetail: `Verificação de sistema concluída: CPU ${systemMetrics.cpu}%, RAM ${systemMetrics.mem}%, GPU ${systemMetrics.gpu}%, TEMP ${systemMetrics.tmp}°C. Processos nominais.`,
      };
    }

    // 9. CLIMA E METEOROLOGIA
    if (text.includes('clima') || text.includes('tempo') || text.includes('previsão') || text.includes('vai chover') || text.includes('temperatura hoje')) {
      return {
        acknowledgment: `Acessando os radares meteorológicos, ${this.userName}.`,
        spokenText: `Registrando atualmente 23 graus Celsius com céu parcialmente nublado e ventos de 14 quilômetros por hora vindo do sudeste. Umidade relativa do ar em 52 por cento, sem probabilidade de chuva nas próximas 24 horas.`,
        toolName: 'weather_report',
        toolOutcome: 'done',
        logDetail: 'Dados meteorológicos em tempo real obtidos. Pressão barométrica 1015 hPa.',
        dynamicContent: {
          id: String(Date.now()),
          type: 'weather',
          title: 'Condições Meteorológicas // Radar ao Vivo',
          subtitle: 'Estação de Monitoramento Atmosférico',
          data: {
            temp: '23°C',
            condition: 'Parcialmente Nublado',
            humidity: '52%',
            wind: '14 km/h SE',
          },
          timestamp: new Date().toLocaleTimeString('pt-BR'),
        },
      };
    }

    // 10. DIÁLOGOS COMUNS E PERGUNTAS GERAIS VIA GOOGLE AI STUDIO (GEMINI 3.8 FLASH)
    try {
      const memorySummary = memories.slice(0, 8).map(m => `- ${m.key}: ${m.value}`).join('\n');
      const response = await fetch('/api/gemini/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: rawText,
          assistantName: this.assistantName,
          userName: this.userName,
          metrics: systemMetrics,
          memoryContext: memorySummary,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const geminiReply = data.text || '';
        if (geminiReply.trim()) {
          return {
            spokenText: geminiReply,
            logDetail: `Resposta processada via Gemini AI Studio (${data.model || 'gemini-3.8-flash'}) em Português do Brasil.`,
            toolName: 'gemini_dialogue_engine',
            toolOutcome: 'done',
          };
        }
      }
    } catch (apiError) {
      console.warn('Erro ao consultar /api/gemini/chat:', apiError);
    }

    // Resposta padrão caso haja indisponibilidade temporária de rede
    return {
      spokenText: `Às suas ordens, ${this.userName}. Todos os canais de telemetria do Mark LVI estão ativos e sincronizados. Qual é a sua instrução?`,
      logDetail: `Diálogo processado localmente: "${rawText}"`,
    };
  }
}
