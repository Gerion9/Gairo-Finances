import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { createInterface } from 'node:readline';

export async function createTestD1() {
  const child = spawn('python', ['-u', 'tests/sqlite_bridge.py'], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
  const pending = new Map(); let sequence = 0;
  createInterface({ input: child.stdout }).on('line', line => { const item = JSON.parse(line); const promise = pending.get(item.id); pending.delete(item.id); if (item.error) promise.reject(new Error(item.error)); else promise.resolve(item.result); });
  child.on('error', error => { for (const promise of pending.values()) promise.reject(error); pending.clear(); });
  child.on('exit', () => { for (const promise of pending.values()) promise.reject(new Error('SQLite test adapter exited')); pending.clear(); });
  const call = (method, sql, params = []) => new Promise((resolve, reject) => { const id = ++sequence; pending.set(id, { resolve, reject }); child.stdin.write(JSON.stringify({ id, method, sql, params }) + '\n'); });
  const db = { prepare(sql) { const statement = params => ({ bind: (...values) => statement(values), first: () => call('first', sql, params), run: () => call('run', sql, params), all: () => call('all', sql, params) }); return statement([]); }, withSession() { return db; }, close() { child.stdin.end(); }, exec: sql => call('exec', sql) };
  await db.exec(await readFile('drizzle/0000_eminent_mariko_yashida.sql', 'utf8'));
  return db;
}
