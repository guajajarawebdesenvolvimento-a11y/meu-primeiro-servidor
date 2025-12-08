const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./gesseiros.db');

// Criar tabela de gesseiros (se não existir)
db.serialize(() => {
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

// Criar tabela para usuario
db.run(`
  CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT INTEGER NOT NULL UNIQUE,
    senha TEXT NOT NULL,
    gesseiro_id INTEGER,
    data_criacao DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (gesseiro_id) REFERENCES gesseiros(id) ON DELETE CASCADE
  )
`);

  console.log('✅ Banco de dados criado/verificado!');
});

// Funções para manipular gesseiros

// Inserir novo gesseiro
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

// Buscar todos os gesseiros
function buscarGesseiros(callback) {
  const sql = `SELECT * FROM gesseiros ORDER BY data_cadastro DESC`;
  
  db.all(sql, [], (err, rows) => {
    if (err) {
      callback(err, null);
    } else {
      callback(null, rows);
    }
  });
}

// Buscar gesseiro por ID
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

// Buscar gesseiros por cidade
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

// Atualizar gesseiro
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

// Deletar gesseiro
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

// Inserir dados de exemplo (apenas na primeira vez)
function inserirDadosExemplo() {
  buscarGesseiros((err, gesseiros) => {
    if (!err && gesseiros.length === 0) {
      console.log('📝 Inserindo dados de exemplo...');
      
      const exemplos = [
        { nome: 'João Silva', cidade: 'Fortaleza', telefone: '(85) 99999-1111', email: 'joao@email.com', instagram: '@joaogesso', descricao: 'Especialista em reboco e forro' },
        { nome: 'Maria Santos', cidade: 'Fortaleza', telefone: '(85) 99999-2222', email: 'maria@email.com', instagram: '@mariagesso', descricao: 'Gesso decorativo e molduras' },
        { nome: 'Pedro Costa', cidade: 'Caucaia', telefone: '(85) 99999-3333', email: 'pedro@email.com', instagram: '@pedrogesso', descricao: 'Todos os tipos de serviços em gesso' }
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
// Adicionar foto
function adicionarFoto(gesseiroId, urlFoto, descricao, callback) {
  const sql = `INSERT INTO fotos (gesseiro_id, url_foto, descricao) VALUES (?, ?, ?)`;
  
  db.run(sql, [gesseiroId, urlFoto, descricao], function(err) {
    if (err) {
      callback(err, null);
    } else {
      callback(null, { id: this.lastID, gesseiro_id: gesseiroId, url_foto: urlFoto });
    }
  });
}

// Buscar fotos de um gesseiro
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

// Deletar foto
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


// Inserir novo usuário
function inserirUsuario(email, senhaHash, gesseiroId, callback) {
const query = `INSERT INTO usuarios (email, senha, gesseiro_id) VALUES (?, ?, ?)`;
db.run(query, [email, senhaHash, gesseiroId], function(err) {
if (err) {
callback(err);
} else {
callback(null, this.lastID);
}
});
}

// Buscar usuário por email
function buscarUsuarioPorEmail(email, callback) {
const query = `SELECT * FROM usuarios WHERE email = ?`;
db.get(query, [email], (err, row) => {
callback(err, row);
});
}

module.exports = {
  db,
  inserirGesseiro,
  buscarGesseiros,
  buscarGesseiroPorId,
  buscarPorCidade,
  atualizarGesseiro,
  deletarGesseiro,
  adicionarFoto,
  buscarFotos,
  deletarFoto,
  inserirUsuario,
  buscarUsuarioPorEmail
};