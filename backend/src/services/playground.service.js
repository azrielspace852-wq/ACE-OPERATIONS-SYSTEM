// services/playground.service.js
import * as instanceRepo from '../repositories/instance.repository.js';
import * as userRepo from '../repositories/user.repository.js';
import * as aiProvider from '../providers/ai.provider.js';

function throwError(message, statusCode = 400) {
  const err = new Error(message);
  err.statusCode = statusCode;
  throw err;
}

export async function chat(uid, messages, instanceSlug) {
  // 1. Ambil data user untuk cek kredit
  const user = await userRepo.findById(uid);
  if (!user) {
    throwError('User tidak ditemukan', 404);
  }

  const remaining = user.creditRemaining || 0;
  if (remaining <= 0) {
    throwError('Kredit habis. Silakan reset kredit Anda.', 429);
  }

  // 2. Cari instance AI
  let instance;
  if (instanceSlug && instanceSlug !== 'default') {
    instance = await instanceRepo.findBySlug(uid, instanceSlug);
  }
  if (!instance) {
    // Fallback ke instance pertama milik user
    const instances = await instanceRepo.findByUser(uid);
    instance = instances[0] || null;
  }
  if (!instance) {
    throwError('Tidak ada instance AI. Silakan buat instance terlebih dahulu.', 400);
  }

  // 3. Pilih API key dengan round‑robin murni
  const keys = instance.apiKeys || [];
  const activeKeys = keys.filter(k => k.status === 'active');
  if (activeKeys.length === 0) {
    throwError('Tidak ada API key aktif untuk instance ini.', 400);
  }

  // Ambil lastUsedIndex, default 0
  let lastIndex = instance.lastUsedIndex !== undefined ? instance.lastUsedIndex : -1;
  const nextIndex = (lastIndex + 1) % activeKeys.length;
  const selectedKey = activeKeys[nextIndex];

  // Periksa daily limit
  if ((selectedKey.usageToday || 0) >= (selectedKey.dailyLimit || 1000)) {
    selectedKey.status = 'limit';
    // Update instance agar key yang sudah limit tersimpan statusnya
    await instanceRepo.update(instance.id, { apiKeys: keys });
    throwError(`API key "${selectedKey.label}" telah mencapai batas harian.`, 429);
  }

  try {
    // 4. Kirim chat ke AI provider
    const reply = await aiProvider.chat({
      provider: instance.provider,
      model: instance.model,
      apiKey: selectedKey.key,
      messages,
      systemPrompt: instance.systemPrompt || '',
      temperature: instance.temperature || 0.7,
      maxTokens: instance.maxTokens || 4096,
    });

    // 5. Chat sukses → update usage & kurangi kredit
    // Update usageToday untuk key yang digunakan
    const updatedKeys = keys.map(k => {
      if (k.label === selectedKey.label) {
        return { ...k, usageToday: (k.usageToday || 0) + 1 };
      }
      return k;
    });

    // Update lastUsedIndex dan apiKeys di instance
    await instanceRepo.update(instance.id, {
      apiKeys: updatedKeys,
      lastUsedIndex: nextIndex,
    });

    // Kurangi kredit user
    await userRepo.update(uid, {
      creditRemaining: remaining - 1,
    });

    return reply;
  } catch (err) {
    // Jika AI provider gagal, jangan kurangi kredit
    console.error('AI Chat error:', err);
    const errorMsg = err.message || 'Gagal menghubungi AI provider';
    // Bedakan error network atau provider
    if (err.message.includes('fetch') || err.message.includes('network')) {
      throwError('Network error: Tidak dapat terhubung ke provider AI.', 502);
    }
    throwError('AI service error: ' + errorMsg, 500);
  }
}