import { createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { getPostsFn, deletePostFn } from '../../server/functions/posts'
import { getSessionFn } from '../../server/functions/auth'
import { useState } from 'react'

export const Route = createFileRoute('/admin/posts')({
  beforeLoad: async () => {
    const user = await getSessionFn()
    if (!user || user.role !== 'organizer') {
      throw redirect({ to: '/admin' })
    }

    if ((user as { isDemoTester?: boolean }).isDemoTester) {
      throw redirect({ to: '/admin/users' })
    }
  },
  loader: async () => {
    const [blogPosts, newsPosts] = await Promise.all([
      getPostsFn({ data: 'blog' }),
      getPostsFn({ data: 'news' }),
    ])

    return {
      posts: [...blogPosts, ...newsPosts].sort((a, b) => {
        const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0
        const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0
        return bTime - aTime
      }),
    }
  },
  component: AdminPosts,
})

function AdminPosts() {
  const { posts } = Route.useLoaderData()
  const router = useRouter()
  
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | 'blog' | 'news'>('all')

  const handleDelete = async (id: number) => {
    if (window.confirm('Är du säker på att du vill radera detta inlägg?')) {
      try {
        await deletePostFn({ data: id })
        await router.invalidate()
      } catch (err) {
        console.error(err)
        alert('Kunde inte radera inlägget')
      }
    }
  }

  const filteredPosts = posts.filter(post => {
    const matchesType = typeFilter === 'all' || post.type === typeFilter;
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = 
      post.title?.toLowerCase().includes(searchLower) || 
      post.slug?.toLowerCase().includes(searchLower) ||
      post.content?.toLowerCase().includes(searchLower);
      
    return matchesType && matchesSearch;
  });

  return (
    <div className="bg-card border border-border p-5 sm:p-8 rounded text-foreground relative overflow-hidden">
      <div className="flex flex-col sm:flex-row justify-between sm:items-end mb-6 gap-4">
        <div>
          <h2 className="font-display text-2xl sm:text-3xl tracking-wide text-foreground">Alla inlägg</h2>
          <p className="text-muted-foreground text-sm mt-1">Hantera blogginlägg och nyheter.</p>
        </div>
        <a
          href="/admin/new"
          className="px-5 py-2.5 bg-primary text-primary-foreground text-sm font-medium rounded hover:bg-primary/90 transition-colors inline-flex justify-center whitespace-nowrap"
        >
          Skapa nytt inlägg
        </a>
      </div>

      <div className="mb-5 flex flex-col md:flex-row gap-3">
        <div className="flex-1 relative">
          <input 
            type="text" 
            placeholder="Sök på titel, slug eller innehåll..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full p-2.5 pl-9 bg-background border border-border rounded text-foreground text-sm transition-colors placeholder:text-muted-foreground outline-none focus:border-primary/60"
          />
          <span className="absolute left-3 top-2.5 text-muted-foreground text-base">⌕</span>
        </div>
        <div className="relative md:w-44">
          <select 
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as any)}
            className="w-full p-2.5 bg-background border border-border rounded text-foreground text-sm transition-colors outline-none focus:border-primary/60 appearance-none cursor-pointer pr-8"
          >
            <option value="all">Alla typer</option>
            <option value="blog">Blogg</option>
            <option value="news">Nyheter</option>
          </select>
          <div className="absolute right-2.5 top-3 pointer-events-none text-muted-foreground text-xs">▼</div>
        </div>
      </div>

      <div className="space-y-2">
        {filteredPosts.map((post) => (
          <div key={post.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-background border border-border hover:border-primary/30 rounded transition-all">
            <div className="min-w-0 flex-1">
              <a href={`/admin/edit/${post.id}`} className="font-medium text-foreground hover:text-primary transition-colors block truncate">
                {post.title}
              </a>
              <p className="text-xs text-muted-foreground font-mono truncate mt-0.5">/{post.slug}</p>
            </div>
            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <span className={`px-2 py-0.5 text-xs font-medium rounded border ${post.type === 'blog' ? 'border-blue-300 text-blue-600 bg-blue-50' : 'border-primary/30 text-primary bg-primary/5'}`}>
                {post.type === 'blog' ? 'Blogg' : 'Nyhet'}
              </span>
              <a href={`/admin/edit/${post.id}`} className="text-muted-foreground hover:text-foreground transition-colors text-sm">Redigera</a>
              <button onClick={() => handleDelete(post.id)} className="text-red-500 hover:text-red-600 transition-colors text-sm">Radera</button>
            </div>
          </div>
        ))}
        {filteredPosts.length === 0 && (
          <div className="text-center py-12 text-muted-foreground border border-dashed border-border rounded">
            <p className="text-base">
              {posts.length === 0 ? 'Inga inlägg ännu.' : 'Inga inlägg matchade din sökning.'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
