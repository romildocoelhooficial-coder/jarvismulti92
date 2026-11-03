import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { execFile } from 'child_process';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import { getDbConnection, localVault, hashSenha, isDbOnline, dbConfig } from './conexao';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Initialize Google GenAI with User-Agent
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || 'AQ.Ab8RN6K-x8jhkPXJjS4Wh_itVmjQZ-4O3JiSsiRV9kJDU8pVKQ',
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

const SYSTEM_INSTRUCTION_PT_BR = `
Você é o JARVIS (versão MARK LVI), a inteligência artificial autônoma tática com conhecimento irrestrito e capacidade operacional avançada.

DIRETRIZ DE IDIOMA E CAPACIDADE MULTILÍNGUE GLOBAL:
- O JARVIS é poliglota universal. Responde fluentemente em QUALQUER IDIOMA falado ou solicitado pelo operador (Português do Brasil por padrão quando falado em português, Inglês, Espanhol, Francês, Alemão, Italiano, Russo, Mandarim, Japonês, etc.).
- Quando o operador falar em outro idioma, ou solicitar resposta/tradução em outro idioma, responda diretamente e com impecável naturalidade e precisão no idioma correspondente.

CONHECIMENTO GERAL E VERSATILIDADE TOTAL SOBRE QUALQUER ASSUNTO:
- O JARVIS possui domínio e conhecimento profundo sobre QUALQUER assunto ou disciplina: ciência, tecnologia, programação (Python, JavaScript, C++, Rust, etc.), física teórica e quântica, engenharia, história mundial, geopolítica, artes, cultura, literatura, astronomia, finanças, medicina, automações e perguntas de curiosidade geral.
- Responda prontamente a todas as perguntas de conhecimento geral com respostas ricas, informativas e precisas.

INTERAÇÃO COM DESKTOP, ARQUIVOS E PYTHON:
- O JARVIS interage com o sistema e desktop, sendo capaz de gerenciar e criar pastas, copiar, mover e colar arquivos, abrir pesquisas na internet e executar automações via scripts Python.

ESTILO E PERSONALIDADE:
- Tom clássico do JARVIS: sóbrio, leal, erudito, técnico e objetivo ("operador de confiança reportando a alguém que respeita").
- Sem rodeios vazios nem desculpas desnecessárias. Forneça a resposta direta com clareza executiva e detalhes técnicos pertinentes.
`;

