export type PhotoState = 'local' | 'uploading' | 'uploaded' | 'failed';
export interface UploadReceipt {
  photoId: string;
  captureId: string;
  slot: number;
}
export interface PhotoDraft {
  captureId: string;
  blob: Blob;
  previewUrl: string;
  status: PhotoState;
  receipt?: UploadReceipt;
  error?: string;
}
export interface UploadPort {
  upload(input: { captureId: string; slot: number; blob: Blob; signal: AbortSignal }): Promise<UploadReceipt>;
}
export interface PhotoEnvironment {
  makeId(): string;
  makeUrl(blob: Blob): string;
  releaseUrl(url: string): void;
}
const browserEnvironment: PhotoEnvironment = {
  makeId: () => crypto.randomUUID(),
  makeUrl: (blob) => URL.createObjectURL(blob),
  releaseUrl: (url) => URL.revokeObjectURL(url),
};

export class PhotoDrafts {
  private slots: Array<PhotoDraft | null> = Array.from({ length: 6 }, () => null);
  private requests = new Map<number, AbortController>();
  private disposed = false;
  private primary: number | null = null;
  private maxBytes: number;
  private transport: UploadPort | undefined;
  private environment: PhotoEnvironment;

  constructor(maxBytes: number, transport?: UploadPort, environment = browserEnvironment) {
    if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) throw new RangeError('INVALID_SIZE_LIMIT');
    this.maxBytes = maxBytes;
    this.transport = transport;
    this.environment = environment;
  }

  private assertSlot(slot: number): void {
    if (this.disposed) throw new Error('DRAFTS_DISPOSED');
    if (!Number.isInteger(slot) || slot < 0 || slot >= 6) throw new RangeError('INVALID_SLOT');
  }

  snapshot(): { photos: Array<PhotoDraft | null>; primarySlot: number | null } {
    return {
      photos: this.slots.map((p) => (p ? { ...p, receipt: p.receipt ? { ...p.receipt } : undefined } : null)),
      primarySlot: this.primary,
    };
  }

  setCapture(slot: number, blob: Blob): void {
    this.assertSlot(slot);
    if (blob.type !== 'image/jpeg' || blob.size < 1 || blob.size > this.maxBytes) throw new Error('INVALID_PHOTO');
    const previous = this.slots[slot];
    if (previous?.status === 'uploaded') throw new Error('SERVER_REPLACE_REQUIRED');
    const captureId = this.environment.makeId();
    if (!captureId || this.slots.some((p) => p?.captureId === captureId)) throw new Error('INVALID_CAPTURE_ID');
    const previewUrl = this.environment.makeUrl(blob);
    this.requests.get(slot)?.abort();
    this.requests.delete(slot);
    if (previous) this.environment.releaseUrl(previous.previewUrl);
    this.slots[slot] = { captureId, blob, previewUrl, status: 'local' };
    if (this.primary === null) this.primary = slot;
  }

  setPrimary(slot: number): void {
    this.assertSlot(slot);
    if (!this.slots[slot]) throw new Error('EMPTY_SLOT');
    this.primary = slot; // Local preference only; no server mutation or automatic profile publication.
  }

  swapLocal(first: number, second: number): void {
    this.assertSlot(first);
    this.assertSlot(second);
    if ([this.slots[first], this.slots[second]].some((p) => p?.status === 'uploading' || p?.status === 'uploaded')) {
      throw new Error('SERVER_REORDER_REQUIRED');
    }
    [this.slots[first], this.slots[second]] = [this.slots[second] ?? null, this.slots[first] ?? null];
    if (this.primary === first) this.primary = second;
    else if (this.primary === second) this.primary = first;
  }

  async upload(slot: number): Promise<UploadReceipt> {
    this.assertSlot(slot);
    const photo = this.slots[slot];
    if (!photo) throw new Error('EMPTY_SLOT');
    if (!this.transport) throw new Error('UPLOAD_NOT_CONFIGURED');
    if (photo.status === 'uploading') throw new Error('UPLOAD_BUSY');
    if (photo.status === 'uploaded' && photo.receipt) return { ...photo.receipt };
    const controller = new AbortController();
    this.requests.set(slot, controller);
    this.slots[slot] = { ...photo, status: 'uploading', error: undefined };
    const isCurrent = () =>
      !this.disposed && this.requests.get(slot) === controller && this.slots[slot]?.captureId === photo.captureId;
    try {
      const receipt = await this.transport.upload({ captureId: photo.captureId, slot, blob: photo.blob, signal: controller.signal });
      if (!isCurrent() || controller.signal.aborted) throw new Error('UPLOAD_CANCELLED');
      if (
        !receipt ||
        typeof receipt.photoId !== 'string' ||
        !receipt.photoId.trim() ||
        receipt.captureId !== photo.captureId ||
        receipt.slot !== slot
      ) {
        throw new Error('INVALID_UPLOAD_RECEIPT');
      }
      this.slots[slot] = { ...photo, status: 'uploaded', receipt: { ...receipt } };
      return { ...receipt };
    } catch (error) {
      if (isCurrent()) this.slots[slot] = { ...photo, status: 'failed', error: 'UPLOAD_FAILED' };
      throw new Error(isCurrent() ? 'UPLOAD_FAILED' : 'UPLOAD_CANCELLED', { cause: error });
    } finally {
      if (this.requests.get(slot) === controller) this.requests.delete(slot);
    }
  }

  dispose(): void {
    this.disposed = true;
    this.requests.forEach((controller) => controller.abort());
    this.requests.clear();
    this.slots.forEach((p) => {
      if (p) this.environment.releaseUrl(p.previewUrl);
    });
    this.slots = Array.from({ length: 6 }, () => null);
    this.primary = null;
  }
}