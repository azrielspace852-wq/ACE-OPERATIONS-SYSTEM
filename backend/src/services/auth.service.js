// services/auth.service.js
import admin from 'firebase-admin';
import * as userRepo from '../repositories/user.repository.js';

function throwError(message, statusCode = 400) {
  const err = new Error(message);
  err.statusCode = statusCode;
  throw err;
}

export async function verify(token) {
  // Verifikasi token Firebase
  let decoded;
  try {
    decoded = await admin.auth().verifyIdToken(token);
  } catch (err) {
    if (err.code === 'auth/id-token-expired') {
      throwError('Token expired', 403);
    } else if (err.code === 'auth/id-token-revoked') {
      throwError('Token revoked', 403);
    } else {
      throwError('Token tidak valid', 401);
    }
  }

  const uid = decoded.uid;

  // Cari atau buat user di Firestore
  let user = await userRepo.findById(uid);
  if (!user) {
    // Dapatkan info dari Firebase Auth
    let email = '';
    let displayName = '';
    try {
      const userRecord = await admin.auth().getUser(uid);
      email = userRecord.email || '';
      displayName = userRecord.displayName || email || 'User';
    } catch (err) {
      // Jika gagal mengambil info, gunakan default
      email = decoded.email || '';
      displayName = decoded.name || email || 'User';
    }

    const newUser = {
      uid,
      email,
      displayName,
      creditLimit: 240,
      creditRemaining: 240,
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await userRepo.create(uid, newUser);
    user = newUser;
  } else {
    // Pastikan field kredit ada; jika tidak, inisialisasi
    if (user.creditRemaining === undefined || user.creditRemaining === null) {
      user.creditRemaining = user.creditLimit || 240;
      await userRepo.update(uid, { creditRemaining: user.creditRemaining });
    }
  }

  return {
    user: {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
    },
    credits: {
      remaining: user.creditRemaining || 0,
      limit: user.creditLimit || 240,
    },
  };
}