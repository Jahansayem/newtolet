'use client'

import { AuthProvider } from '../src/contexts/AuthContext.jsx'
import { AdminAccessProvider } from '../src/contexts/AdminAccessContext.jsx'
import { LanguageProvider } from '../src/i18n/LanguageContext.jsx'
import ServiceWorkerRegistration from '../components/app/ServiceWorkerRegistration.jsx'
import ThemeController from '../components/app/ThemeController.jsx'
import GoogleAnalytics from '../components/app/GoogleAnalytics.jsx'

export default function Providers({ children }) {
  return (
    <AuthProvider>
      <AdminAccessProvider>
        <LanguageProvider>
          <GoogleAnalytics />
          <ThemeController />
          <ServiceWorkerRegistration />
          {children}
        </LanguageProvider>
      </AdminAccessProvider>
    </AuthProvider>
  )
}
