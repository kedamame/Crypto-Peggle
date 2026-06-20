import { ImageResponse } from 'next/og';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BG   = '#ede9df';
const INK  = '#0f0f0d';
const GOLD = '#c8a000';
const MUT  = '#7a7670';
const SEP  = '#c0bcb4';

const h = (top: number, left: number, sz: number) => (
  <div style={{ position: 'absolute', top, left, width: sz, height: sz, borderRadius: '50%', borderWidth: 3, borderStyle: 'solid', borderColor: INK, background: 'transparent', display: 'flex' }} />
);
const f = (top: number, left: number, sz: number) => (
  <div style={{ position: 'absolute', top, left, width: sz, height: sz, borderRadius: '50%', background: INK, display: 'flex' }} />
);
const g = (top: number, left: number, sz: number) => (
  <div style={{ position: 'absolute', top, left, width: sz, height: sz, borderRadius: '50%', background: GOLD, display: 'flex' }} />
);

export async function GET() {
  return new ImageResponse(
    (
      <div style={{ width: 1200, height: 630, background: BG, display: 'flex', flexDirection: 'row' }}>

        {/* ── Left: title ── */}
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', width: 520, height: 630, paddingLeft: 72, paddingBottom: 60, flexShrink: 0 }}>
          <div style={{ display: 'flex', fontSize: 20, fontWeight: 700, color: GOLD, letterSpacing: '0.14em', marginBottom: 16, whiteSpace: 'nowrap' }}>MINI GAME</div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', fontSize: 128, fontWeight: 900, color: INK,  lineHeight: 0.88, letterSpacing: '-0.03em', whiteSpace: 'nowrap' }}>DOT</div>
            <div style={{ display: 'flex', fontSize: 128, fontWeight: 900, color: GOLD, lineHeight: 0.88, letterSpacing: '-0.03em', whiteSpace: 'nowrap' }}>SHOT</div>
          </div>
          <div style={{ display: 'flex', fontSize: 22, color: MUT, marginTop: 28, whiteSpace: 'nowrap' }}>Clear all the orange pegs.</div>
        </div>

        {/* ── Divider ── */}
        <div style={{ width: 1, height: 500, background: SEP, alignSelf: 'center', display: 'flex', flexShrink: 0 }} />

        {/* ── Right: peg field ── */}
        <div style={{ display: 'flex', position: 'relative', flex: 1, height: 630 }}>

          {/* Ball */}
          {f(24, 286, 22)}

          {/* Row 1 */}
          {h(78, 50,  52)}{g(78, 200, 52)}{h(78, 350, 52)}{h(78, 500, 52)}

          {/* Row 2 staggered */}
          {f(162, 125, 52)}{h(162, 275, 52)}{f(162, 425, 52)}

          {/* Bumper */}
          <div style={{ position: 'absolute', top: 244, left: 86, width: 210, height: 14, borderRadius: 7, background: INK, display: 'flex' }} />

          {/* Row 3 */}
          {h(290, 50, 48)}{h(290, 200, 48)}{g(290, 350, 48)}{h(290, 500, 48)}

          {/* Row 4 staggered */}
          {f(366, 125, 44)}{h(366, 275, 44)}{h(366, 425, 44)}

          {/* Row 5 */}
          {h(438, 50, 44)}{g(438, 200, 44)}{h(438, 350, 44)}{f(438, 500, 44)}

          {/* Row 6 staggered */}
          {h(510, 125, 38)}{h(510, 275, 38)}{g(510, 425, 38)}

        </div>

      </div>
    ),
    { width: 1200, height: 630 },
  );
}
