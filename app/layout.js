import './globals.css'
import Providers from './providers'
import Script from 'next/script'
import { Hind_Siliguri, Poppins } from 'next/font/google'

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-poppins',
})

const hindSiliguri = Hind_Siliguri({
  subsets: ['bengali', 'latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-hind-siliguri',
})

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
    alternateLocale: ['bn_BD'],
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
    <html lang="en" suppressHydrationWarning className={`${poppins.variable} ${hindSiliguri.variable}`}>
      <head>
        <Script id="remove-extension-hydration-attrs" strategy="beforeInteractive">
          {`
            (function () {
              try {
                if (localStorage.getItem('appLanguage') === 'bn') {
                  document.documentElement.lang = 'bn';
                }
              } catch (e) {}

              var extensionAttributePattern = /^(bis_|__processed_)/;

              function removeExtensionAttributes(root) {
                if (!root || !root.querySelectorAll) return;
                var nodes = root.querySelectorAll('*');

                for (var index = 0; index < nodes.length; index += 1) {
                  var node = nodes[index];
                  var attributes = Array.prototype.slice.call(node.attributes || []);

                  for (var attrIndex = 0; attrIndex < attributes.length; attrIndex += 1) {
                    var name = attributes[attrIndex].name;
                    if (extensionAttributePattern.test(name)) {
                      node.removeAttribute(name);
                    }
                  }
                }
              }

              removeExtensionAttributes(document);

              new MutationObserver(function (mutations) {
                for (var index = 0; index < mutations.length; index += 1) {
                  var mutation = mutations[index];

                  if (mutation.type === 'attributes' && extensionAttributePattern.test(mutation.attributeName)) {
                    mutation.target.removeAttribute(mutation.attributeName);
                  }

                  for (var nodeIndex = 0; nodeIndex < mutation.addedNodes.length; nodeIndex += 1) {
                    removeExtensionAttributes(mutation.addedNodes[nodeIndex]);
                  }
                }
              }).observe(document.documentElement, {
                attributes: true,
                childList: true,
                subtree: true
              });
            })();
          `}
        </Script>
      </head>
      <body suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
 
