import { ComingSoon } from '@/components/coming-soon'
import { createFileRoute } from '@tanstack/react-router'
import { getPostsFn } from '../../server/functions/posts'

export const Route = createFileRoute('/en/')({
  loader: async () => {
    const [blogs, news] = await Promise.all([
      getPostsFn({ data: 'blog' }),
      getPostsFn({ data: 'news' }),
    ])

    return {
      latestBlog: blogs[0] ?? null,
      latestNews: news[0] ?? null,
    }
  },
  component: Index,
})

function Index() {
  const { latestBlog, latestNews } = Route.useLoaderData()

  return (
    <>
      <ComingSoon locale="en" />

      <section className="bg-[#100E0C] text-[#F0E8D8] border-t border-[#C04A2A]/20">
        <div className="mx-auto max-w-6xl px-4 py-12 md:py-16">
          <div className="mb-8 flex flex-col md:flex-row items-start md:items-end justify-between gap-4">
            <div>
              <p className="text-[10px] uppercase tracking-[0.28em] text-[#C04A2A] font-medium mb-3">Latest</p>
              <h2 className="font-display text-4xl md:text-5xl tracking-wide text-[#F0E8D8]">Latest Blog & News</h2>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <article className="relative group overflow-hidden rounded-sm border border-[#C04A2A]/20 bg-[#141210]/80 p-8 transition-all hover:bg-[#1A1816] hover:border-[#C04A2A]/50">
              <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[#C04A2A]/50 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
              <p className="text-[10px] uppercase tracking-[0.28em] text-[#C04A2A] font-medium mb-4">Blog</p>
              {latestBlog ? (
                <>
                  <h3 className="font-display text-2xl md:text-3xl text-[#F0E8D8] tracking-wide mb-3">{latestBlog.title}</h3>
                  <p className="text-xs text-[#F0E8D8]/50 font-serif italic text-lg mb-6">
                    {latestBlog.createdAt ? new Date(latestBlog.createdAt).toLocaleDateString('en-GB') : ''}
                  </p>
                  <p className="text-[#F0E8D8]/80 text-sm leading-relaxed mb-8">{latestBlog.excerpt || 'Read our latest blog post.'}</p>
                  <a className="inline-flex items-center text-[11px] uppercase tracking-[0.1em] text-[#C04A2A] font-medium hover:text-[#F0E8D8] transition-colors" href={`/en/blogs/${latestBlog.slug}`}>
                    Read post <span className="ml-2">→</span>
                  </a>
                </>
              ) : (
                <p className="text-[#F0E8D8]/50 text-sm">No blog posts published yet.</p>
              )}
            </article>

            <article className="relative group overflow-hidden rounded-sm border border-[#C04A2A]/20 bg-[#141210]/80 p-8 transition-all hover:bg-[#1A1816] hover:border-[#C04A2A]/50">
              <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[#C04A2A]/50 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
              <p className="text-[10px] uppercase tracking-[0.28em] text-[#C04A2A] font-medium mb-4">News</p>
              {latestNews ? (
                <>
                  <h3 className="font-display text-2xl md:text-3xl text-[#F0E8D8] tracking-wide mb-3">{latestNews.title}</h3>
                  <p className="text-xs text-[#F0E8D8]/50 font-serif italic text-lg mb-6">
                    {latestNews.createdAt ? new Date(latestNews.createdAt).toLocaleDateString('en-GB') : ''}
                  </p>
                  <p className="text-[#F0E8D8]/80 text-sm leading-relaxed mb-8">{latestNews.excerpt || 'Read our latest news update.'}</p>
                  <a className="inline-flex items-center text-[11px] uppercase tracking-[0.1em] text-[#C04A2A] font-medium hover:text-[#F0E8D8] transition-colors" href={`/en/nyheter/${latestNews.slug}`}>
                    Read update <span className="ml-2">→</span>
                  </a>
                </>
              ) : (
                <p className="text-[#F0E8D8]/50 text-sm">No news published yet.</p>
              )}
            </article>
          </div>
        </div>
      </section>
    </>
  )
}
