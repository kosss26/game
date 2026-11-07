/** One writer per open chapter; newer checkpoints replace queued older ones. */
export class SaveQueue<T> {
  private pending: T | null = null;
  private running = false;
  constructor(private write: (value: T) => Promise<boolean>, private status: (ok: boolean) => void) {}
  push(value: T) { this.pending = value; void this.flush(); }
  async flush() {
    if (this.running) return;
    this.running = true;
    try {
      while (this.pending !== null) {
        const value = this.pending;
        let ok = false;
        try { ok = await this.write(value); } catch { /* retain checkpoint for retry */ }
        if (!ok) { this.status(false); return; }
        if (this.pending === value) this.pending = null;
        if (this.pending === null) this.status(true);
      }
    } finally { this.running = false; }
  }
}
