import { createFileRoute } from '@tanstack/react-router'
import { getPostBySlugFn } from '../../server/functions/posts'
import { MarkdownContent } from '../../components/markdown-content'

export const Route = createFileRoute('/blogs/$slug')({
  loader: async ({ params }) => {
    try {
      const post = await getPostBySlugFn({ data: params.slug })
      if (!post) {
        throw new Error('Post not found')
      }
      return { post }
    } catch (e) {
      throw new Error('Post not found')
    }
  },
  component: BlogPost,
})

function BlogPost() {
  const { post } = Route.useLoaderData()

  return (
    <div className="container mx-auto p-8 max-w-4xl text-[#F0E8D8]">
      <a href="/blogs" className="text-[#C04A2A] hover:underline mb-8 block">← Back to Blogs</a>
      <h1 className="text-4xl font-bold mb-4">{post.title}</h1>
      <div className="flex items-center text-sm text-gray-500 mb-8">
        <span>{new Date(post.createdAt!).toLocaleDateString()}</span>
        <span className="mx-2">•</span>
        <span className="bg-[#C04A2A]/20 text-[#C04A2A] px-2 py-0.5 rounded text-xs uppercase tracking-wider">{post.type}</span>
      </div>
      <MarkdownContent content={post.content} />
    </div>
  )
}
