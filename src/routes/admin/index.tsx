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
  TrendingUp,
  Users,
  Layers
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
  icon: Icon, 
  label, 
  value, 
  trend, 
  color 
}: { 
  icon: any
  label: string
  value: number | string
  trend?: string
  color: 'blue' | 'purple' | 'amber' | 'emerald'
}) {
  const colors = {
    blue: { bg: 'bg-blue-50', icon: 'bg-blue-100 text-blue-600', border: 'border-blue-100' },
    purple: { bg: 'bg-purple-50', icon: 'bg-purple-100 text-purple-600', border: 'border-purple-100' },
    amber: { bg: 'bg-amber-50', icon: 'bg-amber-100 text-amber-600', border: 'border-amber-100' },
    emerald: { bg: 'bg-emerald-50', icon: 'bg-emerald-100 text-emerald-600', border: 'border-emerald-100' },
  }

  return (
    <div className={`bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md transition-shadow`}>
      <div className="flex items-start justify-between">
        <div className={`p-3 rounded-lg ${colors[color].icon}`}>
          <Icon className="w-5 h-5" />
        </div>
        {trend && (
          <span className="flex items-center gap-1 text-xs font-medium text-emerald-600">
            <TrendingUp className="w-3 h-3" />
            {trend}
          </span>
        )}
      </div>
      <div className="mt-4">
        <p className="text-2xl font-bold text-slate-900">{value}</p>
        <p className="text-sm text-slate-500 mt-0.5">{label}</p>
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-500 mt-1">Välkommen tillbaka! Här är en översikt av ditt innehåll.</p>
        </div>
        <a 
          href="/admin/new" 
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 shadow-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          Skapa inlägg
        </a>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard icon={FileText} label="Totalt innehåll" value={stats.total} color="blue" />
        <StatCard icon={Newspaper} label="Blogginlägg" value={stats.blogs} color="purple" />
        <StatCard icon={Layers} label="Nyheter" value={stats.news} color="amber" />
        <StatCard icon={Eye} label="Publicerade" value={posts.filter(p => p.published).length} color="emerald" />
      </div>

      {/* Content Section */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        {/* Toolbar */}
        <div className="p-4 border-b border-slate-100">
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="Sök på titel, typ eller text..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
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
                  className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                    filterType === filter.value
                      ? 'bg-blue-50 text-blue-600 border border-blue-200'
                      : 'text-slate-600 border border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Content Grid */}
        <div className="p-4">
          {filteredPosts.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredPosts.map((post) => (
                <div 
                  key={post.id} 
                  className="group bg-white border border-slate-200 rounded-xl p-4 hover:border-blue-200 hover:shadow-md transition-all"
                >
                  {/* Header */}
                  <div className="flex items-start justify-between mb-3">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full ${
                      post.type === 'blog' 
                        ? 'bg-blue-50 text-blue-700' 
                        : 'bg-amber-50 text-amber-700'
                    }`}>
                      {post.type === 'blog' ? (
                        <FileText className="w-3 h-3" />
                      ) : (
                        <Newspaper className="w-3 h-3" />
                      )}
                      {post.type === 'blog' ? 'Blogg' : 'Nyhet'}
                    </span>
                    
                    <div className="relative">
                      <button 
                        onClick={() => setMenuOpen(menuOpen === post.id ? null : post.id)}
                        className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                      
                      {menuOpen === post.id && (
                        <>
                          <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(null)} />
                          <div className="absolute right-0 mt-1 w-36 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-20">
                            <a 
                              href={`/admin/edit/${post.id}`}
                              className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
                            >
                              <Edit2 className="w-4 h-4" />
                              Redigera
                            </a>
                            <button 
                              onClick={() => { setMenuOpen(null); handleDelete(post.id) }}
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
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
                  <h3 className="font-semibold text-slate-900 mb-2 line-clamp-1 group-hover:text-blue-600 transition-colors">
                    {post.title}
                  </h3>
                  <p className="text-sm text-slate-500 line-clamp-2 mb-4">
                    {post.excerpt || 'Ingen beskrivning...'}
                  </p>

                  {/* Footer */}
                  <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                    <div className="flex items-center gap-1.5 text-xs text-slate-400">
                      <Calendar className="w-3.5 h-3.5" />
                      {new Date(post.createdAt!).toLocaleDateString('sv-SE', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric'
                      })}
                    </div>
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <a 
                        href={`/admin/edit/${post.id}`}
                        className="text-xs font-medium text-blue-600 hover:text-blue-700"
                      >
                        Redigera
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <FileText className="w-8 h-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-medium text-slate-900 mb-2">
                {posts.length === 0 ? 'Inget innehåll hittades' : 'Inga inlägg matchade din sökning'}
              </h3>
              <p className="text-sm text-slate-500 mb-6 max-w-md mx-auto">
                {posts.length === 0 
                  ? 'Kom igång genom att skapa ditt första inlägg.' 
                  : 'Försök med andra sökord eller filter.'}
              </p>
              {posts.length === 0 && (
                <a 
                  href="/admin/new" 
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
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
          <div className="px-4 py-3 border-t border-slate-100 bg-slate-50 rounded-b-xl">
            <p className="text-xs text-slate-500">
              Visar {filteredPosts.length} av {posts.length} inlägg
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
