import './globals.css'
import Providers from './providers'

export const metadata = {
  title: 'NewTolet.Com',
  description: 'Property rental marketplace application',
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
