const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// ========== USAR SQLITE (database.js) ==========
const db = require('./database.js');

// ========== CONFIGURAÇÕES ==========
const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'minha-chave-secreta-super-segura-2024-gesseiros';

// ========== MIDDLEWARES ==========
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use(express.static(__dirname));
app.use('/uploads', express.static('uploads'));

// ========== CONFIGURAR UPLOAD ==========
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('📁 Pasta uploads criada!');
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    cb(null, uploadsDir);
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
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
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

// ========== MIDDLEWARE DE AUTENTICAÇÃO ADMIN ==========
function verificarTokenAdmin(req, res, next) {
  const token = req.headers['authorization'];
  
  if (!token) {
    return res.status(401).json({ erro: 'Token não fornecido' });
  }

  const tokenLimpo = token.replace('Bearer ', '');

  jwt.verify(tokenLimpo, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).json({ erro: 'Token inválido' });
    }

    if (!decoded.isAdmin) {
      return res.status(403).json({ erro: 'Acesso negado. Apenas administradores.' });
    }

    req.adminId = decoded.adminId;
    req.email = decoded.email;
    next();
  });
}

// ========== ROTAS ==========

app.get('/', (req, res) => {
  res.send(`
    <html>
      <head>
        <title>API Gesseiros Pro - SQLite</title>
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
          .badge { 
            background: #28a745; 
            padding: 5px 10px; 
            border-radius: 5px; 
            font-size: 12px;
            display: inline-block;
            margin-top: 10px;
          }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>🏗️ API Gesseiros Pro</h1>
          <p>✅ Servidor rodando com SQLite!</p>
          <span class="badge">TUDO CORRIGIDO ✅</span>
          <hr>
          <h3>🆕 Novidades:</h3>
          <p>✅ Erro 500 CORRIGIDO</p>
          <p>✅ Upload de fotos funcionando</p>
          <p>✅ Sistema de avaliações ⭐</p>
          <p>✅ Painel de administrador 🔐</p>
          <p>✅ Cadastro e login estáveis</p>
          <hr>
          <h3>📚 Rotas Disponíveis:</h3>
          <p>GET /api/gesseiros</p>
          <p>POST /api/cadastro-completo</p>
          <p>POST /api/login</p>
          <p>POST /api/gesseiros/:id/fotos</p>
          <p>POST /api/gesseiros/:id/servicos</p>
          <p>POST /api/avaliacoes (NOVO)</p>
          <p>POST /api/admin/login (NOVO)</p>
        </div>
      </body>
    </html>
  `);
});

// ========== CADASTRO COMPLETO (CORRIGIDO) ==========
app.post('/api/cadastro-completo', async (req, res) => {
  const { nome, cidade, telefone, email, instagram, descricao, senha } = req.body;

  console.log('=== CADASTRO COMPLETO ===');
  console.log('Nome:', nome);
  console.log('Email:', email);

  if (!nome || !cidade || !telefone || !email || !senha) {
    return res.status(400).json({ erro: 'Todos os campos obrigatórios devem ser preenchidos' });
  }

  try {
    // Verificar se email já existe
    db.buscarUsuarioPorEmail(email, async (err, usuarioExistente) => {
      if (err) {
        console.error('Erro ao verificar email:', err);
        return res.status(500).json({ erro: 'Erro ao verificar email' });
      }

      if (usuarioExistente) {
        return res.status(400).json({ erro: 'Este email já está cadastrado' });
      }

      // Criar gesseiro
      db.inserirGesseiro(
        { nome, cidade, telefone, email, instagram: instagram || '', descricao },
        async (err, gesseiro) => {
          if (err) {
            console.error('Erro ao criar gesseiro:', err);
            return res.status(500).json({ erro: 'Erro ao criar gesseiro' });
          }

          const gesseiroId = gesseiro.id;
          console.log('✅ Gesseiro criado com ID:', gesseiroId);

          // Hash da senha
          const senhaHash = await bcrypt.hash(senha, 10);

          // Criar usuário
          db.inserirUsuario(email, senhaHash, gesseiroId, (err) => {
            if (err) {
              console.error('Erro ao criar usuário:', err);
              return res.status(500).json({ erro: 'Erro ao criar usuário' });
            }

            console.log('✅ Usuário criado!');

            // Gerar token
            const token = jwt.sign(
              { gesseiroId: gesseiroId, email: email },
              JWT_SECRET,
              { expiresIn: '7d' }
            );

            res.json({
              mensagem: 'Cadastro realizado com sucesso!',
              token: token,
              gesseiroId: gesseiroId,
              nome: nome
            });
          });
        }
      );
    });
  } catch (erro) {
    console.error('❌ Erro no cadastro:', erro);
    res.status(500).json({ erro: 'Erro ao processar cadastro' });
  }
});

