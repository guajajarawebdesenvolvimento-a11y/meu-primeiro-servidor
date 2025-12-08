const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const sqlite3 = require('sqlite3').verbose();

// ========== CONFIGURAÇÕES ==========
const app = express();
const PORT = 3000;
const JWT_SECRET = 'minha-chave-secreta-super-segura-2024-gesseiros';

// Conectar ao banco de dados
const db = new sqlite3.Database('./gesseiros.db');

// ========== MIDDLEWARES ==========
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use(express.static(__dirname));
app.use('/uploads', express.static('uploads'));

// ========== CRIAR TABELAS ==========
db.serialize(() => {
  // Tabela gesseiros
  db.run(`
    CREATE TABLE IF NOT EXISTS gesseiros (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      cidade TEXT NOT NULL,
      telefone TEXT NOT NULL,
      email TEXT,
      instagram TEXT,
      descricao TEXT,
      data_cadastro DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Tabela usuarios
  db.run(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      senha TEXT NOT NULL,
      gesseiro_id INTEGER,
      data_cadastro DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (gesseiro_id) REFERENCES gesseiros(id)
    )
  `);

 // ✅ Tabela fotos - versão FINAL CORRETA
db.run(`
  CREATE TABLE IF NOT EXISTS fotos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    gesseiro_id INTEGER NOT NULL,
    url_foto TEXT NOT NULL,
    descricao TEXT,
    data_upload DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (gesseiro_id) REFERENCES gesseiros(id) ON DELETE CASCADE
  )
`);

// ✅ Correção automática para bancos antigos (caso não tenha a coluna descricao)
db.run(`ALTER TABLE fotos ADD COLUMN descricao TEXT`, (err) => {
  if (err) {
    if (err.message.includes('duplicate column name')) {
      console.log('ℹ️ Coluna descricao já existe na tabela fotos.');
    } else if (err.message.includes('no such table')) {
      console.log('ℹ️ Tabela fotos ainda não existe.');
    } else {
      console.log('ℹ️ Verificação da coluna descricao:', err.message);
    }
  } else {
    console.log('✅ Coluna descricao criada com sucesso na tabela fotos!');
  }
});



  // NOVA: Tabela servicos com preços
  db.run(`
    CREATE TABLE IF NOT EXISTS servicos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      gesseiro_id INTEGER NOT NULL,
      nome_servico TEXT NOT NULL,
      preco_com_material REAL,
      preco_sem_material REAL,
      unidade TEXT DEFAULT 'm²',
      distancia_maxima INTEGER DEFAULT 50,
      data_cadastro DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (gesseiro_id) REFERENCES gesseiros(id)
    )
  `);

  console.log('✅ Tabelas verificadas/criadas!');
});

// ========== CONFIGURAR UPLOAD ==========
if (!fs.existsSync('./uploads')) {
  fs.mkdirSync('./uploads');
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'gesseiro-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Apenas imagens são permitidas!'));
    }
  }
});

// ========== MIDDLEWARE DE AUTENTICAÇÃO ==========
function verificarToken(req, res, next) {
  const token = req.headers['authorization'];
  
  if (!token) {
    return res.status(401).json({ erro: 'Token não fornecido' });
  }

  const tokenLimpo = token.replace('Bearer ', '');

  jwt.verify(tokenLimpo, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).json({ erro: 'Token inválido' });
    }

    req.gesseiroId = decoded.gesseiroId;
    req.email = decoded.email;
    next();
  });
}

// ========== ROTAS ==========