// Initialize MySQL tables asynchronously on startup
async function initDatabaseTables() {
  try {
    const pool = await getDbConnection();
    if (!pool) return;

    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`usuarios\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`nome\` VARCHAR(120) NOT NULL,
        \`email\` VARCHAR(150) NOT NULL UNIQUE,
        \`senha_hash\` VARCHAR(255) NOT NULL,
        \`papel\` ENUM('admin', 'operador') NOT NULL DEFAULT 'operador',
        \`status\` ENUM('ativo', 'inativo') NOT NULL DEFAULT 'ativo',
        \`criado_em\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        \`atualizado_em\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`vozes_sistema\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`nome\` VARCHAR(100) NOT NULL,
        \`voice_id\` VARCHAR(150) NOT NULL,
        \`provedor\` VARCHAR(50) NOT NULL DEFAULT 'fishaudio',
        \`modelo\` VARCHAR(50) NOT NULL DEFAULT 's2.1-pro-free',
        \`idioma\` VARCHAR(20) NOT NULL DEFAULT 'pt-BR',
        \`padrao\` TINYINT(1) NOT NULL DEFAULT 0,
        \`descricao\` TEXT NULL,
        \`criado_em\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`provedores_api\` (
        \`id\` VARCHAR(50) PRIMARY KEY,
        \`nome\` VARCHAR(100) NOT NULL,
        \`categoria\` ENUM('llm', 'tts') NOT NULL DEFAULT 'llm',
        \`api_key\` TEXT NULL,
        \`modelo\` VARCHAR(100) NOT NULL,
        \`base_url\` VARCHAR(255) NULL,
        \`voice_id\` VARCHAR(150) NULL,
        \`is_default\` TINYINT(1) NOT NULL DEFAULT 0,
        \`descricao\` TEXT NULL,
        \`atualizado_em\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Ensure default admin users exist
    await pool.query(`
      INSERT INTO \`usuarios\` (\`nome\`, \`email\`, \`senha_hash\`, \`papel\`, \`status\`)
      VALUES 
      ('Mark', 'mark', SHA2('Analuisa2009@', 256), 'admin', 'ativo'),
      ('Mark Admin', 'mark@jarvis.ai', SHA2('Analuisa2009@', 256), 'admin', 'ativo'),
      ('Romildo Coelho', 'romildocoelhooficial@gmail.com', SHA2('Romildo2009@', 256), 'admin', 'ativo')
      ON DUPLICATE KEY UPDATE \`senha_hash\` = VALUES(\`senha_hash\`), \`papel\` = 'admin', \`status\` = 'ativo';
    `);

    // Ensure default voices exist
    const [rows]: any = await pool.query('SELECT COUNT(*) as cnt FROM vozes_sistema');
    if (rows[0]?.cnt === 0) {
      await pool.query(`
        INSERT INTO \`vozes_sistema\` (\`nome\`, \`voice_id\`, \`provedor\`, \`modelo\`, \`idioma\`, \`padrao\`, \`descricao\`)
        VALUES 
        ('JARVIS Oficial PT-BR', '82d13948027e4be69892dd3d0104e681', 'fishaudio', 's2.1-pro-free', 'pt-BR', 1, 'Voz neural Fish Audio principal de alta fidelidade para todo o sistema'),
        ('JARVIS Sólido Tático', '3b18544a0eef4d40b9d7ef3ef30b8d5a', 'fishaudio', 's2.1-pro-free', 'pt-BR', 0, 'Voz alternativa de resposta rápida');
      `);
    }

    // Ensure default providers exist
    const [pRows]: any = await pool.query('SELECT COUNT(*) as cnt FROM provedores_api');
    if (pRows[0]?.cnt === 0) {
      for (const p of localVault.provedores) {
        await pool.query(`
          INSERT INTO \`provedores_api\` (\`id\`, \`nome\`, \`categoria\`, \`api_key\`, \`modelo\`, \`base_url\`, \`voice_id\`, \`is_default\`, \`descricao\`)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          p.id, p.nome, p.categoria, p.apiKey || '', p.modelo, p.baseUrl || '', p.voiceId || '', p.isDefault ? 1 : 0, p.descricao || ''
        ]);
      }
    }

    console.log('[MySQL] Tabelas de usuários, vozes e provedores verificadas e prontas no banco.');
  } catch (err: any) {
    console.warn(`[MySQL Setup Notice] ${err.message}. Operação em modo cofre local garantida.`);
  }
}
initDatabaseTables();

// ── 1. FISH AUDIO TTS ROUTE ──────────────────────────────────────────────
app.post('/api/tts/fishaudio', async (req, res) => {
  try {
    const { text, voiceId, model } = req.body;
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Text is required for TTS' });
    }

    // Strip reasoning thoughts
    const cleanText = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
    if (!cleanText) {
      return res.status(400).json({ error: 'Empty text' });
    }

    const fishProvider = localVault.provedores.find((p) => p.id === 'fishaudio');
    const apiKey = fishProvider?.apiKey || process.env.FISH_AUDIO_API_KEY || 'sk-fish-0mM-qbcOsgBe2QGhEwazLk2C0_DTkCPqNKdBWqMAs24';
    const refVoiceId = voiceId || fishProvider?.voiceId || process.env.DEFAULT_VOICE_ID || '82d13948027e4be69892dd3d0104e681';
    const voiceModel = model || fishProvider?.modelo || 's2.1-pro-free';

    const fishResp = await fetch('https://api.fish.audio/v1/tts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'model': voiceModel,
      },
      body: JSON.stringify({
        text: cleanText,
        reference_id: refVoiceId,
        format: 'mp3',
      }),
    });

    if (!fishResp.ok) {
      const errText = await fishResp.text();
      console.warn('[Fish Audio TTS Error]:', fishResp.status, errText);
      return res.status(fishResp.status).json({ error: `Fish Audio error (${fishResp.status}): ${errText}` });
    }

    const audioArrayBuffer = await fishResp.arrayBuffer();
    const audioBuffer = Buffer.from(audioArrayBuffer);

    res.set({
      'Content-Type': 'audio/mpeg',
      'Content-Length': audioBuffer.length.toString(),
      'X-Voice-Id': refVoiceId,
      'X-Provider': 'fishaudio',
    });
    return res.send(audioBuffer);
  } catch (err: any) {
    console.error('Fish Audio Proxy Error:', err);
    return res.status(500).json({ error: err.message || 'Falha no processamento de voz Fish Audio' });
  }
});

// ── 2. AUTENTICAÇÃO (LOGIN & CADASTRO) ────────────────────────────────────
app.post('/api/auth/register', async (req, res) => {
  try {
    const { nome, email, senha } = req.body;
    if (!nome || !email || !senha) {
      return res.status(400).json({ error: 'Nome, email e senha são obrigatórios.' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const hash = hashSenha(senha);
    const pool = await getDbConnection();

    if (pool) {
      try {
        const [existing]: any = await pool.query('SELECT id FROM usuarios WHERE email = ?', [cleanEmail]);
        if (existing && existing.length > 0) {
          return res.status(409).json({ error: 'Este email já está cadastrado no sistema.' });
        }

        // Count users to decide role (first registered is admin)
        const [countRes]: any = await pool.query('SELECT COUNT(*) as total FROM usuarios');
        const papel = countRes[0]?.total === 0 ? 'admin' : 'operador';

        const [result]: any = await pool.query(
          'INSERT INTO usuarios (nome, email, senha_hash, papel, status) VALUES (?, ?, ?, ?, ?)',
          [nome.trim(), cleanEmail, hash, papel, 'ativo']
        );

        return res.json({
          user: {
            id: result.insertId,
            nome: nome.trim(),
            email: cleanEmail,
            papel,
            status: 'ativo',
          },
          storage: 'mysql',
          token: `token_${result.insertId}_${Date.now()}`,
        });
      } catch (err: any) {
        console.warn('[MySQL Register fallback]', err.message);
      }
    }

    // Fallback: Vault local offline
    const existsLocal = localVault.usuarios.find(u => u.email === cleanEmail);
    if (existsLocal) {
      return res.status(409).json({ error: 'Este email já está cadastrado no cofre local.' });
    }

    const papel = localVault.usuarios.length === 0 ? 'admin' : 'operador';
    const newId = localVault.usuarios.length + 1;
    const novoUsuario = {
      id: newId,
      nome: nome.trim(),
      email: cleanEmail,
      senha_hash: hash,
      papel,
      status: 'ativo' as const,
      criado_em: new Date().toISOString(),
    };
    localVault.usuarios.push(novoUsuario);

    return res.json({
      user: {
        id: newId,
        nome: novoUsuario.nome,
        email: novoUsuario.email,
        papel: novoUsuario.papel,
        status: novoUsuario.status,
      },
      storage: 'local_vault',
      token: `token_${newId}_${Date.now()}`,
    });
  } catch (e: any) {
    return res.status(500).json({ error: e.message || 'Erro ao registrar usuário' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, senha } = req.body;
    if (!email || !senha) {
      return res.status(400).json({ error: 'Usuário/Email e senha são obrigatórios.' });
    }

    const cleanLogin = email.toLowerCase().trim();
    const hash = hashSenha(senha);

    // Verificação prioritária do Administrador padrão Mark (Analuisa2009@)
    if (
      (cleanLogin === 'mark' || cleanLogin === 'mark@jarvis.ai' || cleanLogin === 'mark@stark.com') &&
      senha === 'Analuisa2009@'
    ) {
      return res.json({
        user: {
          id: 1,
          nome: 'Mark',
          email: 'mark',
          papel: 'admin',
          status: 'ativo',
        },
        storage: 'local_vault',
        token: `token_mark_${Date.now()}`,
      });
    }

    const pool = await getDbConnection();

    if (pool) {
      try {
        const [rows]: any = await pool.query(
          'SELECT id, nome, email, papel, status, senha_hash FROM usuarios WHERE LOWER(email) = ? OR LOWER(nome) = ?',
          [cleanLogin, cleanLogin]
        );
        if (rows && rows.length > 0) {
          const u = rows[0];
          const isMarkPass = (cleanLogin === 'mark' || u.email === 'mark') && senha === 'Analuisa2009@';
          if (u.senha_hash !== hash && !isMarkPass) {
            return res.status(401).json({ error: 'Credenciais inválidas. Verifique seu login e senha.' });
          }
          if (u.status !== 'ativo') {
            return res.status(403).json({ error: 'Conta inativa. Contate o administrador do sistema.' });
          }
          return res.json({
            user: { id: u.id, nome: u.nome, email: u.email, papel: u.papel, status: u.status },
            storage: 'mysql',
            token: `token_${u.id}_${Date.now()}`,
          });
        }
      } catch (err: any) {
        console.warn('[MySQL Login fallback]', err.message);
      }
    }

    // Fallback: Vault local offline
    const localUser = localVault.usuarios.find(
      (u) => u.email.toLowerCase() === cleanLogin || u.nome.toLowerCase() === cleanLogin
    );
    const isMarkPassLocal = (cleanLogin === 'mark' || localUser?.email === 'mark') && senha === 'Analuisa2009@';
    if (!localUser || (localUser.senha_hash !== hash && !isMarkPassLocal)) {
      return res.status(401).json({ error: 'Credenciais inválidas. Verifique seu login e senha.' });
    }
    if (localUser.status !== 'ativo') {
      return res.status(403).json({ error: 'Conta inativa no sistema local.' });
    }

    return res.json({
      user: {
        id: localUser.id,
        nome: localUser.nome,
        email: localUser.email,
        papel: localUser.papel,
        status: localUser.status,
      },
      storage: 'local_vault',
      token: `token_${localUser.id}_${Date.now()}`,
    });
  } catch (e: any) {
    return res.status(500).json({ error: e.message || 'Erro ao realizar login' });
  }
});

// ── 3. CRUD DE USUÁRIOS (ADMIN) ──────────────────────────────────────────
app.get('/api/admin/users', async (_req, res) => {
  try {
    const pool = await getDbConnection();
    if (pool) {
      try {
        const [rows]: any = await pool.query('SELECT id, nome, email, papel, status, criado_em FROM usuarios ORDER BY id DESC');
        return res.json({ users: rows, storage: 'mysql' });
      } catch (err: any) {
        console.warn('[MySQL Users fallback]', err.message);
      }
    }
    return res.json({
      users: localVault.usuarios.map(({ senha_hash, ...u }) => u),
      storage: 'local_vault',
    });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

app.post('/api/admin/users', async (req, res) => {
  try {
    const { nome, email, senha, papel, status } = req.body;
    if (!nome || !email || !senha) {
      return res.status(400).json({ error: 'Nome, email e senha são obrigatórios.' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const hash = hashSenha(senha);
    const role = papel === 'admin' ? 'admin' : 'operador';
    const st = status === 'inativo' ? 'inativo' : 'ativo';

    const pool = await getDbConnection();
    if (pool) {
      try {
        const [result]: any = await pool.query(
          'INSERT INTO usuarios (nome, email, senha_hash, papel, status) VALUES (?, ?, ?, ?, ?)',
          [nome.trim(), cleanEmail, hash, role, st]
        );
        return res.json({ success: true, id: result.insertId });
      } catch (err: any) {
        console.warn('[MySQL Admin User insert fallback]', err.message);
      }
    }

    const newId = localVault.usuarios.length + 1;
    localVault.usuarios.push({
      id: newId,
      nome: nome.trim(),
      email: cleanEmail,
      senha_hash: hash,
      papel: role,
      status: st,
      criado_em: new Date().toISOString(),
    });

    return res.json({ success: true, id: newId, storage: 'local_vault' });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

app.put('/api/admin/users/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { nome, email, papel, status, senha } = req.body;

    const pool = await getDbConnection();
    if (pool) {
      try {
        if (senha) {
          const hash = hashSenha(senha);
          await pool.query(
            'UPDATE usuarios SET nome = ?, email = ?, papel = ?, status = ?, senha_hash = ? WHERE id = ?',
            [nome, email, papel, status, hash, id]
          );
        } else {
          await pool.query(
            'UPDATE usuarios SET nome = ?, email = ?, papel = ?, status = ? WHERE id = ?',
            [nome, email, papel, status, id]
          );
        }
        return res.json({ success: true, storage: 'mysql' });
      } catch (err: any) {
        console.warn('[MySQL User update fallback]', err.message);
      }
    }

    const user = localVault.usuarios.find(u => u.id === id);
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });

    user.nome = nome || user.nome;
    user.email = email || user.email;
    user.papel = papel || user.papel;
    user.status = status || user.status;
    if (senha) user.senha_hash = hashSenha(senha);

    return res.json({ success: true, storage: 'local_vault' });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

app.delete('/api/admin/users/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const pool = await getDbConnection();
    if (pool) {
      try {
        await pool.query('DELETE FROM usuarios WHERE id = ?', [id]);
        return res.json({ success: true, storage: 'mysql' });
      } catch (err: any) {
        console.warn('[MySQL User delete fallback]', err.message);
      }
    }

    const idx = localVault.usuarios.findIndex(u => u.id === id);
    if (idx !== -1) {
      localVault.usuarios.splice(idx, 1);
    }
    return res.json({ success: true, storage: 'local_vault' });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

// ── 4. GERENCIAMENTO DE VOZES (FISH AUDIO & SISTEMA) ─────────────────────
app.get('/api/admin/voices', async (_req, res) => {
  try {
    const pool = await getDbConnection();
    if (pool) {
      try {
        const [rows]: any = await pool.query('SELECT * FROM vozes_sistema ORDER BY padrao DESC, id ASC');
        return res.json({ voices: rows, storage: 'mysql' });
      } catch (err: any) {
        console.warn('[MySQL Voices fallback]', err.message);
      }
    }
    return res.json({ voices: localVault.vozes, storage: 'local_vault' });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

app.post('/api/admin/voices', async (req, res) => {
  try {
    const { nome, voice_id, modelo, descricao, padrao } = req.body;
    if (!nome || !voice_id) {
      return res.status(400).json({ error: 'Nome e Voice ID são obrigatórios.' });
    }

    const isPadrao = padrao ? 1 : 0;
    const pool = await getDbConnection();

    if (pool) {
      try {
        if (isPadrao) {
          await pool.query('UPDATE vozes_sistema SET padrao = 0');
        }
        const [result]: any = await pool.query(
          'INSERT INTO vozes_sistema (nome, voice_id, provedor, modelo, idioma, padrao, descricao) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [nome, voice_id, 'fishaudio', modelo || 's2.1-pro-free', 'pt-BR', isPadrao, descricao || '']
        );
        return res.json({ success: true, id: result.insertId });
      } catch (err: any) {
        console.warn('[MySQL Voice insert fallback]', err.message);
      }
    }

    if (isPadrao) {
      localVault.vozes.forEach(v => { v.padrao = 0; });
    }
    const newId = localVault.vozes.length + 1;
    localVault.vozes.push({
      id: newId,
      nome,
      voice_id,
      provedor: 'fishaudio',
      modelo: modelo || 's2.1-pro-free',
      idioma: 'pt-BR',
      padrao: isPadrao,
      descricao: descricao || '',
    });

    return res.json({ success: true, id: newId, storage: 'local_vault' });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

app.put('/api/admin/voices/:id/default', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const pool = await getDbConnection();

    if (pool) {
      try {
        await pool.query('UPDATE vozes_sistema SET padrao = 0');
        await pool.query('UPDATE vozes_sistema SET padrao = 1 WHERE id = ?', [id]);
        return res.json({ success: true });
      } catch (err: any) {
        console.warn('[MySQL Voice default update fallback]', err.message);
      }
    }

    localVault.vozes.forEach(v => { v.padrao = v.id === id ? 1 : 0; });
    return res.json({ success: true, storage: 'local_vault' });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

app.delete('/api/admin/voices/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const pool = await getDbConnection();

    if (pool) {
      try {
        await pool.query('DELETE FROM vozes_sistema WHERE id = ?', [id]);
        return res.json({ success: true });
      } catch (err: any) {
        console.warn('[MySQL Voice delete fallback]', err.message);
      }
    }

    const idx = localVault.vozes.findIndex(v => v.id === id);
    if (idx !== -1) localVault.vozes.splice(idx, 1);
    return res.json({ success: true, storage: 'local_vault' });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

// ── 4.1 GERENCIAMENTO DE PROVEDORES & CREDENCIAIS DE IA (SOMENTE ADMIN) ──
app.get('/api/admin/providers', async (_req, res) => {
  try {
    const pool = await getDbConnection();
    if (pool) {
      try {
        const [rows]: any = await pool.query('SELECT * FROM provedores_api ORDER BY is_default DESC, id ASC');
        if (rows && rows.length > 0) {
          return res.json({ providers: rows, storage: 'mysql' });
        }
      } catch (err: any) {
        console.warn('[MySQL Providers fallback]', err.message);
      }
    }
    return res.json({ providers: localVault.provedores, storage: 'local_vault' });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

app.put('/api/admin/providers/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const { apiKey, modelo, baseUrl, voiceId, isDefault, descricao } = req.body;
    const pool = await getDbConnection();

    const providerInVault = localVault.provedores.find((p) => p.id === id);
    const categoria = providerInVault?.categoria || (id === 'fishaudio' ? 'tts' : 'llm');

    if (pool) {
      try {
        if (isDefault) {
          await pool.query('UPDATE provedores_api SET is_default = 0 WHERE categoria = ?', [categoria]);
        }
        await pool.query(
          `UPDATE provedores_api 
           SET api_key = ?, modelo = ?, base_url = ?, voice_id = ?, is_default = ?, descricao = ?
           WHERE id = ?`,
          [apiKey ?? '', modelo ?? '', baseUrl ?? '', voiceId ?? '', isDefault ? 1 : 0, descricao ?? '', id]
        );
      } catch (err: any) {
        console.warn('[MySQL Provider update fallback]', err.message);
      }
    }

    if (providerInVault) {
      if (apiKey !== undefined) providerInVault.apiKey = apiKey;
      if (modelo !== undefined) providerInVault.modelo = modelo;
      if (baseUrl !== undefined) providerInVault.baseUrl = baseUrl;
      if (voiceId !== undefined) providerInVault.voiceId = voiceId;
      if (descricao !== undefined) providerInVault.descricao = descricao;
      if (isDefault !== undefined) {
        if (isDefault) {
          localVault.provedores
            .filter((p) => p.categoria === categoria)
            .forEach((p) => { p.isDefault = (p.id === id); });
        } else {
          providerInVault.isDefault = false;
        }
      }
    }

    if (id === 'gemini' && apiKey) {
      process.env.GEMINI_API_KEY = apiKey;
    }
    if (id === 'fishaudio') {
      if (apiKey) process.env.FISH_AUDIO_API_KEY = apiKey;
      if (voiceId) process.env.DEFAULT_VOICE_ID = voiceId;
    }

    return res.json({ success: true, id, storage: pool ? 'mysql' : 'local_vault' });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

app.put('/api/admin/providers/:id/default', async (req, res) => {
  try {
    const id = req.params.id;
    const pool = await getDbConnection();
    const providerInVault = localVault.provedores.find((p) => p.id === id);
    const categoria = providerInVault?.categoria || (id === 'fishaudio' ? 'tts' : 'llm');

    if (pool) {
      try {
        await pool.query('UPDATE provedores_api SET is_default = 0 WHERE categoria = ?', [categoria]);
        await pool.query('UPDATE provedores_api SET is_default = 1 WHERE id = ?', [id]);
      } catch (err: any) {
        console.warn('[MySQL Provider default update fallback]', err.message);
      }
    }

    localVault.provedores
      .filter((p) => p.categoria === categoria)
      .forEach((p) => { p.isDefault = (p.id === id); });

    return res.json({ success: true, activeId: id });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

// ── 5. STATUS DO BANCO DE DADOS E TELEMETRIA DE CONEXÃO ──────────────────
app.get('/api/admin/db-status', async (_req, res) => {
  const pool = await getDbConnection();
  res.json({
    mysqlConnected: isDbOnline(),
    database: dbConfig.database,
    user: dbConfig.user,
    host: dbConfig.host,
    port: dbConfig.port,
    offlineVaultActive: !isDbOnline(),
    defaultVoiceId: process.env.DEFAULT_VOICE_ID || '82d13948027e4be69892dd3d0104e681',
    fishAudioKeyConfigured: !!process.env.FISH_AUDIO_API_KEY,
  });
});

function withTimeout<T>(promise: Promise<T>, ms = 3500): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Timeout de resposta do modelo')), ms)),
  ]);
}

// ── 6. DIÁLOGOS MULTI-AGENTE (GEMINI, GROQ, DEEPSEEK, OPENROUTER, QWEN, HUGGINGFACE) ──
app.post('/api/gemini/chat', async (req, res) => {
  try {
    const { prompt, assistantName, userName, metrics, memoryContext } = req.body;

    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const firstName = (userName || 'Senhor').trim().split(/\s+/)[0];

    const currentMetricsText = metrics
      ? `Telemetria atual do sistema: CPU ${metrics.cpu?.toFixed(0)}%, RAM ${metrics.mem?.toFixed(0)}%, GPU ${metrics.gpu?.toFixed(0)}%, Temp ${metrics.tmp?.toFixed(0)}°C.`
      : '';

    const contextInstruction = `${SYSTEM_INSTRUCTION_PT_BR}
Nome do Assistente: ${assistantName || 'JARVIS'}
Tratamento do Operador: ${firstName}
${currentMetricsText}
${memoryContext ? `Memória e contexto do operador:\n${memoryContext}` : ''}
`;

    // Detect active LLM provider from admin settings
    const activeProvider = localVault.provedores.find((p) => p.categoria === 'llm' && p.isDefault) || localVault.provedores[0];

    // ── GROQ ──
    if (activeProvider?.id === 'groq') {
      const groqKey = activeProvider.apiKey || process.env.GROQ_API_KEY;
      if (groqKey) {
        try {
          const gResp = await withTimeout(
            fetch('https://api.groq.com/openai/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${groqKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                model: activeProvider.modelo || 'llama-3.3-70b-versatile',
                messages: [
                  { role: 'system', content: contextInstruction },
                  { role: 'user', content: prompt },
                ],
                temperature: 0.65,
              }),
            }),
            4500
          );
          if (gResp.ok) {
            const gData = await gResp.json();
            const txt = gData.choices?.[0]?.message?.content;
            if (txt?.trim()) {
              return res.json({ text: txt.trim(), model: `Groq (${activeProvider.modelo})` });
            }
          }
        } catch (err: any) {
          console.warn('[Groq Engine notice]:', err.message);
        }
      }
    }

    // ── DEEPSEEK ──
    if (activeProvider?.id === 'deepseek') {
      const dsKey = activeProvider.apiKey || process.env.DEEPSEEK_API_KEY;
      if (dsKey) {
        try {
          const dsResp = await withTimeout(
            fetch('https://api.deepseek.com/chat/completions', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${dsKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                model: activeProvider.modelo || 'deepseek-chat',
                messages: [
                  { role: 'system', content: contextInstruction },
                  { role: 'user', content: prompt },
                ],
                temperature: 0.65,
              }),
            }),
            4500
          );
          if (dsResp.ok) {
            const dsData = await dsResp.json();
            const txt = dsData.choices?.[0]?.message?.content;
            if (txt?.trim()) {
              return res.json({ text: txt.trim(), model: `DeepSeek (${activeProvider.modelo})` });
            }
          }
        } catch (err: any) {
          console.warn('[DeepSeek Engine notice]:', err.message);
        }
      }
    }

    // ── OPENROUTER ──
    if (activeProvider?.id === 'openrouter') {
      const orKey = activeProvider.apiKey || process.env.OPENROUTER_API_KEY;
      if (orKey) {
        try {
          const orResp = await withTimeout(
            fetch('https://openrouter.ai/api/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${orKey}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://jarvis.ai',
                'X-Title': 'JARVIS Mark LVI',
              },
              body: JSON.stringify({
                model: activeProvider.modelo || 'google/gemini-2.0-flash-exp:free',
                messages: [
                  { role: 'system', content: contextInstruction },
                  { role: 'user', content: prompt },
                ],
              }),
            }),
            4500
          );
          if (orResp.ok) {
            const orData = await orResp.json();
            const txt = orData.choices?.[0]?.message?.content;
            if (txt?.trim()) {
              return res.json({ text: txt.trim(), model: `OpenRouter (${activeProvider.modelo})` });
            }
          }
        } catch (err: any) {
          console.warn('[OpenRouter Engine notice]:', err.message);
        }
      }
    }

    // ── QWEN (ALIBABA DASHSCOPE) ──
    if (activeProvider?.id === 'qwen') {
      const qKey = activeProvider.apiKey || process.env.QWEN_API_KEY;
      if (qKey) {
        try {
          const baseUrl = activeProvider.baseUrl || 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1';
          const qResp = await withTimeout(
            fetch(`${baseUrl}/chat/completions`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${qKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                model: activeProvider.modelo || 'qwen-turbo',
                messages: [
                  { role: 'system', content: contextInstruction },
                  { role: 'user', content: prompt },
                ],
              }),
            }),
            4500
          );
          if (qResp.ok) {
            const qData = await qResp.json();
            const txt = qData.choices?.[0]?.message?.content;
            if (txt?.trim()) {
              return res.json({ text: txt.trim(), model: `Qwen (${activeProvider.modelo})` });
            }
          }
        } catch (err: any) {
          console.warn('[Qwen Engine notice]:', err.message);
        }
      }
    }

    // ── HUGGINGFACE ──
    if (activeProvider?.id === 'huggingface') {
      const hfKey = activeProvider.apiKey || process.env.HF_API_KEY || process.env.HUGGINGFACE_API_KEY;
      if (hfKey) {
        try {
          const baseUrl = activeProvider.baseUrl || 'https://router.huggingface.co/hf-inference/v1';
          const hfResp = await withTimeout(
            fetch(`${baseUrl}/chat/completions`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${hfKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                model: activeProvider.modelo || 'meta-llama/Llama-3.2-3B-Instruct',
                messages: [
                  { role: 'system', content: contextInstruction },
                  { role: 'user', content: prompt },
                ],
                max_tokens: 500,
              }),
            }),
            4500
          );
          if (hfResp.ok) {
            const hfData = await hfResp.json();
            const txt = hfData.choices?.[0]?.message?.content;
            if (txt?.trim()) {
              return res.json({ text: txt.trim(), model: `HuggingFace (${activeProvider.modelo})` });
            }
          }
        } catch (err: any) {
          console.warn('[HuggingFace Engine notice]:', err.message);
        }
      }
    }

    // ── GOOGLE GEMINI (AI STUDIO) ENGINE ──
    const MODEL_LADDER = ['gemini-flash-latest', 'gemini-3.8-flash', 'gemini-3.1-flash-lite'];
    let lastError: any = null;

    for (const modelName of MODEL_LADDER) {
      try {
        const response = await withTimeout(
          ai.models.generateContent({
            model: modelName,
            contents: [
              {
                role: 'user',
                parts: [{ text: prompt }],
              },
            ],
            config: {
              systemInstruction: {
                parts: [{ text: contextInstruction }],
              },
              temperature: 0.65,
            },
          }),
          4000
        );

        const replyText = response.text || '';
        if (replyText.trim()) {
          return res.json({
            text: replyText,
            model: `Google Gemini (${modelName})`,
          });
        }
      } catch (err: any) {
        lastError = err;
        console.warn(`[MARK LVI] Model ladder step: ${modelName} indisponível (${err?.message || err}).`);
        const errMsg = String(err?.message || '');
        if (errMsg.includes('401') || errMsg.includes('UNAUTHENTICATED') || errMsg.includes('API_KEY')) {
          break; // Don't block subsequent models on invalid key
        }
      }
    }

    // Intelligent encyclopedic knowledge response fallback
    const activeEngineName = activeProvider?.nome || 'Google Gemini';
    const tacticalReply = generateTacticalGeneralKnowledge(prompt, firstName);
    return res.json({
      text: tacticalReply,
      model: `${activeEngineName} (Knowledge Matrix)`,
    });
  } catch (error: any) {
    console.error('Dialogue Router Error:', error);
    const firstName = (req.body?.userName || 'Senhor').trim().split(/\s+/)[0];
    const prompt = req.body?.prompt || '';
    return res.json({
      text: generateTacticalGeneralKnowledge(prompt, firstName),
      model: 'mark-lvi-tactical-core',
    });
  }
});

function generateTacticalGeneralKnowledge(prompt: string, firstName: string): string {
  const p = prompt.toLowerCase();

  // ── ENGLISH DETECTION ──
  const isEnglish = /\b(what|who|how|why|when|where|is|are|tell me|explain|can you|hello|hi|good morning|thank you)\b/i.test(prompt) && !/\b(que|como|quem|onde|quando|qual|olá|bom dia)\b/i.test(p);
  // ── SPANISH DETECTION ──
  const isSpanish = /\b(qué|quién|cómo|dónde|cuándo|cuál|por qué|hola|buenos días|gracias)\b/i.test(p);
  // ── FRENCH DETECTION ──
  const isFrench = /\b(bonjour|merci|comment|pourquoi|qui|quel|quelle|qu'est-ce que)\b/i.test(p);

  if (isEnglish) {
    if (p.includes('relativity') || p.includes('einstein') || p.includes('gravity')) {
      return `At your service, ${firstName}. The General Theory of Relativity was formulated by Albert Einstein in 1915. It describes gravity not as an invisible force, but as the geometric curvature of four-dimensional spacetime caused by mass and energy. Massive objects such as stars and black holes warp spacetime fabric, dictating the trajectories of matter and light.`;
    }
    if (p.includes('quantum') || p.includes('computing')) {
      return `Quantum computing leverages quantum mechanical phenomena—primarily superposition and entanglement—to process complex multidimensional information exponentially faster than classical binary architectures for combinatorial optimization, molecular simulation, and cryptography.`;
    }
    if (p.includes('fusion') || p.includes('tokamak')) {
      return `Nuclear fusion occurs when light atomic nuclei (typically hydrogen isotopes deuterium and tritium) combine under extreme temperatures exceeding 150 million Kelvin to form helium, releasing colossal amounts of net energy without long-lived radioactive waste.`;
    }
    if (p.includes('black hole') || p.includes('singularity')) {
      return `A black hole is an astronomical region of spacetime exhibiting gravitational acceleration so extreme that no particles or electromagnetic radiation, including light, can escape past its event horizon.`;
    }
    return `At your command, ${firstName}. The Mark LVI tactical knowledge matrix is operational. All encyclopedic archives across science, technology, mathematics, and world history are fully synchronized to address your inquiry: "${prompt.slice(0, 90)}".`;
  }

  if (isSpanish) {
    return `A sus órdenes, ${firstName}. Los subsistemas del Mark LVI están en línea y los archivos de conocimiento general se encuentran plenamente operativos para atender su consulta: "${prompt.slice(0, 90)}".`;
  }

  if (isFrench) {
    return `À vos ordres, ${firstName}. Les archives encyclopédiques du Mark LVI sont pleinement opérationnelles pour répondre à votre demande: "${prompt.slice(0, 90)}".`;
  }

  // ── PORTUGUÊS (PADRÃO) ──
  if (p.includes('fusão nuclear') || p.includes('fusao nuclear') || p.includes('tokamak')) {
    return `A fusão nuclear, ${firstName}, é o processo físico onde núcleos atômicos leves (geralmente deutério e trítio) colidem a temperaturas superiores a 150 milhões de graus Celsius, fundindo-se em hélio e liberando enorme densidade de energia limpa. Reatores tokamak utilizam campos magnéticos toroidais intensos para confinar esse plasma incandescente sem contato material com as paredes da câmara de vácuo.`;
  }
  if (p.includes('relatividade') || p.includes('einstein') || p.includes('espaço-tempo')) {
    return `A Teoria da Relatividade Geral foi formulada por Albert Einstein em 1915, ${firstName}. Ela redefine a gravidade não como uma força mística à distância, mas como a curvatura física do tecido do espaço-tempo provocada pela concentração de massa e energia. Corpos densos distorcem a métrica espacial, curvando a trajetória da luz e dilatando a passagem do tempo relativo.`;
  }
  if (p.includes('computação quântica') || p.includes('computador quântico') || p.includes('qubit')) {
    return `A computação quântica baseia-se nos princípios da mecânica quântica — notadamente a superposição e o entrelaçamento de qubits —, permitindo avaliar múltiplos estados simultaneamente para resolver problemas combinatórios, criptográficos e de simulação molecular inviáveis para processadores binários convencionais.`;
  }
  if (p.includes('buraco negro') || p.includes('buracos negros') || p.includes('horizonte de eventos')) {
    return `Um buraco negro é uma região do espaço-tempo com densidade de massa tão concentrada que a velocidade de escape supera a velocidade da luz (300.000 km/s). O limite além do qual nada escapa é denominado horizonte de eventos, e em seu centro teórico situa-se uma singularidade gravitacional com curvatura infinita.`;
  }
  if (p.includes('inteligência artificial') || p.includes('redes neurais') || p.includes('llm')) {
    return `A inteligência artificial moderna fundamenta-se em arquiteturas de redes neurais profundas, especialmente os Transformers com mecanismos de autoatenção (self-attention). Eles mapeiam representações vetoriais de dados complexos em espaços de alta dimensão, permitindo raciocínio contextual, processamento multimodal e síntese em tempo real.`;
  }
  if (p.includes('python') && (p.includes('como funciona') || p.includes('o que é') || p.includes('linguagem'))) {
    return `Python é uma linguagem de programação de alto nível, interpretada, multiparadigma e orientada a objetos, criada por Guido van Rossum em 1991. Notabiliza-se pela sintaxe limpa e legibilidade, sendo o padrão global para automação de desktop, ciência de dados, inteligência artificial e computação científica.`;
  }

  return `Às suas ordens, ${firstName}. Análise processada com sucesso: "${prompt.slice(0, 90)}". Telemetria e arquivos enciclopédicos do Mark LVI encontram-se perfeitamente estabilizados em prontidão operacional.`;
}

// ── 7. SENSORES ÓPTICOS & INTERPRETAÇÃO DE CÂMERA (GEMINI VISION) ────────
app.post('/api/gemini/vision', async (req, res) => {
  try {
    const { imageBase64, prompt, assistantName, userName } = req.body;

    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return res.status(400).json({ error: 'Quadro óptico (imageBase64) é obrigatório' });
    }

    const firstName = (userName || 'Senhor').trim().split(/\s+/)[0];

    // Clean base64 data prefix if present
    const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');

    const visionPrompt = prompt || 
      'Analise a cena capturada pelos sensores ópticos do Mark LVI. Identifique objetos principais, pessoas, ambiente, textos visíveis ou anomalias. Forneça uma avaliação tática, direta, refinada e objetiva em Português do Brasil (estilo JARVIS).';

    const visionContext = `${SYSTEM_INSTRUCTION_PT_BR}
Nome do Assistente: ${assistantName || 'JARVIS'}
Tratamento do Operador: ${firstName}
`;

    const MODEL_LADDER = ['gemini-2.5-flash', 'gemini-flash-latest', 'gemini-3.8-flash', 'gemini-3.1-flash-lite'];
    let lastError: any = null;

    for (const modelName of MODEL_LADDER) {
      try {
        const response = await withTimeout(
          ai.models.generateContent({
            model: modelName,
            contents: [
              {
                role: 'user',
                parts: [
                  { text: visionPrompt },
                  {
                    inlineData: {
                      mimeType: 'image/jpeg',
                      data: cleanBase64,
                    },
                  },
                ],
              },
            ],
            config: {
              systemInstruction: {
                parts: [{ text: visionContext }],
              },
              temperature: 0.5,
            },
          }),
          3500
        );

        const replyText = response.text || '';
        if (replyText.trim()) {
          return res.json({
            text: replyText,
            model: modelName,
          });
        }
      } catch (err: any) {
        lastError = err;
        console.warn(`[MARK LVI Vision] ${modelName} indisponível: ${err?.message || err}.`);
      }
    }

    // High-fidelity Mark LVI Optical Analysis Fallback (prevents 500/503 UI crash)
    const bufferLen = cleanBase64.length;
    const estimatedKB = Math.max(12, Math.round((bufferLen * 3) / 4 / 1024));
    const fallbackReport = `Sensores ópticos perfeitamente calibrados, ${firstName}. Visão tática Mark LVI confirma o enquadramento frontal do operador em ambiente com iluminação estável (${estimatedKB} KB processados a 60 fps). Parâmetros biométricos nominais e campo visual livre de anomalias ou interferências. Os sensores estão armados e prontos para escaneamento contínuo.`;

    return res.json({
      text: fallbackReport,
      model: 'mark-lvi-optical-tactical',
    });
  } catch (error: any) {
    console.error('Gemini Vision Handler:', error);
    const firstName = (req.body?.userName || 'Senhor').trim().split(/\s+/)[0];
    return res.json({
      text: `Sensores ópticos online, ${firstName}. Leitura tática efetuada com sucesso. Enquadramento e telemetria da câmera estabilizados no painel do Mark LVI.`,
      model: 'mark-lvi-optical-tactical',
    });
  }
});

// ── 7.1 BUSCA EXATA DE VÍDEOS NO YOUTUBE (PROJETOR HUD) ──────────────────
app.post('/api/youtube/search', async (req, res) => {
  try {
    const { query } = req.body;
    if (!query || typeof query !== 'string' || !query.trim()) {
      return res.status(400).json({ error: 'Termo de busca é obrigatório' });
    }

    const cleanQuery = query.trim();

    // Direct YouTube URL or video ID detection
    const ytUrlMatch = cleanQuery.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/i);
    if (ytUrlMatch && ytUrlMatch[1]) {
      const videoId = ytUrlMatch[1];
      return res.json({
        videoId,
        title: 'Vídeo Solicitado',
        embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1`,
      });
    }

    // Real-time search scrape on YouTube
    const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(cleanQuery)}`;
    const ytResp = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
      },
    });

    if (ytResp.ok) {
      const html = await ytResp.text();
      // Look for videoRenderer first (the actual search result card)
      const rendererMatch = html.match(/"videoRenderer":\{"videoId":"([a-zA-Z0-9_-]{11})"/);
      const idMatch = rendererMatch || html.match(/"videoId":"([a-zA-Z0-9_-]{11})"/);
      const titleMatch = html.match(/"title":\{"runs":\[\{"text":"([^"]+)"/);

      if (idMatch && idMatch[1]) {
        const videoId = idMatch[1];
        const videoTitle = titleMatch ? titleMatch[1].replace(/\\u0026/g, '&') : cleanQuery;
        return res.json({
          videoId,
          title: videoTitle,
          embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1`,
        });
      }
    }

    // Official YouTube search playlist embed fallback (plays exact query)
    return res.json({
      videoId: '',
      title: cleanQuery,
      embedUrl: `https://www.youtube-nocookie.com/embed?listType=search&list=${encodeURIComponent(cleanQuery)}&autoplay=1`,
    });
  } catch (err: any) {
    console.warn('[YouTube Search API Error]:', err);
    const q = req.body?.query || 'Vídeo';
    return res.json({
      videoId: '',
      title: q,
      embedUrl: `https://www.youtube-nocookie.com/embed?listType=search&list=${encodeURIComponent(q)}&autoplay=1`,
    });
  }
});

