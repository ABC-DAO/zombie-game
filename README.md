# 🧟‍♂️ ZOMBIEFICATION

**Halloween Zombie Infection Game on Farcaster**

ZOMBIEFICATION is a viral Halloween game where zombies spread through Farcaster tipping. Get infected, become a zombie, spread the infection, and share the final prize pool with your fellow undead!

## 🎃 Game Overview

- **Duration**: 12 hours (Halloween 2025)
- **Infection Method**: Tip 1 $ZOMBIE to any human
- **Becoming Zombie**: Claim your tip to join the undead
- **Final Reward**: Equal share of prize pool among all zombies

## ✨ Key Features

- **Viral Infection Mechanics** → Spread zombies through tipping
- **Strategic Claiming** → Decide when to become zombie
- **Time Pressure** → Tips expire in 4 hours
- **Final Payout** → Equal shares for all zombies at game end
- **Social Dynamics** → Track infection chains and leaderboards

## 🏗️ Project Structure

```
zombie-game/
├── backend/          # Node.js API server
├── frontend/         # Next.js Farcaster miniapp
├── contracts/        # Smart contracts for $ZOMBIE
├── plans/            # Game design documents
└── README.md         # This file
```

## 🚀 Quick Start

### Backend Setup
```bash
cd backend
npm install
npm run dev
```

### Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

### Contracts Setup
```bash
cd contracts
npm install
npm run build
```

## 🧟‍♀️ Game Rules

1. **Everyone starts human** - No one is initially infected
2. **Zombies tip humans** - Send 1 $ZOMBIE to spread infection
3. **Humans choose fate** - Claim tips to become zombie or ignore to stay human
4. **Tips expire** - 4 hours to decide or tip returns to pool
5. **Final payout** - Game ends after 12 hours, zombies split remaining pool

## 🛠️ Tech Stack

**Backend:**
- Node.js + Express
- Supabase database
- Farcaster integration
- Railway deployment

**Frontend:**
- Next.js 15 + React 19
- TypeScript
- Tailwind CSS
- Farcaster Miniapp SDK

**Contracts:**
- Solidity smart contracts
- Base mainnet deployment
- ERC20 $ZOMBIE token
- Game mechanics contract

## 🌐 Deployment

- **Backend**: Railway with Supabase
- **Frontend**: Vercel or Railway
- **Database**: Supabase PostgreSQL
- **Contracts**: Base mainnet

## 🎯 Farcaster Integration

ZOMBIEFICATION integrates with Farcaster to enable:
- Zombie tipping via miniapp
- Infection notifications
- Real-time game status
- Social infection tracking
- Viral game mechanics

## 📄 API Endpoints

### Game Status
- `GET /api/zombie/status/:fid` - Get player infection status
- `GET /api/zombie/leaderboard` - Top zombie spreaders
- `GET /api/zombie/game-status` - Current game state

### Game Actions
- `POST /api/zombie/tip` - Tip $ZOMBIE to infect human
- `POST /api/zombie/claim` - Claim tips to become zombie
- `GET /api/zombie/pending/:fid` - Get unclaimed tips

### Frame Endpoints
- `GET /api/zombie/frame` - Main game frame
- `POST /api/zombie/frame` - Handle frame actions

## 🏆 Win Conditions

### For Zombies
- **Equal Payout**: Share final prize pool with all zombies
- **Infection Glory**: Earn recognition for spreading chaos
- **Leaderboard Fame**: Track your infection impact

### For Humans
- **Survival Honor**: Stay human for the full 12 hours
- **Resistance Recognition**: Get listed as "Last Human Standing"
- **Bragging Rights**: Pure human pride (but no $ZOMBIE)

## 🔄 Fork Information

This project is forked from [SteakNStake](https://github.com/ipfsnut/steaknstake), demonstrating how open-source infrastructure can be adapted for new game mechanics and communities.

### Key Adaptations
- Game mechanics replaced staking with zombie infection
- Tipping system adapted for viral spreading
- Time-limited gameplay with final payout
- Halloween theming and social dynamics

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## 📜 License

MIT License - see LICENSE file for details

---

**🧟‍♂️ Join the Zombie Apocalypse - Halloween 2025 🧟‍♀️**

*Built with 🧠 for the Farcaster community by ABC DAO*