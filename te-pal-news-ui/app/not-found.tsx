import Link from "next/link"
import { Home } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-4">
      <p className="text-6xl font-bold text-muted-foreground/50">404</p>
      <h1 className="mt-4 text-xl font-semibold text-foreground">Page not found</h1>
      <p className="mt-2 text-sm text-muted-foreground text-center max-w-sm">
        The page you’re looking for doesn’t exist or has been moved.
      </p>
      <Button asChild className="mt-6">
        <Link href="/">
          <Home className="size-4" /> Back to Home
        </Link>
      </Button>
    </div>
  )
}