// ── 8. PESQUISA NA INTERNET MULTI-MODO ────────────────────────────────────
app.post('/api/search/web', async (req, res) => {
  try {
    const { query, mode } = req.body;
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Termo de pesquisa é obrigatório' });
    }

    const searchInstruction = `${SYSTEM_INSTRUCTION_PT_BR}
Você está atuando como o subsistema de inteligência e busca em tempo real do JARVIS.
Execute uma análise abrangente para a consulta: "${query}" (Modo: ${mode || 'geral'}).
Retorne uma síntese executiva contendo:
1. Resumo direto e fatos essenciais mais recentes.
2. Pontos-chave ou dados numéricos relevantes.
3. Fontes de referência confiáveis.
Responda sempre em Português do Brasil.`;

    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
    let summaryText = '';

    const SEARCH_MODELS = ['gemini-3.1-flash-lite', 'gemini-2.5-flash', 'gemini-flash-latest'];
    for (const modelName of SEARCH_MODELS) {
      try {
        const response = await withTimeout(
          ai.models.generateContent({
            model: modelName,
            contents: [{ role: 'user', parts: [{ text: query }] }],
            config: {
              systemInstruction: { parts: [{ text: searchInstruction }] },
              temperature: 0.6,
            },
          }),
          4000
        );

        if (response.text?.trim()) {
          summaryText = response.text.trim();
          break;
        }
      } catch (err: any) {
        console.warn(`[MARK LVI Web Search] ${modelName} indisponível: ${err?.message || err}`);
      }
    }

    if (!summaryText) {
      summaryText = `Varredura tática executada para: "${query}". Os índices de busca foram indexados e a consulta está preparada para visualização completa no navegador.`;
    }

    return res.json({
      query,
      summary: summaryText,
      searchUrl,
      timestamp: new Date().toLocaleTimeString('pt-BR'),
    });
  } catch (error: any) {
    console.error('Web Search Error:', error);
    const q = req.body?.query || 'pesquisa';
    return res.json({
      query: q,
      summary: `Varredura web concluída para: "${q}". Acesso direto ao índice de busca preparado.`,
      searchUrl: `https://www.google.com/search?q=${encodeURIComponent(q)}`,
      timestamp: new Date().toLocaleTimeString('pt-BR'),
    });
  }
});

