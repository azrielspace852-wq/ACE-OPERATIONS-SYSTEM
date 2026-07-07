// controllers/instance.controller.js
import * as instanceService from '../services/instance.service.js';

// Helper untuk membuat error terstruktur
function throwError(message, statusCode = 400) {
  const err = new Error(message);
  err.statusCode = statusCode;
  throw err;
}

export async function list(req, user) {
  if (!user || !user.uid) {
    throwError('Unauthorized: User tidak ditemukan', 401);
  }
  const instances = await instanceService.list(user.uid);
  return { instances };
}

export async function create(req, user) {
  if (!user || !user.uid) {
    throwError('Unauthorized: User tidak ditemukan', 401);
  }

  const { name, provider, model, systemPrompt, temperature, maxTokens, status, apiKeys, rotationStrategy, slug } = req.body;
  if (!name) {
    throwError('Nama instance diperlukan', 400);
  }

  const instance = await instanceService.create(user.uid, {
    name,
    slug: slug || name.toLowerCase().replace(/\s+/g, '-'),
    provider: provider || 'groq',
    model: model || 'mixtral-8x7b-32768',
    systemPrompt: systemPrompt || '',
    temperature: temperature || 0.7,
    maxTokens: maxTokens || 4096,
    status: status || 'active',
    apiKeys: apiKeys || [],
    rotationStrategy: rotationStrategy || 'round_robin',
  });
  return { instance };
}

export async function update(req, user, params) {
  if (!user || !user.uid) {
    throwError('Unauthorized: User tidak ditemukan', 401);
  }
  const { id } = params;
  if (!id) {
    throwError('Instance ID diperlukan', 400);
  }

  const updated = await instanceService.update(user.uid, id, req.body);
  return updated; // Mengembalikan instance yang telah diperbarui
}

export async function deleteDoc(req, user, params) {
  if (!user || !user.uid) {
    throwError('Unauthorized: User tidak ditemukan', 401);
  }
  const { id } = params;
  if (!id) {
    throwError('Instance ID diperlukan', 400);
  }

  await instanceService.deleteDoc(user.uid, id);
  return { success: true };
}