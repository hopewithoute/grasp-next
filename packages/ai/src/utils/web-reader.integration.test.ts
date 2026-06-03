import { describe, expect, it } from 'vitest';
import { extractWebpageContent } from './web-reader';

// Gunakan timeout panjang (15 detik) karena Cloudflare Browser Run perlu memuat Chromium headless
const INTEGRATION_TIMEOUT = 15000;

/**
 * INTEGRATION TESTS
 * Tes ini menembak internet nyata. Tidak ada MOCKING.
 * Untuk menjalankan tes ini, pastikan variabel environment berikut tersedia di .env Anda:
 * - CLOUDFLARE_ACCOUNT_ID
 * - CLOUDFLARE_API_TOKEN
 * 
 * Jalankan dengan command: 
 * npx vitest run web-reader.integration.test.ts
 */
describe('extractWebpageContent (Integration)', () => {

  it('Layer 1 Success: extracts clean text from a standard unprotected website', async () => {
    // example.com adalah website statis tanpa WAF yang rumit
    const url = 'https://example.com';
    const result = await extractWebpageContent(url);
    
    // Pastikan hasilnya mengandung teks khas example.com
    expect(result).toContain('EXAMPLE DOMAIN');
    expect(result).toContain('This domain is for use in documentation examples');
    
    // Pastikan hasil ekstraksi cukup panjang (minimal 50 karakter untuk example.com)
    expect(result.length).toBeGreaterThan(50);
  }, INTEGRATION_TIMEOUT);

  it('Layer 2 Fallback: successfully extracts from a heavily protected WAF site', async () => {
    // Jika kredensial tidak diset, batalkan (skip) tes ini agar tidak error konyol di CI
    if (!process.env.CLOUDFLARE_ACCOUNT_ID || !process.env.CLOUDFLARE_API_TOKEN) {
      console.warn('Skipping Layer 2 integration test: CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_API_TOKEN not set.');
      return;
    }

    // nowsecure.nl is a test site for Cloudflare WAF bypass
    const url = 'https://nowsecure.nl';
    const result = await extractWebpageContent(url);
    
    // Hasilnya harus berupa Markdown (karena keluar dari Cloudflare API)
    expect(result.toLowerCase()).toContain('nowsecure');
    
    // Membuktikan bahwa WAF challenge tidak ikut terbaca sebagai konten
    expect(result).not.toContain('Just a moment...');
    
    // Memastikan ekstraksi kontennya berhasil
    expect(result.length).toBeGreaterThan(30);
  }, INTEGRATION_TIMEOUT);

});
