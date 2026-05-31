import { NextResponse } from 'next/server';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://crypto-peggle.vercel.app';

export async function GET() {
  return NextResponse.json({
    accountAssociation: {
      // Generate at: https://warpcast.com/~/developers/mini-apps
      // Domain must match your deployed URL (e.g. crypto-peggle.vercel.app)
      header:    process.env.FARCASTER_HEADER    ?? '',
      payload:   process.env.FARCASTER_PAYLOAD   ?? '',
      signature: process.env.FARCASTER_SIGNATURE ?? '',
    },
    miniapp: {
      version: '1',
      name: 'Crypto Peggle',
      subtitle: 'Clear all the orange pegs.',
      description:
        'Aim and fire a ball through a field of stippled dot pegs. Clear every orange peg to advance. Indestructible bar bumpers deflect your shot unpredictably. Score saved on Base.',
      homeUrl: APP_URL,
      iconUrl: `${APP_URL}/icon.png`,
      splashImageUrl: `${APP_URL}/splash.png`,
      splashBackgroundColor: '#ede9df',
      heroImageUrl: `${APP_URL}/og-image.png`,
      ogTitle: 'Crypto Peggle',
      ogDescription: 'Clear all the orange pegs. How far can you go?',
      ogImageUrl: `${APP_URL}/og-image.png`,
      screenshotUrls: [],
      primaryCategory: 'games',
      tags: ['game', 'peggle', 'arcade', 'farcaster', 'base'],
      tagline: 'Clear all the orange pegs.',
      noindex: false,
      requiredChains: ['eip155:8453'],
      requiredCapabilities: [],
    },
  });
}
