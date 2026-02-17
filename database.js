const { Pool } = require('pg');
const bcrypt = require('bcrypt');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// ========== CRIAR TABELAS ==========
async function inicializarBanco() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS gesseiros (
        id SERIAL PRIMARY KEY,
        nome TEXT NOT NULL,
        cidade TEXT NOT NULL,
        telefone TEXT NOT NULL,
        email TEXT,
        instagram TEXT,
        descricao TEXT,
        endereco TEXT,
        latitude REAL,
        longitude REAL,
        foto_perfil TEXT,
        data_cadastro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Adicionar foto_perfil se não existir (para bancos existentes)
    try {
      await client.query('ALTER TABLE gesseiros ADD COLUMN IF NOT EXISTS foto_perfil TEXT');
    } catch(e) {}

    await client.query(`
      CREATE TABLE IF NOT EXISTS fotos (
        id SERIAL PRIMARY KEY,
        gesseiro_id INTEGER NOT NULL,
        url_foto TEXT NOT NULL,
        descricao TEXT,
        data_upload TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (gesseiro_id) REFERENCES gesseiros(id) ON DELETE CASCADE
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id SERIAL PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        senha TEXT NOT NULL,
        gesseiro_id INTEGER,
        data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (gesseiro_id) REFERENCES gesseiros(id) ON DELETE CASCADE
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS servicos (
        id SERIAL PRIMARY KEY,
        gesseiro_id INTEGER NOT NULL,
        nome_servico TEXT NOT NULL,
        preco_com_material REAL,
        preco_sem_material REAL,
        unidade TEXT DEFAULT 'm²',
        distancia_maxima INTEGER DEFAULT 50,
        data_cadastro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (gesseiro_id) REFERENCES gesseiros(id) ON DELETE CASCADE
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS avaliacoes (
        id SERIAL PRIMARY KEY,
        gesseiro_id INTEGER NOT NULL,
        nome_avaliador TEXT,
        email_avaliador TEXT,
        estrelas INTEGER NOT NULL CHECK(estrelas >= 1 AND estrelas <= 5),
        comentario TEXT,
        data_avaliacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (gesseiro_id) REFERENCES gesseiros(id) ON DELETE CASCADE
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS admins (
        id SERIAL PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        senha TEXT NOT NULL,
        nome TEXT NOT NULL,
        data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Criar admin padrão se não existir
    const adminExiste = await client.query('SELECT * FROM admins WHERE email = $1', ['cristorm12@gmail.com']);
    if (adminExiste.rows.length === 0) {
      const senhaHash = await bcrypt.hash('1992@IBPaz', 10);
      await client.query(
        'INSERT INTO admins (email, senha, nome) VALUES ($1, $2, $3)',
        ['cristorm12@gmail.com', senhaHash, 'Administrador']
      );
      console.log('🔐 Admin criado!');
      console.log('📧 Email: cristorm12@gmail.com');
      console.log('🔑 Senha: 1992@IBPaz');
      console.log('⚠️  ALTERE A SENHA NO PRIMEIRO LOGIN!');
    }

    console.log('✅ Banco de dados PostgreSQL criado/verificado!');
  } finally {
    client.release();
  }
}

// ========== FUNÇÕES PARA GESSEIROS ==========

function inserirGesseiro(dados, callback) {
  const { nome, cidade, telefone, email, instagram, descricao, endereco, latitude, longitude } = dados;
  const sql = `
    INSERT INTO gesseiros (nome, cidade, telefone, email, instagram, descricao, endereco, latitude, longitude)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *
  `;
  pool.query(sql, [nome, cidade, telefone, email || null, instagram || null, descricao, endereco || null, latitude || null, longitude || null])
    .then(result => callback(null, result.rows[0]))
    .catch(err => callback(err, null));
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
  pool.query(sql)
    .then(result => callback(null, result.rows))
    .catch(err => callback(err, null));
}

function buscarGesseiroPorId(id, callback) {
  pool.query('SELECT * FROM gesseiros WHERE id = $1', [id])
    .then(result => callback(null, result.rows[0] || null))
    .catch(err => callback(err, null));
}

function buscarPorCidade(cidade, callback) {
  pool.query('SELECT * FROM gesseiros WHERE cidade ILIKE $1 ORDER BY nome', [`%${cidade}%`])
    .then(result => callback(null, result.rows))
    .catch(err => callback(err, null));
}

function atualizarGesseiro(id, dados, callback) {
  const { nome, cidade, telefone, email, instagram, descricao, endereco, latitude, longitude } = dados;
  const sql = `
    UPDATE gesseiros
    SET nome=$1, cidade=$2, telefone=$3, email=$4, instagram=$5, descricao=$6, endereco=$7, latitude=$8, longitude=$9
    WHERE id=$10
  `;
  pool.query(sql, [nome, cidade, telefone, email, instagram, descricao, endereco, latitude, longitude, id])
    .then(result => callback(null, { id, changes: result.rowCount }))
    .catch(err => callback(err, null));
}

function deletarGesseiro(id, callback) {
  pool.query('DELETE FROM gesseiros WHERE id = $1', [id])
    .then(result => callback(null, { id, changes: result.rowCount }))
    .catch(err => callback(err, null));
}

// ========== FUNÇÕES PARA FOTOS ==========

function adicionarFoto(gesseiroId, urlFoto, descricao, callback) {
  const sql = `INSERT INTO fotos (gesseiro_id, url_foto, descricao) VALUES ($1, $2, $3) RETURNING *`;
  pool.query(sql, [gesseiroId, urlFoto, descricao || ''])
    .then(result => callback(null, result.rows[0]))
    .catch(err => callback(err, null));
}

function buscarFotos(gesseiroId, callback) {
  pool.query('SELECT * FROM fotos WHERE gesseiro_id = $1 ORDER BY data_upload DESC', [gesseiroId])
    .then(result => callback(null, result.rows))
    .catch(err => callback(err, null));
}

function buscarFotoPorId(id, callback) {
  pool.query('SELECT * FROM fotos WHERE id = $1', [id])
    .then(result => callback(null, result.rows[0] || null))
    .catch(err => callback(err, null));
}

function deletarFoto(id, callback) {
  pool.query('DELETE FROM fotos WHERE id = $1', [id])
    .then(result => callback(null, { id, changes: result.rowCount }))
    .catch(err => callback(err, null));
}

// ========== FUNÇÕES PARA USUÁRIOS ==========

function inserirUsuario(email, senhaHash, gesseiroId, callback) {
  pool.query(
    'INSERT INTO usuarios (email, senha, gesseiro_id) VALUES ($1, $2, $3) RETURNING id',
    [email, senhaHash, gesseiroId]
  )
    .then(result => callback(null, result.rows[0].id))
    .catch(err => callback(err, null));
}

function buscarUsuarioPorEmail(email, callback) {
  pool.query('SELECT * FROM usuarios WHERE email = $1', [email])
    .then(result => callback(null, result.rows[0] || null))
    .catch(err => callback(err, null));
}

// ========== FUNÇÕES PARA SERVIÇOS ==========

function adicionarServico(dados, callback) {
  const { gesseiro_id, nome_servico, preco_com_material, preco_sem_material, unidade, distancia_maxima } = dados;
  const sql = `
    INSERT INTO servicos (gesseiro_id, nome_servico, preco_com_material, preco_sem_material, unidade, distancia_maxima)
    VALUES ($1, $2, $3, $4, $5, $6) RETURNING *
  `;
  pool.query(sql, [gesseiro_id, nome_servico, preco_com_material, preco_sem_material, unidade || 'm²', distancia_maxima || 50])
    .then(result => callback(null, result.rows[0]))
    .catch(err => callback(err, null));
}

function buscarServicos(gesseiroId, callback) {
  pool.query('SELECT * FROM servicos WHERE gesseiro_id = $1 ORDER BY data_cadastro DESC', [gesseiroId])
    .then(result => callback(null, result.rows))
    .catch(err => callback(err, null));
}

function deletarServico(id, callback) {
  pool.query('DELETE FROM servicos WHERE id = $1', [id])
    .then(result => callback(null, { id, changes: result.rowCount }))
    .catch(err => callback(err, null));
}

// ========== FUNÇÕES PARA AVALIAÇÕES ==========

function adicionarAvaliacao(dados, callback) {
  const { gesseiro_id, nome_avaliador, email_avaliador, estrelas, comentario } = dados;
  const sql = `
    INSERT INTO avaliacoes (gesseiro_id, nome_avaliador, email_avaliador, estrelas, comentario)
    VALUES ($1, $2, $3, $4, $5) RETURNING *
  `;
  pool.query(sql, [gesseiro_id, nome_avaliador, email_avaliador, estrelas, comentario])
    .then(result => callback(null, result.rows[0]))
    .catch(err => callback(err, null));
}

function buscarAvaliacoes(gesseiroId, callback) {
  pool.query('SELECT * FROM avaliacoes WHERE gesseiro_id = $1 ORDER BY data_avaliacao DESC', [gesseiroId])
    .then(result => callback(null, result.rows))
    .catch(err => callback(err, null));
}

function deletarAvaliacao(id, callback) {
  pool.query('DELETE FROM avaliacoes WHERE id = $1', [id])
    .then(result => callback(null, { id, changes: result.rowCount }))
    .catch(err => callback(err, null));
}

// ========== FUNÇÕES PARA ADMIN ==========

function buscarAdminPorEmail(email, callback) {
  pool.query('SELECT * FROM admins WHERE email = $1', [email])
    .then(result => callback(null, result.rows[0] || null))
    .catch(err => callback(err, null));
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
  pool.query(sql)
    .then(result => callback(null, result.rows))
    .catch(err => callback(err, null));
}

function obterEstatisticas(callback) {
  const sql = `
    SELECT 
      (SELECT COUNT(*) FROM gesseiros) as total_gesseiros,
      (SELECT COUNT(*) FROM usuarios) as total_usuarios,
      (SELECT COUNT(*) FROM fotos) as total_fotos,
      (SELECT COUNT(*) FROM avaliacoes) as total_avaliacoes,
      (SELECT AVG(estrelas) FROM avaliacoes) as media_geral_avaliacoes
  `;
  pool.query(sql)
    .then(result => callback(null, result.rows[0]))
    .catch(err => callback(err, null));
}

function deletarUsuarioPorId(id, callback) {
  pool.query('DELETE FROM usuarios WHERE id = $1', [id])
    .then(result => callback(null, { id, changes: result.rowCount }))
    .catch(err => callback(err, null));
}

// Inicializar banco ao carregar o módulo
inicializarBanco().catch(err => {
  console.error('❌ Erro ao inicializar banco:', err);
});

// ========== EXPORTS ==========
module.exports = {
  pool,
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
  buscarFotoPorId,
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
  obterEstatisticas,
  deletarUsuarioPorId
};
