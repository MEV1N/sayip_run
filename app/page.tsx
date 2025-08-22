import PirateGame from "@/components/pirate-game"

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-sky-300 to-blue-400 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl">
        <div className="text-center mb-6">
          <h1 className="text-4xl font-bold text-white mb-2 drop-shadow-lg">🏴‍☠️ Pixel Pirate Escape</h1>
          <p className="text-white/90 text-lg">Help our clumsy pirate escape across the collapsing dock!</p>
        </div>
        <PirateGame />
      </div>
    </main>
  )
}
