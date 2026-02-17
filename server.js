const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

// Forçar uso do v2 no multer-storage-cloudinary


// ========== USAR POSTGRESQL (database.js) ==========
const db = require('./database.js');

// ========== CONFIGURAÇÕES ==========
const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'minha-chave-secreta-super-segura-2024-gesseiros';
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

// ========== CLOUDINARY ==========
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// ========== MIDDLEWARES ==========
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({
  origin: [
    'https://seugesseiro.com.br',
    'https://www.seugesseiro.com.br',
    'http://localhost:3000'
  ],
  credentials: true
}));
app.use(express.static(__dirname));

// ========== CONFIGURAR UPLOAD (CLOUDINARY) ==========
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'gesseiros',
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
    transformation: [{ width: 1200, height: 1200, crop: 'limit', quality: 'auto' }]
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
    req.usuario = { gesseiroId: decoded.gesseiroId, usuarioId: decoded.usuarioId, email: decoded.email };
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
        <title>API Gesseiros Pro - PostgreSQL</title>
        <style>
          body { font-family: Arial, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; }
          .card { background: rgba(255,255,255,0.1); padding: 30px; border-radius: 10px; backdrop-filter: blur(10px); }
          h1 { margin-bottom: 10px; }
          p { margin: 5px 0; }
          .badge { background: #28a745; padding: 5px 10px; border-radius: 5px; font-size: 12px; display: inline-block; margin-top: 10px; }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>🏗️ API Gesseiros Pro</h1>
          <p>✅ Servidor rodando com PostgreSQL + Cloudinary!</p>
          <span class="badge">PRODUÇÃO PRONTA ✅</span>
          <hr>
          <h3>✅ Funcionalidades:</h3>
          <p>✅ Banco de dados PostgreSQL (dados persistentes)</p>
          <p>✅ Fotos no Cloudinary (imagens persistentes)</p>
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
          <p>POST /api/avaliacoes</p>
          <p>POST /api/admin/login</p>
        </div>
      </body>
    </html>
  `);
});

// ========== GEOCODING ==========
app.post('/api/geocode', async (req, res) => {
  const { endereco } = req.body;
  if (!endereco) {
    return res.status(400).json({ erro: 'Endereço é obrigatório' });
  }
  try {
    const response = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
      params: { address: endereco, key: GOOGLE_MAPS_API_KEY }
    });
    if (response.data.results && response.data.results.length > 0) {
      const location = response.data.results[0].geometry.location;
      res.json({
        latitude: location.lat,
        longitude: location.lng,
        endereco_formatado: response.data.results[0].formatted_address
      });
    } else {
      res.status(404).json({ erro: 'Endereço não encontrado' });
    }
  } catch (error) {
    console.error('Erro no geocoding:', error);
    res.status(500).json({ erro: 'Erro ao buscar coordenadas' });
  }
});

// ========== GEOCODING REVERSO (LAT/LNG → ENDEREÇO) ==========
app.post('/api/geocode-reverso', async (req, res) => {
  const { latitude, longitude } = req.body;
  if (!latitude || !longitude) {
    return res.status(400).json({ erro: 'Latitude e longitude são obrigatórios' });
  }
  try {
    const response = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
      params: {
        latlng: `${latitude},${longitude}`,
        key: GOOGLE_MAPS_API_KEY
      }
    });
    if (response.data.results && response.data.results.length > 0) {
      res.json({ endereco: response.data.results[0].formatted_address });
    } else {
      res.status(404).json({ erro: 'Endereço não encontrado' });
    }
  } catch (error) {
    console.error('Erro no geocoding reverso:', error);
    res.status(500).json({ erro: 'Erro ao buscar endereço' });
  }
});

// ========== FOTO DE PERFIL ==========
app.post('/api/gesseiros/:id/foto-perfil', autenticar, upload.single('foto'), async (req, res) => {
  const gesseiroId = parseInt(req.params.id);
  if (req.usuario.gesseiroId !== gesseiroId) return res.status(403).json({ erro: 'Sem permissão' });
  if (!req.file) return res.status(400).json({ erro: 'Nenhuma foto enviada' });

  try {
    // Deletar foto anterior se existir
    const gesseiro = await new Promise((resolve, reject) => {
      db.buscarGesseiroPorId(gesseiroId, (err, g) => err ? reject(err) : resolve(g));
    });

    if (gesseiro && gesseiro.foto_perfil) {
      const publicId = gesseiro.foto_perfil.split('/').slice(-2).join('/').replace(/\.[^/.]+$/, '');
      try { await cloudinary.uploader.destroy(publicId); } catch(e) {}
    }

    const fotoUrl = req.file.path;
    await new Promise((resolve, reject) => {
      db.pool.query('UPDATE gesseiros SET foto_perfil = $1 WHERE id = $2', [fotoUrl, gesseiroId], (err) => err ? reject(err) : resolve());
    });

    res.json({ foto_perfil: fotoUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao salvar foto de perfil' });
  }
});

// ========== ALTERAR EMAIL ==========
app.put('/api/usuarios/alterar-email', autenticar, async (req, res) => {
  const { novoEmail, senha } = req.body;
  if (!novoEmail || !senha) return res.status(400).json({ erro: 'Email e senha são obrigatórios' });

  try {
    const usuario = await new Promise((resolve, reject) => {
      db.pool.query('SELECT * FROM usuarios WHERE id = $1', [req.usuario.usuarioId], (err, result) => {
        if (err) reject(err);
        else resolve(result.rows[0]);
      });
    });

    if (!usuario) return res.status(404).json({ erro: 'Usuário não encontrado' });

    const senhaOk = await bcrypt.compare(senha, usuario.senha);
    if (!senhaOk) return res.status(401).json({ erro: 'Senha incorreta' });

    // Verificar se email já existe
    const emailExiste = await new Promise((resolve, reject) => {
      db.pool.query('SELECT id FROM usuarios WHERE email = $1 AND id != $2', [novoEmail, usuario.id], (err, result) => {
        if (err) reject(err);
        else resolve(result.rows.length > 0);
      });
    });

    if (emailExiste) return res.status(400).json({ erro: 'Este email já está em uso' });

    await db.pool.query('UPDATE usuarios SET email = $1 WHERE id = $2', [novoEmail, usuario.id]);
    res.json({ mensagem: 'Email alterado com sucesso' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao alterar email' });
  }
});

// ========== CADASTRO COMPLETO ==========
app.post('/api/cadastro-completo', async (req, res) => {
  const { nome, cidade, telefone, email, instagram, descricao, senha, endereco, latitude, longitude } = req.body;

  console.log('=== CADASTRO COMPLETO ===');
  console.log('Nome:', nome);
  console.log('Email:', email);

  if (!nome || !cidade || !telefone || !email || !senha) {
    return res.status(400).json({ erro: 'Todos os campos obrigatórios devem ser preenchidos' });
  }

  try {
    db.buscarUsuarioPorEmail(email, async (err, usuarioExistente) => {
      if (err) {
        console.error('Erro ao verificar email:', err);
        return res.status(500).json({ erro: 'Erro ao verificar email' });
      }
      if (usuarioExistente) {
        return res.status(400).json({ erro: 'Este email já está cadastrado' });
      }

      db.inserirGesseiro(
        { nome, cidade, telefone, email, instagram: instagram || '', descricao, endereco, latitude, longitude },
        async (err, gesseiro) => {
          if (err) {
            console.error('Erro ao criar gesseiro:', err);
            return res.status(500).json({ erro: 'Erro ao criar gesseiro' });
          }

          const gesseiroId = gesseiro.id;
          console.log('✅ Gesseiro criado com ID:', gesseiroId);

          const senhaHash = await bcrypt.hash(senha, 10);

          db.inserirUsuario(email, senhaHash, gesseiroId, (err) => {
            if (err) {
              console.error('Erro ao criar usuário:', err);
              return res.status(500).json({ erro: 'Erro ao criar usuário' });
            }

            console.log('✅ Usuário criado!');

            db.pool.query('SELECT id FROM usuarios WHERE email = $1', [email]).then(r => {
              const usuarioId = r.rows[0] ? r.rows[0].id : null;
            }).catch(() => {});
            const token = jwt.sign(
              { gesseiroId: gesseiroId, email: email, usuarioId: null },
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

// ========== LOGIN ==========
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
        { gesseiroId: gesseiro.id, email: email, usuarioId: usuario.id },
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

// ========== LOGIN ADMIN ==========
app.post('/api/admin/login', (req, res) => {
  const { email, senha } = req.body;

  console.log('=== LOGIN ADMIN ===');

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

    const promises = gesseiros.map(gesseiro => {
      return new Promise((resolve) => {
        db.buscarFotos(gesseiro.id, (err, fotos) => {
          gesseiro.fotos = err ? [] : fotos;

          db.buscarServicos(gesseiro.id, (err, servicos) => {
            gesseiro.servicos = err ? [] : servicos;

            db.buscarAvaliacoes(gesseiro.id, (err, avaliacoes) => {
              gesseiro.avaliacoes = err ? [] : avaliacoes;
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
  const { nome, cidade, telefone, email, instagram, descricao, endereco, latitude, longitude } = req.body;

  if (req.gesseiroId !== id) {
    return res.status(403).json({ erro: 'Você não tem permissão para editar este perfil!' });
  }
  if (!nome || !cidade || !telefone) {
    return res.status(400).json({ erro: 'Nome, cidade e telefone são obrigatórios' });
  }

  db.atualizarGesseiro(id, { nome, cidade, telefone, email, instagram, descricao, endereco, latitude, longitude }, (err, result) => {
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

// ========== UPLOAD DE FOTO (CLOUDINARY) ==========
app.post('/api/gesseiros/:id/fotos', verificarToken, upload.single('foto'), (req, res) => {
  const gesseiroId = parseInt(req.params.id);
  const descricao = req.body.descricao || '';

  console.log('=== UPLOAD DE FOTO ===');
  console.log('Gesseiro ID:', gesseiroId);
  console.log('Arquivo:', req.file ? req.file.filename : 'NENHUM');
  console.log('Descrição:', descricao);

  if (req.gesseiroId !== gesseiroId) {
    return res.status(403).json({ erro: 'Você não tem permissão para adicionar fotos aqui!' });
  }
  if (!req.file) {
    return res.status(400).json({ erro: 'Nenhuma foto foi enviada' });
  }

  // URL pública do Cloudinary
  const fotoUrl = req.file.path;

  db.adicionarFoto(gesseiroId, fotoUrl, descricao, (err, foto) => {
    if (err) {
      console.error('❌ Erro ao salvar foto:', err);
      return res.status(500).json({ erro: 'Erro ao salvar foto' });
    }
    console.log('✅ Foto salva no Cloudinary:', fotoUrl);
    res.json({ mensagem: 'Foto adicionada com sucesso!', foto: foto });
  });
});

// ========== DELETAR FOTO ==========
app.delete('/api/gesseiros/:gesseiroId/fotos/:fotoId', verificarToken, (req, res) => {
  const gesseiroId = parseInt(req.params.gesseiroId);
  const fotoId = req.params.fotoId;

  if (req.gesseiroId !== gesseiroId) {
    return res.status(403).json({ erro: 'Você não tem permissão para deletar esta foto!' });
  }

  db.buscarFotoPorId(fotoId, (err, foto) => {
    if (err || !foto) {
      return res.status(404).json({ erro: 'Foto não encontrada' });
    }

    // Deletar do Cloudinary
    const publicId = foto.url_foto.split('/').slice(-2).join('/').split('.')[0];
    cloudinary.uploader.destroy(publicId, (cloudErr) => {
      if (cloudErr) console.error('Aviso: erro ao deletar do Cloudinary:', cloudErr);
    });

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

  const dados = { gesseiro_id: gesseiroId, nome_servico, preco_com_material, preco_sem_material, unidade: unidade || 'm²', distancia_maxima: distancia_maxima || 50 };

  db.adicionarServico(dados, (err, servico) => {
    if (err) {
      console.error('Erro ao adicionar serviço:', err);
      return res.status(500).json({ erro: 'Erro ao adicionar serviço' });
    }
    console.log('💰 Serviço adicionado:', nome_servico);
    res.json({ mensagem: 'Serviço adicionado com sucesso!', servico: servico });
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

// ========== ADICIONAR AVALIAÇÃO ==========
app.post('/api/avaliacoes', (req, res) => {
  const { gesseiro_id, nome_avaliador, email_avaliador, estrelas, comentario } = req.body;

  console.log('=== NOVA AVALIAÇÃO ===');

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
    res.json({ mensagem: 'Avaliação enviada com sucesso!', avaliacao: avaliacao });
  });
});

// ========== LISTAR AVALIAÇÕES ==========
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

// ========== ROTAS ADMIN ==========

app.get('/api/admin/usuarios', verificarTokenAdmin, (req, res) => {
  db.listarTodosUsuarios((err, usuarios) => {
    if (err) {
      console.error('Erro ao listar usuários:', err);
      return res.status(500).json({ erro: 'Erro ao listar usuários' });
    }
    res.json(usuarios);
  });
});

app.delete('/api/admin/usuarios/:id', verificarTokenAdmin, (req, res) => {
  const usuarioId = req.params.id;

  db.deletarUsuarioPorId(usuarioId, (err, result) => {
    if (err) {
      console.error('Erro ao deletar usuário:', err);
      return res.status(500).json({ erro: 'Erro ao deletar usuário' });
    }
    if (result.changes === 0) {
      return res.status(404).json({ erro: 'Usuário não encontrado' });
    }
    console.log('🗑️ Usuário deletado - ID:', usuarioId);
    res.json({ mensagem: 'Usuário deletado com sucesso!' });
  });
});

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

app.get('/api/admin/estatisticas', verificarTokenAdmin, (req, res) => {
  db.obterEstatisticas((err, stats) => {
    if (err) {
      console.error('Erro ao buscar estatísticas:', err);
      return res.status(500).json({ erro: 'Erro ao buscar estatísticas' });
    }
    res.json(stats);
  });
});

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
  console.log('🚀 GESSEIROS PRO - PRODUÇÃO');
  console.log('=================================');
  console.log(`📍 URL: http://localhost:${PORT}`);
  console.log(`🗄️  Banco: PostgreSQL (Render)`);
  console.log(`📸 Fotos: Cloudinary`);
  console.log(`🔐 JWT: Ativado`);
  console.log('=================================');
});
