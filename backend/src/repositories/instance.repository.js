// repositories/instance.repository.js
import admin from 'firebase-admin';
const db = admin.firestore();

/**
 * Firestore Composite Index Recommendation:
 * Collection: instances
 * Fields: userId (ASC), createdAt (DESC)
 * 
 * Buat index ini di Firebase Console:
 * 1. Buka Firestore Database > Indexes
 * 2. Tambahkan composite index:
 *    - Field: userId, order: ascending
 *    - Field: createdAt, order: descending
 */

function throwError(message, statusCode = 500) {
  const err = new Error(message);
  err.statusCode = statusCode;
  throw err;
}

export async function create(uid, data) {
  const now = new Date();
  const ref = await db.collection('instances').add({
    userId: uid,
    ...data,
    createdAt: now,
    updatedAt: now,
  });
  const doc = await ref.get();
  return { id: ref.id, ...doc.data() };
}

export async function findByUser(uid) {
  try {
    const snap = await db.collection('instances')
      .where('userId', '==', uid)
      .orderBy('createdAt', 'desc')
      .get();
    const list = [];
    snap.forEach(doc => list.push({ id: doc.id, ...doc.data() }));
    return list;
  } catch (err) {
    if (err.message && err.message.includes('requires an index')) {
      console.warn('Firestore index not ready, falling back to unordered query');
      const snap = await db.collection('instances')
        .where('userId', '==', uid)
        .get();
      const list = [];
      snap.forEach(doc => list.push({ id: doc.id, ...doc.data() }));
      return list;
    }
    console.error('findByUser error:', err);
    throwError('Gagal mengambil daftar instance', 500);
  }
}

export async function findBySlug(uid, slug) {
  const snap = await db.collection('instances')
    .where('userId', '==', uid)
    .where('slug', '==', slug)
    .limit(1)
    .get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  return { id: doc.id, ...doc.data() };
}

export async function findById(id) {
  try {
    const doc = await db.collection('instances').doc(id).get();
    return doc.exists ? { id: doc.id, ...doc.data() } : null;
  } catch (err) {
    console.error('findById error:', err);
    return null;
  }
}

export async function update(id, data) {
  const updateData = { ...data, updatedAt: new Date() };
  // Hindari overwrite field yang tidak boleh diubah
  delete updateData.id;
  delete updateData.userId;
  delete updateData.createdAt;
  await db.collection('instances').doc(id).update(updateData);
}

export async function deleteDoc(id) {
  await db.collection('instances').doc(id).delete();
}

// Fungsi yang lebih sederhana: terima apiKeys yang sudah dimodifikasi
export async function updateUsage(id, apiKeys, lastUsedIndex) {
  const updateData = {
    apiKeys,
    updatedAt: new Date(),
  };
  if (lastUsedIndex !== undefined) {
    updateData.lastUsedIndex = lastUsedIndex;
  }
  await db.collection('instances').doc(id).update(updateData);
}