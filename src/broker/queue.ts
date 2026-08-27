export type TaskFn<T = any> = () => Promise<T>;

export class ConsultationQueue {
  private queue: Array<() => Promise<void>> = [];
  private isProcessing = false;

  async enqueue<T>(task: TaskFn<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await task();
          resolve(result);
        } catch (err) {
          reject(err);
        }
      });
      this.advanceQueue();
    });
  }

  private async advanceQueue(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) return;
    this.isProcessing = true;
    const next = this.queue.shift();
    if (next) {
      try {
        await next();
      } finally {
        this.isProcessing = false;
        this.advanceQueue();
      }
    }
  }

  get length(): number {
    return this.queue.length;
  }
}
