// controllers/playground.controller.js
import * as playgroundService from '../services/playground.service.js';

function throwError(message, statusCode = 400) {
  const err = new Error(message);
  err.statusCode = statusCode;
  throw err;
}

export async function chat(req, user) {
  if (!user || !user.uid) {
    throwError('Unauthorized: User tidak ditemukan', 401);
  }

  const { messages, instance } = req.body;

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    throwError('Messages harus berupa array dan tidak boleh kosong', 400);
  }

  // Instance bisa 'default' atau slug dari instance yang sudah dikonfigurasi
  const instanceSlug = instance || 'default';

  try {
    const reply = await playgroundService.chat(user.uid, messages, instanceSlug);
    return { reply };
  } catch (serviceErr) {
    const err = new Error(serviceErr.message || 'Gagal memproses chat');
    err.statusCode = serviceErr.statusCode || 500;
    throw err;
  }
}