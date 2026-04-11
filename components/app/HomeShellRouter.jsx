'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Listprovaider from '../../src/Component/Route/Listprovaider.jsx'
import Home from '../../src/Component/Home/Home.jsx'
import About from '../../src/Component/Home/About.jsx'
import Contact from '../../src/Component/Home/Contact.jsx'
import PolicyPage from '../../src/Component/Home/PolicyPage.jsx'
import { privacyPolicy, refundPolicy, termsPolicy } from '../../src/Component/Home/policyContent.js'
import Admin from '../../src/Component/Home/Admin.jsx'
import Dashboard from '../../src/Component/Dashboard/Dashboard.jsx'
import Earnmoney from '../../src/Component/Navber/Earnmoney.jsx'
import Propertylist from '../../src/Component/Navber/Propertylist.jsx'
import Propertylist2 from '../../src/Component/Navber/Propertylist2.jsx'
import CreateOrderForm from '../../src/Component/Navber/CreateOrderForm.jsx'
import Addproperty from '../../src/Component/Navber/Addproperty.jsx'
import EditProperty from '../../src/Component/Navber/EditProperty.jsx'
import MyOrders from '../../src/Component/Navber/MyOrders.jsx'
import MyProperties from '../../src/Component/Navber/MyProperties.jsx'
import PaymentConfirmPage from '../../src/Component/Navber/PaymentConfirmPage.jsx'
import Listdetails from '../../src/Component/Home/Listdetails.jsx'
import Book from '../../src/Component/Route/Book.jsx'
import ForgotPassword from '../../src/Component/Route/ForgotPassword.jsx'
import Login from '../../src/Component/Route/Login.jsx'
import PrivateRouter from '../../src/Component/Route/PrivateRouter.jsx'
import Registration from '../../src/Component/Route/Registration.jsx'
import ResetPassword from '../../src/Component/Route/ResetPassword.jsx'
import AdminRoute from '../../src/Component/Route/AdminRoute.jsx'
import AdminDashboard from '../../src/Component/Admin/AdminDashboard.jsx'

function RootPageContent() {
  const searchParams = useSearchParams()
  const page = searchParams?.get('page') || ''

  switch (page) {
    case 'about':
      return <About />
    case 'addproperty':
      return (
        <PrivateRouter>
          <Addproperty />
        </PrivateRouter>
      )
    case 'admin':
      return (
        <AdminRoute>
          <Admin />
        </AdminRoute>
      )
    case 'admin-dashboard':
      return (
        <AdminRoute>
          <AdminDashboard />
        </AdminRoute>
      )
    case 'book':
      return <Book />
    case 'book-buy-credits':
      return (
        <PrivateRouter>
          <Book />
        </PrivateRouter>
      )
    case 'contact':
      return <Contact />
    case 'dashboard':
      return <Dashboard />
    case 'earnmoney':
      return <Earnmoney />
    case 'edit-property':
      return (
        <PrivateRouter>
          <EditProperty />
        </PrivateRouter>
      )
    case 'forgot-password':
      return <ForgotPassword />
    case 'listdetails':
      return <Listdetails />
    case 'login':
      return <Login />
    case 'my-orders':
      return (
        <PrivateRouter>
          <MyOrders />
        </PrivateRouter>
      )
    case 'my-properties':
      return (
        <PrivateRouter>
          <MyProperties />
        </PrivateRouter>
      )
    case 'orderhome':
      return <CreateOrderForm />
    case 'payment-confirm':
      return <PaymentConfirmPage />
    case 'privacy':
      return <PolicyPage policy={privacyPolicy} />
    case 'propertylist':
      return <Propertylist />
    case 'propertylist2':
      return <Propertylist2 />
    case 'refund':
      return <PolicyPage policy={refundPolicy} />
    case 'registration':
      return <Registration />
    case 'reset-password':
      return <ResetPassword />
    case 'terms':
      return <PolicyPage policy={termsPolicy} />
    default:
      return <Home />
  }
}

export default function HomeShellRouter() {
  return (
    <Suspense fallback={null}>
      <Listprovaider>
        <RootPageContent />
      </Listprovaider>
    </Suspense>
  )
}
