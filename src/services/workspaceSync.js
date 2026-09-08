import { accountRequest } from './auth.js';

// One queue per authenticated workspace. Pending data stays only in this object,
// never in a shared browser key. Retrying a lost response reuses the same UUID.
export class WorkspaceSync {
  constructor(accountId, { request = accountRequest, onChange = () => {}, onSessionLost = () => {} } = {}) {
    this.accountId = accountId; this.request = request; this.onChange = onChange; this.onSessionLost = onSessionLost;
    this.controller = new AbortController(); this.active = true; this.revision = 0; this.data = null;
    this.dirty = false; this.inFlight = false; this.pending = null; this.remote = null; this.status = 'loading'; this.generation = 0;
    this.readEpoch = 0;
  }
  snapshot() { return { data: this.data, revision: this.revision, dirty: this.dirty, status: this.status, updatedAt: this.updatedAt, error: this.error, remote: this.remote, generation: this.generation }; }
  emit() { if (this.active) this.onChange(this.snapshot()); }
  async call(path, options = {}) { return this.request(path, { ...options, accountId: this.accountId, signal: this.controller.signal }); }
  fail(error) {
    if (!this.active || error.name === 'AbortError') return;
    if ([400, 413, 415, 422].includes(error.status)) this.pending = null;
    this.error = error.message;
    this.status = ['AUTH_REQUIRED', 'ACCOUNT_NOT_ALLOWED', 'ACCOUNT_CHANGED'].includes(error.code) ? 'session' : error.code === 'REVISION_CONFLICT' ? 'conflict' : 'error';
    if (this.status === 'session') this.onSessionLost(this.snapshot());
    this.emit();
  }
  async load() {
    const epoch = ++this.readEpoch;
    try { const remote = await this.call('/api/workspace'); if (this.active && epoch === this.readEpoch) this.accept(remote); }
    catch (error) { if (epoch === this.readEpoch) this.fail(error); }
  }
  accept(remote) {
    this.data = remote.financialData; this.revision = remote.revision; this.updatedAt = remote.updatedAt;
    this.readEpoch += 1; this.migrationRequested = false;
    this.dirty = false; this.pending = null; this.remote = null; this.error = ''; this.status = 'saved'; this.generation += 1; this.emit();
  }
  edit(data) {
    if (!this.active || !this.data || ['session', 'conflict', 'remote', 'refreshing'].includes(this.status)) throw new Error('Revisa la sincronización antes de seguir editando.');
    this.data = data; this.dirty = true; this.status = 'pending'; this.error = ''; this.emit();
    clearTimeout(this.timer); this.timer = setTimeout(() => this.flush(), 450);
  }
  async flush({ migration = false } = {}) {
    if (!this.active || !this.dirty || this.inFlight || ['conflict', 'session', 'remote', 'refreshing'].includes(this.status)) return;
    clearTimeout(this.timer);
    if (migration) this.migrationRequested = true;
    if (!this.pending) this.pending = { schemaVersion: 1, baseRevision: this.revision, mutationId: crypto.randomUUID(), financialData: this.data, migration: Boolean(this.migrationRequested) };
    const operation = this.pending; const submitted = operation.financialData;
    this.readEpoch += 1; this.inFlight = true; this.status = 'saving'; this.emit();
    try {
      const { migration: isMigration, ...body } = operation;
      const result = await this.call(isMigration ? '/api/workspace/migrate' : '/api/workspace', { method: isMigration ? 'POST' : 'PUT', body });
      if (!this.active) return;
      if (result.mutationId !== operation.mutationId || result.acceptedRevision !== operation.baseRevision + 1) throw new Error('No se pudo confirmar la versión guardada.');
      this.revision = result.acceptedRevision; this.updatedAt = result.updatedAt; this.pending = null; this.migrationRequested = false;
      this.dirty = this.data !== submitted;
      this.status = result.currentRevision > this.revision ? 'conflict' : this.dirty ? 'pending' : 'saved';
      this.error = this.status === 'conflict' ? 'Hay una versión posterior en la nube. Revisa los cambios antes de continuar.' : '';
      this.emit();
    } catch (error) { this.fail(error); }
    finally { this.inFlight = false; }
    if (this.active && this.dirty && this.status === 'pending') await this.flush();
  }
  async check() {
    if (!this.active || this.inFlight || !this.data || ['session', 'refreshing'].includes(this.status)) return;
    const version = this.revision;
    const epoch = this.readEpoch;
    try {
      const remote = await this.call('/api/workspace');
      if (!this.active || this.inFlight || this.revision !== version || epoch !== this.readEpoch) return;
      if (remote.revision > this.revision) {
        this.readEpoch += 1;
        this.remote = remote; this.status = this.dirty ? 'conflict' : 'remote'; this.emit();
      } else if (!this.dirty && this.status === 'error') { this.status = 'saved'; this.error = ''; this.emit(); }
    } catch (error) { if (epoch === this.readEpoch && this.revision === version && !this.inFlight) this.fail(error); }
  }
  async useCloud() {
    if (!this.active || this.inFlight || this.status === 'refreshing') return;
    const epoch = ++this.readEpoch;
    clearTimeout(this.timer); this.status = 'refreshing'; this.emit();
    try { const remote = await this.call('/api/workspace'); if (this.active && epoch === this.readEpoch) this.accept(remote); }
    catch (error) { if (epoch === this.readEpoch) this.fail(error); }
  }
  async resumeSession(session, userId) {
    if (!this.active) return 'closed';
    if (this.status !== 'session') return 'obsolete';
    if (!session?.authenticated || session.access !== 'allowed' || !session.account) return 'pending';
    if (session.account.id !== this.accountId || session.account.userId !== userId) return 'changed';
    this.status = this.dirty ? 'pending' : 'saved'; this.error = ''; this.emit();
    if (this.dirty) await this.flush(); else await this.check();
    return this.status === 'session' ? 'pending' : 'resumed';
  }
  dispose() { this.active = false; this.readEpoch += 1; clearTimeout(this.timer); this.controller.abort(); }
}
