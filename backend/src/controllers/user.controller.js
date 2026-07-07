// controllers/user.controller.js
import * as userService from '../services/user.service.js';

function throwError(message, statusCode = 400) {
  const err = new Error(message);
  err.statusCode = statusCode;
  throw err;
}

export async function profile(req, user) {
  if (!user || !user.uid) {
    throwError('Unauthorized: User tidak ditemukan', 401);
  }

  try {
    const profile = await userService.getProfile(user.uid);
    return profile;
  } catch (serviceErr) {
    const err = new Error(serviceErr.message || 'Gagal memuat profil');
    err.statusCode = serviceErr.statusCode || 500;
    throw err;
  }
}

export async function list(req, user) {
  if (!user || !user.uid) {
    throwError('Unauthorized: User tidak ditemukan', 401);
  }

  // Untuk MVP, semua user bisa melihat daftar pengguna.
  // Nanti bisa ditambah role admin.
  try {
    const users = await userService.list(user.uid);
    return { users };
  } catch (serviceErr) {
    const err = new Error(serviceErr.message || 'Gagal memuat daftar pengguna');
    err.statusCode = serviceErr.statusCode || 500;
    throw err;
  }
}

export async function reset(req, user, params) {
  if (!user || !user.uid) {
    throwError('Unauthorized: User tidak ditemukan', 401);
  }

  const { id } = params; // id pengguna yang akan direset kreditnya
  if (!id) {
    throwError('User ID diperlukan', 400);
  }

  // Opsional: admin check. Untuk saat ini, izinkan user mereset kreditnya sendiri,
  // atau kita bisa tambahkan pengecekan role admin di sini.
  // if (user.uid !== id && user.role !== 'admin') {
  //   throwError('Forbidden: Hanya admin yang dapat mereset kredit pengguna lain', 403);
  // }

  try {
    await userService.resetCredits(user.uid, id);
    return { success: true };
  } catch (serviceErr) {
    const err = new Error(serviceErr.message || 'Gagal mereset kredit');
    err.statusCode = serviceErr.statusCode || 500;
    throw err;
  }
}