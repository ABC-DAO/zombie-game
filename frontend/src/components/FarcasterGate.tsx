'use client';

import { useEffect, useState } from 'react';

interface FarcasterGateProps {
  children: React.ReactNode
}

export function FarcasterGate({ children }: FarcasterGateProps) {
  const [isFarcaster, setIsFarcaster] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Check if we're in a Farcaster frame or mobile app
    const checkFarcasterContext = () => {
      // Check for Farcaster frame context
      const isFrame = window?.parent !== window
      
      // Check for Farcaster mobile app user agent
      const userAgent = navigator.userAgent.toLowerCase()
      const isFarcasterApp = userAgent.includes('farcaster') || userAgent.includes('warpcast')
      
      // Check for frame postMessage API
      const hasFrameAPI = typeof window !== 'undefined' && window.parent !== window
      
      // For development, allow localhost and pages.dev
      const isDev = window.location.hostname === 'localhost' || 
                   window.location.hostname === '127.0.0.1' ||
                   window.location.hostname.includes('pages.dev')
      
      // Check URL parameters that might indicate Farcaster context
      const urlParams = new URLSearchParams(window.location.search)
      const hasFarcasterParams = urlParams.has('fc_frame') || urlParams.has('farcaster')
      
      return isFrame || isFarcasterApp || hasFrameAPI || isDev || hasFarcasterParams
    }

    setIsFarcaster(checkFarcasterContext())
    setIsLoading(false)
  }, [])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-red-900 to-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-red-600 to-orange-600 rounded-xl flex items-center justify-center mx-auto mb-4 border border-red-500/30">
            <span className="text-white text-2xl">🧟‍♂️</span>
          </div>
          <p className="text-gray-300">🧟‍♂️ Loading zombie apocalypse...</p>
        </div>
      </div>
    )
  }

  if (!isFarcaster) {
    return <ComingSoonPage />
  }

  return <>{children}</>
}

function ComingSoonPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-red-900 to-black flex items-center justify-center p-4">
      <div className="max-w-md mx-auto text-center">
        {/* Logo */}
        <div className="w-24 h-24 bg-gradient-to-br from-red-600 to-orange-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg border border-red-500/30">
          <span className="text-white text-4xl">🧟‍♂️</span>
        </div>
        
        {/* Title */}
        <h1 className="text-4xl font-black text-transparent bg-gradient-to-r from-red-500 via-orange-500 to-red-600 bg-clip-text mb-4">
          ZOMBIEFICATION
        </h1>
        
        {/* Subtitle */}
        <p className="text-xl text-gray-300 mb-2">
          An ABC_DAO Project for Halloween 2025
        </p>
        <p className="text-lg text-red-400 mb-6">
          Zombie Infection Game on Farcaster
        </p>
        
        {/* Coming Soon Message */}
        <div className="bg-black/40 backdrop-blur-sm border border-red-500/30 rounded-xl p-6 shadow-lg mb-8">
          <h2 className="text-2xl font-bold text-red-400 mb-3">
            🎃 Halloween Apocalypse
          </h2>
          <p className="text-gray-300 mb-4">
            ZOMBIEFICATION is exclusively available within the Farcaster ecosystem.
          </p>
          <p className="text-sm text-gray-400">
            Access the zombie infection game through Warpcast to tip $ZOMBIE, bite humans, and join the undead horde!
          </p>
        </div>
        
        {/* Call to Action */}
        <div className="space-y-3">
          <a 
            href="https://warpcast.com" 
            target="_blank" 
            rel="noopener noreferrer"
            className="block w-full bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 text-white font-bold py-3 px-6 rounded-lg transition-all duration-200 shadow-lg"
          >
            🧟‍♂️ Get Warpcast
          </a>
          <a 
            href="https://farcaster.xyz" 
            target="_blank" 
            rel="noopener noreferrer"
            className="block w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold py-3 px-6 rounded-lg transition-all duration-200 shadow-lg"
          >
            🦇 Learn about Farcaster
          </a>
        </div>
        
        {/* Footer */}
        <div className="mt-8 text-xs text-gray-400">
          <p>🧠 Built for the Farcaster community by ABC_DAO</p>
          <p className="mt-1">🦷 Bite, Infect, Spread, Survive</p>
          <p className="mt-2 text-red-500 font-bold">Halloween 2025 Limited Edition</p>
        </div>
      </div>
    </div>
  )
}