app.get('/', (req, res) => {
  res.send(`
    <html>
      <head>
        <title>API Gesseiros Pro - FASE 1</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            max-width: 800px;
            margin: 50px auto;
            padding: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
          }
          .card {
            background: rgba(255,255,255,0.1);
            padding: 30px;
            border-radius: 10px;
            backdrop-filter: blur(10px);
          }
          h1 { margin-bottom: 10px; }
          p { margin: 5px 0; }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>🏗️ API Gesseiros Pro - FASE 1</h1>
          <p>✅ Servidor rodando com novas funcionalidades!</p>
          <hr>
          <h3>🆕 Novidades:</h3>
          <p>✅ Upload de fotos com descrição</p>
          <p>✅ Sistema de serviços e preços</p>
          <p>✅ Preços com/sem material</p>
          <hr>
          <h3>📚 Rotas Disponíveis:</h3>
          <p>GET /api/gesseiros</p>
          <p>POST /api/gesseiros/:id/fotos (com descrição)</p>
          <p>POST /api/gesseiros/:id/servicos</p>
          <p>GET /api/gesseiros/:id/servicos</p>
          <p>DELETE /api/gesseiros/:id/servicos/:servicoId</p>
        </div>
      </body>
    </html>
  `);
});

// ========== CADASTRO COMPLETO ==========
app.post('/api/cadastro-completo', async (req, res) => {
  const { nome, cidade, telefone, email, instagram, descricao, senha } = req.body;

  console.log('=== CADASTRO COMPLETO ===');
  console.log('Nome:', nome);
  console.log('Email:', email);

  if (!nome || !cidade || !telefone || !email || !senha) {
    return res.status(400).json({ erro: 'Todos os campos obrigatórios devem ser preenchidos' });
  }

  try {
    db.get('SELECT * FROM usuarios WHERE email = ?', [email], async (err, usuarioExistente) => {
      if (err) {
        console.error('Erro ao verificar email:', err);
        return res.status(500).json({ erro: 'Erro no servidor' });
      }

      if (usuarioExistente) {
        return res.status(400).json({ erro: 'Este email já está cadastrado' });
      }

      db.run(
        'INSERT INTO gesseiros (nome, cidade, telefone, email, instagram, descricao) VALUES (?, ?, ?, ?, ?, ?)',
        [nome, cidade, telefone, email, instagram || '', descricao],
        async function(err) {
          if (err) {
            console.error('Erro ao criar gesseiro:', err);
            return res.status(500).json({ erro: 'Erro ao cadastrar gesseiro' });
          }

          const gesseiroId = this.lastID;
          console.log('Gesseiro criado com ID:', gesseiroId);

          const senhaHash = await bcrypt.hash(senha, 10);

          db.run(
            'INSERT INTO usuarios (email, senha, gesseiro_id) VALUES (?, ?, ?)',
            [email, senhaHash, gesseiroId],
            function(err) {
              if (err) {
                console.error('Erro ao criar usuário:', err);
                return res.status(500).json({ erro: 'Erro ao criar usuário' });
              }

              console.log('Usuário criado! ID:', this.lastID);

              const token = jwt.sign(
                { gesseiroId: gesseiroId, email: email },
                JWT_SECRET,
                { expiresIn: '7d' }
              );

              console.log('✅ Cadastro completo realizado com sucesso!\n');

              res.json({
                mensagem: 'Cadastro realizado com sucesso!',
                token: token,
                gesseiroId: gesseiroId,
                nome: nome,
                email: email
              });
            }
          );
        }
      );
    });
  } catch (erro) {
    console.error('Erro geral:', erro);
    res.status(500).json({ erro: 'Erro no servidor', detalhes: erro.message });
  }
});

