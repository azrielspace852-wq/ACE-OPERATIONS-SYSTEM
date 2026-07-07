// middlewares/auth.js
import admin from 'firebase-admin';

/**
 * Authenticate request using Bearer token
 * @param {Headers} headers - Request headers
 * @returns {Promise<Object>} Decoded Firebase user
 * @throws {Object} Error with statusCode and message
 */
export async function authenticate(headers) {
  const authHeader = headers.get('authorization') || headers.get('Authorization') || '';
  const token = authHeader.replace('Bearer ', '');

  if (!token) {
    const err = new Error('Missing authorization token');
    err.statusCode = 401;
    throw err;
  }

  try {
    const decoded = await admin.auth().verifyIdToken(token);
    return decoded;
  } catch (err) {
    const authError = new Error();
    
    if (err.code === 'auth/id-token-expired') {
      authError.message = 'Token expired';
      authError.statusCode = 403;
    } else if (err.code === 'auth/id-token-revoked') {
      authError.message = 'Token revoked';
      authError.statusCode = 403;
    } else {
      authError.message = 'Invalid token';
      authError.statusCode = 401;
    }
    
    throw authError;
  }
}