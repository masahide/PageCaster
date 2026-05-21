import { AppError } from "../errors.js";
import { ImageHasher } from "./hashImage.js";

type PageChangeWatcherOptions = {
  timeoutMs: number;
  pollMs: number;
  captureBuffer: () => Promise<Buffer>;
  hasher?: ImageHasher;
  sleep?: (ms: number) => Promise<void>;
  stableSamples?: number;
};

const defaultSleep = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

export class PageChangeWatcher {
  private readonly hasher: ImageHasher;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(private readonly options: PageChangeWatcherOptions) {
    this.hasher = options.hasher ?? new ImageHasher();
    this.sleep = options.sleep ?? defaultSleep;
  }

  async waitForChange(previousHash: string, pageIndex?: number): Promise<string> {
    const startedAt = Date.now();
    const requiredStableSamples = this.options.stableSamples ?? 2;
    let candidateHash: string | undefined;
    let candidateSamples = 0;

    while (Date.now() - startedAt <= this.options.timeoutMs) {
      const nextHash = this.hasher.sha256(await this.options.captureBuffer());

      if (nextHash !== previousHash) {
        if (nextHash === candidateHash) {
          candidateSamples += 1;
        } else {
          candidateHash = nextHash;
          candidateSamples = 1;
        }

        if (candidateSamples >= requiredStableSamples) {
          return nextHash;
        }
      } else {
        candidateHash = undefined;
        candidateSamples = 0;
      }

      await this.sleep(this.options.pollMs);
    }

    throw new AppError(
      "PAGE_CHANGE_TIMEOUT",
      "Page did not change before timeout.",
      pageIndex
    );
  }
}
