'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import type { Ack, CustomQuestionInput, Question, QuestionPack } from '../shared/types';
import { createSocket, type GameSocket } from '../lib/socket';
import { Header } from './game-common';

const emptyQuestion: CustomQuestionInput = { text: '', correctAnswer: '', category: 'Custom', acceptedAnswers: [], explanation: '' };

export function CustomPacks() {
  const socketRef = useRef<GameSocket | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [packs, setPacks] = useState<QuestionPack[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [question, setQuestion] = useState<CustomQuestionInput>(emptyQuestion);
  const [accepted, setAccepted] = useState('');
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const selected = packs.find((pack) => pack.id === selectedId) ?? null;

  const request = useCallback(async <T,>(send: (socket: GameSocket, done: (error: Error | null, result: Ack<T>) => void) => void): Promise<T | null> => {
    const socket = socketRef.current; if (!socket?.connected) { setError('Cannot reach the game server.'); return null; }
    setPending(true); setError(''); setMessage('');
    const result = await new Promise<Ack<T>>((resolve) => send(socket, (timeout, reply) => resolve(timeout ? { ok: false, error: 'The server did not respond.' } : reply)));
    setPending(false); if (!result.ok) { setError(result.error); return null; } return result.data;
  }, []);
  const load = useCallback(async () => { const result = await request<QuestionPack[]>((socket, done) => socket.timeout(8000).emit('packs:list', done)); if (result) { setPacks(result); setSelectedId((current) => current && result.some((pack) => pack.id === current) ? current : result[0]?.id ?? null); } }, [request]);

  useEffect(() => { const socket = createSocket(); socketRef.current = socket; socket.on('connect', () => void load()); socket.on('packs:changed', () => void load()); socket.connect(); return () => { socket.removeAllListeners(); socket.disconnect(); socketRef.current = null; }; }, [load]);

  const replace = (pack: QuestionPack) => { setPacks((current) => current.map((item) => item.id === pack.id ? pack : item)); setSelectedId(pack.id); };
  const create = async (event: FormEvent) => { event.preventDefault(); const pack = await request<QuestionPack>((socket, done) => socket.timeout(8000).emit('packs:create', { name: newName, description: newDescription }, done)); if (pack) { setPacks((current) => [...current, pack]); setSelectedId(pack.id); setNewName(''); setNewDescription(''); setMessage('Pack created. Add your first question.'); } };
  const savePack = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); if (!selected) return; const fields = new FormData(event.currentTarget); const pack = await request<QuestionPack>((socket, done) => socket.timeout(8000).emit('packs:update', { packId: selected.id, name: String(fields.get('name')), description: String(fields.get('description')) }, done)); if (pack) { replace(pack); setMessage('Pack details saved.'); } };
  const editQuestion = (item: Question) => { setEditingQuestionId(item.id); setQuestion({ text: item.text, correctAnswer: item.correctAnswer, category: item.category, acceptedAnswers: item.acceptedAnswers ?? [], explanation: item.explanation ?? '' }); setAccepted((item.acceptedAnswers ?? []).join('\n')); };
  const clearQuestion = () => { setEditingQuestionId(null); setQuestion(emptyQuestion); setAccepted(''); };
  const saveQuestion = async (event: FormEvent) => { event.preventDefault(); if (!selected) return; const input = { ...question, acceptedAnswers: accepted.split('\n').map((value) => value.trim()).filter(Boolean) }; const pack = editingQuestionId
      ? await request<QuestionPack>((socket, done) => socket.timeout(8000).emit('packs:question-update', { packId: selected.id, questionId: editingQuestionId, question: input }, done))
      : await request<QuestionPack>((socket, done) => socket.timeout(8000).emit('packs:question-add', { packId: selected.id, question: input }, done));
    if (pack) { replace(pack); clearQuestion(); setMessage(editingQuestionId ? 'Question updated.' : 'Question added.'); }
  };
  const removeQuestion = async (item: Question) => { if (!selected || !confirm(`Delete “${item.text}”?`)) return; const pack = await request<QuestionPack>((socket, done) => socket.timeout(8000).emit('packs:question-delete', { packId: selected.id, questionId: item.id }, done)); if (pack) { replace(pack); if (editingQuestionId === item.id) clearQuestion(); setMessage('Question deleted.'); } };
  const removePack = async (pack: QuestionPack) => { if (!confirm(`Delete “${pack.name}”? This removes the pack from the server.`)) return; const result = await request<undefined>((socket, done) => socket.timeout(8000).emit('packs:delete', { packId: pack.id }, done)); if (result !== null) { const remaining = packs.filter((item) => item.id !== pack.id); setPacks(remaining); setSelectedId(remaining[0]?.id ?? null); setMessage('Pack deleted.'); } };
  const exportPack = async (pack: QuestionPack) => { const result = await request<{ filename: string; pack: object }>((socket, done) => socket.timeout(8000).emit('packs:export', { packId: pack.id }, done)); if (!result) return; const url = URL.createObjectURL(new Blob([JSON.stringify(result.pack, null, 2)], { type: 'application/json' })); const link = document.createElement('a'); link.href = url; link.download = result.filename; link.click(); URL.revokeObjectURL(url); setMessage('Pack exported.'); };
  const importFile = async (file?: File) => { if (!file) return; if (file.size > 2 * 1024 * 1024) { setError('Pack files must be 2 MB or smaller.'); return; } const json = await file.text(); const pack = await request<QuestionPack>((socket, done) => socket.timeout(8000).emit('packs:import', { json }, done)); if (pack) { setPacks((current) => [...current, pack]); setSelectedId(pack.id); setMessage('Pack imported with new local IDs.'); } if (fileRef.current) fileRef.current.value = ''; };

  return <div className="page packs-page"><Header /><main className="packs-shell"><div className="packs-page-heading"><div><div className="eyebrow">Your question library</div><h1>Custom Packs</h1><p>Create local packs for family nights, work parties, and gloriously specific arguments.</p></div><Link className="btn btn-ghost btn-small" href="/">Back to Game</Link></div>
    {(error || message) && <div className={`pack-notice${error ? ' is-error' : ''}`} role={error ? 'alert' : 'status'}>{error || message}</div>}
    <div className="packs-workspace"><aside className="pack-library"><form className="pack-create-form" onSubmit={create}><h2>Create Pack</h2><label>Name<input maxLength={100} required value={newName} onChange={(event) => setNewName(event.target.value)} /></label><label>Description<textarea maxLength={500} rows={2} value={newDescription} onChange={(event) => setNewDescription(event.target.value)} /></label><button className="btn btn-primary btn-small" disabled={pending}>Create Pack</button></form><div className="pack-library-actions"><button className="btn btn-secondary btn-small" type="button" onClick={() => fileRef.current?.click()}>Import Pack</button><input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(event) => void importFile(event.target.files?.[0])} /></div><div className="pack-library-list">{packs.length === 0 ? <p>No custom packs yet.</p> : packs.map((pack) => <button key={pack.id} className={selectedId === pack.id ? 'is-active' : ''} onClick={() => { setSelectedId(pack.id); clearQuestion(); }}><strong>{pack.name}</strong><span>{pack.questions.length} questions</span></button>)}</div></aside>
      <section className="pack-editor">{selected ? <><form className="pack-details-form" onSubmit={savePack}><div className="editor-title"><div><div className="eyebrow">Custom Pack</div><h2>{selected.name}</h2><span>{selected.questions.length} questions</span></div><div className="editor-actions"><button type="button" className="btn btn-ghost btn-small" onClick={() => void exportPack(selected)}>Export</button><button type="button" className="btn btn-ghost btn-small danger-action" onClick={() => void removePack(selected)}>Delete</button></div></div><label>Name<input name="name" key={`${selected.id}-name`} maxLength={100} required defaultValue={selected.name} /></label><label>Description<textarea name="description" key={`${selected.id}-description`} maxLength={500} rows={2} defaultValue={selected.description} /></label><button className="btn btn-secondary btn-small" disabled={pending}>Save Details</button></form>
        <form className="question-editor" onSubmit={saveQuestion}><h3>{editingQuestionId ? 'Edit Question' : 'Add Question'}</h3><label>Question<textarea maxLength={300} rows={3} required value={question.text} onChange={(event) => setQuestion({ ...question, text: event.target.value })} /></label><div className="question-field-grid"><label>Correct Answer<input maxLength={150} required value={question.correctAnswer} onChange={(event) => setQuestion({ ...question, correctAnswer: event.target.value })} /></label><label>Category<input maxLength={80} required value={question.category} onChange={(event) => setQuestion({ ...question, category: event.target.value })} /></label></div><label>Accepted Answers <small>One per line; capitalization variants are handled automatically.</small><textarea maxLength={7550} rows={3} value={accepted} onChange={(event) => setAccepted(event.target.value)} /></label><label>Explanation <small>Optional</small><textarea maxLength={600} rows={3} value={question.explanation ?? ''} onChange={(event) => setQuestion({ ...question, explanation: event.target.value })} /></label><div className="editor-actions"><button className="btn btn-primary btn-small" disabled={pending}>{editingQuestionId ? 'Save Question' : 'Add Question'}</button>{editingQuestionId && <button type="button" className="btn btn-ghost btn-small" onClick={clearQuestion}>Cancel</button>}</div></form>
        <div className="question-list"><h3>Questions</h3>{selected.questions.length === 0 ? <p>Add a question to make this pack playable.</p> : selected.questions.map((item, index) => <article key={item.id}><span>{index + 1}</span><div><strong>{item.text}</strong><small>{item.category} · {item.correctAnswer}{item.acceptedAnswers?.length ? ` · ${item.acceptedAnswers.length} alternate` : ''}</small></div><button className="text-action" onClick={() => editQuestion(item)}>Edit</button><button className="text-action danger-action" onClick={() => void removeQuestion(item)}>Delete</button></article>)}</div></> : <div className="empty-editor"><h2>Make trivia personal.</h2><p>Create a pack or import a compatible JSON file to begin.</p></div>}</section></div></main></div>;
}