// ========== LOGIN ==========
app.post('/api/login', (req, res) => {
  const { email, senha } = req.body;

  console.log('=== TENTATIVA DE LOGIN ===');
  console.log('Email:', email);

  db.get('SELECT * FROM usuarios WHERE email = ?', [email], (err, usuario) => {
    if (err) {
      console.error('Erro ao buscar usuário:', err);
      return res.status(500).json({ erro: 'Erro no servidor' });
    }

    if (!usuario) {
      console.log('❌ Usuário não encontrado\n');
      return res.status(401).json({ erro: 'Email ou senha incorretos' });
    }

    console.log('Usuário encontrado:', usuario.email);

    bcrypt.compare(senha, usuario.senha, (err, senhaCorreta) => {
      if (err) {
        console.error('Erro ao verificar senha:', err);
        return res.status(500).json({ erro: 'Erro no servidor' });
      }

      if (!senhaCorreta) {
        console.log('❌ Senha incorreta\n');
        return res.status(401).json({ erro: 'Email ou senha incorretos' });
      }

      console.log('Senha correta! Buscando gesseiro...');

      db.get('SELECT * FROM gesseiros WHERE id = ?', [usuario.gesseiro_id], (err, gesseiro) => {
        if (err) {
          console.error('Erro ao buscar gesseiro:', err);
          return res.status(500).json({ erro: 'Erro ao buscar dados do gesseiro' });
        }

        if (!gesseiro) {
          console.log('❌ Gesseiro não encontrado\n');
          return res.status(500).json({ erro: 'Dados do gesseiro não encontrados' });
        }

        console.log('Gesseiro encontrado:', gesseiro.nome);

        const token = jwt.sign(
          { gesseiroId: usuario.gesseiro_id, email: usuario.email },
          JWT_SECRET,
          { expiresIn: '7d' }
        );

        console.log('✅ Login bem-sucedido!\n');

        res.json({
          token: token,
          gesseiroId: usuario.gesseiro_id,
          nome: gesseiro.nome,
          email: usuario.email
        });
      });
    });
  });
});

// ========== LISTAR TODOS OS GESSEIROS COM SERVIÇOS ==========
app.get('/api/gesseiros', (req, res) => {
  db.all('SELECT * FROM gesseiros ORDER BY data_cadastro DESC', [], (err, gesseiros) => {
    if (err) {
      return res.status(500).json({ erro: 'Erro ao buscar gesseiros' });
    }

    if (gesseiros.length === 0) {
      return res.json([]);
    }

    const gesseiroIds = gesseiros.map(g => g.id);
    const placeholders = gesseiroIds.map(() => '?').join(',');

    // Buscar fotos
    db.all(
      `SELECT * FROM fotos WHERE gesseiro_id IN (${placeholders})`,
      gesseiroIds,
      (err, fotos) => {
        if (err) {
          return res.status(500).json({ erro: 'Erro ao buscar fotos' });
        }

        // Buscar serviços
        db.all(
          `SELECT * FROM servicos WHERE gesseiro_id IN (${placeholders})`,
          gesseiroIds,
          (err, servicos) => {
            if (err) {
              return res.status(500).json({ erro: 'Erro ao buscar serviços' });
            }

            const fotosPorGesseiro = {};
            fotos.forEach(foto => {
              if (!fotosPorGesseiro[foto.gesseiro_id]) {
                fotosPorGesseiro[foto.gesseiro_id] = [];
              }
              fotosPorGesseiro[foto.gesseiro_id].push(foto);
            });

            const servicosPorGesseiro = {};
            servicos.forEach(servico => {
              if (!servicosPorGesseiro[servico.gesseiro_id]) {
                servicosPorGesseiro[servico.gesseiro_id] = [];
              }
              servicosPorGesseiro[servico.gesseiro_id].push(servico);
            });

            const gesseirosCompletos = gesseiros.map(g => ({
              ...g,
              fotos: fotosPorGesseiro[g.id] || [],
              servicos: servicosPorGesseiro[g.id] || []
            }));

            res.json(gesseirosCompletos);
          }
        );
      }
    );
  });
});

// ========== BUSCAR GESSEIRO POR ID ==========
app.get('/api/gesseiros/:id', (req, res) => {
  const id = req.params.id;

  db.get('SELECT * FROM gesseiros WHERE id = ?', [id], (err, gesseiro) => {
    if (err) {
      return res.status(500).json({ erro: 'Erro ao buscar gesseiro' });
    }

    if (!gesseiro) {
      return res.status(404).json({ erro: 'Gesseiro não encontrado' });
    }

    res.json(gesseiro);
  });
});

