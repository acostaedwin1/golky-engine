import { describe, expect, it } from 'vitest';
import { ENGINE_NAME } from '../src/index.ts';

describe('smoke', () => {
  it('exports the engine name', () => {
    expect(ENGINE_NAME).toBe('golky-engine');
  });
});