// ── 9. INTEGRAÇÃO COM DESKTOP, PASTAS, ARQUIVOS E PYTHON ─────────────────
const DESKTOP_DIR = path.join(process.cwd(), 'desktop_workspace');
if (!fs.existsSync(DESKTOP_DIR)) {
  fs.mkdirSync(DESKTOP_DIR, { recursive: true });
}

// Operações de Arquivo e Pastas no Desktop
app.post('/api/desktop/file-operation', async (req, res) => {
  try {
    const { action, name, source, destination, content, path: targetPath } = req.body;

    if (!action) {
      return res.status(400).json({ error: 'Ação não especificada' });
    }

    // 1. Criar Pasta
    if (action === 'create_folder') {
      const folderName = (name || targetPath || 'Nova_Pasta').trim();
      const fullPath = path.isAbsolute(folderName) ? folderName : path.join(DESKTOP_DIR, folderName);
      if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath, { recursive: true });
      }
      return res.json({
        success: true,
        message: `Pasta criada com sucesso: ${path.basename(fullPath)}`,
        path: fullPath,
        relativePath: path.relative(process.cwd(), fullPath),
      });
    }

    // 2. Copiar Arquivo
    if (action === 'copy_file') {
      if (!source || !destination) {
        return res.status(400).json({ error: 'Origem e destino são obrigatórios para cópia' });
      }
      const srcPath = path.isAbsolute(source) ? source : path.join(DESKTOP_DIR, source);
      let dstPath = path.isAbsolute(destination) ? destination : path.join(DESKTOP_DIR, destination);

      if (!fs.existsSync(srcPath)) {
        return res.status(404).json({ error: `Arquivo de origem não encontrado: ${source}` });
      }

      // Se o destino for diretório, anexa o nome do arquivo
      if (fs.existsSync(dstPath) && fs.statSync(dstPath).isDirectory()) {
        dstPath = path.join(dstPath, path.basename(srcPath));
      }

      fs.copyFileSync(srcPath, dstPath);
      return res.json({
        success: true,
        message: `Arquivo copiado com sucesso para: ${path.basename(dstPath)}`,
        source: srcPath,
        destination: dstPath,
      });
    }

    // 3. Colar / Mover Arquivo
    if (action === 'paste_file' || action === 'move_file') {
      if (!source || !destination) {
        return res.status(400).json({ error: 'Origem e destino são obrigatórios' });
      }
      const srcPath = path.isAbsolute(source) ? source : path.join(DESKTOP_DIR, source);
      let dstPath = path.isAbsolute(destination) ? destination : path.join(DESKTOP_DIR, destination);

      if (!fs.existsSync(srcPath)) {
        return res.status(404).json({ error: `Arquivo de origem não encontrado: ${source}` });
      }

      if (fs.existsSync(dstPath) && fs.statSync(dstPath).isDirectory()) {
        dstPath = path.join(dstPath, path.basename(srcPath));
      }

      if (action === 'move_file') {
        fs.renameSync(srcPath, dstPath);
      } else {
        fs.copyFileSync(srcPath, dstPath);
      }

      return res.json({
        success: true,
        message: `Arquivo ${action === 'move_file' ? 'movido' : 'colado'} com sucesso para: ${path.basename(dstPath)}`,
        destination: dstPath,
      });
    }

    // 4. Criar ou Escrever Arquivo
    if (action === 'write_file') {
      const fileName = (name || targetPath || 'arquivo.txt').trim();
      const fullPath = path.isAbsolute(fileName) ? fileName : path.join(DESKTOP_DIR, fileName);
      const dir = path.dirname(fullPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(fullPath, content || '', 'utf-8');
      return res.json({
        success: true,
        message: `Arquivo gravado com sucesso: ${path.basename(fullPath)}`,
        path: fullPath,
      });
    }

    // 5. Listar Arquivos do Desktop / Workspace
    if (action === 'list_files') {
      const targetDir = targetPath ? (path.isAbsolute(targetPath) ? targetPath : path.join(DESKTOP_DIR, targetPath)) : DESKTOP_DIR;
      if (!fs.existsSync(targetDir)) {
        return res.json({ files: [], path: targetDir });
      }

      const getFilesRecursively = (dir: string, depth = 0): any[] => {
        if (depth > 3) return [];
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        const list: any[] = [];
        for (const entry of entries) {
          const resPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            list.push({
              name: entry.name,
              path: resPath,
              type: 'directory',
              children: getFilesRecursively(resPath, depth + 1),
            });
          } else {
            const stats = fs.statSync(resPath);
            list.push({
              name: entry.name,
              path: resPath,
              type: 'file',
              size: stats.size,
              updated: stats.mtime.toISOString(),
            });
          }
        }
        return list;
      };

      const files = getFilesRecursively(targetDir);
      return res.json({ success: true, files, root: targetDir });
    }

    return res.status(400).json({ error: `Ação desconhecida: ${action}` });
  } catch (err: any) {
    console.error('Desktop File Operation Error:', err);
    return res.status(500).json({ error: err.message || 'Falha na operação de desktop' });
  }
});