// ========== ATUALIZAR GESSEIRO ==========
app.put('/api/gesseiros/:id', verificarToken, (req, res) => {
  const id = parseInt(req.params.id);
  const { nome, cidade, telefone, email, instagram, descricao } = req.body;

  if (req.gesseiroId !== id) {
    return res.status(403).json({ erro: 'Você não tem permissão para editar este gesseiro!' });
  }

  if (!nome || !cidade || !telefone) {
    return res.status(400).json({ erro: 'Nome, cidade e telefone são obrigatórios' });
  }

  db.run(
    'UPDATE gesseiros SET nome = ?, cidade = ?, telefone = ?, email = ?, instagram = ?, descricao = ? WHERE id = ?',
    [nome, cidade, telefone, email, instagram, descricao, id],
    function(err) {
      if (err) {
        return res.status(500).json({ erro: 'Erro ao atualizar' });
      }

      if (this.changes === 0) {
        return res.status(404).json({ erro: 'Gesseiro não encontrado' });
      }

      console.log('✅ Gesseiro atualizado:', nome);
      res.json({ mensagem: 'Gesseiro atualizado com sucesso!', id });
    }
  );
});

// ========== DELETAR GESSEIRO ==========
app.delete('/api/gesseiros/:id', verificarToken, (req, res) => {
  const id = parseInt(req.params.id);

  if (req.gesseiroId !== id) {
    return res.status(403).json({ erro: 'Você não tem permissão para deletar este gesseiro!' });
  }

  db.run('DELETE FROM gesseiros WHERE id = ?', [id], function(err) {
    if (err) {
      return res.status(500).json({ erro: 'Erro ao deletar' });
    }

    if (this.changes === 0) {
      return res.status(404).json({ erro: 'Gesseiro não encontrado' });
    }

    console.log('🗑️ Gesseiro deletado - ID:', id);
    res.json({ mensagem: 'Gesseiro deletado com sucesso!' });
  });
});

// ========== LISTAR FOTOS DE UM GESSEIRO ==========
app.get('/api/gesseiros/:id/fotos', (req, res) => {
  const gesseiroId = req.params.id;

  db.all('SELECT * FROM fotos WHERE gesseiro_id = ? ORDER BY data_upload DESC', [gesseiroId], (err, fotos) => {
    if (err) {
      return res.status(500).json({ erro: 'Erro ao buscar fotos' });
    }
    res.json(fotos);
  });
});

// ========== UPLOAD DE FOTO COM DESCRIÇÃO ==========
app.post('/api/gesseiros/:id/fotos', verificarToken, upload.single('foto'), (req, res) => {
  const gesseiroId = parseInt(req.params.id);
  const descricao = req.body.descricao || '';

  if (req.gesseiroId !== gesseiroId) {
    return res.status(403).json({ erro: 'Você não tem permissão para adicionar fotos aqui!' });
  }

  if (!req.file) {
    return res.status(400).json({ erro: 'Nenhuma foto foi enviada' });
  }

  const fotoUrl = `uploads/${req.file.filename}`;

  db.run(
    'INSERT INTO fotos (gesseiro_id, url, descricao) VALUES (?, ?, ?)',
    [gesseiroId, fotoUrl, descricao],
    function(err) {
      if (err) {
        return res.status(500).json({ erro: 'Erro ao salvar foto' });
      }

      console.log('📸 Foto adicionada - Gesseiro ID:', gesseiroId, '- Descrição:', descricao);

      res.json({
        mensagem: 'Foto adicionada com sucesso!',
        foto: {
          id: this.lastID,
          gesseiro_id: gesseiroId,
          url: fotoUrl,
          descricao: descricao
        }
      });
    }
  );
});

