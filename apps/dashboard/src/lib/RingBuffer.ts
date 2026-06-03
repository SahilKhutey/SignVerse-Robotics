import { TelemetryFrame } from '@signverse/shared-types';

export class RingBuffer<T> {
  private buffer: T[];
  private capacity: number;
  private writePointer: number = 0;
  private isFull: boolean = false;

  constructor(capacity: number) {
    this.capacity = capacity;
    this.buffer = new Array<T>(capacity);
  }

  public push(item: T): void {
    this.buffer[this.writePointer] = item;
    this.writePointer = (this.writePointer + 1) % this.capacity;
    if (this.writePointer === 0) {
      this.isFull = true;
    }
  }

  public getSnapshot(): T[] {
    if (!this.isFull) {
      return this.buffer.slice(0, this.writePointer);
    }
    const result = new Array<T>(this.capacity);
    for (let i = 0; i < this.capacity; i++) {
      result[i] = this.buffer[(this.writePointer + i) % this.capacity];
    }
    return result;
  }

  public size(): number {
    return this.isFull ? this.capacity : this.writePointer;
  }

  public clear(): void {
    this.buffer = new Array<T>(this.capacity);
    this.writePointer = 0;
    this.isFull = false;
  }
}

// Export a singleton instance with capacity 2000 for storing telemetry downsampled to 200Hz
export const telemetryRingBuffer = new RingBuffer<TelemetryFrame>(2000);
