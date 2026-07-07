// repositories/user.repository.js
import admin from 'firebase-admin';
const db = admin.firestore();

export async function findById(uid) {
  try {
    const doc = await db.collection('users').doc(uid).get();
    return doc.exists ? { id: doc.id, ...doc.data() } : null;
  } catch (err) {
    console.error('findById user error:', err);
    return null;
  }
}

export async function create(uid, data) {
  const now = new Date();
  const userData = {
    ...data,
    uid: uid, // pastikan uid sesuai parameter
    createdAt: data.createdAt || now,
    updatedAt: now,
  };
  // Hapus id jika ada (Firestore doc id = uid)
  delete userData.id;
  
  await db.collection('users').doc(uid).set(userData);
  return findById(uid);
}

export async function update(uid, data) {
  const updateData = {
    ...data,
    updatedAt: new Date(),
  };
  // Field yang tidak boleh diubah
  delete updateData.uid;
  delete updateData.id;
  delete updateData.createdAt;
  
  await db.collection('users').doc(uid).update(updateData);
}

export async function findAll() {
  try {
    const snap = await db.collection('users').get();
    const list = [];
    snap.forEach(doc => list.push({ id: doc.id, ...doc.data() }));
    return list;
  } catch (err) {
    console.error('findAll users error:', err);
    return [];
  }
}