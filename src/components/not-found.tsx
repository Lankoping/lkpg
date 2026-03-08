import { Link } from '@tanstack/react-router'
import { Button } from './ui/button'

export function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] py-20 text-center space-y-4">
      <h1 className="text-4xl font-bold">404 - Sidan hittades inte</h1>
      <p className="text-muted-foreground w-full max-w-md mx-auto">
        Den sida du letar efter verkar inte finnas. Kanske har den flyttats eller tagits bort.
      </p>
      <div className="flex gap-4 mt-6">
        <Button asChild>
          <Link to="/">Gå till startsidan</Link>
        </Button>
      </div>
    </div>
  )
}
