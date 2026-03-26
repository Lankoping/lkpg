import { ComingSoon } from '@/components/coming-soon'
import { createFileRoute } from '@tanstack/react-router'
import { getPostsTranslatedToEnglishFn } from '../../server/functions/posts'

export const Route = createFileRoute('/en/')({
  head: () => ({
    meta: [
      {
        title: 'Lanköping.se - Coming Soon',
      },
      {
        name: 'description',
        content:
          'Lanköping.se is finishing the final details and will be launching soon.',
      },
      {
        property: 'og:title',
        content: 'Lanköping.se - Coming Soon',
      },
      {
        property: 'og:description',
        content:
          'Lanköping.se is finishing the final details and will be launching soon.',
      },
      {
        property: 'og:type',
        content: 'website',
      },
      {
        property: 'og:locale',
        content: 'en_GB',
      },
    ],
  }),
  loader: async () => {
    try {
      const [blogs, news] = await Promise.all([
        getPostsTranslatedToEnglishFn({ data: 'blog' }),
        getPostsTranslatedToEnglishFn({ data: 'news' }),
      ])

      return {
        latestBlog: blogs[0] ?? null,
        latestNews: news[0] ?? null,
      }
    } catch {
      return {
        latestBlog: null,
        latestNews: null,
      }
    }
  },
  component: Index,
})

function Index() {
  const { latestBlog, latestNews } = Route.useLoaderData()

  return (
    <>
      <ComingSoon locale="en" />

      {/* Latest Content Section */}
      <section className="bg-background border-t border-border">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="mb-12">
            <p className="text-sm font-medium tracking-widest text-primary uppercase mb-3">Latest</p>
            <h2 className="font-display text-4xl md:text-5xl text-foreground">Blog & News</h2>
          </div>

          <div className="grid gap-8 md:grid-cols-2">
            {/* Blog Card */}
            <article className="group border border-border bg-card p-8 transition-all hover:border-primary/50">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-2 h-2 bg-primary" />
                <span className="text-xs font-medium tracking-widest text-primary uppercase">Blog</span>
              </div>
              {latestBlog ? (
                <>
                  <h3 className="font-display text-2xl md:text-3xl text-foreground mb-3">
                    {latestBlog.title}
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    {latestBlog.createdAt ? new Date(latestBlog.createdAt).toLocaleDateString('en-GB') : ''}
                  </p>
                  <p className="text-muted-foreground leading-relaxed mb-6">
                    {latestBlog.excerpt || 'Read our latest blog post.'}
                  </p>
                  <a 
                    className="inline-flex items-center text-sm font-medium text-primary hover:text-foreground transition-colors" 
                    href={`/en/blogs/${latestBlog.slug}`}
                  >
                    Read more
                    <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                    </svg>
                  </a>
                </>
              ) : (
                <p className="text-muted-foreground">No blog posts published yet.</p>
              )}
            </article>

            {/* News Card */}
            <article className="group border border-border bg-card p-8 transition-all hover:border-primary/50">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-2 h-2 bg-primary" />
                <span className="text-xs font-medium tracking-widest text-primary uppercase">News</span>
              </div>
              {latestNews ? (
                <>
                  <h3 className="font-display text-2xl md:text-3xl text-foreground mb-3">
                    {latestNews.title}
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    {latestNews.createdAt ? new Date(latestNews.createdAt).toLocaleDateString('en-GB') : ''}
                  </p>
                  <p className="text-muted-foreground leading-relaxed mb-6">
                    {latestNews.excerpt || 'Read our latest news update.'}
                  </p>
                  <a 
                    className="inline-flex items-center text-sm font-medium text-primary hover:text-foreground transition-colors" 
                    href={`/en/nyheter/${latestNews.slug}`}
                  >
                    Read more
                    <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                    </svg>
                  </a>
                </>
              ) : (
                <p className="text-muted-foreground">No news published yet.</p>
              )}
            </article>
          </div>
        </div>
      </section>
    </>
  )
}