// ========== DELETAR FOTO ==========
app.delete('/api/gesseiros/:gesseiroId/fotos/:fotoId', verificarToken, (req, res) => {
  const gesseiroId = parseInt(req.params.gesseiroId);
  const fotoId = req.params.fotoId;

  if (req.gesseiroId !== gesseiroId) {
    return res.status(403).json({ erro: 'Você não tem permissão para deletar esta foto!' });
  }

  db.get('SELECT * FROM fotos WHERE id = ? AND gesseiro_id = ?', [fotoId, gesseiroId], (err, foto) => {
    if (err || !foto) {
      return res.status(404).json({ erro: 'Foto não encontrada' });
    }

    const caminhoArquivo = path.join(__dirname, foto.url);
    if (fs.existsSync(caminhoArquivo)) {
      fs.unlinkSync(caminhoArquivo);
    }

    db.run('DELETE FROM fotos WHERE id = ?', [fotoId], function(err) {
      if (err) {
        return res.status(500).json({ erro: 'Erro ao deletar foto' });
      }

      console.log('🗑️ Foto deletada - ID:', fotoId);
      res.json({ mensagem: 'Foto deletada com sucesso!' });
    });
  });
});

// ========== CRUD SERVIÇOS ==========

// Adicionar serviço
app.post('/api/gesseiros/:id/servicos', verificarToken, (req, res) => {
  const gesseiroId = parseInt(req.params.id);
  const { nome_servico, preco_com_material, preco_sem_material, unidade, distancia_maxima } = req.body;

  if (req.gesseiroId !== gesseiroId) {
    return res.status(403).json({ erro: 'Sem permissão' });
  }

  if (!nome_servico || !preco_com_material || !preco_sem_material) {
    return res.status(400).json({ erro: 'Nome do serviço e preços são obrigatórios' });
  }

  db.run(
    'INSERT INTO servicos (gesseiro_id, nome_servico, preco_com_material, preco_sem_material, unidade, distancia_maxima) VALUES (?, ?, ?, ?, ?, ?)',
    [gesseiroId, nome_servico, preco_com_material, preco_sem_material, unidade || 'm²', distancia_maxima || 50],
    function(err) {
      if (err) {
        return res.status(500).json({ erro: 'Erro ao adicionar serviço' });
      }

      console.log('💰 Serviço adicionado:', nome_servico);

      res.json({
        mensagem: 'Serviço adicionado com sucesso!',
        servico: {
          id: this.lastID,
          gesseiro_id: gesseiroId,
          nome_servico,
          preco_com_material,
          preco_sem_material,
          unidade,
          distancia_maxima
        }
      });
    }
  );
});

// Listar serviços
app.get('/api/gesseiros/:id/servicos', (req, res) => {
  const gesseiroId = req.params.id;

  db.all('SELECT * FROM servicos WHERE gesseiro_id = ? ORDER BY data_cadastro DESC', [gesseiroId], (err, servicos) => {
    if (err) {
      return res.status(500).json({ erro: 'Erro ao buscar serviços' });
    }
    res.json(servicos);
  });
});

// Deletar serviço
app.delete('/api/gesseiros/:gesseiroId/servicos/:servicoId', verificarToken, (req, res) => {
  const gesseiroId = parseInt(req.params.gesseiroId);
  const servicoId = req.params.servicoId;

  if (req.gesseiroId !== gesseiroId) {
    return res.status(403).json({ erro: 'Sem permissão' });
  }

  db.run('DELETE FROM servicos WHERE id = ? AND gesseiro_id = ?', [servicoId, gesseiroId], function(err) {
    if (err) {
      return res.status(500).json({ erro: 'Erro ao deletar serviço' });
    }

    console.log('🗑️ Serviço deletado - ID:', servicoId);
    res.json({ mensagem: 'Serviço deletado com sucesso!' });
  });
});

// ========== INICIAR SERVIDOR ==========
app.listen(PORT, () => {
  console.log('\n=================================');
  console.log('🚀 GESSEIROS PRO - FASE 1');
  console.log('=================================');
  console.log(`📍 URL: http://localhost:${PORT}`);
  console.log(`🗄️ Banco: SQLite (gesseiros.db)`);
  console.log(`📸 Uploads: ./uploads/`);
  console.log(`🔐 JWT: Ativado`);
  console.log('=================================');
  console.log('✅ NOVIDADES FASE 1:');
  console.log('   - Fotos com descrição');
  console.log('   - Sistema de preços');
  console.log('   - Preço com/sem material');
  console.log('=================================\n');
});