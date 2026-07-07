// repositories/knowledge.repository.js
import admin from 'firebase-admin';
const db = admin.firestore();

export async function create(uid, data) {
  const now = new Date();
  const ref = await db.collection('knowledge').add({
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
    const snap = await db.collection('knowledge')
      .where('userId', '==', uid)
      .orderBy('createdAt', 'desc')
      .get();
    const list = [];
    snap.forEach(doc => list.push({ id: doc.id, ...doc.data() }));
    return list;
  } catch (err) {
    if (err.message && err.message.includes('requires an index')) {
      console.warn('Knowledge index not ready, falling back to unordered query');
      const snap = await db.collection('knowledge')
        .where('userId', '==', uid)
        .get();
      const list = [];
      snap.forEach(doc => list.push({ id: doc.id, ...doc.data() }));
      return list;
    }
    console.error('findByUser knowledge error:', err);
    throw err;
  }
}

export async function findById(id) {
  try {
    const doc = await db.collection('knowledge').doc(id).get();
    return doc.exists ? { id: doc.id, ...doc.data() } : null;
  } catch (err) {
    console.error('findById knowledge error:', err);
    return null;
  }
}

export async function deleteDoc(id) {
  await db.collection('knowledge').doc(id).delete();
}