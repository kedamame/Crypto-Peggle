import { NextResponse } from 'next/server';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://crypto-peggle.vercel.app';

export async function GET() {
  return NextResponse.json({
    accountAssociation: {
      // Generate at: https://warpcast.com/~/developers/mini-apps
      // Domain must match your deployed URL (e.g. crypto-peggle.vercel.app)
      header:    process.env.FARCASTER_HEADER    ?? 'eyJmaWQiOjIxMTE4OSwidHlwZSI6ImN1c3RvZHkiLCJrZXkiOiIweEFBZTM5NEQ1MWUyYzBhOTczNWUwQmI2NzdFMTJmMjE1MjVCRWI1NTIifQ',
      payload:   process.env.FARCASTER_PAYLOAD   ?? 'eyJkb21haW4iOiJjcnlwdG8tcGVnZ2xlLnZlcmNlbC5hcHAifQ',
      signature: process.env.FARCASTER_SIGNATURE ?? '6tcKbejT0iY5QVMKiM6zP6MAG6cmOPY1McW7opnM/QVVui3w2QmAvr0gD+3NbWkOhLHh7dNOPu/SkR0baLjgFBw=',
    },
    miniapp: {
      version: '1',
      name: 'DotShot',
      subtitle: 'Clear all the orange pegs.',
      description:
        'Fire a ball through dot pegs. Clear every orange peg to advance. Indestructible bar bumpers create unpredictable deflections. Score recorded on Base.',
      homeUrl: APP_URL,
      iconUrl: `${APP_URL}/icon.png`,
      splashImageUrl: `${APP_URL}/splash.png`,
      splashBackgroundColor: '#ede9df',
      heroImageUrl: `${APP_URL}/og-image.png`,
      ogTitle: 'DotShot',
      ogDescription: 'Clear all the orange pegs. How far can you go?',
      ogImageUrl: `${APP_URL}/og-image.png`,
      screenshotUrls: [],
      primaryCategory: 'games',
      tags: ['game', 'dotshot', 'arcade', 'farcaster', 'base'],
      tagline: 'Clear all the orange pegs.',
      noindex: false,
      requiredChains: ['eip155:8453'],
      requiredCapabilities: [],
    },
  });
}