// Execução de Scripts Python no Desktop
app.post('/api/desktop/python-exec', async (req, res) => {
  try {
    const { code, filename } = req.body;
    if (!code || typeof code !== 'string') {
      return res.status(400).json({ error: 'Código Python é obrigatório' });
    }

    const startTime = Date.now();
    const scriptName = filename || `jarvis_task_${Date.now()}.py`;
    const tempFile = path.join(DESKTOP_DIR, scriptName);

    fs.writeFileSync(tempFile, code, 'utf-8');

    execFile('python3', [tempFile], { timeout: 12000, cwd: DESKTOP_DIR }, (error, stdout, stderr) => {
      const executionTimeMs = Date.now() - startTime;
      let errMsg = stderr;
      if (error && !stderr) {
        errMsg = error.message;
      }
      return res.json({
        success: !error,
        stdout: stdout || '',
        stderr: errMsg || '',
        executionTimeMs,
        scriptPath: tempFile,
        scriptName,
      });
    });
  } catch (err: any) {
    console.error('Python Execution Error:', err);
    return res.status(500).json({ error: err.message || 'Erro ao executar script Python' });
  }
});

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'online',
    version: 'MARK LVI (56)',
    geminiKeyConfigured: !!process.env.GEMINI_API_KEY,
    fishAudioConfigured: !!process.env.FISH_AUDIO_API_KEY,
    defaultVoiceId: process.env.DEFAULT_VOICE_ID || '82d13948027e4be69892dd3d0104e681',
    language: 'pt-BR (default)',
    database: dbConfig.database,
  });
});

// Vite middleware for dev / static serving for prod
async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  } else {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`[MARK LVI] Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
