'use client'

import { AuthProvider } from '../src/contexts/AuthContext.jsx'
import { LanguageProvider } from '../src/i18n/LanguageContext.jsx'
import ServiceWorkerRegistration from '../components/app/ServiceWorkerRegistration.jsx'
import ThemeController from '../components/app/ThemeController.jsx'

export default function Providers({ children }) {
  return (
    <AuthProvider>
      <LanguageProvider>
        <ThemeController />
        <ServiceWorkerRegistration />
        {children}
      </LanguageProvider>
    </AuthProvider>
  )
}
