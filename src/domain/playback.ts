export interface PlaybackRun {
  stop(): void;
  beat(): number | null;
}
export type PlaybackFactory<T> = (
  settings: T,
  current: () => boolean,
) => Promise<PlaybackRun>;

// Cancelling a pending start must never allow late resume/import completion to
// restart sound after Stop, tab switch, sign-out, or an interruption.
export class Playback<T> {
  private generation = 0;
  private run: PlaybackRun | null = null;
  private pending: Promise<unknown> = Promise.resolve();
  constructor(private readonly factory: PlaybackFactory<T>) {}
  start(settings: T): Promise<boolean> {
    this.stop();
    const ticket = this.generation;
    const current = () => ticket === this.generation;
    const previous = this.pending;
    const operation = (async () => {
      await previous;
      if (!current()) return false;
      try {
        const run = await this.factory(settings, current);
        if (!current()) {
          run.stop();
          return false;
        }
        this.run = run;
        return true;
      } catch (error) {
        if (!current()) return false;
        throw error;
      }
    })();
    this.pending = operation.catch(() => {});
    return operation;
  }
  stop(): void {
    ++this.generation;
    const run = this.run;
    this.run = null;
    run?.stop();
  }
  beat(): number | null {
    return this.run?.beat() ?? null;
  }
}
