// 数据层：句子切分、锚点计算与笔记操作。全部为纯函数，不触碰存储与界面。

export const NOTE_STATUS = { ANCHORED: 'anchored', PENDING: 'pending', ENTRY: 'entry' };

let seq = 0;
export function uid(prefix = 'n') {
  seq += 1;
  return `${prefix}-${Date.now().toString(36)}-${seq.toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

// 中英文句末标点与换行都视为句子边界，标点保留在句尾。
const SENTENCE_END = new Set(['。', '！', '？', '!', '?', '；', ';', '…', '\n']);

export function splitSentences(text) {
  const out = [];
  let buf = '';
  for (const ch of String(text ?? '')) {
    buf += ch;
    if (SENTENCE_END.has(ch)) {
      const s = buf.trim();
      if (s) out.push(s);
      buf = '';
    }
  }
  const tail = buf.trim();
  if (tail) out.push(tail);
  return out;
}

export const normalizeSentence = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
export const normalizeText = normalizeSentence;

export function notesOfEntry(notes, entryId) {
  return notes.filter((n) => n.entryId === entryId);
}

// 在句子列表中定位原句：优先原位置，其次全表精确匹配。返回下标或 -1。
export function locateSentence(sentences, sentence, preferIndex = -1) {
  const target = normalizeSentence(sentence);
  if (!target) return -1;
  if (preferIndex >= 0 && preferIndex < sentences.length && normalizeSentence(sentences[preferIndex]) === target) {
    return preferIndex;
  }
  return sentences.findIndex((s) => normalizeSentence(s) === target);
}

// 保存摘要前的预演：哪些已锚定笔记能跟随原句，哪些将失去锚点。
// 只检查精确匹配的原句，绝不做模糊猜测。
export function planAbstractSave(entry, notes, newAbstract) {
  const sentences = splitSentences(newAbstract);
  const reanchored = []; // { noteId, fromIndex, toIndex } 原句仍在，跟随更新位置
  const affected = []; // 找不到原句、将进入待重定位的笔记
  for (const note of notes) {
    if (note.entryId !== entry.id || note.status !== NOTE_STATUS.ANCHORED) continue;
    const toIndex = locateSentence(sentences, note.sentence, note.sentenceIndex);
    if (toIndex >= 0) {
      reanchored.push({ noteId: note.id, fromIndex: note.sentenceIndex, toIndex });
    } else {
      affected.push(note);
    }
  }
  return { sentences, reanchored, affected };
}

// 应用摘要保存：版本 +1；原句仍在的笔记跟随原句更新位置与版本；
// 找不到原句的进入待重定位，保留原句、原位置与锚定版本快照，绝不自动挪到新位置。
export function applyAbstractSave(state, entryId, newAbstract) {
  const entry = state.items.find((x) => x.id === entryId);
  if (!entry) return { state, plan: null, version: null };
  const abstract = String(newAbstract ?? '').trim();
  const plan = planAbstractSave(entry, state.notes, abstract);
  const version = (entry.abstractVersion || 1) + 1;
  const moved = new Map(plan.reanchored.map((r) => [r.noteId, r.toIndex]));
  const notes = state.notes.map((n) => {
    if (n.entryId !== entryId || n.status !== NOTE_STATUS.ANCHORED) return n;
    if (moved.has(n.id)) {
      return { ...n, sentenceIndex: moved.get(n.id), abstractVersion: version, updatedAt: Date.now() };
    }
    return { ...n, status: NOTE_STATUS.PENDING, updatedAt: Date.now() };
  });
  const items = state.items.map((x) => (x.id === entryId ? { ...x, abstract, abstractVersion: version } : x));
  return { state: { ...state, items, notes }, plan, version };
}

// 新增笔记：同一条目、同一原句、同一文本的重复摘录只累加 refs，不新建副本。
export function addNote(state, { entryId, text, sentence = null, sentenceIndex = null }) {
  const entry = state.items.find((x) => x.id === entryId);
  const clean = normalizeText(text);
  if (!entry || !clean) return { state, note: null, merged: false };

  const isEntryNote = sentence == null;
  let canonical = null;
  let index = null;
  if (!isEntryNote) {
    // 锚定笔记必须以当前摘要中的原句为准；原句不在当前摘要中则拒绝锚定。
    const sentences = splitSentences(entry.abstract);
    index = locateSentence(sentences, sentence, Number.isInteger(sentenceIndex) ? sentenceIndex : -1);
    if (index < 0) return { state, note: null, merged: false };
    canonical = sentences[index];
  }
  const normSentence = isEntryNote ? null : normalizeSentence(canonical);
  const dup = state.notes.find(
    (n) =>
      n.entryId === entryId &&
      n.status === (isEntryNote ? NOTE_STATUS.ENTRY : NOTE_STATUS.ANCHORED) &&
      (isEntryNote ? n.sentence == null : normalizeSentence(n.sentence) === normSentence) &&
      normalizeText(n.text) === clean
  );
  if (dup) {
    const refs = (dup.refs || 1) + 1;
    const notes = state.notes.map((n) => (n.id === dup.id ? { ...n, refs, updatedAt: Date.now() } : n));
    return { state: { ...state, notes }, note: { ...dup, refs }, merged: true };
  }
  const note = {
    id: uid('note'),
    entryId,
    status: isEntryNote ? NOTE_STATUS.ENTRY : NOTE_STATUS.ANCHORED,
    sentence: canonical,
    sentenceIndex: index,
    abstractVersion: isEntryNote ? null : entry.abstractVersion || 1,
    text: clean,
    refs: 1,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  return { state: { ...state, notes: [...state.notes, note] }, note, merged: false };
}

// 手动重定位：只有用户显式选择当前摘要中的一句，待重定位笔记才允许离开该状态。
// 若目标句下已有相同文本的锚定笔记，则合并引用次数，不产生副本。
export function relocateNote(state, noteId, sentenceIndex) {
  const note = state.notes.find((n) => n.id === noteId);
  if (!note || note.status !== NOTE_STATUS.PENDING) return { state, merged: false };
  const entry = state.items.find((x) => x.id === note.entryId);
  if (!entry) return { state, merged: false };
  const sentences = splitSentences(entry.abstract);
  const sentence = sentences[sentenceIndex];
  if (sentence == null) return { state, merged: false };
  const norm = normalizeSentence(sentence);
  const twin = state.notes.find(
    (n) =>
      n.id !== noteId &&
      n.entryId === note.entryId &&
      n.status === NOTE_STATUS.ANCHORED &&
      normalizeSentence(n.sentence) === norm &&
      normalizeText(n.text) === normalizeText(note.text)
  );
  if (twin) {
    const notes = state.notes
      .filter((n) => n.id !== noteId)
      .map((n) => (n.id === twin.id ? { ...n, refs: (n.refs || 1) + (note.refs || 1), updatedAt: Date.now() } : n));
    return { state: { ...state, notes }, merged: true };
  }
  const notes = state.notes.map((n) =>
    n.id === noteId
      ? {
          ...n,
          status: NOTE_STATUS.ANCHORED,
          sentence,
          sentenceIndex,
          abstractVersion: entry.abstractVersion || 1,
          updatedAt: Date.now(),
        }
      : n
  );
  return { state: { ...state, notes }, merged: false };
}

export function removeNote(state, noteId) {
  return { ...state, notes: state.notes.filter((n) => n.id !== noteId) };
}
