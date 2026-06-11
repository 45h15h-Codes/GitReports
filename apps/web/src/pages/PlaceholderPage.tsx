import { Wrench } from '@phosphor-icons/react'

export function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[500px] text-center px-4">
      <div 
        className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6"
        style={{ background: '#1C2128', border: '1px solid #30363D' }}
      >
        <Wrench size={32} weight="duotone" color="#8B949E" />
      </div>
      <h1 className="font-display text-[24px] font-bold tracking-tight mb-2" style={{ color: '#E6EDF3' }}>
        {title}
      </h1>
      <p className="font-mono text-[14px] max-w-md" style={{ color: '#8B949E' }}>
        This page is under construction. Check back soon for updates!
      </p>
    </div>
  )
}
