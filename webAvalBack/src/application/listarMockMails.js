const mockMailsRepo = require("../infrastructure/repositories/mockMailsRepository");

async function listarMockMails() {
  const mails = await mockMailsRepo.listarMockMails();
  return { ok: true, mails };
}

module.exports = { listarMockMails };