// controllers/knowledge.controller.js
import * as knowledgeService from '../services/knowledge.service.js';

function throwError(message, statusCode = 400) {
  const err = new Error(message);
  err.statusCode = statusCode;
  throw err;
}

export async function list(req, user) {
  if (!user || !user.uid) {
    throwError('Unauthorized: User tidak ditemukan', 401);
  }
  const knowledge = await knowledgeService.list(user.uid);
  return { knowledge };
}

export async function create(req, user) {
  if (!user || !user.uid) {
    throwError('Unauthorized: User tidak ditemukan', 401);
  }

  const { title, content, type } = req.body;
  if (!title) {
    throwError('Judul pengetahuan diperlukan', 400);
  }
  if (!content) {
    throwError('Konten pengetahuan diperlukan', 400);
  }

  const knowledge = await knowledgeService.create(user.uid, {
    title,
    content,
    type: type || 'Umum',
  });
  return { knowledge };
}

export async function deleteDoc(req, user, params) {
  if (!user || !user.uid) {
    throwError('Unauthorized: User tidak ditemukan', 401);
  }

  const { id } = params;
  if (!id) {
    throwError('Knowledge ID diperlukan', 400);
  }

  await knowledgeService.deleteDoc(user.uid, id);
  return { success: true };
}