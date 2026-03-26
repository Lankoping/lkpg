import { createFileRoute, Link } from '@tanstack/react-router'
import { getPostsFn } from '../../server/functions/posts'
import { ArrowLeft } from 'lucide-react'

export const Route = createFileRoute('/blogs/')({
  loader: async () => {
    try {
      return {
        posts: await getPostsFn({ data: 'blog' }),
      }
    } catch {
      return { posts: [] }
    }
  },
  component: BlogList,
})

function BlogList() {
  const { posts } = Route.useLoaderData()

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft size={16} />
            <span>Tillbaka</span>
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-16">
        {/* Page Header */}
        <div className="mb-16">
          <p className="text-sm font-medium tracking-widest text-primary uppercase mb-3">Innehall</p>
          <h1 className="font-display text-5xl md:text-6xl text-foreground mb-4">Blogg</h1>
          <p className="text-lg text-muted-foreground">
            Tankar, uppdateringar och nyheter fran Lanköping-teamet.
          </p>
        </div>

        {/* Posts Grid */}
        {posts.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-muted-foreground">Inga blogginlagg annu.</p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {posts.map((post) => (
              <article 
                key={post.id} 
                className="group p-8 border border-border bg-card hover:border-primary/30 transition-colors"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-2 h-2 bg-primary" />
                  <span className="text-xs text-muted-foreground">
                    {post.createdAt ? new Date(post.createdAt).toLocaleDateString('sv-SE') : ''}
                  </span>
                </div>
                <h2 className="font-display text-2xl text-foreground mb-3 group-hover:text-primary transition-colors">
                  {post.title}
                </h2>
                <p className="text-muted-foreground leading-relaxed mb-6">
                  {post.excerpt}
                </p>
                <Link 
                  to={`/blogs/${post.slug}`}
                  className="inline-flex items-center text-sm font-medium text-primary hover:text-foreground transition-colors"
                >
                  Las mer
                  <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </Link>
              </article>
            ))}
          </div>
        )}

        {/* Footer */}
        <footer className="pt-16 border-t border-border mt-16">
          <p className="text-sm text-muted-foreground text-center">
            © 2026 Lanköping.se
          </p>
        </footer>
      </main>
    </div>
  )
}
