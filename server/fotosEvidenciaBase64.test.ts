import { describe, it, expect, vi } from 'vitest';

/**
 * Tests for /api/fotos-evidencia-base64 endpoint
 * Verifies that the endpoint correctly fetches photos from S3 and returns base64 data URIs
 */
describe('POST /api/fotos-evidencia-base64', () => {
  it('should return empty fotos map for empty itemIds array', async () => {
    const response = await fetch('http://localhost:3000/api/fotos-evidencia-base64', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemIds: [] }),
    });
    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data).toHaveProperty('fotos');
    expect(data.fotos).toEqual({});
  });

  it('should return fotos map for valid itemIds', async () => {
    // Use item ID 1 which should exist in the database
    const response = await fetch('http://localhost:3000/api/fotos-evidencia-base64', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemIds: [1] }),
    });
    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data).toHaveProperty('fotos');
    // Should return an object with item ID as key
    expect(typeof data.fotos).toBe('object');
  });

  it('should return base64 data URIs for items with photos', async () => {
    // Fetch a few items to test
    const response = await fetch('http://localhost:3000/api/fotos-evidencia-base64', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemIds: [1, 2, 3] }),
    });
    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data).toHaveProperty('fotos');
    
    // Check that any returned photo is a valid data URI or null
    for (const [_id, value] of Object.entries(data.fotos)) {
      if (value !== null) {
        expect(typeof value).toBe('string');
        expect((value as string).startsWith('data:')).toBe(true);
      }
    }
  });

  it('should handle non-existent itemIds gracefully', async () => {
    const response = await fetch('http://localhost:3000/api/fotos-evidencia-base64', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemIds: [999999] }),
    });
    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data).toHaveProperty('fotos');
    // Non-existent items should not appear in the map
    expect(data.fotos[999999]).toBeUndefined();
  });

  it('should handle missing body gracefully', async () => {
    const response = await fetch('http://localhost:3000/api/fotos-evidencia-base64', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data).toHaveProperty('fotos');
    expect(data.fotos).toEqual({});
  });
});
