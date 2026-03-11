import { createFileRoute } from '@tanstack/react-router'
import { getPostBySlugTranslatedToEnglishFn } from '../../../server/functions/posts'
import { MarkdownContent } from '../../../components/markdown-content'

export const Route = createFileRoute('/en/nyheter/$slug')({
  loader: async ({ params }) => {
    const post = await getPostBySlugTranslatedToEnglishFn({ data: params.slug })
    if (!post) {
      throw new Error('Post not found')
    }
    return { post }
  },
  component: NewsPost,
})

function NewsPost() {
  const { post } = Route.useLoaderData()

  return (
    <div className="container mx-auto p-8 max-w-4xl text-[#F0E8D8]">
      <a href="/en/nyheter" className="text-[#C04A2A] hover:underline mb-8 block">← Back to News</a>
      <p className="text-xs text-[#F0E8D8]/60 mb-3 italic">* Translted from swedish to english using google translate</p>
      <h1 className="text-4xl font-bold mb-4">{post.title}</h1>
      <div className="flex items-center text-sm text-gray-500 mb-8">
        <span>{new Date(post.createdAt!).toLocaleDateString('en-GB')}</span>
        <span className="mx-2">•</span>
        <span className="bg-[#C04A2A]/20 text-[#C04A2A] px-2 py-0.5 rounded text-xs uppercase tracking-wider">{post.type}</span>
      </div>
      <MarkdownContent content={post.content} />
    </div>
  )
}
