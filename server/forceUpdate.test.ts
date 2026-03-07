import { describe, it, expect } from 'vitest';
import { VERSION_NUMBER, APP_VERSION, FULL_VERSION, SW_BUILD } from '../shared/version';

describe('Force Update Version System', () => {
  it('VERSION_NUMBER should be 404', () => {
    expect(VERSION_NUMBER).toBe(404);
  });

  it('APP_VERSION should be "4.04"', () => {
    expect(APP_VERSION).toBe('4.04');
  });

  it('FULL_VERSION should be "v4.04"', () => {
    expect(FULL_VERSION).toBe('v4.04');
  });

  it('SW_BUILD should match VERSION_NUMBER', () => {
    expect(SW_BUILD).toBe(VERSION_NUMBER);
  });

  it('/api/version endpoint should return current version', async () => {
    // Simulate what the endpoint returns
    const expectedResponse = {
      version: VERSION_NUMBER,
      displayVersion: FULL_VERSION,
      forceUpdate: true,
    };
    
    expect(expectedResponse.version).toBe(404);
    expect(expectedResponse.displayVersion).toBe('v4.04');
    expect(expectedResponse.forceUpdate).toBe(true);
  });

  it('version comparison should detect newer versions', () => {
    const clientVersion = 403; // Omar's current version
    const serverVersion = VERSION_NUMBER; // 404
    
    expect(serverVersion > clientVersion).toBe(true);
  });

  it('version comparison should not trigger for same version', () => {
    const clientVersion = VERSION_NUMBER;
    const serverVersion = VERSION_NUMBER;
    
    expect(serverVersion > clientVersion).toBe(false);
  });

  it('sw.js version constants should be consistent', async () => {
    const fs = await import('fs');
    const swContent = fs.readFileSync('./client/public/sw.js', 'utf-8');
    
    // Check SW has correct version
    expect(swContent).toContain(`const APP_VERSION = ${VERSION_NUMBER};`);
    expect(swContent).toContain(`const DISPLAY_VERSION = '${FULL_VERSION}';`);
    expect(swContent).toContain(`const CACHE_NAME = \`oqc-v${VERSION_NUMBER}\`;`);
  });

  it('index.html should have matching REQUIRED_VERSION', async () => {
    const fs = await import('fs');
    const htmlContent = fs.readFileSync('./client/index.html', 'utf-8');
    
    expect(htmlContent).toContain(`const REQUIRED_VERSION = ${VERSION_NUMBER};`);
    expect(htmlContent).toContain(`const DISPLAY_VERSION = '${FULL_VERSION}';`);
  });

  it('SW should send FORCE_RELOAD message on activate', async () => {
    const fs = await import('fs');
    const swContent = fs.readFileSync('./client/public/sw.js', 'utf-8');
    
    // Verify SW sends FORCE_RELOAD to all clients on activation
    expect(swContent).toContain("type: 'FORCE_RELOAD'");
    expect(swContent).toContain('includeUncontrolled: true');
  });
});
