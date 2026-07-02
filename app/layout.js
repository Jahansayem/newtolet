import './globals.css'
import Providers from './providers'

export const metadata = {
  title: 'NewTolet.Com - Find Rental Properties in Bangladesh',
  description: 'Property rental marketplace in Bangladesh. Find apartments, flats, houses, and commercial spaces for rent. Browse verified property listings with photos and details.',
  keywords: 'rent, property rental, bangladesh, dhaka rent, apartment rent, flat rent, house rent, tolet, sublet',
  authors: [{ name: 'NewTolet.Com', url: 'https://thetolet.com' }],
  creator: 'NewTolet.Com',
  publisher: 'NewTolet.Com',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL('https://thetolet.com'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'NewTolet.Com - Property Rental Marketplace Bangladesh',
    description: 'Find your perfect rental property in Bangladesh. Browse verified listings of apartments, flats, houses, and commercial spaces.',
    url: 'https://thetolet.com',
    siteName: 'NewTolet.Com',
    images: [
      {
        url: 'https://thetolet.com/favicon-512x512.png',
        width: 512,
        height: 512,
        alt: 'NewTolet.Com Logo',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'NewTolet.Com - Property Rental Marketplace',
    description: 'Find rental properties in Bangladesh',
    images: ['https://thetolet.com/favicon-512x512.png'],
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '48x48' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/favicon-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
  manifest: '/site.webmanifest',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
 