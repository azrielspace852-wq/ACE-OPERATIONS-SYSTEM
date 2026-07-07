// services/knowledge.service.js
import * as knowledgeRepo from '../repositories/knowledge.repository.js';

function throwError(message, statusCode = 400) {
  const err = new Error(message);
  err.statusCode = statusCode;
  throw err;
}

export async function list(uid) {
  return knowledgeRepo.findByUser(uid);
}

export async function create(uid, data) {
  if (!data.title) {
    throwError('Judul pengetahuan diperlukan', 400);
  }
  if (!data.content) {
    throwError('Konten pengetahuan diperlukan', 400);
  }

  const knowledge = await knowledgeRepo.create(uid, {
    title: data.title,
    content: data.content,
    type: data.type || 'Umum',
  });
  return knowledge;
}

export async function deleteDoc(uid, id) {
  const kb = await knowledgeRepo.findById(id);
  if (!kb) {
    throwError('Pengetahuan tidak ditemukan', 404);
  }
  if (kb.userId !== uid) {
    throwError('Unauthorized: Anda tidak memiliki entri pengetahuan ini', 403);
  }

  await knowledgeRepo.deleteDoc(id);
  return { success: true };
}