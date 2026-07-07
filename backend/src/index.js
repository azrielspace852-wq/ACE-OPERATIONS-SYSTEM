// index.js
import admin from 'firebase-admin';
import { authenticate } from './middlewares/auth.js';
import * as authCtrl from './controllers/auth.controller.js';
import * as instanceCtrl from './controllers/instance.controller.js';
import * as knowledgeCtrl from './controllers/knowledge.controller.js';
import * as userCtrl from './controllers/user.controller.js';
import * as playgroundCtrl from './controllers/playground.controller.js';

let adminInitialized = false;

// Simple in-memory cache for GET requests
const cache = new Map();
const CACHE_TTL = 60 * 1000; // 1 menit

function getCacheKey(path, userId) {
  return `${userId}:${path}`;
}

function getCached(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(key, data) {
  cache.set(key, { data, timestamp: Date.now() });
}

function clearCache(userId, pathPrefix = '') {
  for (const key of cache.keys()) {
    if (key.startsWith(`${userId}:${pathPrefix}`)) {
      cache.delete(key);
    }
  }
}

// Helper to build consistent JSON responses with CORS
function jsonResponse(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      ...extraHeaders,
    },
  });
}

function success(data) {
  return { success: true, data };
}

function error(err, status = 500) {
  const msg = err.message || 'Internal server error';
  return {
    success: false,
    error: { code: status, message: msg },
  };
}

function matchRoute(path, pattern) {
  const pParts = pattern.split('/');
  const pathParts = path.split('/');
  if (pParts.length !== pathParts.length) return null;
  const params = {};
  for (let i = 0; i < pParts.length; i++) {
    if (pParts[i].startsWith(':')) {
      params[pParts[i].slice(1)] = pathParts[i];
    } else if (pParts[i] !== pathParts[i]) {
      return null;
    }
  }
  return params;
}

const routes = [
  { method: 'POST', path: '/api/v1/auth/verify', handler: authCtrl.verify, public: true },
  { method: 'GET', path: '/api/v1/instances', handler: instanceCtrl.list, cacheable: true },
  { method: 'POST', path: '/api/v1/instances', handler: instanceCtrl.create },
  { method: 'PUT', path: '/api/v1/instances/:id', handler: instanceCtrl.update },
  { method: 'DELETE', path: '/api/v1/instances/:id', handler: instanceCtrl.deleteDoc },
  { method: 'GET', path: '/api/v1/knowledge', handler: knowledgeCtrl.list, cacheable: true },
  { method: 'POST', path: '/api/v1/knowledge', handler: knowledgeCtrl.create },
  { method: 'DELETE', path: '/api/v1/knowledge/:id', handler: knowledgeCtrl.deleteDoc },
  { method: 'GET', path: '/api/v1/users', handler: userCtrl.list, cacheable: true },
  { method: 'POST', path: '/api/v1/users/:id/reset', handler: userCtrl.reset },
  { method: 'POST', path: '/api/v1/playground/chat', handler: playgroundCtrl.chat },
  { method: 'GET', path: '/api/v1/user/profile', handler: userCtrl.profile, cacheable: true },
];

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // CORS preflight
    if (method === 'OPTIONS') {
      return jsonResponse(null, 204);
    }

    // Init Firebase Admin (singleton)
    if (!adminInitialized) {
      try {
        const serviceAccount = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT);
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
        });
        adminInitialized = true;
      } catch (e) {
        console.error('Firebase init error:', e);
        return jsonResponse(error(new Error('Firebase initialization failed: ' + e.message), 500), 500);
      }
    }

    // Route matching
    let matched = null;
    let params = {};
    for (const route of routes) {
      if (route.method !== method) continue;
      const result = matchRoute(path, route.path);
      if (result !== null) {
        matched = route;
        params = result;
        break;
      }
    }

    if (!matched) {
      return jsonResponse(error(new Error('Not Found'), 404), 404);
    }

    try {
      // Authentication (kecuali route public)
      let user = null;
      if (!matched.public) {
        try {
          user = await authenticate(request.headers);
        } catch (authErr) {
          // Gunakan statusCode dari error jika ada
          const statusCode = authErr.statusCode || 401;
          return jsonResponse(error(new Error(authErr.message), statusCode), statusCode);
        }
      }

      // Cache check for GET
      const cacheKey = user ? getCacheKey(path, user.uid) : path;
      if (matched.cacheable && method === 'GET') {
        const cached = getCached(cacheKey);
        if (cached) {
          return jsonResponse(success(cached), 200, { 'X-Cache': 'HIT' });
        }
      }

      // Parse request body
      let body = {};
      if (method === 'POST' || method === 'PUT') {
        try {
          body = await request.json();
        } catch (_) {
          body = {};
        }
      }

      const req = { body, params, headers: request.headers };
      const result = await matched.handler(req, user, params);

      // Cache result for GET
      if (matched.cacheable && method === 'GET' && result) {
        setCache(cacheKey, result);
      }

      // Invalidate cache on mutations (POST/PUT/DELETE)
      if (method === 'POST' || method === 'PUT' || method === 'DELETE') {
        if (user) {
          // Clear all cache for this user (or you can scope by collection prefix)
          clearCache(user.uid);
          // Optional: clear specific path prefix if needed
          // const prefix = path.split('/')[3] || ''; // instances, knowledge, etc.
          // clearCache(user.uid, `/${prefix}`);
        }
      }

      return jsonResponse(success(result), 200, { 'X-Cache': 'MISS' });
    } catch (err) {
      console.error('API Error:', err);
      // Determine status code from error or fallback to generic mapping
      let statusCode = err.statusCode || 500;
      if (!err.statusCode) {
        if (err.message.includes('Unauthorized') || err.message.includes('Missing authorization')) {
          statusCode = 401;
        } else if (err.message.includes('Token expired') || err.message.includes('revoked')) {
          statusCode = 403;
        } else if (err.message.includes('not found') || err.message.includes('NotFound')) {
          statusCode = 404;
        } else if (err.message.includes('Kredit') || err.message.includes('credit')) {
          statusCode = 429;
        }
      }

      return jsonResponse(error(err, statusCode), statusCode);
    }
  },
};