import NavBar from './NavBar'

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-cream">
      <main className="max-w-lg mx-auto pb-24 min-h-screen">
        {children}
      </main>
      <NavBar />
    </div>
  )
}
