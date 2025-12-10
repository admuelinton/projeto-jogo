// wallet.js - armazenamento simples em memória (DEV ONLY)

const transactions = []; // lista de transações
let nextTxId = 1;

// Saldo por usuário (em inteiro ou float conforme necessidade)
const balances = {}; // { userId: number }

function ensureUser(userId) {
  if (!balances[userId]) balances[userId] = 0;
}

// retorna saldo atual (number)
function getBalance(userId) {
  ensureUser(userId);
  return balances[userId];
}

// registra transação e atualiza saldo
function recordTransaction({ userId, type, amount, reason, relatedUserId = null }) {
  ensureUser(userId);
  const tx = {
    id: nextTxId++,
    userId,
    type, // 'credit' | 'debit'
    amount: Number(amount),
    reason: reason || null,
    relatedUserId,
    timestamp: new Date().toISOString(),
  };
  transactions.push(tx);
  if (type === "credit") balances[userId] += Number(amount);
  if (type === "debit") balances[userId] -= Number(amount);
  return tx;
}

// creditar
function credit(userId, amount, reason) {
  if (Number(amount) <= 0) throw new Error("Amount must be > 0");
  return recordTransaction({ userId, type: "credit", amount, reason });
}

// debitar (verifica saldo)
function debit(userId, amount, reason) {
  if (Number(amount) <= 0) throw new Error("Amount must be > 0");
  ensureUser(userId);
  if (balances[userId] < Number(amount)) {
    const err = new Error("Insufficient funds");
    err.code = "INSUFFICIENT_FUNDS";
    throw err;
  }
  return recordTransaction({ userId, type: "debit", amount, reason });
}

// transferir (atômico do lado do app - para dev)
function transfer(fromUserId, toUserId, amount, reason) {
  if (Number(amount) <= 0) throw new Error("Amount must be > 0");
  ensureUser(fromUserId);
  ensureUser(toUserId);
  if (balances[fromUserId] < Number(amount)) {
    const err = new Error("Insufficient funds");
    err.code = "INSUFFICIENT_FUNDS";
    throw err;
  }
  // debitar e creditar (ordem: debit then credit)
  const debitTx = recordTransaction({
    userId: fromUserId,
    type: "debit",
    amount,
    reason: reason || `Transfer to ${toUserId}`,
    relatedUserId: toUserId,
  });
  const creditTx = recordTransaction({
    userId: toUserId,
    type: "credit",
    amount,
    reason: reason || `Transfer from ${fromUserId}`,
    relatedUserId: fromUserId,
  });
  return { debitTx, creditTx };
}

function getTransactionsByUser(userId) {
  return transactions.filter((t) => Number(t.userId) === Number(userId));
}

module.exports = {
  getBalance,
  credit,
  debit,
  transfer,
  getTransactionsByUser,
};
