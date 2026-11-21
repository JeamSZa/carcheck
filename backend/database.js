const Database = require('better-sqlite3');
const path = require('path');
const db = new Database(path.join(__dirname, 'carcheck.db'));

// Cria as tabelas (executa apenas se não existirem)
db.exec(`
  CREATE TABLE IF NOT EXISTS usuario (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    senha TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS veiculo (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id INTEGER,
    marca TEXT,
    modelo TEXT,
    ano INTEGER,
    placa TEXT,
    km INTEGER,
    FOREIGN KEY(usuario_id) REFERENCES usuario(id)
  );

  CREATE TABLE IF NOT EXISTS manutencao (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    veiculo_id INTEGER,
    titulo TEXT,
    descricao TEXT,
    data_realizada TEXT,
    km_realizada INTEGER,
    valor REAL,
    FOREIGN KEY(veiculo_id) REFERENCES veiculo(id)
  );
`);

module.exports = db;