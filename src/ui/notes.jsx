// 界面层：摘要句子列表、锚定笔记、待重定位与整篇笔记的展示与交互。
import React, { useState } from 'react';
import { NOTE_STATUS, splitSentences } from '../lib/model.js';

function NoteEditor({ placeholder, onSave, onCancel }) {
  const [text, setText] = useState('');
  return (
    <div className="note-editor">
      <textarea
        autoFocus
        rows="2"
        placeholder={placeholder}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="row-end">
        <button className="mini" onClick={onCancel}>取消</button>
        <button className="mini solid" onClick={() => text.trim() && onSave(text)}>保存笔记</button>
      </div>
    </div>
  );
}

// 删除需二次确认，避免误触。
function DeleteButton({ onDelete }) {
  const [armed, setArmed] = useState(false);
  return (
    <button
      className={'note-del' + (armed ? ' armed' : '')}
      onClick={() => (armed ? onDelete() : setArmed(true))}
      onBlur={() => setArmed(false)}
    >
      {armed ? '确认删除？' : '删除'}
    </button>
  );
}

function NoteMeta({ children, note, onRemove }) {
  return (
    <div className="note-meta">
      {children}
      {note.refs > 1 && <span className="refs">摘录 ×{note.refs}</span>}
      <DeleteButton onDelete={() => onRemove(note.id)} />
    </div>
  );
}

// 摘要区：按句渲染，句旁挂载锚定笔记；找不到原句的笔记单独进入待重定位区。
export function AbstractSection({ entry, notes, onAddNote, onRemoveNote, onRelocate, onEditAbstract }) {
  const [addingAt, setAddingAt] = useState(null); // 句子下标
  const [relocating, setRelocating] = useState(null); // 待重定位笔记 id
  const sentences = splitSentences(entry.abstract);
  const anchored = notes.filter((n) => n.status === NOTE_STATUS.ANCHORED);
  const pending = notes.filter((n) => n.status === NOTE_STATUS.PENDING);
  const bySentence = new Map();
  for (const n of anchored) {
    const list = bySentence.get(n.sentenceIndex) || [];
    list.push(n);
    bySentence.set(n.sentenceIndex, list);
  }

  return (
    <>
      <div className="detail-section">
        <h4>
          摘要 <span>ABSTRACT · v{entry.abstractVersion}</span>
          <span className="h4-spacer" />
          <button className="h4-btn" onClick={onEditAbstract}>✎ 编辑摘要</button>
        </h4>
        <div className="sent-list">
          {sentences.map((s, i) => {
            const list = bySentence.get(i) || [];
            return (
              <div className="sent-block" key={i}>
                <div className={'sent' + (list.length ? ' has-notes' : '')}>
                  <span className="sent-idx">#{i + 1}</span>
                  <p>{s}</p>
                  <span className="sent-tools">
                    {list.length > 0 && <span className="note-badge">{list.length} 条笔记</span>}
                    <button className="mini" onClick={() => setAddingAt(addingAt === i ? null : i)}>＋ 笔记</button>
                  </span>
                </div>
                {list.map((n) => (
                  <div className="note-card" key={n.id}>
                    <p>{n.text}</p>
                    <NoteMeta note={n} onRemove={onRemoveNote}>
                      <span>锚定 v{n.abstractVersion} · #{n.sentenceIndex + 1}</span>
                    </NoteMeta>
                  </div>
                ))}
                {addingAt === i && (
                  <NoteEditor
                    placeholder="为这句摘要写一条笔记…"
                    onCancel={() => setAddingAt(null)}
                    onSave={(text) => {
                      onAddNote({ sentence: s, sentenceIndex: i, text });
                      setAddingAt(null);
                    }}
                  />
                )}
              </div>
            );
          })}
          {!sentences.length && <p className="empty-hint">暂无摘要，可点击「编辑摘要」填写。</p>}
        </div>
      </div>

      {pending.length > 0 && (
        <div className="detail-section">
          <h4>待重定位 <span>PENDING · {pending.length} 条</span></h4>
          <p className="section-hint">
            这些笔记的原句已不在当前摘要中，内容与引用次数完整保留。请手动重定位或删除——系统不会自动挪动它们。
          </p>
          {pending.map((n) => (
            <div className="pending-card" key={n.id}>
              <div className="pending-sentence">
                原句（v{n.abstractVersion} · #{n.sentenceIndex + 1}）：{n.sentence}
              </div>
              <p>{n.text}</p>
              <div className="note-meta">
                <span>当前摘要 v{entry.abstractVersion}</span>
                {n.refs > 1 && <span className="refs">摘录 ×{n.refs}</span>}
                <button className="mini" onClick={() => setRelocating(relocating === n.id ? null : n.id)}>
                  重定位…
                </button>
                <DeleteButton onDelete={() => onRemoveNote(n.id)} />
              </div>
              {relocating === n.id && (
                <div className="picker">
                  <small>选择当前摘要中的一句作为新锚点：</small>
                  {sentences.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        onRelocate(n.id, i);
                        setRelocating(null);
                      }}
                    >
                      <b>#{i + 1}</b>
                      {s}
                    </button>
                  ))}
                  {!sentences.length && <small>当前摘要为空，请先编辑摘要。</small>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

// 整篇笔记：不锚定具体句子，承载旧版自由文本笔记的迁移结果。
export function EntryNotes({ notes, onAddNote, onRemoveNote }) {
  const [adding, setAdding] = useState(false);
  return (
    <div className="detail-section">
      <h4>整篇笔记 <span>ENTRY NOTES</span></h4>
      {notes.map((n) => (
        <div className="note-card entry" key={n.id}>
          <p>{n.text}</p>
          <NoteMeta note={n} onRemove={onRemoveNote}>
            <span>不锚定句子</span>
          </NoteMeta>
        </div>
      ))}
      {adding ? (
        <NoteEditor
          placeholder="写一条不针对具体句子的整篇笔记…"
          onCancel={() => setAdding(false)}
          onSave={(text) => {
            onAddNote({ text });
            setAdding(false);
          }}
        />
      ) : (
        <button className="mini" onClick={() => setAdding(true)}>＋ 添加整篇笔记</button>
      )}
    </div>
  );
}
