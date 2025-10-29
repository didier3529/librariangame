import { SocialButtons } from "@/components/social-buttons"

export default function Page() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950">
      <div className="flex flex-col items-center gap-8">
        <div className="text-center">
          <h1 className="mb-2 bg-gradient-to-r from-cyan-400 to-pink-400 bg-clip-text text-4xl font-bold text-transparent">
            Social Logos
          </h1>
          <p className="text-slate-400">X, Discord, and Pump.fun logos</p>
        </div>
        <SocialButtons />
      </div>
    </main>
  )
}
