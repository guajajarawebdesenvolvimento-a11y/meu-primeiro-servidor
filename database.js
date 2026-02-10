const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const db = new sqlite3.Database('./gesseiros.db');

// ========== CRIAR TABELAS ==========
db.serialize(() => {
  // Tabela de gesseiros
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

  // Tabela de fotos
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

  // Tabela de usuários (CORRIGIDO)
  db.run(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      senha TEXT NOT NULL,
      gesseiro_id INTEGER,
      data_criacao DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (gesseiro_id) REFERENCES gesseiros(id) ON DELETE CASCADE
    )
  `);

  // Tabela de serviços
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
      FOREIGN KEY (gesseiro_id) REFERENCES gesseiros(id) ON DELETE CASCADE
    )
  `);

  // ⭐ NOVA: Tabela de avaliações
  db.run(`
    CREATE TABLE IF NOT EXISTS avaliacoes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      gesseiro_id INTEGER NOT NULL,
      nome_avaliador TEXT,
      email_avaliador TEXT,
      estrelas INTEGER NOT NULL CHECK(estrelas >= 1 AND estrelas <= 5),
      comentario TEXT,
      data_avaliacao DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (gesseiro_id) REFERENCES gesseiros(id) ON DELETE CASCADE
    )
  `);

  // 🔐 NOVA: Tabela de administradores
  db.run(`
    CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      senha TEXT NOT NULL,
      nome TEXT NOT NULL,
      data_criacao DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (!err) {
      // Criar admin padrão se não existir
      db.get('SELECT * FROM admins WHERE email = ?', ['cristorm12@gmail.com'], (err, admin) => {
        if (!admin) {
          const senhaHash = bcrypt.hashSync('1992@IBPaz', 10);
          db.run(
            'INSERT INTO admins (email, senha, nome) VALUES (?, ?, ?)',
            ['GesseiroAdmin', senhaHash, 'Administrador'],
            (err) => {
              if (!err) {
                console.log('🔐 Admin criado!');
                console.log('📧 Email: cristorm12@gmail.com');
                console.log('🔑 Senha: 1992@IBPaz');
                console.log('⚠️  ALTERE A SENHA NO PRIMEIRO LOGIN!');
              }
            }
          );
        }
      });
    }
  });

  console.log('✅ Banco de dados SQLite criado/verificado!');
});

// ========== FUNÇÕES PARA GESSEIROS ==========

function inserirGesseiro(dados, callback) {
  const { nome, cidade, telefone, email, instagram, descricao } = dados;
  
  const sql = `INSERT INTO gesseiros (nome, cidade, telefone, email, instagram, descricao) 
               VALUES (?, ?, ?, ?, ?, ?)`;
  
  db.run(sql, [nome, cidade, telefone, email, instagram, descricao], function(err) {
    if (err) {
      callback(err, null);
    } else {
      callback(null, { id: this.lastID, ...dados });
    }
  });
}

function buscarGesseiros(callback) {
  const sql = `
    SELECT 
      g.*,
      (SELECT COUNT(*) FROM fotos WHERE gesseiro_id = g.id) as total_fotos,
      (SELECT COUNT(*) FROM avaliacoes WHERE gesseiro_id = g.id) as total_avaliacoes,
      (SELECT AVG(estrelas) FROM avaliacoes WHERE gesseiro_id = g.id) as media_avaliacoes
    FROM gesseiros g 
    ORDER BY data_cadastro DESC
  `;
  
  db.all(sql, [], (err, rows) => {
    if (err) {
      callback(err, null);
    } else {
      callback(null, rows);
    }
  });
}

function buscarGesseiroPorId(id, callback) {
  const sql = `SELECT * FROM gesseiros WHERE id = ?`;
  
  db.get(sql, [id], (err, row) => {
    if (err) {
      callback(err, null);
    } else {
      callback(null, row);
    }
  });
}

function buscarPorCidade(cidade, callback) {
  const sql = `SELECT * FROM gesseiros WHERE cidade LIKE ? ORDER BY nome`;
  
  db.all(sql, [`%${cidade}%`], (err, rows) => {
    if (err) {
      callback(err, null);
    } else {
      callback(null, rows);
    }
  });
}

function atualizarGesseiro(id, dados, callback) {
  const { nome, cidade, telefone, email, instagram, descricao } = dados;
  
  const sql = `UPDATE gesseiros 
               SET nome = ?, cidade = ?, telefone = ?, email = ?, instagram = ?, descricao = ?
               WHERE id = ?`;
  
  db.run(sql, [nome, cidade, telefone, email, instagram, descricao, id], function(err) {
    if (err) {
      callback(err, null);
    } else {
      callback(null, { id, changes: this.changes });
    }
  });
}

function deletarGesseiro(id, callback) {
  const sql = `DELETE FROM gesseiros WHERE id = ?`;
  
  db.run(sql, [id], function(err) {
    if (err) {
      callback(err, null);
    } else {
      callback(null, { id, changes: this.changes });
    }
  });
}

// ========== FUNÇÕES PARA FOTOS ==========

function adicionarFoto(gesseiroId, urlFoto, descricao, callback) {
  const sql = `INSERT INTO fotos (gesseiro_id, url_foto, descricao) VALUES (?, ?, ?)`;
  
  db.run(sql, [gesseiroId, urlFoto, descricao || ''], function(err) {
    if (err) {
      callback(err, null);
    } else {
      callback(null, { 
        id: this.lastID, 
        gesseiro_id: gesseiroId, 
        url_foto: urlFoto,
        descricao: descricao || ''
      });
    }
  });
}

function buscarFotos(gesseiroId, callback) {
  const sql = `SELECT * FROM fotos WHERE gesseiro_id = ? ORDER BY data_upload DESC`;
  
  db.all(sql, [gesseiroId], (err, rows) => {
    if (err) {
      callback(err, null);
    } else {
      callback(null, rows);
    }
  });
}

function deletarFoto(id, callback) {
  const sql = `DELETE FROM fotos WHERE id = ?`;
  
  db.run(sql, [id], function(err) {
    if (err) {
      callback(err, null);
    } else {
      callback(null, { id, changes: this.changes });
    }
  });
}

// ========== FUNÇÕES PARA USUÁRIOS ==========

function inserirUsuario(email, senhaHash, gesseiroId, callback) {
  const query = `INSERT INTO usuarios (email, senha, gesseiro_id) VALUES (?, ?, ?)`;
  
  db.run(query, [email, senhaHash, gesseiroId], function(err) {
    if (err) {
      callback(err, null);
    } else {
      callback(null, this.lastID);
    }
  });
}

function buscarUsuarioPorEmail(email, callback) {
  const query = `SELECT * FROM usuarios WHERE email = ?`;
  
  db.get(query, [email], (err, row) => {
    callback(err, row);
  });
}

// ========== FUNÇÕES PARA SERVIÇOS ==========

function adicionarServico(dados, callback) {
  const { gesseiro_id, nome_servico, preco_com_material, preco_sem_material, unidade, distancia_maxima } = dados;
  
  const sql = `
    INSERT INTO servicos (gesseiro_id, nome_servico, preco_com_material, preco_sem_material, unidade, distancia_maxima) 
    VALUES (?, ?, ?, ?, ?, ?)
  `;
  
  db.run(sql, [
    gesseiro_id, 
    nome_servico, 
    preco_com_material, 
    preco_sem_material, 
    unidade || 'm²', 
    distancia_maxima || 50
  ], function(err) {
    if (err) {
      callback(err, null);
    } else {
      callback(null, { id: this.lastID, ...dados });
    }
  });
}

function buscarServicos(gesseiroId, callback) {
  const sql = `SELECT * FROM servicos WHERE gesseiro_id = ? ORDER BY data_cadastro DESC`;
  
  db.all(sql, [gesseiroId], (err, rows) => {
    if (err) {
      callback(err, null);
    } else {
      callback(null, rows);
    }
  });
}

function deletarServico(id, callback) {
  const sql = `DELETE FROM servicos WHERE id = ?`;
  
  db.run(sql, [id], function(err) {
    if (err) {
      callback(err, null);
    } else {
      callback(null, { id, changes: this.changes });
    }
  });
}

// ========== FUNÇÕES PARA AVALIAÇÕES ⭐ ==========

function adicionarAvaliacao(dados, callback) {
  const { gesseiro_id, nome_avaliador, email_avaliador, estrelas, comentario } = dados;
  
  const sql = `
    INSERT INTO avaliacoes (gesseiro_id, nome_avaliador, email_avaliador, estrelas, comentario) 
    VALUES (?, ?, ?, ?, ?)
  `;
  
  db.run(sql, [gesseiro_id, nome_avaliador, email_avaliador, estrelas, comentario], function(err) {
    if (err) {
      callback(err, null);
    } else {
      callback(null, { id: this.lastID, ...dados });
    }
  });
}

function buscarAvaliacoes(gesseiroId, callback) {
  const sql = `SELECT * FROM avaliacoes WHERE gesseiro_id = ? ORDER BY data_avaliacao DESC`;
  
  db.all(sql, [gesseiroId], (err, rows) => {
    if (err) {
      callback(err, null);
    } else {
      callback(null, rows);
    }
  });
}

function deletarAvaliacao(id, callback) {
  const sql = `DELETE FROM avaliacoes WHERE id = ?`;
  
  db.run(sql, [id], function(err) {
    if (err) {
      callback(err, null);
    } else {
      callback(null, { id, changes: this.changes });
    }
  });
}

// ========== FUNÇÕES PARA ADMIN 🔐 ==========

function buscarAdminPorEmail(email, callback) {
  const sql = `SELECT * FROM admins WHERE email = ?`;
  
  db.get(sql, [email], (err, row) => {
    callback(err, row);
  });
}

function listarTodosUsuarios(callback) {
  const sql = `
    SELECT 
      u.id as usuario_id,
      u.email,
      u.data_criacao as data_cadastro_usuario,
      g.id as gesseiro_id,
      g.nome,
      g.cidade,
      g.telefone,
      g.data_cadastro as data_cadastro_gesseiro,
      (SELECT COUNT(*) FROM fotos WHERE gesseiro_id = g.id) as total_fotos,
      (SELECT COUNT(*) FROM avaliacoes WHERE gesseiro_id = g.id) as total_avaliacoes
    FROM usuarios u
    LEFT JOIN gesseiros g ON u.gesseiro_id = g.id
    ORDER BY u.data_criacao DESC
  `;
  
  db.all(sql, [], (err, rows) => {
    callback(err, rows);
  });
}

function obterEstatisticas(callback) {
  db.all(`
    SELECT 
      (SELECT COUNT(*) FROM gesseiros) as total_gesseiros,
      (SELECT COUNT(*) FROM usuarios) as total_usuarios,
      (SELECT COUNT(*) FROM fotos) as total_fotos,
      (SELECT COUNT(*) FROM avaliacoes) as total_avaliacoes,
      (SELECT AVG(estrelas) FROM avaliacoes) as media_geral_avaliacoes
  `, [], (err, rows) => {
    callback(err, rows[0]);
  });
}

// ========== DADOS DE EXEMPLO ==========

function inserirDadosExemplo() {
  buscarGesseiros((err, gesseiros) => {
    if (!err && gesseiros.length === 0) {
      console.log('📝 Inserindo dados de exemplo...');
      
      const exemplos = [
        { 
          nome: 'João Silva', 
          cidade: 'Fortaleza', 
          telefone: '(85) 99999-1111', 
          email: 'joao@email.com', 
          instagram: '@joaogesso', 
          descricao: 'Especialista em reboco e forro de gesso. 15 anos de experiência em Fortaleza e região.' 
        },
        { 
          nome: 'Maria Santos', 
          cidade: 'Fortaleza', 
          telefone: '(85) 99999-2222', 
          email: 'maria@email.com', 
          instagram: '@mariagesso', 
          descricao: 'Gesso decorativo, molduras e sancas. Trabalhos personalizados com qualidade.' 
        },
        { 
          nome: 'Pedro Costa', 
          cidade: 'Caucaia', 
          telefone: '(85) 99999-3333', 
          email: 'pedro@email.com', 
          instagram: '@pedrogesso', 
          descricao: 'Todos os tipos de serviços em gesso. Atendimento em toda região metropolitana.' 
        }
      ];
      
      exemplos.forEach(ex => {
        inserirGesseiro(ex, (err, result) => {
          if (!err) console.log(`✅ ${ex.nome} cadastrado!`);
        });
      });
    }
  });
}

// Executar ao iniciar
inserirDadosExemplo();

// ========== EXPORTS ==========

module.exports = {
  db,
  // Gesseiros
  inserirGesseiro,
  buscarGesseiros,
  buscarGesseiroPorId,
  buscarPorCidade,
  atualizarGesseiro,
  deletarGesseiro,
  // Fotos
  adicionarFoto,
  buscarFotos,
  deletarFoto,
  // Usuários
  inserirUsuario,
  buscarUsuarioPorEmail,
  // Serviços
  adicionarServico,
  buscarServicos,
  deletarServico,
  // Avaliações
  adicionarAvaliacao,
  buscarAvaliacoes,
  deletarAvaliacao,
  // Admin
  buscarAdminPorEmail,
  listarTodosUsuarios,
  obterEstatisticas
};
