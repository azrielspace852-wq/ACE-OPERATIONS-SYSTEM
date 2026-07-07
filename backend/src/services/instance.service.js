// services/instance.service.js
import * as instanceRepo from '../repositories/instance.repository.js';

function throwError(message, statusCode = 400) {
  const err = new Error(message);
  err.statusCode = statusCode;
  throw err;
}

export async function list(uid) {
  return instanceRepo.findByUser(uid);
}

export async function create(uid, data) {
  // Validasi input
  if (!data.name) {
    throwError('Nama instance diperlukan', 400);
  }
  if (!data.provider) {
    throwError('Provider diperlukan', 400);
  }
  if (!data.apiKeys || data.apiKeys.length === 0) {
    throwError('Minimal satu API Key diperlukan', 400);
  }

  // Pastikan setiap API key memiliki field yang lengkap
  const apiKeys = data.apiKeys.map(k => ({
    label: k.label,
    key: k.key,
    status: k.status || 'active',
    dailyLimit: k.dailyLimit || 1000,
    usageToday: k.usageToday || 0,
  }));

  const instance = await instanceRepo.create(uid, { ...data, apiKeys });
  return instance;
}

export async function update(uid, id, data) {
  const inst = await instanceRepo.findById(id);
  if (!inst) {
    throwError('Instance tidak ditemukan', 404);
  }
  if (inst.userId !== uid) {
    throwError('Unauthorized: Anda tidak memiliki instance ini', 403);
  }

  // Sanitasi data: hapus field yang tidak boleh diubah langsung
  const updateData = { ...data };
  delete updateData.userId;
  delete updateData.createdAt;
  delete updateData.id;

  await instanceRepo.update(id, updateData);

  // Kembalikan data terbaru setelah update
  const updated = await instanceRepo.findById(id);
  return { instance: updated };
}

export async function deleteDoc(uid, id) {
  const inst = await instanceRepo.findById(id);
  if (!inst) {
    throwError('Instance tidak ditemukan', 404);
  }
  if (inst.userId !== uid) {
    throwError('Unauthorized: Anda tidak memiliki instance ini', 403);
  }

  await instanceRepo.deleteDoc(id);
  return { success: true };
}