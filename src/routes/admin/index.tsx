import { createFileRoute, useRouter } from '@tanstack/react-router'
import { getPostsFn, deletePostFn } from '../../server/functions/posts'
import { useState } from 'react'

export const Route = createFileRoute('/admin/')({
  loader: async () => {
    const [blogs, news] = await Promise.all([
      getPostsFn({ data: 'blog' }),
      getPostsFn({ data: 'news' })
    ])
    return {
      posts: [...blogs, ...news].sort((a, b) => {
        const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0
        const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0
        return bTime - aTime
      })
    }
  },
  component: AdminDashboard,
})

function AdminDashboard() {
  const { posts } = Route.useLoaderData()
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState('')

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
    const searchLower = searchQuery.toLowerCase();
    return (
      post.title?.toLowerCase().includes(searchLower) ||
      post.slug?.toLowerCase().includes(searchLower) ||
      post.excerpt?.toLowerCase().includes(searchLower) ||
      post.type?.toLowerCase().includes(searchLower)
    );
  });

  return (
    <div className="bg-card border border-border p-5 sm:p-8 rounded text-foreground relative overflow-hidden">

      
      <div className="flex flex-col sm:flex-row justify-between sm:items-end mb-8 gap-4">
        <div>
          <h2 className="font-display text-2xl sm:text-3xl tracking-wide mb-2 text-foreground">Översikt</h2>
          <p className="text-muted-foreground text-sm">Hantera innehåll och blogginlägg.</p>
        </div>
        <a href="/admin/new" className="px-5 py-2.5 bg-primary text-primary-foreground text-sm font-medium rounded hover:bg-primary/90 transition-colors inline-flex justify-center whitespace-nowrap">
          Skapa nytt inlägg
        </a>
      </div>

      <div className="mb-6">
        <div className="relative">
          <input 
            type="text" 
            placeholder="Sök på titel, typ eller text..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full p-2.5 pl-9 bg-background border border-border rounded text-foreground text-sm transition-colors placeholder:text-muted-foreground outline-none focus:border-primary/60"
          />
          <span className="absolute left-3 top-2.5 text-muted-foreground text-base">⌕</span>
        </div>
      </div>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredPosts.map((post) => (
          <div key={post.id} className="group/card p-5 bg-background border border-border hover:border-primary/40 rounded transition-all">
            <div className="flex justify-between items-start mb-3">
              <span className={`px-2 py-0.5 text-xs font-medium rounded border ${post.type === 'blog' ? 'border-blue-300 text-blue-600 bg-blue-50' : 'border-primary/30 text-primary bg-primary/5'}`}>
                {post.type === 'blog' ? 'Blogg' : 'Nyhet'}
              </span>
              <span className="text-xs text-muted-foreground">{new Date(post.createdAt!).toLocaleDateString('sv-SE')}</span>
            </div>
            <h3 className="font-medium text-foreground text-base mb-2 truncate">{post.title}</h3>
            <p className="text-muted-foreground text-sm line-clamp-2 mb-4 leading-relaxed">{post.excerpt}</p>
            <div className="flex justify-end gap-4 text-xs font-medium mt-auto pt-3 border-t border-border">
              <a href={`/admin/edit/${post.id}`} className="text-muted-foreground hover:text-foreground transition-colors">Redigera</a>
              <button onClick={() => handleDelete(post.id)} className="text-red-500 hover:text-red-600 transition-colors">Radera</button>
            </div>
          </div>
        ))}
        {filteredPosts.length === 0 && (
          <div className="col-span-full text-center py-14 text-muted-foreground border border-dashed border-border rounded">
            <p className="text-base mb-3">
              {posts.length === 0 ? 'Inget innehåll hittades.' : 'Inga inlägg matchade din sökning.'}
            </p>
            {posts.length === 0 && (
              <a href="/admin/new" className="mt-2 px-5 py-2 border border-border hover:border-primary/50 hover:text-primary text-foreground rounded inline-block text-sm transition-colors">Skapa ditt första inlägg</a>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
