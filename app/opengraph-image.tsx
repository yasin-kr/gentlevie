import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export const alt = 'gentle vie — The art of living well';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function OpenGraphImage() {
  const editorialFont = await readFile(join(process.cwd(), 'public/assets/editorial-regular.woff'));
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: '#0845b7',
          color: '#f3f0e8',
          padding: '56px 72px',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div style={{ display: 'flex', fontSize: 17, letterSpacing: '5px' }}>THE ART OF LIVING WELL</div>
        <div
          style={{
            display: 'flex',
            position: 'absolute',
            right: -115,
            bottom: -210,
            width: 500,
            height: 730,
            border: '1px solid rgba(243, 240, 232, 0.3)',
            borderRadius: '250px 250px 0 0',
          }}
        />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>
          <div style={{ display: 'flex', fontFamily: 'Editorial', fontSize: 172, lineHeight: 1, letterSpacing: '-9px' }}>gentle vie</div>
          <div style={{ display: 'flex', fontSize: 29, letterSpacing: '-0.5px' }}>Hayatı biraz yavaşlat</div>
        </div>
        <div
          style={{
            display: 'flex',
            borderTop: '1px solid rgba(243, 240, 232, 0.45)',
            paddingTop: 22,
            fontSize: 16,
            letterSpacing: '4px',
          }}
        >
          STYLE / LIVING / JOURNAL
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [{ name: 'Editorial', data: editorialFont, weight: 400, style: 'normal' }],
    },
  );
}
