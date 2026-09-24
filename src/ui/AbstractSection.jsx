import { useMemo, useState } from 'react';
import { STATUS } from '../model/data.js';
import { splitSentences, normalizeSentence, anchorsBySentence } from '../model/anchor.js';

// 摘要区：句子可逐句摘录/加笔记；编辑保存前由父组件弹受影响笔记清单。
export default function AbstractSection({
  item,
  onExcerpt,
  onAddNoteTo,
  onEditNote,
  onDeleteNote,
  onRequestSave,
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.abstract);
  const [openKey, setOpenKey] = useState(null);
  const [noteDraft, setNoteDraft] = useState('');

  const sentences = useMemo(() => splitSentences(item.abstract), [item.abstract]);
  const bySentence = useMemo(() => anchorsBySentence(item), [item]);
  const openAnchors = openKey ? bySentence.get(openKey) || null : null;
  const openSentence = sentences.find((s) => normalizeSentence(s) === openKey);

  const startEdit = () => {
    setDraft(item.abstract);
    setOpenKey(null);
    setEditing(true);
  };
  const cancelEdit = () => setEditing(false);
  const save = () => {
    onRequestSave(draft, () => setEditing(false));
  };

  const submitNote = () => {
    const text = noteDraft.trim();
    if (!text || !openSentence) return;
    onAddNoteTo(openSentence, text);
    setNoteDraft('');
  };

  return (
    <div className="detail-section abstract-section">
      <h4>
        摘要 <span>ABSTRACT · v{item.abstractVersion || 1}</span>
        {!editing && (
          <button className="link-btn" onClick={startEdit}>
            ✎ 编辑摘要
          </button>
        )}
      </h4>

      {editing ? (
        <div className="abstract-edit">
          <textarea
            rows={5}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="修改摘要后，仍能找到原句的笔记会保留，找不到的将进入待重定位。"
          />
          <div className="abstract-edit-actions">
            <button className="mini" onClick={cancelEdit}>
              取消
            </button>
            <button className="mini primary" onClick={save}>
              保存并检查笔记
            </button>
          </div>
        </div>
      ) : (
        <>
          <p className="abstract-text">
            {sentences.map((s) => {
              const key = normalizeSentence(s);
              const anchors = bySentence.get(key);
              return (
                <span
                  key={key}
                  className={
                    'sentence' +
                    (anchors ? ' anchored' : '') +
                    (openKey === key ? ' open' : '')
                  }
                  onClick={() => setOpenKey(openKey === key ? null : key)}
                  title={anchors ? `${anchors.length} 条锚点笔记` : '点按对此句加笔记'}
                >
                  {s}
                  {anchors && <i className="sentence-dot" />}
                </span>
              );
            })}
          </p>
          <small className="sentence-hint">点击句子可摘录或写笔记；笔记记住原句与位置。</small>

          {openAnchors !== null && openSentence && (
            <SentencePanel
              sentence={openSentence}
              anchors={openAnchors}
              noteDraft={noteDraft}
              setNoteDraft={setNoteDraft}
              onExcerpt={() => onExcerpt(openSentence)}
              onSubmitNote={submitNote}
              onEditNote={onEditNote}
              onDeleteNote={onDeleteNote}
            />
          )}
          {openAnchors === null && openSentence && (
            <div className="sentence-panel">
              <blockquote>{openSentence}</blockquote>
              <p className="empty-line">此句还没有笔记。</p>
              <div className="panel-row">
                <button className="mini" onClick={() => onExcerpt(openSentence)}>
                  ✂ 摘录此句
                </button>
                <input
                  placeholder="为此句写一条笔记，回车保存…"
                  value={noteDraft}
                  onChange={(e) => setNoteDraft(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && submitNote()}
                />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function SentencePanel({
  sentence,
  anchors,
  noteDraft,
  setNoteDraft,
  onExcerpt,
  onSubmitNote,
  onEditNote,
  onDeleteNote,
}) {
  const [editingId, setEditingId] = useState(null);
  const [editingText, setEditingText] = useState('');

  return (
    <div className="sentence-panel">
      <blockquote>{sentence}</blockquote>
      {anchors.map((a) => (
        <div className="anchor-card" key={a.id}>
          <div className="anchor-meta">
            <span className="ref-count">引用 ×{a.noteCount}</span>
            <button className="link-btn" onClick={onExcerpt}>
              ✂ 再次摘录（只累加引用）
            </button>
          </div>
          {a.notes.length === 0 && <p className="empty-line">已摘录，尚无笔记。</p>}
          {a.notes.map((n) =>
            editingId === n.id ? (
              <div className="note-edit" key={n.id}>
                <textarea
                  rows={2}
                  value={editingText}
                  onChange={(e) => setEditingText(e.target.value)}
                />
                <div className="panel-row">
                  <button
                    className="mini"
                    onClick={() => {
                      setEditingId(null);
                      setEditingText('');
                    }}
                  >
                    取消
                  </button>
                  <button
                    className="mini primary"
                    onClick={() => {
                      if (editingText.trim()) onEditNote(a.id, n.id, editingText.trim());
                      setEditingId(null);
                    }}
                  >
                    保存
                  </button>
                </div>
              </div>
            ) : (
              <div className="note-line" key={n.id}>
                <p>{n.text}</p>
                <span>
                  <button
                    className="link-btn"
                    onClick={() => {
                      setEditingId(n.id);
                      setEditingText(n.text);
                    }}
                  >
                    编辑
                  </button>
                  <button className="link-btn danger" onClick={() => onDeleteNote(a.id, n.id)}>
                    删除
                  </button>
                </span>
              </div>
            )
          )}
        </div>
      ))}
      <div className="panel-row">
        <input
          placeholder="为此句再加一条笔记，回车保存…"
          value={noteDraft}
          onChange={(e) => setNoteDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onSubmitNote()}
        />
        <button className="mini primary" onClick={onSubmitNote}>
          加笔记
        </button>
      </div>
    </div>
  );
}
