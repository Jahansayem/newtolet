import './globals.css'
import Providers from './providers'
import Script from 'next/script'
import { Hind_Siliguri, Poppins } from 'next/font/google'
import { DEFAULT_OG_IMAGE, ROUTE_SEO, SITE_NAME, SITE_URL } from '../src/lib/seo/siteMeta.js'
import { siteJsonLd } from '../src/lib/seo/jsonLd.js'

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
  // No canonical or og:url here: those are per route (app/**/layout.js), otherwise every
  // page would inherit the home URL as its canonical.
  description: ROUTE_SEO.home.description,
  openGraph: {
    siteName: SITE_NAME,
    type: 'website',
    locale: 'en_US',
    alternateLocale: ['bn_BD'],
    images: [{ url: DEFAULT_OG_IMAGE, width: 512, height: 512, alt: `${SITE_NAME} logo` }],
  },
  twitter: { card: 'summary', images: [DEFAULT_OG_IMAGE] },
  title: {
    default: ROUTE_SEO.home.title,
    template: '%s',
  },
  keywords: 'rent, house rent, flat rent, to-let, tolet, bachelor room, sublet, hostel, office rent, shop rent, dhaka, bangladesh',
  authors: [{ name: SITE_NAME, url: SITE_URL }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL(SITE_URL),
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
  // Google Search Console ownership proof; removing it un-verifies the property.
  verification: {
    google: 'Slj_jSwBX5q4HEXCN6LN6a-63wlHrWir34vBKYp7RVo',
  },
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
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(siteJsonLd()) }}
        />
      </head>
      <body suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
 
