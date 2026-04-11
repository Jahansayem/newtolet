import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-3">Page not found</h1>
        <p className="text-gray-600 mb-6">
          The page you requested does not exist or has been moved.
        </p>
        <Link
          href="/"
          className="inline-flex items-center justify-center rounded-lg bg-[#1E73B8] px-5 py-3 text-white font-semibold hover:bg-[#1665a0] transition-colors"
        >
          Go to homepage
        </Link>
      </div>
    </div>
  )
}
