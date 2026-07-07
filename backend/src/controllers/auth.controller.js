// controllers/auth.controller.js
import * as authService from '../services/auth.service.js';

export async function verify(req) {
  const { token } = req.body;

  if (!token || typeof token !== 'string') {
    const err = new Error('Token diperlukan dan harus berupa string');
    err.statusCode = 400;
    throw err;
  }

  try {
    return await authService.verify(token);
  } catch (serviceErr) {
    // Teruskan error dari service, pastikan statusCode ada
    const err = new Error(serviceErr.message || 'Verifikasi token gagal');
    err.statusCode = serviceErr.statusCode || 401;
    throw err;
  }
}