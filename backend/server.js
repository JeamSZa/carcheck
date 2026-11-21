const express = require('express');
const cors = require('cors');
const db = require('./database');
const path = require('path');

const app = express();
const PORT = 3000;

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// --- ROTAS DE USUÁRIO ---

// Cadastrar Usuário
app.post('/usuarios', (req, res) => {
  const { nome, email, senha } = req.body;
  if (!nome || !email || !senha) return res.status(400).json({ erro: "Preencha todos os campos." });

  try {
    const stmt = db.prepare(`INSERT INTO usuario (nome, email, senha) VALUES (?, ?, ?)`);
    const info = stmt.run(nome, email, senha);
    res.status(201).json({ id: info.lastInsertRowid, nome, email, mensagem: "Usuário cadastrado!" });
  } catch (err) {
    res.status(400).json({ erro: "E-mail já cadastrado ou dados inválidos." });
  }
});

// Login do Usuário
app.post('/login', (req, res) => {
  const { email, senha } = req.body;
  
  try {
    const usuario = db.prepare(`SELECT id, nome, email FROM usuario WHERE email = ? AND senha = ?`).get(email, senha);
    
    if (usuario) {
      res.json({ mensagem: "Login realizado com sucesso", usuario: usuario });
    } else {
      res.status(401).json({ erro: "E-mail ou senha incorretos." });
    }
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// --- ROTAS DE VEÍCULO ---

// Cadastrar Veículo
app.post('/veiculos', (req, res) => {
  const { usuario_id, marca, modelo, ano, placa, km } = req.body;
  
  if (!usuario_id || !marca || !modelo) {
    return res.status(400).json({ erro: "Usuário, marca e modelo são obrigatórios." });
  }
  if (km === undefined || km === null) {
    return res.status(400).json({ erro: "KM inválido." });
  }
  if (ano !== undefined && ano !== null && ano !== '' && (!Number.isFinite(Number(ano)) || Number(ano) < 0)) {
    return res.status(400).json({ erro: "Ano inválido." });
  }
  if (km !== undefined && km !== null && (!Number.isFinite(Number(km)) || Number(km) < 0)) {
    return res.status(400).json({ erro: "KM inválido." });
  }

  try {
    const stmt = db.prepare(`INSERT INTO veiculo (usuario_id, marca, modelo, ano, placa, km) VALUES (?, ?, ?, ?, ?, ?)`);
    const info = stmt.run(usuario_id, marca, modelo, ano == null || ano === '' ? null : Number(ano), placa, Number(km));
    
    res.status(201).json({ id: info.lastInsertRowid, mensagem: "Veículo cadastrado com sucesso!" });
  } catch (err) {
    res.status(400).json({ erro: err.message });
  }
});

// Listar Veículos de um Usuário específico
app.get('/veiculos/:usuario_id', (req, res) => {
  const { usuario_id } = req.params;

  try {
    const veiculos = db.prepare(`SELECT * FROM veiculo WHERE usuario_id = ?`).all(usuario_id);
    res.json(veiculos);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// --- ROTAS DE MANUTENÇÃO ---

// Cadastrar Manutenção
app.post('/manutencoes', (req, res) => {
  const { veiculo_id, titulo, descricao, data_realizada, km_realizada, valor } = req.body;
  
  if (!veiculo_id || !titulo || km_realizada === undefined || km_realizada === null) {
    return res.status(400).json({ erro: "Veículo, título e KM são obrigatórios." });
  }
  if (!Number.isFinite(Number(km_realizada)) || Number(km_realizada) < 0) {
    return res.status(400).json({ erro: "KM inválido." });
  }
  if (valor !== undefined && valor !== null && (!Number.isFinite(Number(valor)) || Number(valor) < 0)) {
    return res.status(400).json({ erro: "Valor inválido." });
  }

  try {
    const stmt = db.prepare(`INSERT INTO manutencao (veiculo_id, titulo, descricao, data_realizada, km_realizada, valor) VALUES (?, ?, ?, ?, ?, ?)`);
    const info = stmt.run(
      veiculo_id,
      titulo,
      descricao,
      data_realizada,
      Number(km_realizada),
      valor == null || valor === '' ? 0 : Number(valor)
    );
    
    res.status(201).json({ id: info.lastInsertRowid, mensagem: "Manutenção registrada com sucesso!" });
  } catch (err) {
    res.status(400).json({ erro: err.message });
  }
});

// Todas as manutenções do usuário (tela Manutenções + gastos)
app.get('/manutencoes/usuario/:usuario_id', (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT m.*, v.marca, v.modelo, v.placa
      FROM manutencao m JOIN veiculo v ON v.id = m.veiculo_id
      WHERE v.usuario_id = ? ORDER BY m.data_realizada DESC, m.id DESC
    `).all(req.params.usuario_id);
    res.json(rows);
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

// Listar Histórico de Manutenções de um Veículo
app.get('/manutencoes/:veiculo_id', (req, res) => {
  const { veiculo_id } = req.params;

  try {
    const manutencoes = db.prepare(`SELECT * FROM manutencao WHERE veiculo_id = ? ORDER BY data_realizada DESC`).all(veiculo_id);
    res.json(manutencoes);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// Atualizar veículo (principalmente km)
app.put('/veiculos/:id', (req, res) => {
  const { marca, modelo, ano, placa, km } = req.body;
  try {
    if (ano !== undefined && ano !== null && ano !== '' && (!Number.isFinite(Number(ano)) || Number(ano) < 0)) {
      return res.status(400).json({ erro: "Ano inválido." });
    }
    if (km !== undefined && km !== null && (!Number.isFinite(Number(km)) || Number(km) < 0)) {
      return res.status(400).json({ erro: "KM inválido." });
    }
    const atual = db.prepare(`SELECT * FROM veiculo WHERE id = ?`).get(req.params.id);
    if (!atual) return res.status(404).json({ erro: "Veículo não encontrado." });
    db.prepare(`UPDATE veiculo SET marca=?, modelo=?, ano=?, placa=?, km=? WHERE id=?`).run(
      marca ?? atual.marca, modelo ?? atual.modelo, ano ?? atual.ano,
      placa ?? atual.placa, km ?? atual.km, req.params.id);
    res.json({ mensagem: "Veículo atualizado!" });
  } catch (err) { res.status(400).json({ erro: err.message }); }
});

// Excluir veículo (e suas manutenções)
app.delete('/veiculos/:id', (req, res) => {
  try {
    db.prepare(`DELETE FROM manutencao WHERE veiculo_id = ?`).run(req.params.id);
    db.prepare(`DELETE FROM veiculo WHERE id = ?`).run(req.params.id);
    res.json({ mensagem: "Veículo excluído." });
  } catch (err) { res.status(400).json({ erro: err.message }); }
});

// Excluir manutenção
app.delete('/manutencoes/:id', (req, res) => {
  try {
    db.prepare(`DELETE FROM manutencao WHERE id = ?`).run(req.params.id);
    res.json({ mensagem: "Manutenção excluída." });
  } catch (err) { res.status(400).json({ erro: err.message }); }
});

// --- ROTA INTELIGENTE DE ALERTAS ---

// Gerar Alertas para o Dashboard do Usuário
app.get('/alertas/:usuario_id', (req, res) => {
  const { usuario_id } = req.params;

  try {
    const ehTrocaOleo = titulo => String(titulo || "")
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .includes('oleo');
    const veiculos = db.prepare(`SELECT * FROM veiculo WHERE usuario_id = ?`).all(usuario_id);
    const alertas = [];

    veiculos.forEach(veiculo => {
      const manutencoes = db.prepare(`
        SELECT * FROM manutencao WHERE veiculo_id = ?
      `).all(veiculo.id);
      const ultimaTroca = manutencoes
        .filter(manutencao => ehTrocaOleo(manutencao.titulo))
        .sort((a, b) => Number(b.km_realizada) - Number(a.km_realizada))[0];

      if (ultimaTroca) {
        const diferencaKm = veiculo.km - ultimaTroca.km_realizada;
        
        if (diferencaKm >= 10000) {
          alertas.push({
            veiculo_id: veiculo.id,
            modelo: veiculo.modelo,
            tipo: "Manutenção Atrasada",
            mensagem: `O ${veiculo.modelo} já rodou ${diferencaKm} km desde a última troca de óleo.`
          });
        } else if (diferencaKm >= 8000) {
          alertas.push({
            veiculo_id: veiculo.id,
            modelo: veiculo.modelo,
            tipo: "Atenção",
            mensagem: `O ${veiculo.modelo} está próximo da troca de óleo (faltam ${10000 - diferencaKm} km).`
          });
        }
      } else {
         alertas.push({
            veiculo_id: veiculo.id,
            modelo: veiculo.modelo,
            tipo: "Aviso",
            mensagem: `Nenhuma troca de óleo registrada para o ${veiculo.modelo}.`
          });
      }
    });

    res.json(alertas);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// Iniciar o servidor
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});