// ========== LOGIN (CORRIGIDO) ==========
app.post('/api/login', (req, res) => {
  const { email, senha } = req.body;

  console.log('=== LOGIN ===');
  console.log('Email:', email);

  if (!email || !senha) {
    return res.status(400).json({ erro: 'Email e senha são obrigatórios' });
  }

  db.buscarUsuarioPorEmail(email, async (err, usuario) => {
    if (err) {
      console.error('Erro ao buscar usuário:', err);
      return res.status(500).json({ erro: 'Erro ao processar login' });
    }

    if (!usuario) {
      return res.status(401).json({ erro: 'Email ou senha incorretos' });
    }

    const senhaCorreta = await bcrypt.compare(senha, usuario.senha);

    if (!senhaCorreta) {
      return res.status(401).json({ erro: 'Email ou senha incorretos' });
    }

    db.buscarGesseiroPorId(usuario.gesseiro_id, (err, gesseiro) => {
      if (err || !gesseiro) {
        return res.status(500).json({ erro: 'Erro ao buscar dados do gesseiro' });
      }

      const token = jwt.sign(
        { gesseiroId: gesseiro.id, email: email },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      console.log('✅ Login bem-sucedido:', gesseiro.nome);

      res.json({
        mensagem: 'Login realizado com sucesso!',
        token: token,
        gesseiroId: gesseiro.id,
        nome: gesseiro.nome
      });
    });
  });
});

// ========== LOGIN ADMIN 🔐 ==========
app.post('/api/admin/login', (req, res) => {
  const { email, senha } = req.body;

  console.log('=== LOGIN ADMIN ===');
  console.log('Email:', email);

  if (!email || !senha) {
    return res.status(400).json({ erro: 'Email e senha são obrigatórios' });
  }

  db.buscarAdminPorEmail(email, async (err, admin) => {
    if (err) {
      console.error('Erro ao buscar admin:', err);
      return res.status(500).json({ erro: 'Erro ao processar login' });
    }

    if (!admin) {
      return res.status(401).json({ erro: 'Email ou senha incorretos' });
    }

    const senhaCorreta = await bcrypt.compare(senha, admin.senha);

    if (!senhaCorreta) {
      return res.status(401).json({ erro: 'Email ou senha incorretos' });
    }

    const token = jwt.sign(
      { adminId: admin.id, email: email, isAdmin: true },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    console.log('✅ Admin logado:', admin.nome);

    res.json({
      mensagem: 'Login admin realizado com sucesso!',
      token: token,
      nome: admin.nome,
      isAdmin: true
    });
  });
});

// ========== LISTAR GESSEIROS ==========
app.get('/api/gesseiros', (req, res) => {
  db.buscarGesseiros((err, gesseiros) => {
    if (err) {
      console.error('Erro ao buscar gesseiros:', err);
      return res.status(500).json({ erro: 'Erro ao buscar gesseiros' });
    }

    // Para cada gesseiro, buscar fotos, serviços e avaliações
    const promises = gesseiros.map(gesseiro => {
      return new Promise((resolve) => {
        db.buscarFotos(gesseiro.id, (err, fotos) => {
          if (err) {
            gesseiro.fotos = [];
          } else {
            gesseiro.fotos = fotos;
          }

          db.buscarServicos(gesseiro.id, (err, servicos) => {
            if (err) {
              gesseiro.servicos = [];
            } else {
              gesseiro.servicos = servicos;
            }

            db.buscarAvaliacoes(gesseiro.id, (err, avaliacoes) => {
              if (err) {
                gesseiro.avaliacoes = [];
              } else {
                gesseiro.avaliacoes = avaliacoes;
              }
              resolve(gesseiro);
            });
          });
        });
      });
    });

    Promise.all(promises).then(gesseirosCompletos => {
      res.json(gesseirosCompletos);
    });
  });
});

// ========== BUSCAR GESSEIRO POR ID ==========
app.get('/api/gesseiros/:id', (req, res) => {
  const id = req.params.id;

  db.buscarGesseiroPorId(id, (err, gesseiro) => {
    if (err) {
      console.error('Erro:', err);
      return res.status(500).json({ erro: 'Erro ao buscar gesseiro' });
    }

    if (!gesseiro) {
      return res.status(404).json({ erro: 'Gesseiro não encontrado' });
    }

    res.json(gesseiro);
  });
});

// ========== ATUALIZAR PERFIL ==========
app.put('/api/gesseiros/:id', verificarToken, (req, res) => {
  const id = parseInt(req.params.id);
  const { nome, cidade, telefone, email, instagram, descricao } = req.body;

  if (req.gesseiroId !== id) {
    return res.status(403).json({ erro: 'Você não tem permissão para editar este perfil!' });
  }

  if (!nome || !cidade || !telefone) {
    return res.status(400).json({ erro: 'Nome, cidade e telefone são obrigatórios' });
  }

  db.atualizarGesseiro(id, { nome, cidade, telefone, email, instagram, descricao }, (err, result) => {
    if (err) {
      console.error('Erro ao atualizar:', err);
      return res.status(500).json({ erro: 'Erro ao atualizar' });
    }

    if (result.changes === 0) {
      return res.status(404).json({ erro: 'Gesseiro não encontrado' });
    }

    console.log('✅ Gesseiro atualizado:', nome);
    res.json({ mensagem: 'Gesseiro atualizado com sucesso!', id });
  });
});

// ========== DELETAR GESSEIRO ==========
app.delete('/api/gesseiros/:id', verificarToken, (req, res) => {
  const id = parseInt(req.params.id);

  if (req.gesseiroId !== id) {
    return res.status(403).json({ erro: 'Você não tem permissão para deletar este gesseiro!' });
  }

  db.deletarGesseiro(id, (err, result) => {
    if (err) {
      console.error('Erro ao deletar:', err);
      return res.status(500).json({ erro: 'Erro ao deletar' });
    }

    if (result.changes === 0) {
      return res.status(404).json({ erro: 'Gesseiro não encontrado' });
    }

    console.log('🗑️ Gesseiro deletado - ID:', id);
    res.json({ mensagem: 'Gesseiro deletado com sucesso!' });
  });
});

// ========== LISTAR FOTOS ==========
app.get('/api/gesseiros/:id/fotos', (req, res) => {
  const gesseiroId = req.params.id;

  db.buscarFotos(gesseiroId, (err, fotos) => {
    if (err) {
      console.error('Erro ao buscar fotos:', err);
      return res.status(500).json({ erro: 'Erro ao buscar fotos' });
    }

    res.json(fotos);
  });
});

// ========== UPLOAD DE FOTO (CORRIGIDO) ==========
app.post('/api/gesseiros/:id/fotos', verificarToken, upload.single('foto'), (req, res) => {
  const gesseiroId = parseInt(req.params.id);
  const descricao = req.body.descricao || '';

  console.log('=== UPLOAD DE FOTO ===');
  console.log('Gesseiro ID:', gesseiroId);
  console.log('Token Gesseiro ID:', req.gesseiroId);
  console.log('Arquivo:', req.file ? req.file.filename : 'NENHUM');
  console.log('Descrição:', descricao);

  if (req.gesseiroId !== gesseiroId) {
    console.log('❌ Permissão negada');
    return res.status(403).json({ erro: 'Você não tem permissão para adicionar fotos aqui!' });
  }

  if (!req.file) {
    console.log('❌ Nenhum arquivo enviado');
    return res.status(400).json({ erro: 'Nenhuma foto foi enviada' });
  }

  const fotoUrl = `uploads/${req.file.filename}`;
  console.log('URL da foto:', fotoUrl);

  db.adicionarFoto(gesseiroId, fotoUrl, descricao, (err, foto) => {
    if (err) {
      console.error('❌ Erro ao salvar foto:', err);
      return res.status(500).json({ erro: 'Erro ao salvar foto' });
    }

    console.log('✅ Foto salva:', foto);

    res.json({
      mensagem: 'Foto adicionada com sucesso!',
      foto: foto
    });
  });
});

// ========== DELETAR FOTO ==========
app.delete('/api/gesseiros/:gesseiroId/fotos/:fotoId', verificarToken, (req, res) => {
  const gesseiroId = parseInt(req.params.gesseiroId);
  const fotoId = req.params.fotoId;

  if (req.gesseiroId !== gesseiroId) {
    return res.status(403).json({ erro: 'Você não tem permissão para deletar esta foto!' });
  }

  // Buscar foto para pegar o caminho do arquivo
  db.db.get('SELECT * FROM fotos WHERE id = ? AND gesseiro_id = ?', [fotoId, gesseiroId], (err, foto) => {
    if (err || !foto) {
      return res.status(404).json({ erro: 'Foto não encontrada' });
    }

    const caminhoArquivo = path.join(__dirname, foto.url_foto);
    
    if (fs.existsSync(caminhoArquivo)) {
      fs.unlinkSync(caminhoArquivo);
    }

    db.deletarFoto(fotoId, (err, result) => {
      if (err) {
        console.error('Erro ao deletar foto:', err);
        return res.status(500).json({ erro: 'Erro ao deletar foto' });
      }

      console.log('🗑️ Foto deletada - ID:', fotoId);
      res.json({ mensagem: 'Foto deletada com sucesso!' });
    });
  });
});

// ========== ADICIONAR SERVIÇO ==========
app.post('/api/gesseiros/:id/servicos', verificarToken, (req, res) => {
  const gesseiroId = parseInt(req.params.id);
  const { nome_servico, preco_com_material, preco_sem_material, unidade, distancia_maxima } = req.body;

  if (req.gesseiroId !== gesseiroId) {
    return res.status(403).json({ erro: 'Sem permissão' });
  }

  if (!nome_servico || !preco_com_material || !preco_sem_material) {
    return res.status(400).json({ erro: 'Nome do serviço e preços são obrigatórios' });
  }

  const dados = {
    gesseiro_id: gesseiroId,
    nome_servico,
    preco_com_material,
    preco_sem_material,
    unidade: unidade || 'm²',
    distancia_maxima: distancia_maxima || 50
  };

  db.adicionarServico(dados, (err, servico) => {
    if (err) {
      console.error('Erro ao adicionar serviço:', err);
      return res.status(500).json({ erro: 'Erro ao adicionar serviço' });
    }

    console.log('💰 Serviço adicionado:', nome_servico);

    res.json({
      mensagem: 'Serviço adicionado com sucesso!',
      servico: servico
    });
  });
});

// ========== LISTAR SERVIÇOS ==========
app.get('/api/gesseiros/:id/servicos', (req, res) => {
  const gesseiroId = req.params.id;

  db.buscarServicos(gesseiroId, (err, servicos) => {
    if (err) {
      console.error('Erro ao buscar serviços:', err);
      return res.status(500).json({ erro: 'Erro ao buscar serviços' });
    }

    res.json(servicos);
  });
});

// ========== DELETAR SERVIÇO ==========
app.delete('/api/gesseiros/:gesseiroId/servicos/:servicoId', verificarToken, (req, res) => {
  const gesseiroId = parseInt(req.params.gesseiroId);
  const servicoId = req.params.servicoId;

  if (req.gesseiroId !== gesseiroId) {
    return res.status(403).json({ erro: 'Sem permissão' });
  }

  db.deletarServico(servicoId, (err, result) => {
    if (err) {
      console.error('Erro ao deletar serviço:', err);
      return res.status(500).json({ erro: 'Erro ao deletar serviço' });
    }

    if (result.changes === 0) {
      return res.status(404).json({ erro: 'Serviço não encontrado' });
    }

    console.log('🗑️ Serviço deletado - ID:', servicoId);
    res.json({ mensagem: 'Serviço deletado com sucesso!' });
  });
});

// ========== ⭐ ADICIONAR AVALIAÇÃO (PÚBLICO - SEM TOKEN) ==========
app.post('/api/avaliacoes', (req, res) => {
  const { gesseiro_id, nome_avaliador, email_avaliador, estrelas, comentario } = req.body;

  console.log('=== NOVA AVALIAÇÃO ===');
  console.log('Gesseiro ID:', gesseiro_id);
  console.log('Estrelas:', estrelas);

  if (!gesseiro_id || !estrelas) {
    return res.status(400).json({ erro: 'Gesseiro e estrelas são obrigatórios' });
  }

  if (estrelas < 1 || estrelas > 5) {
    return res.status(400).json({ erro: 'Estrelas devem ser entre 1 e 5' });
  }

  const dados = {
    gesseiro_id,
    nome_avaliador: nome_avaliador || 'Anônimo',
    email_avaliador: email_avaliador || '',
    estrelas,
    comentario: comentario || ''
  };

  db.adicionarAvaliacao(dados, (err, avaliacao) => {
    if (err) {
      console.error('Erro ao adicionar avaliação:', err);
      return res.status(500).json({ erro: 'Erro ao adicionar avaliação' });
    }

    console.log('✅ Avaliação adicionada!');

    res.json({
      mensagem: 'Avaliação enviada com sucesso!',
      avaliacao: avaliacao
    });
  });
});

// ========== LISTAR AVALIAÇÕES DE UM GESSEIRO ==========
app.get('/api/gesseiros/:id/avaliacoes', (req, res) => {
  const gesseiroId = req.params.id;

  db.buscarAvaliacoes(gesseiroId, (err, avaliacoes) => {
    if (err) {
      console.error('Erro ao buscar avaliações:', err);
      return res.status(500).json({ erro: 'Erro ao buscar avaliações' });
    }

    res.json(avaliacoes);
  });
});

// ========== 🔐 ROTAS ADMIN ==========

// Listar todos usuários (admin)
app.get('/api/admin/usuarios', verificarTokenAdmin, (req, res) => {
  db.listarTodosUsuarios((err, usuarios) => {
    if (err) {
      console.error('Erro ao listar usuários:', err);
      return res.status(500).json({ erro: 'Erro ao listar usuários' });
    }

    res.json(usuarios);
  });
});

// Deletar usuário (admin)
app.delete('/api/admin/usuarios/:id', verificarTokenAdmin, (req, res) => {
  const usuarioId = req.params.id;

  db.db.run('DELETE FROM usuarios WHERE id = ?', [usuarioId], function(err) {
    if (err) {
      console.error('Erro ao deletar usuário:', err);
      return res.status(500).json({ erro: 'Erro ao deletar usuário' });
    }

    if (this.changes === 0) {
      return res.status(404).json({ erro: 'Usuário não encontrado' });
    }

    console.log('🗑️ Usuário deletado - ID:', usuarioId);
    res.json({ mensagem: 'Usuário deletado com sucesso!' });
  });
});

// Deletar gesseiro (admin)
app.delete('/api/admin/gesseiros/:id', verificarTokenAdmin, (req, res) => {
  const gesseiroId = req.params.id;

  db.deletarGesseiro(gesseiroId, (err, result) => {
    if (err) {
      console.error('Erro ao deletar gesseiro:', err);
      return res.status(500).json({ erro: 'Erro ao deletar gesseiro' });
    }

    if (result.changes === 0) {
      return res.status(404).json({ erro: 'Gesseiro não encontrado' });
    }

    console.log('🗑️ Gesseiro deletado pelo admin - ID:', gesseiroId);
    res.json({ mensagem: 'Gesseiro deletado com sucesso!' });
  });
});

// Estatísticas (admin)
app.get('/api/admin/estatisticas', verificarTokenAdmin, (req, res) => {
  db.obterEstatisticas((err, stats) => {
    if (err) {
      console.error('Erro ao buscar estatísticas:', err);
      return res.status(500).json({ erro: 'Erro ao buscar estatísticas' });
    }

    res.json(stats);
  });
});

// Deletar avaliação (admin)
app.delete('/api/admin/avaliacoes/:id', verificarTokenAdmin, (req, res) => {
  const avaliacaoId = req.params.id;

  db.deletarAvaliacao(avaliacaoId, (err, result) => {
    if (err) {
      console.error('Erro ao deletar avaliação:', err);
      return res.status(500).json({ erro: 'Erro ao deletar avaliação' });
    }

    if (result.changes === 0) {
      return res.status(404).json({ erro: 'Avaliação não encontrada' });
    }

    console.log('🗑️ Avaliação deletada - ID:', avaliacaoId);
    res.json({ mensagem: 'Avaliação deletada com sucesso!' });
  });
});

// ========== INICIAR SERVIDOR ==========
app.listen(PORT, () => {
  console.log('\n=================================');
  console.log('🚀 GESSEIROS PRO - VERSÃO CORRIGIDA');
  console.log('=================================');
  console.log(`📍 URL: http://localhost:${PORT}`);
  console.log(`🗄️ Banco: SQLite (gesseiros.db)`);
  console.log(`📸 Uploads: ./uploads/`);
  console.log(`🔐 JWT: Ativado`);
  console.log('=================================');
  console.log('✅ FUNCIONALIDADES:');
  console.log('   - ✅ Cadastro e Login');
  console.log('   - ✅ Upload de fotos COM descrição');
  console.log('   - ✅ Sistema de preços/serviços');
  console.log('   - ⭐ Sistema de avaliações');
  console.log('   - 🔐 Painel de administrador');
  console.log('=================================');
  console.log('🔑 CREDENCIAIS ADMIN:');
  console.log('   Email: GesseiroAdmin');
  console.log('   Senha: Admin@2025');
  console.log('=================================\n');
});
