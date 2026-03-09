import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { getSessionFn, logoutFn } from '../server/functions/auth'

export const Route = createFileRoute('/admin')({
  beforeLoad: async ({ location }) => {
    const user = await getSessionFn()
    if (!user) {
      throw redirect({
        to: '/login',
        search: {
          redirect: location.href,
        },
      })
    }

    if (user.role !== 'admin') {
      throw redirect({ to: '/' })
    }

    return { user }
  },
  loader: async ({ context: { user } }) => {
    return { user }
  },
  component: AdminLayout,
})

function AdminLayout() {
  const { user } = Route.useLoaderData()

  const handleLogout = async () => {
    await logoutFn()
    window.location.href = '/'
  }

  return (
    <div className="flex flex-col md:flex-row h-screen bg-[#100E0C] text-[#F0E8D8] font-sans">
      {/* Sidebar / Topbar */}
      <div className="w-full md:w-64 bg-[#141210] p-4 md:p-6 border-b md:border-b-0 md:border-r border-[#C04A2A]/20 flex md:flex-col items-center md:items-start justify-between">
        <h2 className="font-display tracking-widest text-xl md:text-3xl text-[#C04A2A] md:mb-12">Admin</h2>
        
        <nav className="flex md:flex-col space-x-6 md:space-x-0 md:space-y-6 md:flex-1 w-full md:w-full overflow-x-auto justify-end md:justify-start items-center md:items-start ml-4 md:ml-0 scrollbar-hide">
          <a href="/admin/posts" className="block text-[11px] uppercase tracking-[0.1em] text-[#F0E8D8]/70 hover:text-[#C04A2A] transition-colors whitespace-nowrap">Posts</a>
          <a href="/admin/users" className="block text-[11px] uppercase tracking-[0.1em] text-[#F0E8D8]/70 hover:text-[#C04A2A] transition-colors whitespace-nowrap">Users</a>
          <a href="/admin/tickets" className="block text-[11px] uppercase tracking-[0.1em] text-[#F0E8D8]/70 hover:text-[#C04A2A] transition-colors whitespace-nowrap">Tickets</a>
          <div className="hidden md:block flex-1" />
          <button onClick={handleLogout} className="text-[11px] uppercase tracking-[0.1em] text-red-500/70 hover:text-red-400 block w-full text-left transition-colors whitespace-nowrap">Logout</button>
        </nav>
      </div>

      {/* Content */}
      <div className="flex-1 p-4 sm:p-10 lg:p-16 overflow-y-auto bg-[#100E0C] relative">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#C04A2A11_1px,transparent_1px),linear-gradient(to_bottom,#C04A2A11_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none" />
        
        <header className="relative flex flex-col sm:flex-row justify-between sm:items-end mb-8 sm:mb-12 pb-4 border-b border-[#C04A2A]/20 gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.28em] text-[#C04A2A] font-medium mb-2">Inloggad som</p>
            <h1 className="font-display text-4xl tracking-wide text-[#F0E8D8]">{user.name}</h1>
          </div>
        </header>
        <div className="relative">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
