import { ComingSoon } from '@/components/coming-soon'
import { createFileRoute } from '@tanstack/react-router'
import { getPostsFn } from '../../server/functions/posts'
import { getHeroContentFn, getInfoSectionsFn } from '../../server/functions/cms'

export const Route = createFileRoute('/_public/')({
  loader: async () => {
    try {
      const [blogs, news, hero, infoSections] = await Promise.all([
        getPostsFn({ data: 'blog' }),
        getPostsFn({ data: 'news' }),
        getHeroContentFn(),
        getInfoSectionsFn(),
      ])

      return {
        latestBlog: blogs[0] ?? null,
        latestNews: news[0] ?? null,
        heroData: hero,
        infoSectionsData: infoSections,
      }
    } catch (error) {
      console.error('[v0] Error loading homepage data:', error)
      return {
        latestBlog: null,
        latestNews: null,
        heroData: null,
        infoSectionsData: null,
      }
    }
  },
  component: Index,
})

function Index() {
  const { latestBlog, latestNews, heroData, infoSectionsData } = Route.useLoaderData()

  return (
    <>
      <ComingSoon locale="sv" heroData={heroData} infoSectionsData={infoSectionsData} />

      {/* Latest Content Section */}
      <section className="bg-background border-t border-border">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="mb-12">
            <p className="text-sm font-medium tracking-widest text-primary uppercase mb-3">Senaste</p>
            <h2 className="font-display text-4xl md:text-5xl text-foreground">Blogg & Nyheter</h2>
          </div>

          <div className="grid gap-8 md:grid-cols-2">
            {/* Blog Card */}
            <article className="group border border-border bg-card p-8 transition-all hover:border-primary/50">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-2 h-2 bg-primary" />
                <span className="text-xs font-medium tracking-widest text-primary uppercase">Blogg</span>
              </div>
              {latestBlog ? (
                <>
                  <h3 className="font-display text-2xl md:text-3xl text-foreground mb-3">
                    {latestBlog.title}
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    {latestBlog.createdAt ? new Date(latestBlog.createdAt).toLocaleDateString('sv-SE') : ''}
                  </p>
                  <p className="text-muted-foreground leading-relaxed mb-6">
                    {latestBlog.excerpt || 'Las senaste blogginlagget.'}
                  </p>
                  <a 
                    className="inline-flex items-center text-sm font-medium text-primary hover:text-foreground transition-colors" 
                    href={`/blogs/${latestBlog.slug}`}
                  >
                    Las mer
                    <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                    </svg>
                  </a>
                </>
              ) : (
                <p className="text-muted-foreground">Ingen blogg publicerad annu.</p>
              )}
            </article>

            {/* News Card */}
            <article className="group border border-border bg-card p-8 transition-all hover:border-primary/50">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-2 h-2 bg-primary" />
                <span className="text-xs font-medium tracking-widest text-primary uppercase">Nyhet</span>
              </div>
              {latestNews ? (
                <>
                  <h3 className="font-display text-2xl md:text-3xl text-foreground mb-3">
                    {latestNews.title}
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    {latestNews.createdAt ? new Date(latestNews.createdAt).toLocaleDateString('sv-SE') : ''}
                  </p>
                  <p className="text-muted-foreground leading-relaxed mb-6">
                    {latestNews.excerpt || 'Las senaste nyheten.'}
                  </p>
                  <a 
                    className="inline-flex items-center text-sm font-medium text-primary hover:text-foreground transition-colors" 
                    href={`/nyheter/${latestNews.slug}`}
                  >
                    Las mer
                    <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                    </svg>
                  </a>
                </>
              ) : (
                <p className="text-muted-foreground">Ingen nyhet publicerad antu.</p>
              )}
            </article>
          </div>
        </div>
      </section>
    </>
  )
}
