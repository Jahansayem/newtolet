'use client'

import { AuthProvider } from '../src/contexts/AuthContext.jsx'
import ServiceWorkerRegistration from '../components/app/ServiceWorkerRegistration.jsx'
import ThemeController from '../components/app/ThemeController.jsx'

export default function Providers({ children }) {
  return (
    <AuthProvider>
      <ThemeController />
      <ServiceWorkerRegistration />
      {children}
    </AuthProvider>
  )
}
