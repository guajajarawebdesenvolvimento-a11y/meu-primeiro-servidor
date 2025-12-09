const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

// ========== CONFIGURAÇÕES ==========
const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'minha-chave-secreta-super-segura-2024-gesseiros';

// Conectar ao banco de dados PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? {
    rejectUnauthorized: false
  } : false
});

// Testar conexão
pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Erro ao conectar no PostgreSQL:', err.message);
  } else {
    console.log('✅ Conectado ao PostgreSQL!');
    release();
  }
});

// ========== MIDDLEWARES ==========
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use(express.static(__dirname));
app.use('/uploads', express.static('uploads'));

// ========== CRIAR TABELAS ==========
const criarTabelas = async () => {
  try {
    // Tabela gesseiros
    await pool.query(`
      CREATE TABLE IF NOT EXISTS gesseiros (
        id SERIAL PRIMARY KEY,
        nome TEXT NOT NULL,
        cidade TEXT NOT NULL,
        telefone TEXT NOT NULL,
        email TEXT,
        instagram TEXT,
        descricao TEXT,
        data_cadastro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Tabela usuarios
    await pool.query(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id SERIAL PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        senha TEXT NOT NULL,
        gesseiro_id INTEGER REFERENCES gesseiros(id),
        data_cadastro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Tabela fotos
    await pool.query(`
      CREATE TABLE IF NOT EXISTS fotos (
        id SERIAL PRIMARY KEY,
        gesseiro_id INTEGER NOT NULL REFERENCES gesseiros(id) ON DELETE CASCADE,
        url_foto TEXT NOT NULL,
        descricao TEXT,
        data_upload TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Tabela servicos
    await pool.query(`
      CREATE TABLE IF NOT EXISTS servicos (
        id SERIAL PRIMARY KEY,
        gesseiro_id INTEGER NOT NULL REFERENCES gesseiros(id),
        nome_servico TEXT NOT NULL,
        preco_com_material DECIMAL(10,2),
        preco_sem_material DECIMAL(10,2),
        unidade TEXT DEFAULT 'm²',
        distancia_maxima INTEGER DEFAULT 50,
        data_cadastro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('✅ Tabelas verificadas/criadas no PostgreSQL!');
  } catch (err) {
    console.error('❌ Erro ao criar tabelas:', err.message);
  }
};

criarTabelas();

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
        <title>API Gesseiros Pro - PostgreSQL</title>
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
          <h1>🏗️ API Gesseiros Pro - PostgreSQL</h1>
          <p>✅ Servidor rodando com PostgreSQL!</p>
          <hr>
          <h3>🆕 Novidades:</h3>
          <p>✅ Migrado para PostgreSQL</p>
          <p>✅ Dados persistem entre deploys</p>
          <p>✅ Upload de fotos com descrição</p>
          <p>✅ Sistema de serviços e preços</p>
          <hr>
          <h3>📚 Rotas Disponíveis:</h3>
          <p>GET /api/gesseiros</p>
          <p>POST /api/gesseiros/:id/fotos</p>
          <p>POST /api/gesseiros/:id/servicos</p>
          <p>GET /api/gesseiros/:id/servicos</p>
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
    // Verificar se email já existe
    const usuarioExistente = await pool.query('SELECT * FROM usuarios WHERE email = $1', [email]);
    
    if (usuarioExistente.rows.length > 0) {
      return res.status(400).json({ erro: 'Este email já está cadastrado' });
    }

    // Criar gesseiro
    const resultGesseiro = await pool.query(
      'INSERT INTO gesseiros (nome, cidade, telefone, email, instagram, descricao) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
      [nome, cidade, telefone, email, instagram || '', descricao]
    );

    const gesseiroId = resultGesseiro.rows[0].id;
    console.log('Gesseiro criado com ID:', gesseiroId);

    // Hash da senha
    const senhaHash = await bcrypt.hash(senha, 10);

    // Criar usuário
    await pool.query(
      'INSERT INTO usuarios (email, senha, gesseiro_id) VALUES ($1, $2, $3)',
      [email, senhaHash, gesseiroId]
    );

    console.log('Usuário criado!');

    // Gerar token
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

  } catch (erro) {
    console.error('Erro geral:', erro);
    res.status(500).json({ erro: 'Erro no servidor', detalhes: erro.message });
  }
});

// ========== LOGIN ==========
app.post('/api/login', async (req, res) => {
  const { email, senha } = req.body;

  console.log('=== TENTATIVA DE LOGIN ===');
  console.log('Email:', email);

  try {
    // Buscar usuário
    const resultUsuario = await pool.query('SELECT * FROM usuarios WHERE email = $1', [email]);

    if (resultUsuario.rows.length === 0) {
      console.log('❌ Usuário não encontrado\n');
      return res.status(401).json({ erro: 'Email ou senha incorretos' });
    }

    const usuario = resultUsuario.rows[0];
    console.log('Usuário encontrado:', usuario.email);

    // Verificar senha
    const senhaCorreta = await bcrypt.compare(senha, usuario.senha);

    if (!senhaCorreta) {
      console.log('❌ Senha incorreta\n');
      return res.status(401).json({ erro: 'Email ou senha incorretos' });
    }

    // Buscar gesseiro
    const resultGesseiro = await pool.query('SELECT * FROM gesseiros WHERE id = $1', [usuario.gesseiro_id]);

    if (resultGesseiro.rows.length === 0) {
      console.log('❌ Gesseiro não encontrado\n');
      return res.status(500).json({ erro: 'Dados do gesseiro não encontrados' });
    }

    const gesseiro = resultGesseiro.rows[0];
    console.log('Gesseiro encontrado:', gesseiro.nome);

    // Gerar token
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

  } catch (erro) {
    console.error('Erro no login:', erro);
    res.status(500).json({ erro: 'Erro no servidor' });
  }
});

// ========== LISTAR TODOS OS GESSEIROS ==========
app.get('/api/gesseiros', async (req, res) => {
  try {
    const resultGesseiros = await pool.query('SELECT * FROM gesseiros ORDER BY data_cadastro DESC');
    const gesseiros = resultGesseiros.rows;

    if (gesseiros.length === 0) {
      return res.json([]);
    }

    const gesseiroIds = gesseiros.map(g => g.id);

    // Buscar fotos
    const resultFotos = await pool.query(
      `SELECT * FROM fotos WHERE gesseiro_id = ANY($1)`,
      [gesseiroIds]
    );

    // Buscar serviços
    const resultServicos = await pool.query(
      `SELECT * FROM servicos WHERE gesseiro_id = ANY($1)`,
      [gesseiroIds]
    );

    // Organizar fotos por gesseiro
    const fotosPorGesseiro = {};
    resultFotos.rows.forEach(foto => {
      if (!fotosPorGesseiro[foto.gesseiro_id]) {
        fotosPorGesseiro[foto.gesseiro_id] = [];
      }
      fotosPorGesseiro[foto.gesseiro_id].push(foto);
    });

    // Organizar serviços por gesseiro
    const servicosPorGesseiro = {};
    resultServicos.rows.forEach(servico => {
      if (!servicosPorGesseiro[servico.gesseiro_id]) {
        servicosPorGesseiro[servico.gesseiro_id] = [];
      }
      servicosPorGesseiro[servico.gesseiro_id].push(servico);
    });

    // Montar resposta completa
    const gesseirosCompletos = gesseiros.map(g => ({
      ...g,
      fotos: fotosPorGesseiro[g.id] || [],
      servicos: servicosPorGesseiro[g.id] || []
    }));

    res.json(gesseirosCompletos);

  } catch (erro) {
    console.error('Erro ao buscar gesseiros:', erro);
    res.status(500).json({ erro: 'Erro ao buscar gesseiros' });
  }
});

// ========== BUSCAR GESSEIRO POR ID ==========
app.get('/api/gesseiros/:id', async (req, res) => {
  const id = req.params.id;

  try {
    const result = await pool.query('SELECT * FROM gesseiros WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ erro: 'Gesseiro não encontrado' });
    }

    res.json(result.rows[0]);

  } catch (erro) {
    console.error('Erro ao buscar gesseiro:', erro);
    res.status(500).json({ erro: 'Erro ao buscar gesseiro' });
  }
});

// ========== ATUALIZAR GESSEIRO ==========
app.put('/api/gesseiros/:id', verificarToken, async (req, res) => {
  const id = parseInt(req.params.id);
  const { nome, cidade, telefone, email, instagram, descricao } = req.body;

  if (req.gesseiroId !== id) {
    return res.status(403).json({ erro: 'Você não tem permissão para editar este gesseiro!' });
  }

  if (!nome || !cidade || !telefone) {
    return res.status(400).json({ erro: 'Nome, cidade e telefone são obrigatórios' });
  }

  try {
    const result = await pool.query(
      'UPDATE gesseiros SET nome = $1, cidade = $2, telefone = $3, email = $4, instagram = $5, descricao = $6 WHERE id = $7',
      [nome, cidade, telefone, email, instagram, descricao, id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ erro: 'Gesseiro não encontrado' });
    }

    console.log('✅ Gesseiro atualizado:', nome);
    res.json({ mensagem: 'Gesseiro atualizado com sucesso!', id });

  } catch (erro) {
    console.error('Erro ao atualizar:', erro);
    res.status(500).json({ erro: 'Erro ao atualizar' });
  }
});

// ========== DELETAR GESSEIRO ==========
app.delete('/api/gesseiros/:id', verificarToken, async (req, res) => {
  const id = parseInt(req.params.id);

  if (req.gesseiroId !== id) {
    return res.status(403).json({ erro: 'Você não tem permissão para deletar este gesseiro!' });
  }

  try {
    const result = await pool.query('DELETE FROM gesseiros WHERE id = $1', [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ erro: 'Gesseiro não encontrado' });
    }

    console.log('🗑️ Gesseiro deletado - ID:', id);
    res.json({ mensagem: 'Gesseiro deletado com sucesso!' });

  } catch (erro) {
    console.error('Erro ao deletar:', erro);
    res.status(500).json({ erro: 'Erro ao deletar' });
  }
});

// ========== LISTAR FOTOS DE UM GESSEIRO ==========
app.get('/api/gesseiros/:id/fotos', async (req, res) => {
  const gesseiroId = req.params.id;

  try {
    const result = await pool.query(
      'SELECT * FROM fotos WHERE gesseiro_id = $1 ORDER BY data_upload DESC',
      [gesseiroId]
    );

    res.json(result.rows);

  } catch (erro) {
    console.error('Erro ao buscar fotos:', erro);
    res.status(500).json({ erro: 'Erro ao buscar fotos' });
  }
});

// ========== UPLOAD DE FOTO COM DESCRIÇÃO ==========
app.post('/api/gesseiros/:id/fotos', verificarToken, upload.single('foto'), async (req, res) => {
  const gesseiroId = parseInt(req.params.id);
  const descricao = req.body.descricao || '';

  if (req.gesseiroId !== gesseiroId) {
    return res.status(403).json({ erro: 'Você não tem permissão para adicionar fotos aqui!' });
  }

  if (!req.file) {
    return res.status(400).json({ erro: 'Nenhuma foto foi enviada' });
  }

  const fotoUrl = `uploads/${req.file.filename}`;

  try {
    const result = await pool.query(
      'INSERT INTO fotos (gesseiro_id, url_foto, descricao) VALUES ($1, $2, $3) RETURNING id',
      [gesseiroId, fotoUrl, descricao]
    );

    console.log('📸 Foto adicionada - Gesseiro ID:', gesseiroId, '- Descrição:', descricao);

    res.json({
      mensagem: 'Foto adicionada com sucesso!',
      foto: {
        id: result.rows[0].id,
        gesseiro_id: gesseiroId,
        url_foto: fotoUrl,
        descricao: descricao
      }
    });

  } catch (erro) {
    console.error('Erro ao salvar foto:', erro);
    res.status(500).json({ erro: 'Erro ao salvar foto' });
  }
});

// ========== DELETAR FOTO ==========
app.delete('/api/gesseiros/:gesseiroId/fotos/:fotoId', verificarToken, async (req, res) => {
  const gesseiroId = parseInt(req.params.gesseiroId);
  const fotoId = req.params.fotoId;

  if (req.gesseiroId !== gesseiroId) {
    return res.status(403).json({ erro: 'Você não tem permissão para deletar esta foto!' });
  }

  try {
    const resultFoto = await pool.query(
      'SELECT * FROM fotos WHERE id = $1 AND gesseiro_id = $2',
      [fotoId, gesseiroId]
    );

    if (resultFoto.rows.length === 0) {
      return res.status(404).json({ erro: 'Foto não encontrada' });
    }

    const foto = resultFoto.rows[0];
    const caminhoArquivo = path.join(__dirname, foto.url_foto);
    
    if (fs.existsSync(caminhoArquivo)) {
      fs.unlinkSync(caminhoArquivo);
    }

    await pool.query('DELETE FROM fotos WHERE id = $1', [fotoId]);

    console.log('🗑️ Foto deletada - ID:', fotoId);
    res.json({ mensagem: 'Foto deletada com sucesso!' });

  } catch (erro) {
    console.error('Erro ao deletar foto:', erro);
    res.status(500).json({ erro: 'Erro ao deletar foto' });
  }
});

// ========== ADICIONAR SERVIÇO ==========
app.post('/api/gesseiros/:id/servicos', verificarToken, async (req, res) => {
  const gesseiroId = parseInt(req.params.id);
  const { nome_servico, preco_com_material, preco_sem_material, unidade, distancia_maxima } = req.body;

  if (req.gesseiroId !== gesseiroId) {
    return res.status(403).json({ erro: 'Sem permissão' });
  }

  if (!nome_servico || !preco_com_material || !preco_sem_material) {
    return res.status(400).json({ erro: 'Nome do serviço e preços são obrigatórios' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO servicos (gesseiro_id, nome_servico, preco_com_material, preco_sem_material, unidade, distancia_maxima) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
      [gesseiroId, nome_servico, preco_com_material, preco_sem_material, unidade || 'm²', distancia_maxima || 50]
    );

    console.log('💰 Serviço adicionado:', nome_servico);

    res.json({
      mensagem: 'Serviço adicionado com sucesso!',
      servico: {
        id: result.rows[0].id,
        gesseiro_id: gesseiroId,
        nome_servico,
        preco_com_material,
        preco_sem_material,
        unidade: unidade || 'm²',
        distancia_maxima: distancia_maxima || 50
      }
    });

  } catch (erro) {
    console.error('Erro ao adicionar serviço:', erro);
    res.status(500).json({ erro: 'Erro ao adicionar serviço' });
  }
});

// ========== LISTAR SERVIÇOS ==========
app.get('/api/gesseiros/:id/servicos', async (req, res) => {
  const gesseiroId = req.params.id;

  try {
    const result = await pool.query(
      'SELECT * FROM servicos WHERE gesseiro_id = $1 ORDER BY data_cadastro DESC',
      [gesseiroId]
    );

    res.json(result.rows);

  } catch (erro) {
    console.error('Erro ao buscar serviços:', erro);
    res.status(500).json({ erro: 'Erro ao buscar serviços' });
  }
});

// ========== DELETAR SERVIÇO ==========
app.delete('/api/gesseiros/:gesseiroId/servicos/:servicoId', verificarToken, async (req, res) => {
  const gesseiroId = parseInt(req.params.gesseiroId);
  const servicoId = req.params.servicoId;

  if (req.gesseiroId !== gesseiroId) {
    return res.status(403).json({ erro: 'Sem permissão' });
  }

  try {
    const result = await pool.query(
      'DELETE FROM servicos WHERE id = $1 AND gesseiro_id = $2',
      [servicoId, gesseiroId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ erro: 'Serviço não encontrado' });
    }

    console.log('🗑️ Serviço deletado - ID:', servicoId);
    res.json({ mensagem: 'Serviço deletado com sucesso!' });

  } catch (erro) {
    console.error('Erro ao deletar serviço:', erro);
    res.status(500).json({ erro: 'Erro ao deletar serviço' });
  }
});

// ========== INICIAR SERVIDOR ==========
app.listen(PORT, () => {
  console.log('\n=================================');
  console.log('🚀 GESSEIROS PRO - PostgreSQL');
  console.log('=================================');
  console.log(`📍 URL: http://localhost:${PORT}`);
  console.log(`🗄️ Banco: PostgreSQL`);
  console.log(`📸 Uploads: ./uploads/`);
  console.log(`🔐 JWT: Ativado`);
  console.log('=================================');
  console.log('✅ FUNCIONALIDADES:');
  console.log('   - Fotos com descrição');
  console.log('   - Sistema de preços');
  console.log('   - Dados persistem!');
  console.log('=================================\n');
});