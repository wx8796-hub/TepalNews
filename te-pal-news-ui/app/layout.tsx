import type { Metadata, Viewport } from 'next'
import { Inter, Space_Grotesk } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { Toaster } from 'sonner'
import { AppBar } from '@/components/app-bar'
import { BottomNav } from '@/components/bottom-nav'
import { AuthProvider } from '@/lib/auth-context'
import { PostsProvider } from '@/lib/posts-context'
import './globals.css'

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" })
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-space-grotesk" })

export const metadata: Metadata = {
  title: 'TePal News',
  description: 'A warm community for TePal members to share updates, photos, and English tips.',
}

export const viewport: Viewport = {
  themeColor: "#d4783c",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${spaceGrotesk.variable} font-sans antialiased`}>
        <AuthProvider>
        <PostsProvider>
          <AppBar />
          <main className="min-h-screen pb-20 md:pb-0">
            {children}
          </main>
        </PostsProvider>
        </AuthProvider>
        <BottomNav />
        <Toaster position="top-center" richColors />
        <Analytics />
      </body>
    </html>
  )
}
