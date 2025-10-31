import type { Metadata } from 'next';
import './globals.css';
import { WalletProvider } from '@/components/WalletProvider';
import { FarcasterGate } from '@/components/FarcasterGate';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export const metadata: Metadata = {
  metadataBase: new URL('https://zombie.epicdylan.com'),
  title: '🧟‍♂️ ZOMBIEFICATION - Halloween Zombie Infection Game',
  description: '🎃 Join the Halloween zombie apocalypse on Farcaster! Tip $ZOMBIE to infect humans, claim tips to become undead, and share the final prize pool. Halloween 2025 limited edition!',
  keywords: ['zombie', 'halloween', 'farcaster', 'infection', 'tipping', 'web3', 'crypto', 'apocalypse', 'game'],
  authors: [{ name: 'ABC DAO' }],
  icons: {
    icon: '/icon.png',
    shortcut: '/icon.png',
    apple: '/icon.png',
  },
  manifest: '/manifest.json',
  openGraph: {
    title: '🧟‍♂️ ZOMBIEFICATION - Halloween Zombie Infection Game',
    description: '🎃 Join the Halloween zombie apocalypse on Farcaster! Tip $ZOMBIE to infect humans and share the prize pool.',
    url: 'https://zombie.epicdylan.com',
    siteName: 'ZOMBIEFICATION',
    images: [
      {
        url: '/image.png',
        width: 800,
        height: 600,
        alt: 'ZOMBIEFICATION - Halloween Zombie Game',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: '🧟‍♂️ ZOMBIEFICATION - Halloween Zombie Infection Game',
    description: '🎃 Join the zombie apocalypse! Infect humans, become undead, share the prize pool.',
    images: ['/image.png'],
  },
  other: {
    // Farcaster Frame metadata
    'fc:frame': 'vNext',
    'fc:frame:image': 'https://zombie.epicdylan.com/image.png',
    'fc:frame:image:aspect_ratio': '1.5:1',
    'fc:frame:button:1': '🧟‍♂️ Join Apocalypse',
    'fc:frame:button:1:action': 'link',
    'fc:frame:button:1:target': 'https://zombie.epicdylan.com',
    'fc:frame:post_url': 'https://zombie.epicdylan.com/api/frame',
    // Farcaster Mini App metadata
    'fc:miniapp': JSON.stringify({
      version: '1',
      name: 'ZOMBIEFICATION',
      iconUrl: 'https://zombie.epicdylan.com/icon.png',
      homeUrl: 'https://zombie.epicdylan.com',
      imageUrl: 'https://zombie.epicdylan.com/image.png',
      buttonTitle: '🧟‍♂️ Spread infection',
      splashImageUrl: 'https://zombie.epicdylan.com/splash.png',
      splashBackgroundColor: '#8B0000',
    }),
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark" style={{ colorScheme: 'dark' }}>
      <body className="antialiased min-h-screen text-white" style={{ 
        background: 'linear-gradient(135deg, #0f0f0f 0%, #1a0000 25%, #000000 50%, #1a0a00 75%, #0f0f0f 100%)',
        color: '#f8fafc'
      }}>
        <WalletProvider>
          <FarcasterGate>
            <div className="flex flex-col min-h-screen">
              <Header />
              <main className="flex-1">
                {children}
              </main>
              <Footer />
            </div>
          </FarcasterGate>
        </WalletProvider>
      </body>
    </html>
  );
}