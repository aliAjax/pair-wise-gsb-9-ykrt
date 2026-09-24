// 界面层：应用外壳与状态编排。数据改动一律经由数据层纯函数，持久化交给存储层。
import React, { useEffect, useMemo, useState } from 'react';
import { loadState, saveState } from '../lib/storage.js';
import { NOTE_STATUS, addNote, applyAbstractSave, planAbstractSave, relocateNote, removeNote } from '../lib/model.js';
import { AbstractSection, EntryNotes } from './notes.jsx';
import { AbstractEditor, SavePlanDialog } from './AbstractEditor.jsx';

const emptyForm = { title: '', authors: '', year: '2024', venue: '', abstract: '', tags: '' };

export default function App() {
  const [state, setState] = useState(loadState);
  const { items, notes } = state;
  const [selected, setSelected] = useState(() => items[0]?.id);
  const [query, setQuery] = useState('');
  const [tag, setTag] = useState('全部');
  const [show, setShow] = useState(false);
  const [notice, setNotice] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [editingAbstract, setEditingAbstract] = useState(false);
  const [savePlan, setSavePlan] = useState(null); // { entryId, draft, plan }

  useEffect(() => saveState(state), [state]);

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

  const update = (k, v) => setState((s) => ({ ...s, items: s.items.map((x) => (x.id === cur.id ? { ...x, [k]: v } : x)) }));

  const add = () => {
    if (!form.title) return;
    const p = {
      ...form,
      id: Date.now(),
      year: +form.year,
      tags: form.tags.split(',').map((x) => x.trim()).filter(Boolean),
      abstractVersion: 1,
      status: '待读',
      cite: `${form.authors} (${form.year}). ${form.title}. ${form.venue}.`,
    };
    setState((s) => ({ ...s, items: [...s.items, p] }));
    setSelected(p.id);
    setForm(emptyForm);
    setShow(false);
    setNotice('文献已加入研究库');
  };

  const bib = () => {
    navigator.clipboard?.writeText(cur.cite);
    setNotice('引用文本已复制');
  };

  const download = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([items.map((x) => x.cite).join('\n')], { type: 'text/plain' }));
    a.download = 'references.txt';
    a.click();
    setNotice('引用列表已导出');
  };

  // —— 摘要保存：先预演，若有受影响笔记则先列出，确认后才落盘 ——
  const requestSaveAbstract = (draft) => {
    const clean = String(draft ?? '').trim();
    if (!clean) return setNotice('摘要不能为空');
    if (clean === cur.abstract.trim()) {
      setEditingAbstract(false);
      return setNotice('摘要没有改动');
    }
    const plan = planAbstractSave(cur, notes, clean);
    if (plan.affected.length > 0) setSavePlan({ entryId: cur.id, draft: clean, plan });
    else saveAbstract(cur.id, clean);
  };

  const saveAbstract = (entryId, draft) => {
    const { state: next, plan, version } = applyAbstractSave(state, entryId, draft);
    setState(next);
    setEditingAbstract(false);
    setSavePlan(null);
    const parts = [`摘要已保存为 v${version}`, `${plan.reanchored.length} 条笔记跟随原句`];
    if (plan.affected.length) parts.push(`${plan.affected.length} 条进入待重定位`);
    setNotice(parts.join('，'));
  };

  // —— 笔记 ——
  const handleAddNote = ({ sentence = null, sentenceIndex = null, text }) => {
    const { state: next, note, merged } = addNote(state, { entryId: cur.id, sentence, sentenceIndex, text });
    if (!note) return setNotice('笔记内容为空，或原句不在当前摘要中');
    setState(next);
    if (merged) setNotice('相同摘录已存在，引用次数 +1');
    else setNotice(sentence == null ? '整篇笔记已保存' : '笔记已锚定到原句');
  };

  const handleRemoveNote = (id) => {
    setState((s) => removeNote(s, id));
    setNotice('笔记已删除');
  };

  const handleRelocate = (id, sentenceIndex) => {
    const { state: next, merged } = relocateNote(state, id, sentenceIndex);
    setState(next);
    setNotice(merged ? '目标句已有相同笔记，已合并引用次数' : '笔记已手动重定位');
  };

  const curNotes = cur ? notes.filter((n) => n.entryId === cur.id) : [];
  const planEntry = savePlan ? items.find((x) => x.id === savePlan.entryId) : null;

  return (
    <div className="app">
      <aside>
        <div className="logo"><span>∴</span> LITERATURE</div>
        <div className="library-head"><span>我的研究库</span><strong>{items.length}<small> 篇文献</small></strong></div>
        <nav>
          <button className="active">▤ <span>所有文献</span><b>{items.length}</b></button>
          <button>▥ <span>待读</span><b>{items.filter((x) => x.status === '待读').length}</b></button>
          <button>✓ <span>已读</span></button>
          <button>☆ <span>收藏</span></button>
        </nav>
        <div className="side-tags">
          <small>标签</small>
          {tags.slice(1, 5).map((t) => <button onClick={() => setTag(t)} key={t}># {t}</button>)}
        </div>
        <div className="side-foot"><button>⚙ 偏好设置</button><small>本地数据库 · 已同步</small></div>
      </aside>
      <main>
        <header>
          <div><span className="crumb">RESEARCH / LIBRARY</span><h1>所有文献</h1></div>
          <div className="actions">
            <button className="outline" onClick={download}>↓ 导出引用</button>
            <button className="primary" onClick={() => setShow(true)}>＋ 添加文献</button>
          </div>
        </header>
        <div className="toolbar">
          <div className="search">
            ⌕<input placeholder="搜索标题、作者或摘要…" value={query} onChange={(e) => setQuery(e.target.value)} />
            {query && <button onClick={() => setQuery('')}>×</button>}
          </div>
          <div className="tag-filter">
            {tags.map((t) => <button className={tag === t ? 'on' : ''} onClick={() => setTag(t)} key={t}>{t}</button>)}
          </div>
        </div>
        <div className="body">
          <section className="paper-list">
            {filtered.map((p) => (
              <button className={'paper ' + (selected === p.id ? 'selected' : '')} onClick={() => setSelected(p.id)} key={p.id}>
                <div className="paper-year">{p.year}</div>
                <div className="paper-copy">
                  <h3>{p.title}</h3>
                  <p>{p.authors}</p>
                  <div>{p.tags.map((t) => <span key={t}>#{t}</span>)}</div>
                </div>
                <small className={'status ' + p.status}>{p.status}</small>
              </button>
            ))}
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
                  key={cur.id}
                  entry={cur}
                  notes={curNotes}
                  onAddNote={handleAddNote}
                  onRemoveNote={handleRemoveNote}
                  onRelocate={handleRelocate}
                  onEditAbstract={() => setEditingAbstract(true)}
                />
                <div className="detail-section">
                  <h4>出版信息 <span>PUBLICATION</span></h4>
                  <div className="pub-grid">
                    <div><small>出版物</small><strong>{cur.venue}</strong></div>
                    <div><small>年份</small><strong>{cur.year}</strong></div>
                  </div>
                </div>
                <div className="detail-section">
                  <h4>引用文本 <span>BIBTEX / TEXT</span></h4>
                  <div className="cite-box">{cur.cite}<button onClick={bib}>复制</button></div>
                </div>
                <EntryNotes
                  key={`entry-${cur.id}`}
                  notes={curNotes.filter((n) => n.status === NOTE_STATUS.ENTRY)}
                  onAddNote={handleAddNote}
                  onRemoveNote={handleRemoveNote}
                />
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
            <label>标题<input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="论文或书籍标题" /></label>
            <label>作者<input value={form.authors} onChange={(e) => setForm({ ...form, authors: e.target.value })} /></label>
            <div className="two">
              <label>年份<input type="number" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} /></label>
              <label>出版物<input value={form.venue} onChange={(e) => setForm({ ...form, venue: e.target.value })} /></label>
            </div>
            <label>关键词<input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="用逗号分隔" /></label>
            <label>摘要<textarea rows="3" value={form.abstract} onChange={(e) => setForm({ ...form, abstract: e.target.value })} /></label>
            <button className="primary full" onClick={add}>保存文献</button>
          </div>
        </div>
      )}
      {editingAbstract && cur && (
        <AbstractEditor entry={cur} onClose={() => setEditingAbstract(false)} onSave={requestSaveAbstract} />
      )}
      {savePlan && planEntry && (
        <SavePlanDialog
          entry={planEntry}
          plan={savePlan.plan}
          onCancel={() => setSavePlan(null)}
          onConfirm={() => saveAbstract(savePlan.entryId, savePlan.draft)}
        />
      )}
      {notice && <div className="toast">{notice}</div>}
    </div>
  );
}
