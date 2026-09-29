export type CameraErrorCode =
  | 'CAMERA_UNAVAILABLE'
  | 'CAMERA_PERMISSION_DENIED'
  | 'CAMERA_NOT_FOUND'
  | 'CAMERA_OPEN_FAILED'
  | 'CAMERA_CANCELLED'
  | 'CAMERA_NOT_READY'
  | 'CAPTURE_BUSY'
  | 'CAPTURE_FAILED'
  | 'CAPTURE_TOO_LARGE';

export class CameraError extends Error {
  readonly code: CameraErrorCode;
  constructor(code: CameraErrorCode) {
    super(code);
    this.name = 'CameraError';
    this.code = code;
  }
}

export interface CameraEnvironment {
  secure: boolean;
  mediaDevices?: Pick<MediaDevices, 'getUserMedia'>;
  createCanvas: () => HTMLCanvasElement;
}

function browserEnvironment(): CameraEnvironment {
  return {
    secure: globalThis.isSecureContext === true,
    mediaDevices: globalThis.navigator?.mediaDevices,
    createCanvas: () => document.createElement('canvas'),
  };
}

export class CameraController {
  private video: HTMLVideoElement;
  private environment: CameraEnvironment;
  private maxPixels: number;
  private stream: MediaStream | null = null;
  private generation = 0;
  private ready = false;
  private capturing = false;

  constructor(video: HTMLVideoElement, maxPixels: number, environment = browserEnvironment()) {
    if (!Number.isSafeInteger(maxPixels) || maxPixels < 1) throw new RangeError('INVALID_PIXEL_LIMIT');
    this.video = video;
    this.maxPixels = maxPixels;
    this.environment = environment;
  }

  async open(facingMode: 'user' | 'environment' = 'user'): Promise<void> {
    this.close();
    const generation = this.generation;
    const devices = this.environment.mediaDevices;
    if (!this.environment.secure || !devices?.getUserMedia) throw new CameraError('CAMERA_UNAVAILABLE');
    let acquired: MediaStream | null = null;
    try {
      acquired = await devices.getUserMedia({ audio: false, video: { facingMode: { ideal: facingMode } } });
      if (generation !== this.generation) throw new CameraError('CAMERA_CANCELLED');
      this.stream = acquired;
      this.video.muted = true;
      this.video.playsInline = true;
      this.video.srcObject = acquired;
      await this.video.play();
      if (generation !== this.generation) throw new CameraError('CAMERA_CANCELLED');
      this.ready = true;
    } catch (error) {
      acquired?.getTracks().forEach((track) => track.stop());
      if (generation !== this.generation) throw new CameraError('CAMERA_CANCELLED');
      this.stream = null;
      this.video.srcObject = null;
      this.ready = false;
      if (error instanceof CameraError) throw error;
      const name = error instanceof Error ? error.name : '';
      throw new CameraError(
        name === 'NotAllowedError'
          ? 'CAMERA_PERMISSION_DENIED'
          : name === 'NotFoundError'
            ? 'CAMERA_NOT_FOUND'
            : 'CAMERA_OPEN_FAILED',
      );
    }
  }

  async capture(): Promise<Blob> {
    if (this.capturing) throw new CameraError('CAPTURE_BUSY');
    const { videoWidth: width, videoHeight: height, readyState } = this.video;
    if (
      !this.ready ||
      !this.stream?.getVideoTracks().some((track) => track.readyState === 'live') ||
      width < 1 ||
      height < 1 ||
      readyState < 2
    ) {
      throw new CameraError('CAMERA_NOT_READY');
    }
    if (width * height > this.maxPixels) throw new CameraError('CAPTURE_TOO_LARGE');
    const generation = this.generation;
    this.capturing = true;
    try {
      const canvas = this.environment.createCanvas();
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');
      if (!context) throw new CameraError('CAPTURE_FAILED');
      context.drawImage(this.video, 0, 0, width, height);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
      if (generation !== this.generation) throw new CameraError('CAMERA_CANCELLED');
      if (!blob || !blob.size || blob.type !== 'image/jpeg') throw new CameraError('CAPTURE_FAILED');
      return blob;
    } catch (error) {
      if (error instanceof CameraError) throw error;
      throw new CameraError('CAPTURE_FAILED');
    } finally {
      this.capturing = false;
    }
  }

  close(): void {
    this.generation += 1;
    this.ready = false;
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    this.video.srcObject = null;
  }
}