import { useEffect, useMemo, useState } from 'react';
import {
  createItem,
  anchorAtSentence,
  addNote,
  updateNote,
  deleteNote,
  relinkAnchor,
  removeAnchor,
  commitAbstract,
} from '../model/data.js';
import { reviewAnchors } from '../model/anchor.js';
import { loadLibrary, saveLibrary } from '../model/storage.js';
import AbstractSection from './AbstractSection.jsx';
import PendingNotes from './PendingNotes.jsx';
import SaveReviewDialog from './SaveReviewDialog.jsx';

const blankForm = { title: '', authors: '', year: '2024', venue: '', abstract: '', tags: '' };

export default function App() {
  const [items, setItems] = useState(loadLibrary);
  const [selected, setSelected] = useState(() =>
    items[0] ? items[0].id : null
  );
  const [query, setQuery] = useState('');
  const [tag, setTag] = useState('全部');
  const [show, setShow] = useState(false);
  const [notice, setNotice] = useState('');
  const [form, setForm] = useState(blankForm);
  // 待确认的摘要编辑：{ itemId, text, review, done }
  const [pendingSave, setPendingSave] = useState(null);

  useEffect(() => saveLibrary(items), [items]);

  const tags = ['全部', ...new Set(items.flatMap((x) => x.tags))];
  const filtered = useMemo(
    () =>
      items.filter(
        (x) =>
          (tag === '全部' || x.tags.includes(tag)) &&
          `${x.title}${x.authors}${x.abstract}`.toLowerCase().includes(query.toLowerCase())
      ),
    [items, tag, query]
  );
  const cur = items.find((x) => x.id === selected) || items[0];

  const patchItem = (id, fn) => setItems((list) => list.map((x) => (x.id === id ? fn(x) : x)));
  const update = (k, v) => patchItem(cur.id, (x) => ({ ...x, [k]: v }));

  // —— 句子锚点操作（委托给数据层）——
  const excerpt = (sentence) => {
    patchItem(cur.id, (x) =>
      anchorAtSentence(x, sentence, { source: 'excerpt', at: x.abstractVersion }).item
    );
    setNotice('已摘录：同一句重复摘录只累加引用');
  };
  const addNoteTo = (sentence, text) => {
    let anchorId;
    patchItem(cur.id, (x) => {
      const r = anchorAtSentence(x, sentence, {
        source: 'note',
        at: x.abstractVersion,
      });
      anchorId = r.anchorId;
      return addNote(r.item, anchorId, text);
    });
  };
  const editNote = (anchorId, noteId, text) =>
    patchItem(cur.id, (x) => updateNote(x, anchorId, noteId, text));
  const removeNote = (anchorId, noteId) =>
    patchItem(cur.id, (x) => deleteNote(x, anchorId, noteId));
  const relink = (anchorId, sentence) =>
    patchItem(cur.id, (x) => relinkAnchor(x, anchorId, sentence));
  const dropAnchor = (anchorId) =>
    patchItem(cur.id, (x) => removeAnchor(x, anchorId));

  // —— 摘要保存：先核对受影响笔记 ——
  const requestSave = (text, done) => {
    const item = items.find((x) => x.id === cur.id);
    if (text === item.abstract) {
      done();
      return;
    }
    const review = reviewAnchors(item, text);
    if (review.affected.length === 0) {
      patchItem(item.id, (x) => commitAbstract(x, text, review));
      done();
      setNotice('摘要已保存，所有笔记均锚在原句上');
      return;
    }
    setPendingSave({ itemId: item.id, text, review, done });
  };
  const confirmSave = () => {
    const { itemId, text, review, done } = pendingSave;
    patchItem(itemId, (x) => commitAbstract(x, text, review));
    setPendingSave(null);
    done();
    setNotice(
      `摘要已保存：${review.missing.length} 条进入待重定位，${review.moved.length} 条跟随原句`
    );
  };
  const cancelSave = () => {
    const { done } = pendingSave;
    setPendingSave(null);
    done();
  };

  const add = () => {
    if (!form.title) return;
    const p = createItem(form);
    setItems([...items, p]);
    setSelected(p.id);
    setForm(blankForm);
    setShow(false);
    setNotice('文献已加入研究库');
  };
  const bib = () => {
    navigator.clipboard?.writeText(cur.cite);
    setNotice('引用文本已复制');
  };
  const download = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(
      new Blob([items.map((x) => x.cite).join('\n')], { type: 'text/plain' })
    );
    a.download = 'references.txt';
    a.click();
    setNotice('引用列表已导出');
  };

  const pendingCountOf = (p) =>
    (p.anchors || []).filter((a) => a.status !== 'anchored').length;

  return (
    <div className="app">
      <aside>
        <div className="logo"><span>∴</span> LITERATURE</div>
        <div className="library-head">
          <span>我的研究库</span>
          <strong>{items.length}<small> 篇文献</small></strong>
        </div>
        <nav>
          <button className="active">▤ <span>所有文献</span><b>{items.length}</b></button>
          <button>▥ <span>待读</span><b>{items.filter((x) => x.status === '待读').length}</b></button>
          <button>✓ <span>已读</span></button>
          <button>☆ <span>收藏</span></button>
        </nav>
        <div className="side-tags">
          <small>标签</small>
          {tags.slice(1, 5).map((t) => (
            <button onClick={() => setTag(t)} key={t}># {t}</button>
          ))}
        </div>
        <div className="side-foot">
          <button>⚙ 偏好设置</button>
          <small>本地数据库 · 已同步</small>
        </div>
      </aside>

      <main>
        <header>
          <div>
            <span className="crumb">RESEARCH / LIBRARY</span>
            <h1>所有文献</h1>
          </div>
          <div className="actions">
            <button className="outline" onClick={download}>↓ 导出引用</button>
            <button className="primary" onClick={() => setShow(true)}>＋ 添加文献</button>
          </div>
        </header>
        <div className="toolbar">
          <div className="search">
            ⌕
            <input
              placeholder="搜索标题、作者或摘要…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && <button onClick={() => setQuery('')}>×</button>}
          </div>
          <div className="tag-filter">
            {tags.map((t) => (
              <button className={tag === t ? 'on' : ''} onClick={() => setTag(t)} key={t}>
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="body">
          <section className="paper-list">
            {filtered.map((p) => {
              const pc = pendingCountOf(p);
              return (
                <button
                  className={'paper ' + (selected === p.id ? 'selected' : '')}
                  onClick={() => setSelected(p.id)}
                  key={p.id}
                >
                  <div className="paper-year">{p.year}</div>
                  <div className="paper-copy">
                    <h3>{p.title}</h3>
                    <p>{p.authors}</p>
                    <div>
                      {p.tags.map((t) => <span key={t}>#{t}</span>)}
                      {pc > 0 && <span className="pending-flag">⚲ {pc} 待重定位</span>}
                    </div>
                  </div>
                  <small className={'status ' + p.status}>{p.status}</small>
                </button>
              );
            })}
            {!filtered.length && <div className="no-result">没有找到匹配的文献</div>}
          </section>

          <section className="detail">
            {cur && (
              <>
                <div className="detail-top">
                  <span className="status reading">{cur.status}</span>
                  <button onClick={() => setNotice('已加入收藏')}>☆ 收藏</button>
                </div>
                <h2>{cur.title}</h2>
                <p className="authors">{cur.authors}</p>
                <div className="cite-actions">
                  <button onClick={bib}>▣ 复制引用</button>
                  <button onClick={() => update('status', cur.status === '已读' ? '待读' : '已读')}>
                    {cur.status === '已读' ? '标记为待读' : '标记为已读'}
                  </button>
                </div>

                <AbstractSection
                  item={cur}
                  onExcerpt={excerpt}
                  onAddNoteTo={addNoteTo}
                  onEditNote={editNote}
                  onDeleteNote={removeNote}
                  onRequestSave={requestSave}
                />

                <PendingNotes item={cur} onRelink={relink} onRemove={dropAnchor} />

                <div className="detail-section">
                  <h4>出版信息 <span>PUBLICATION</span></h4>
                  <div className="pub-grid">
                    <div><small>出版物</small><strong>{cur.venue}</strong></div>
                    <div><small>年份</small><strong>{cur.year}</strong></div>
                  </div>
                </div>
                <div className="detail-section">
                  <h4>引用文本 <span>BIBTEX / TEXT</span></h4>
                  <div className="cite-box">
                    {cur.cite}
                    <button onClick={bib}>复制</button>
                  </div>
                </div>
              </>
            )}
          </section>
        </div>
      </main>

      {show && (
        <div className="modal-bg">
          <div className="modal">
            <button className="close" onClick={() => setShow(false)}>×</button>
            <span className="crumb">NEW REFERENCE</span>
            <h2>添加一篇文献</h2>
            <label>标题
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="论文或书籍标题" />
            </label>
            <label>作者
              <input value={form.authors} onChange={(e) => setForm({ ...form, authors: e.target.value })} />
            </label>
            <div className="two">
              <label>年份
                <input type="number" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} />
              </label>
              <label>出版物
                <input value={form.venue} onChange={(e) => setForm({ ...form, venue: e.target.value })} />
              </label>
            </div>
            <label>关键词
              <input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="用逗号分隔" />
            </label>
            <label>摘要
              <textarea rows={3} value={form.abstract} onChange={(e) => setForm({ ...form, abstract: e.target.value })} />
            </label>
            <button className="primary full" onClick={add}>保存文献</button>
          </div>
        </div>
      )}

      {pendingSave && (
        <SaveReviewDialog
          review={pendingSave.review}
          nextVersion={(items.find((x) => x.id === pendingSave.itemId)?.abstractVersion || 0) + 1}
          onConfirm={confirmSave}
          onCancel={cancelSave}
        />
      )}

      {notice && <div className="toast">{notice}</div>}
    </div>
  );
}
