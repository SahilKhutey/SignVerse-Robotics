import { describe, it, expect, beforeEach } from 'vitest';
import { RingBuffer } from '../lib/RingBuffer';

describe('RingBuffer', () => {
  let buffer: RingBuffer<number>;

  beforeEach(() => {
    buffer = new RingBuffer<number>(3);
  });

  it('should initialize empty', () => {
    expect(buffer.size()).toBe(0);
    expect(buffer.getSnapshot()).toEqual([]);
  });

  it('should push elements and increase size', () => {
    buffer.push(10);
    expect(buffer.size()).toBe(1);
    expect(buffer.getSnapshot()).toEqual([10]);

    buffer.push(20);
    expect(buffer.size()).toBe(2);
    expect(buffer.getSnapshot()).toEqual([10, 20]);
  });

  it('should handle buffer overflow by overwriting oldest elements', () => {
    buffer.push(10);
    buffer.push(20);
    buffer.push(30);
    
    // Buffer is full (capacity = 3)
    expect(buffer.size()).toBe(3);
    expect(buffer.getSnapshot()).toEqual([10, 20, 30]);

    // Overwrite oldest element (10)
    buffer.push(40);
    expect(buffer.size()).toBe(3);
    expect(buffer.getSnapshot()).toEqual([20, 30, 40]);

    // Overwrite next oldest (20)
    buffer.push(50);
    expect(buffer.size()).toBe(3);
    expect(buffer.getSnapshot()).toEqual([30, 40, 50]);
  });

  it('should clear buffer correctly', () => {
    buffer.push(10);
    buffer.push(20);
    buffer.clear();
    
    expect(buffer.size()).toBe(0);
    expect(buffer.getSnapshot()).toEqual([]);
  });
});
