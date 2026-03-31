import { createFileRoute, useRouter } from '@tanstack/react-router'
import { getPostsFn, deletePostFn } from '../../server/functions/posts'
import { useState } from 'react'
import { 
  Search, 
  Plus, 
  Edit2, 
  Trash2, 
  FileText, 
  Newspaper,
  Calendar,
  MoreVertical,
  Eye,
  ArrowRight
} from 'lucide-react'

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
      }),
      stats: {
        blogs: blogs.length,
        news: news.length,
        total: blogs.length + news.length
      }
    }
  },
  component: AdminDashboard,
})

function StatCard({ 
  label, 
  value, 
  icon: Icon,
}: { 
  label: string
  value: number | string
  icon: any
}) {
  return (
    <div className="bg-card border border-border p-6 transition-all hover:border-primary/30">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium tracking-widest text-muted-foreground uppercase mb-2">{label}</p>
          <p className="font-display text-4xl text-foreground">{value}</p>
        </div>
        <div className="p-2 bg-primary/10">
          <Icon className="w-5 h-5 text-primary" />
        </div>
      </div>
    </div>
  )
}

function AdminDashboard() {
  const { posts, stats } = Route.useLoaderData()
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState<'all' | 'blog' | 'news'>('all')
  const [menuOpen, setMenuOpen] = useState<number | null>(null)

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
    const searchLower = searchQuery.toLowerCase()
    const matchesSearch = 
      post.title?.toLowerCase().includes(searchLower) ||
      post.slug?.toLowerCase().includes(searchLower) ||
      post.excerpt?.toLowerCase().includes(searchLower)
    const matchesType = filterType === 'all' || post.type === filterType
    return matchesSearch && matchesType
  })

  return (
    <div className="max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
        <div>
          <p className="text-xs font-medium tracking-widest text-primary uppercase mb-2">Adminpanel</p>
          <h1 className="font-display text-4xl md:text-5xl text-foreground">Översikt</h1>
          <p className="text-muted-foreground mt-2">Välkommen tillbaka! Hantera ditt innehåll.</p>
        </div>
        <a 
          href="/admin/new" 
          className="inline-flex items-center gap-2 px-5 py-3 bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Skapa inlägg
        </a>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        <StatCard icon={FileText} label="Totalt" value={stats.total} />
        <StatCard icon={FileText} label="Blogginlägg" value={stats.blogs} />
        <StatCard icon={Newspaper} label="Nyheter" value={stats.news} />
        <StatCard icon={Eye} label="Publicerade" value={posts.filter(p => p.published).length} />
      </div>

      {/* Content Section */}
      <div className="bg-card border border-border">
        {/* Header */}
        <div className="px-6 py-5 border-b border-border">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-2 h-2 bg-primary" />
            <span className="text-xs font-medium tracking-widest text-primary uppercase">Innehåll</span>
          </div>
          <h2 className="font-display text-2xl text-foreground">Alla inlägg</h2>
        </div>

        {/* Toolbar */}
        <div className="p-4 border-b border-border bg-secondary/30">
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input 
                type="text" 
                placeholder="Sök på titel eller text..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 text-sm border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
              />
            </div>

            {/* Filters */}
            <div className="flex gap-2">
              {[
                { value: 'all', label: 'Alla' },
                { value: 'blog', label: 'Blogg' },
                { value: 'news', label: 'Nyheter' },
              ].map((filter) => (
                <button
                  key={filter.value}
                  onClick={() => setFilterType(filter.value as any)}
                  className={`px-4 py-2 text-sm font-medium transition-colors ${
                    filterType === filter.value
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground border border-border bg-card hover:text-foreground hover:border-primary/30'
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Content Grid */}
        <div className="p-6">
          {filteredPosts.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredPosts.map((post) => (
                <article 
                  key={post.id} 
                  className="group bg-card border border-border p-5 hover:border-primary/50 transition-all"
                >
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-primary" />
                      <span className="text-[10px] font-medium tracking-widest text-primary uppercase">
                        {post.type === 'blog' ? 'Blogg' : 'Nyhet'}
                      </span>
                    </div>
                    
                    <div className="relative">
                      <button 
                        onClick={() => setMenuOpen(menuOpen === post.id ? null : post.id)}
                        className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                      
                      {menuOpen === post.id && (
                        <>
                          <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(null)} />
                          <div className="absolute right-0 mt-1 w-36 bg-card border border-border shadow-lg py-1 z-20">
                            <a 
                              href={`/admin/edit/${post.id}`}
                              className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                            >
                              <Edit2 className="w-4 h-4" />
                              Redigera
                            </a>
                            <button 
                              onClick={() => { setMenuOpen(null); handleDelete(post.id) }}
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="w-4 h-4" />
                              Radera
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Content */}
                  <h3 className="font-display text-xl text-foreground mb-2 line-clamp-2 group-hover:text-primary transition-colors">
                    {post.title}
                  </h3>
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-4 leading-relaxed">
                    {post.excerpt || 'Ingen beskrivning...'}
                  </p>

                  {/* Footer */}
                  <div className="flex items-center justify-between pt-4 border-t border-border">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Calendar className="w-3.5 h-3.5" />
                      {new Date(post.createdAt!).toLocaleDateString('sv-SE', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric'
                      })}
                    </div>
                    <a 
                      href={`/admin/edit/${post.id}`}
                      className="inline-flex items-center text-xs font-medium text-primary hover:text-foreground transition-colors"
                    >
                      Redigera
                      <ArrowRight className="w-3 h-3 ml-1" />
                    </a>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <div className="w-16 h-16 bg-secondary flex items-center justify-center mx-auto mb-4">
                <FileText className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="font-display text-2xl text-foreground mb-2">
                {posts.length === 0 ? 'Inget innehåll' : 'Inga träffar'}
              </h3>
              <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
                {posts.length === 0 
                  ? 'Kom igång genom att skapa ditt första inlägg.' 
                  : 'Försök med andra sökord eller filter.'}
              </p>
              {posts.length === 0 && (
                <a 
                  href="/admin/new" 
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Skapa första inlägget
                </a>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {filteredPosts.length > 0 && (
          <div className="px-6 py-4 border-t border-border bg-secondary/30">
            <p className="text-xs text-muted-foreground">
              Visar {filteredPosts.length} av {posts.length} inlägg
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
