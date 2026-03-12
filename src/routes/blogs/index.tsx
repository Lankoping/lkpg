import { createFileRoute } from '@tanstack/react-router'
import { getPostsFn } from '../../server/functions/posts'
import { useQuery } from '@tanstack/react-query'

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
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6 text-[#C04A2A]">Lanköping Blog</h1>
      
      {posts.length === 0 ? (
        <p className="text-gray-500">Inga blogginlägg ännu.</p>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => (
            <div key={post.id} className="bg-[#100E0C] border border-[#C04A2A]/20 p-6 rounded-lg text-[#F0E8D8]">
              <h2 className="text-xl font-bold mb-2">{post.title}</h2>
              <p className="text-sm text-gray-400 mb-4">{new Date(post.createdAt!).toLocaleDateString()}</p>
              <div className="prose prose-invert max-w-none">
                <p>{post.excerpt}</p>
              </div>
              <a href={`/blogs/${post.slug}`} className="block mt-4 text-[#C04A2A] hover:underline">Read more →</a>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
