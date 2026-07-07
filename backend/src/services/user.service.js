// services/user.service.js
import * as userRepo from '../repositories/user.repository.js';

function throwError(message, statusCode = 400) {
  const err = new Error(message);
  err.statusCode = statusCode;
  throw err;
}

export async function getProfile(uid) {
  const user = await userRepo.findById(uid);
  if (!user) {
    throwError('User tidak ditemukan', 404);
  }
  return {
    user: {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      status: user.status || 'active',
    },
    credits: {
      remaining: user.creditRemaining || 0,
      limit: user.creditLimit || 240,
    },
  };
}

export async function list(uid) {
  // Untuk MVP, semua user bisa melihat daftar pengguna.
  // Nantinya bisa ditambahkan pengecekan role admin.
  const users = await userRepo.findAll();
  return users;
}

export async function resetCredits(requestorUid, targetUid) {
  // Hanya boleh mereset kredit sendiri, kecuali admin (fitur admin belum diimplementasikan)
  // Untuk MVP, izinkan mereset diri sendiri.
  if (requestorUid !== targetUid) {
    // TODO: periksa apakah requestorUid adalah admin
    throwError('Forbidden: Anda hanya dapat mereset kredit Anda sendiri.', 403);
  }

  const target = await userRepo.findById(targetUid);
  if (!target) {
    throwError('User tidak ditemukan', 404);
  }

  const creditLimit = target.creditLimit || 240;
  await userRepo.update(targetUid, {
    creditRemaining: creditLimit,
    status: 'active',
  });

  return { success: true };
}