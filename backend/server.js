const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const { findUserByEmail, createUser } = require("./users");
const wallet = require("./wallet");

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());

const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

const JWT_SECRET = process.env.JWT_SECRET || "troque_essa_chave_para_producao";

app.get("/", (req, res) => {
  res.json({ message: "Backend do projeto-jogo rodando! 🚀" });
});

// REGISTER (mantém)
app.post("/auth/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: "name, email e password são obrigatórios." });
    }
    const existing = findUserByEmail(email);
    if (existing) {
      return res.status(409).json({ error: "Email já cadastrado." });
    }
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    const user = createUser({ name, email, passwordHash });
    // inicializar saldo (opcional) - aqui deixamos 0 por padrão
    // wallet.credit(user.id, 1000, "Bônus inicial"); // EXEMPLO
    return res.status(201).json({ message: "Usuário criado com sucesso.", user: { id: user.id, name: user.name, email: user.email } });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Erro ao criar usuário." });
  }
});

// LOGIN (mantém JWT)
app.post("/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email e senha são obrigatórios." });
    }
    const user = findUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: "Credenciais inválidas." });
    }
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ error: "Credenciais inválidas." });
    }
    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: "7d" });
    return res.json({
      message: "Login realizado com sucesso!",
      user: { id: user.id, name: user.name, email: user.email },
      token,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Erro no login." });
  }
});

/**
 * WALLET ROUTES
 * - GET /wallet/:userId               -> ver saldo
 * - GET /wallet/transactions/:userId  -> ver histórico
 * - POST /wallet/:userId/credit       -> creditar { amount, reason }
 * - POST /wallet/:userId/debit        -> debitar { amount, reason }
 * - POST /wallet/transfer             -> transferir { fromUserId, toUserId, amount, reason }
 */

// ver saldo
app.get("/wallet/:userId", (req, res) => {
  const userId = req.params.userId;
  const balance = wallet.getBalance(userId);
  return res.json({ userId, balance });
});

// histórico
app.get("/wallet/transactions/:userId", (req, res) => {
  const userId = req.params.userId;
  const txs = wallet.getTransactionsByUser(userId);
  return res.json({ userId, transactions: txs });
});

// creditar
app.post("/wallet/:userId/credit", (req, res) => {
  const userId = req.params.userId;
  const { amount, reason } = req.body;
  if (!amount || Number(amount) <= 0) return res.status(400).json({ error: "amount positivo obrigatório." });
  try {
    const tx = wallet.credit(userId, Number(amount), reason);
    return res.json({ message: "Credit realizado", transaction: tx, balance: wallet.getBalance(userId) });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// debitar
app.post("/wallet/:userId/debit", (req, res) => {
  const userId = req.params.userId;
  const { amount, reason } = req.body;
  if (!amount || Number(amount) <= 0) return res.status(400).json({ error: "amount positivo obrigatório." });
  try {
    const tx = wallet.debit(userId, Number(amount), reason);
    return res.json({ message: "Debit realizado", transaction: tx, balance: wallet.getBalance(userId) });
  } catch (err) {
    if (err.code === "INSUFFICIENT_FUNDS") return res.status(400).json({ error: "Saldo insuficiente." });
    return res.status(500).json({ error: err.message });
  }
});

// transferir
app.post("/wallet/transfer", (req, res) => {
  const { fromUserId, toUserId, amount, reason } = req.body;
  if (!fromUserId || !toUserId || !amount || Number(amount) <= 0) return res.status(400).json({ error: "fromUserId, toUserId e amount (>0) obrigatórios." });
  try {
    const result = wallet.transfer(fromUserId, toUserId, Number(amount), reason);
    return res.json({
      message: "Transferência realizada.",
      debitTx: result.debitTx,
      creditTx: result.creditTx,
      balanceFrom: wallet.getBalance(fromUserId),
      balanceTo: wallet.getBalance(toUserId),
    });
  } catch (err) {
    if (err.code === "INSUFFICIENT_FUNDS") return res.status(400).json({ error: "Saldo insuficiente no usuário remetente." });
    return res.status(500).json({ error: err.message });
  }
});

// Socket.io (mantém)
io.on("connection", (socket) => {
  console.log("Novo jogador conectado:", socket.id);
  socket.on("mensagem_teste", (data) => {
    console.log("Mensagem do jogador:", data);
  });
  socket.on("disconnect", () => {
    console.log("Jogador desconectado:", socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Servidor ouvindo na porta ${PORT}`);
});
