export default function Footer() {
  return (
    <footer className="bg-black border-t border-red-500/30 text-white">
      <div className="container mx-auto px-4 py-8">
        <div className="grid md:grid-cols-4 gap-8">
          {/* Brand */}
          <div>
            <div className="flex items-center space-x-3 mb-4">
              <div className="text-3xl">🧟‍♂️</div>
              <span className="text-xl font-bold text-transparent bg-gradient-to-r from-red-500 via-orange-500 to-red-600 bg-clip-text">
                ZOMBIEFICATION
              </span>
            </div>
            <p className="text-gray-400 text-sm">
              The ultimate Halloween zombie infection game on Farcaster. Spread the virus, claim your share! 🎃
            </p>
          </div>

          {/* Game */}
          <div>
            <h3 className="font-semibold mb-4 text-red-400">🦷 Game</h3>
            <ul className="space-y-2 text-sm text-gray-400">
              <li><a href="/" className="hover:text-red-400 transition-colors">🧟‍♂️ Apocalypse</a></li>
              <li><a href="/leaderboard" className="hover:text-red-400 transition-colors">📊 Bite Tracker</a></li>
              <li><a href="#rules" className="hover:text-red-400 transition-colors">📜 Game Rules</a></li>
              <li><a href="#stats" className="hover:text-red-400 transition-colors">📈 Live Stats</a></li>
            </ul>
          </div>

          {/* $ZOMBIE Token & Contract */}
          <div>
            <h3 className="font-semibold mb-4 text-orange-400">🪙 $ZOMBIE Token</h3>
            <ul className="space-y-2 text-sm text-gray-400">
              <li>
                <a 
                  href="https://www.clanker.world/clanker/0x9b6260F4d9B183391ba979D6B1B2e017Def70B07" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="hover:text-orange-400 transition-colors flex items-center gap-2"
                >
                  🦠 Clanker Contract
                </a>
              </li>
              <li>
                <span className="text-xs font-mono bg-gray-800 px-2 py-1 rounded break-all">
                  0x9b6260F4d9B183391ba979D6B1B2e017Def70B07
                </span>
              </li>
              <li><a href="https://github.com/ABC-DAO/zombie-game" className="hover:text-orange-400 transition-colors">💀 GitHub</a></li>
              <li><a href="#" className="hover:text-orange-400 transition-colors">📜 Game Rules</a></li>
            </ul>
          </div>

          {/* Spooky Community */}
          <div>
            <h3 className="font-semibold mb-4 text-purple-400">🕸️ Community</h3>
            <ul className="space-y-2 text-sm text-gray-400">
              <li><a href="#" className="hover:text-purple-400 transition-colors">🦇 Farcaster</a></li>
              <li><a href="#" className="hover:text-purple-400 transition-colors">👻 Discord</a></li>
              <li><a href="#" className="hover:text-purple-400 transition-colors">🕷️ Twitter</a></li>
              <li><a href="#" className="hover:text-purple-400 transition-colors">🎃 Telegram</a></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-red-900/50 mt-8 pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <p className="text-gray-400 text-sm">
              🧟‍♂️ © 2025 ZOMBIEFICATION by ABC DAO. All brains reserved. 🧠
            </p>
            <div className="flex items-center space-x-6 mt-4 md:mt-0">
              <span className="text-red-400 text-sm font-bold">
                🎃 Halloween 2025 Limited Edition
              </span>
            </div>
          </div>
          <div className="text-center mt-4">
            <p className="text-xs text-gray-500">
              🦠 Forked from SteakNStake • Built for the zombie apocalypse • May cause irreversible infection
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}