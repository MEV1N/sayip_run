"use client"

import type React from "react"

import { useEffect, useRef, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

interface GameState {
  isPlaying: boolean
  isPaused: boolean
  score: number
  coins: number
  lives: number
  gameSpeed: number
  shipBoosts: {
    speedMultiplier: number
    extraLives: number
    coinMagnetRange: number
    startingLives: number
  }
  currentCatchphrase: string
  levelSeed: number
}

interface ShipUpgrade {
  id: string
  name: string
  description: string
  cost: number
  maxLevel: number
  currentLevel: number
  effect: {
    type: "speed" | "lives" | "coin-magnet" | "starting-lives"
    value: number
  }
}

interface DailyChallenge {
  id: string
  name: string
  description: string
  target: number
  progress: number
  reward: number
  completed: boolean
  type: "coins" | "score" | "survival" | "enemies"
}

interface PirateOutfit {
  id: string
  name: string
  description: string
  cost: number
  unlocked: boolean
  parts: {
    hat?: string
    beard?: string
    shirt?: string
    accessory?: string
  }
}

interface PlayerProgress {
  totalCoins: number
  shipUpgrades: ShipUpgrade[]
  gamesPlayed: number
  bestScore: number
  dailyChallenges: DailyChallenge[]
  lastChallengeReset: string
  pirateOutfits: PirateOutfit[]
  selectedOutfit: string
  totalEnemiesDefeated: number
  totalSurvivalTime: number
}

interface Player {
  x: number
  y: number
  width: number
  height: number
  velocityY: number
  isJumping: boolean
  isSliding: boolean
  groundY: number
}

interface Obstacle {
  x: number
  y: number
  width: number
  height: number
  type: "crab" | "barrel" | "gap" | "parrot" | "moonwalk-crab" | "treasure-chest"
  behavior?: {
    direction?: number
    speed?: number
    amplitude?: number
    frequency?: number
    projectiles?: Projectile[]
  }
}

interface Projectile {
  x: number
  y: number
  velocityX: number
  velocityY: number
  width: number
  height: number
  type: "banana"
}

interface Coin {
  x: number
  y: number
  width: number
  height: number
  collected: boolean
}

interface PowerUp {
  x: number
  y: number
  width: number
  height: number
  type: "speed-boost" | "coin-magnet" | "extra-life"
  collected: boolean
}

interface Particle {
  x: number
  y: number
  velocityX: number
  velocityY: number
  life: number
  maxLife: number
  color: string
  size: number
}

interface Cloud {
  x: number
  y: number
  speed: number
  size: number
}

const CANVAS_WIDTH = 800
const CANVAS_HEIGHT = 400
const GRAVITY = 0.8
const JUMP_FORCE = -15
const GAME_SPEED = 4

// Mobile detection and responsive constants
const isMobile = () => {
  if (typeof window === 'undefined') return false
  return window.innerWidth <= 768 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
}

const getResponsiveCanvasSize = () => {
  if (typeof window === 'undefined') return { width: CANVAS_WIDTH, height: CANVAS_HEIGHT }
  
  const mobile = isMobile()
  const screenWidth = window.innerWidth
  const screenHeight = window.innerHeight
  
  if (mobile) {
    // For mobile, make canvas much smaller to fit better
    const padding = 16
    let maxWidth, maxHeight
    
    if (screenWidth <= 480) {
      // Very small screens
      maxWidth = Math.min(screenWidth - padding, 280)
      maxHeight = screenHeight * 0.15
    } else if (screenWidth <= 768) {
      // Medium mobile screens
      maxWidth = Math.min(screenWidth - padding, 320)
      maxHeight = screenHeight * 0.2
    } else {
      // Larger mobile screens
      maxWidth = Math.min(screenWidth - padding, 400)
      maxHeight = screenHeight * 0.25
    }
    
    const aspectRatio = CANVAS_WIDTH / CANVAS_HEIGHT
    
    let width = maxWidth
    let height = width / aspectRatio
    
    // Ensure height doesn't exceed max height
    if (height > maxHeight) {
      height = maxHeight
      width = height * aspectRatio
    }
    
    return { width: Math.floor(width), height: Math.floor(height) }
  }
  
  return { width: CANVAS_WIDTH, height: CANVAS_HEIGHT }
}

const getMobileSpeed = () => {
  return isMobile() ? GAME_SPEED * 0.7 : GAME_SPEED // Slower on mobile for better control
}

const PIRATE_CATCHPHRASES = [
  "Arrr, me boots are soggy!",
  "Shiver me timbers, that was embarrassing!",
  "Blimey! The sea be callin' me name!",
  "Batten down the hatches, I'm all wet!",
  "Yo ho ho, what a landlubber I be!",
  "Avast! Me sea legs need more practice!",
  "Scurvy dogs got the better of me!",
  "By Blackbeard's ghost, I'll get ye next time!",
  "Pieces of eight ain't worth drownin' for!",
  "Keelhaul me sideways, that stung!",
  "Dead men tell no tales, but wet pirates do!",
  "Splice the mainbrace, I need a drink!",
  "Barnacles! Me treasure map is all soggy!",
  "Walk the plank? I already fell off it!",
  "Fifteen men on a dead man's chest... and I ain't one of 'em!",
]

const LEVEL_PATTERNS = [
  {
    name: "Crab Invasion",
    weights: { crab: 0.4, "moonwalk-crab": 0.3, barrel: 0.1, gap: 0.1, parrot: 0.05, "treasure-chest": 0.05 },
  },
  {
    name: "Parrot Paradise",
    weights: { parrot: 0.4, barrel: 0.2, crab: 0.2, gap: 0.1, "moonwalk-crab": 0.05, "treasure-chest": 0.05 },
  },
  {
    name: "Barrel Bonanza",
    weights: { barrel: 0.4, gap: 0.3, crab: 0.15, parrot: 0.1, "moonwalk-crab": 0.03, "treasure-chest": 0.02 },
  },
  {
    name: "Treasure Hunt",
    weights: { "treasure-chest": 0.3, crab: 0.25, barrel: 0.2, gap: 0.15, parrot: 0.05, "moonwalk-crab": 0.05 },
  },
  {
    name: "Moonwalk Madness",
    weights: { "moonwalk-crab": 0.4, crab: 0.2, parrot: 0.2, barrel: 0.1, gap: 0.05, "treasure-chest": 0.05 },
  },
  {
    name: "Gap Gauntlet",
    weights: { gap: 0.4, barrel: 0.3, crab: 0.15, parrot: 0.1, "moonwalk-crab": 0.03, "treasure-chest": 0.02 },
  },
]

function generateAICatchphrase(): string {
  const randomIndex = Math.floor(Math.random() * PIRATE_CATCHPHRASES.length)
  return PIRATE_CATCHPHRASES[randomIndex]
}

function generateAILevelPattern(seed: number): (typeof LEVEL_PATTERNS)[0] {
  // Use seed for consistent but varied level generation
  const patternIndex = seed % LEVEL_PATTERNS.length
  const basePattern = LEVEL_PATTERNS[patternIndex]

  // Add some AI-driven variation based on seed
  const variation = (seed * 0.1) % 1
  const modifiedWeights = { ...basePattern.weights }

  // Slightly adjust weights based on seed for procedural variation
  Object.keys(modifiedWeights).forEach((key) => {
    const adjustment = Math.sin(seed * 0.01 + key.length) * 0.1
    modifiedWeights[key as keyof typeof modifiedWeights] = Math.max(
      0.01,
      modifiedWeights[key as keyof typeof modifiedWeights] + adjustment,
    )
  })

  return {
    name: `${basePattern.name} (Variant ${Math.floor(variation * 10)})`,
    weights: modifiedWeights,
  }
}

function generateDailyChallenges(): DailyChallenge[] {
  const challenges = [
    {
      id: "coins-50",
      name: "Treasure Hunter",
      description: "Collect 50 coins in one run",
      target: 50,
      type: "coins" as const,
      reward: 25,
    },
    {
      id: "score-1000",
      name: "Distance Runner",
      description: "Reach a score of 1000",
      target: 1000,
      type: "score" as const,
      reward: 50,
    },
    {
      id: "survival-120",
      name: "Sea Survivor",
      description: "Survive for 2 minutes",
      target: 120,
      type: "survival" as const,
      reward: 40,
    },
    {
      id: "enemies-10",
      name: "Enemy Slayer",
      description: "Defeat 10 enemies",
      target: 10,
      type: "enemies" as const,
      reward: 30,
    },
    {
      id: "coins-100",
      name: "Gold Rush",
      description: "Collect 100 coins total",
      target: 100,
      type: "coins" as const,
      reward: 75,
    },
  ]

  // Randomly select 3 challenges for the day
  const shuffled = challenges.sort(() => 0.5 - Math.random())
  return shuffled.slice(0, 3).map((challenge) => ({
    ...challenge,
    progress: 0,
    completed: false,
  }))
}

function generatePirateOutfits(): PirateOutfit[] {
  return [
    {
      id: "default",
      name: "Classic Pirate",
      description: "The traditional pirate look",
      cost: 0,
      unlocked: true,
      parts: { hat: "black", beard: "brown", shirt: "red", accessory: "sword" },
    },
    {
      id: "fancy",
      name: "Fancy Captain",
      description: "For the distinguished pirate",
      cost: 100,
      unlocked: false,
      parts: { hat: "feathered", beard: "white", shirt: "blue", accessory: "telescope" },
    },
    {
      id: "ghost",
      name: "Ghost Pirate",
      description: "Spooky and mysterious",
      cost: 200,
      unlocked: false,
      parts: { hat: "tattered", beard: "wispy", shirt: "ghostly", accessory: "lantern" },
    },
    {
      id: "royal",
      name: "Pirate King",
      description: "Rule the seven seas in style",
      cost: 500,
      unlocked: false,
      parts: { hat: "crown", beard: "golden", shirt: "royal", accessory: "scepter" },
    },
  ]
}

export default function PirateGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number>(0)

  const [playerProgress, setPlayerProgress] = useState<PlayerProgress>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("pirate-game-progress")
      if (saved) {
        const progress = JSON.parse(saved)
        // Check if daily challenges need reset
        const today = new Date().toDateString()
        if (progress.lastChallengeReset !== today) {
          progress.dailyChallenges = generateDailyChallenges()
          progress.lastChallengeReset = today
        }
        // Ensure pirate outfits exist
        if (!progress.pirateOutfits) {
          progress.pirateOutfits = generatePirateOutfits()
          progress.selectedOutfit = "default"
        }
        if (!progress.totalEnemiesDefeated) progress.totalEnemiesDefeated = 0
        if (!progress.totalSurvivalTime) progress.totalSurvivalTime = 0
        return progress
      }
    }

    return {
      totalCoins: 0,
      gamesPlayed: 0,
      bestScore: 0,
      dailyChallenges: generateDailyChallenges(),
      lastChallengeReset: new Date().toDateString(),
      pirateOutfits: generatePirateOutfits(),
      selectedOutfit: "default",
      totalEnemiesDefeated: 0,
      totalSurvivalTime: 0,
      shipUpgrades: [
        {
          id: "hull",
          name: "Reinforced Hull",
          description: "Start with extra lives",
          cost: 50,
          maxLevel: 3,
          currentLevel: 0,
          effect: { type: "starting-lives", value: 1 },
        },
        {
          id: "sails",
          name: "Swift Sails",
          description: "Increase movement speed",
          cost: 75,
          maxLevel: 3,
          currentLevel: 0,
          effect: { type: "speed", value: 0.2 },
        },
        {
          id: "compass",
          name: "Magnetic Compass",
          description: "Attract coins from further away",
          cost: 100,
          maxLevel: 3,
          currentLevel: 0,
          effect: { type: "coin-magnet", value: 20 },
        },
        {
          id: "crew",
          name: "Lucky Crew",
          description: "Extra life during gameplay",
          cost: 150,
          maxLevel: 2,
          currentLevel: 0,
          effect: { type: "lives", value: 1 },
        },
      ],
    }
  })

  const [showShipUpgrades, setShowShipUpgrades] = useState(false)
  const [showChallenges, setShowChallenges] = useState(false)
  const [showOutfits, setShowOutfits] = useState(false)
  const [showLeaderboard, setShowLeaderboard] = useState(false)

  const [gameState, setGameState] = useState<GameState>(() => {
    const shipBoosts = calculateShipBoosts(playerProgress.shipUpgrades)
    const baseSpeed = getMobileSpeed()
    return {
      isPlaying: false,
      isPaused: false,
      score: 0,
      coins: 0,
      lives: Math.max(1, 3 + shipBoosts.startingLives),
      gameSpeed: baseSpeed * shipBoosts.speedMultiplier,
      shipBoosts,
      currentCatchphrase: generateAICatchphrase(),
      levelSeed: Math.floor(Math.random() * 10000),
    }
  })

  function calculateShipBoosts(upgrades: ShipUpgrade[]) {
    return upgrades.reduce(
      (boosts, upgrade) => {
        const effectValue = upgrade.currentLevel * upgrade.effect.value

        switch (upgrade.effect.type) {
          case "speed":
            boosts.speedMultiplier += effectValue
            break
          case "lives":
            boosts.extraLives += effectValue
            break
          case "coin-magnet":
            boosts.coinMagnetRange += effectValue
            break
          case "starting-lives":
            boosts.startingLives += effectValue
            break
        }

        return boosts
      },
      {
        speedMultiplier: 1,
        extraLives: 0,
        coinMagnetRange: 0,
        startingLives: 0,
      },
    )
  }

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("pirate-game-progress", JSON.stringify(playerProgress))
    }
  }, [playerProgress])

  // Handle window resize for responsive canvas
  useEffect(() => {
    const handleResize = () => {
      setCanvasSize(getResponsiveCanvasSize())
    }

    if (typeof window !== "undefined") {
      window.addEventListener('resize', handleResize)
      return () => window.removeEventListener('resize', handleResize)
    }
  }, [])

  const [player, setPlayer] = useState<Player>({
    x: 100,
    y: 300,
    width: 32,
    height: 32,
    velocityY: 0,
    isJumping: false,
    isSliding: false,
    groundY: 300,
  })

  const [obstacles, setObstacles] = useState<Obstacle[]>([])
  const [coins, setCoins] = useState<Coin[]>([])
  const [powerUps, setPowerUps] = useState<PowerUp[]>([])
  const [projectiles, setProjectiles] = useState<Projectile[]>([])
  const [backgroundX, setBackgroundX] = useState(0)
  const [particles, setParticles] = useState<Particle[]>([])
  const [clouds, setClouds] = useState<Cloud[]>([])
  const [animationFrame, setAnimationFrame] = useState(0)
  const [canvasSize, setCanvasSize] = useState(getResponsiveCanvasSize())
  const [gameOverTimer, setGameOverTimer] = useState<NodeJS.Timeout | null>(null)

  // Game controls
  const jump = useCallback(() => {
    if (!player.isJumping && gameState.isPlaying) {
      setPlayer((prev) => ({
        ...prev,
        velocityY: JUMP_FORCE,
        isJumping: true,
      }))
    }
  }, [player.isJumping, gameState.isPlaying])

  const slide = useCallback(() => {
    if (gameState.isPlaying && !player.isSliding) {
      setPlayer((prev) => ({
        ...prev,
        isSliding: true,
        height: 16,
        y: prev.groundY + 16,
      }))

      setTimeout(() => {
        setPlayer((prev) => ({
          ...prev,
          isSliding: false,
          height: 32,
          y: prev.groundY,
        }))
      }, 500)
    }
  }, [gameState.isPlaying, player.isSliding])

  // Keyboard controls
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      switch (e.code) {
        case "Space":
        case "ArrowUp":
          e.preventDefault()
          jump()
          break
        case "ArrowDown":
          e.preventDefault()
          slide()
          break
      }
    }

    window.addEventListener("keydown", handleKeyPress)
    return () => window.removeEventListener("keydown", handleKeyPress)
  }, [jump, slide])

  // Touch controls
  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      e.preventDefault()
      const touch = e.touches[0]
      const rect = canvasRef.current?.getBoundingClientRect()
      if (!rect) return

      const touchY = touch.clientY - rect.top
      const canvasHeight = rect.height

      if (touchY < canvasHeight / 2) {
        jump()
      } else {
        slide()
      }
    },
    [jump, slide],
  )

  const generateObstacle = useCallback((): Obstacle => {
    const currentPattern = generateAILevelPattern(gameState.levelSeed + Math.floor(gameState.score / 500))

    // Use weighted random selection based on current AI pattern
    const rand = Math.random()
    let cumulativeWeight = 0
    let selectedType: Obstacle["type"] = "crab"

    for (const [type, weight] of Object.entries(currentPattern.weights)) {
      cumulativeWeight += weight
      if (rand <= cumulativeWeight) {
        selectedType = type as Obstacle["type"]
        break
      }
    }

    const baseObstacle = {
      x: canvasSize.width + Math.random() * 200,
      y: selectedType === "gap" ? 332 : selectedType === "parrot" ? 200 + Math.random() * 50 : 300,
      width: selectedType === "gap" ? 60 : selectedType === "treasure-chest" ? 40 : 32,
      height: selectedType === "gap" ? 68 : selectedType === "treasure-chest" ? 28 : 32,
      type: selectedType,
    }

    // Add specific behaviors for different enemy types
    switch (selectedType) {
      case "moonwalk-crab":
        return {
          ...baseObstacle,
          behavior: {
            direction: -1, // Moonwalking backwards
            speed: 1,
          },
        }
      case "parrot":
        return {
          ...baseObstacle,
          behavior: {
            amplitude: 30,
            frequency: 0.05,
            projectiles: [],
          },
        }
      default:
        return baseObstacle
    }
  }, [gameState.levelSeed, gameState.score])

  // Generate coins
  const generateCoin = useCallback(
    (): Coin => ({
      x: canvasSize.width + Math.random() * 300,
      y: 200 + Math.random() * 100,
      width: 16,
      height: 16,
      collected: false,
    }),
    [],
  )

  // Generate power-up
  const generatePowerUp = useCallback((): PowerUp => {
    const types: PowerUp["type"][] = ["speed-boost", "coin-magnet", "extra-life"]
    const type = types[Math.floor(Math.random() * types.length)]

    return {
      x: canvasSize.width + Math.random() * 400,
      y: 220 + Math.random() * 80,
      width: 20,
      height: 20,
      type,
      collected: false,
    }
  }, [])

  // Collision detection
  const checkCollision = useCallback((rect1: any, rect2: any): boolean => {
    return (
      rect1.x < rect2.x + rect2.width &&
      rect1.x + rect1.width > rect2.x &&
      rect1.y < rect2.y + rect2.height &&
      rect1.y + rect1.height > rect2.y
    )
  }, [])

  const checkCoinMagnet = useCallback(
    (coin: Coin) => {
      const magnetRange = 50 + gameState.shipBoosts.coinMagnetRange
      const distance = Math.sqrt(
        Math.pow(player.x + player.width / 2 - (coin.x + coin.width / 2), 2) +
          Math.pow(player.y + player.height / 2 - (coin.y + coin.height / 2), 2),
      )

      if (distance < magnetRange && distance > 20) {
        const pullStrength = 0.3
        const dx = player.x + player.width / 2 - (coin.x + coin.width / 2)
        const dy = player.y + player.height / 2 - (coin.y + coin.height / 2)

        return {
          x: coin.x + dx * pullStrength * 0.1,
          y: coin.y + dy * pullStrength * 0.1,
        }
      }

      return { x: coin.x, y: coin.y }
    },
    [player, gameState.shipBoosts.coinMagnetRange],
  )

  // Initialize clouds
  useEffect(() => {
    const initialClouds: Cloud[] = []
    for (let i = 0; i < 5; i++) {
      initialClouds.push({
        x: Math.random() * canvasSize.width,
        y: 50 + Math.random() * 100,
        speed: 0.5 + Math.random() * 1,
        size: 30 + Math.random() * 20,
      })
    }
    setClouds(initialClouds)
  }, [])

  // Add particle effect
  const addParticles = useCallback((x: number, y: number, color: string, count = 5) => {
    const newParticles: Particle[] = []
    for (let i = 0; i < count; i++) {
      newParticles.push({
        x: x + Math.random() * 20 - 10,
        y: y + Math.random() * 20 - 10,
        velocityX: (Math.random() - 0.5) * 8,
        velocityY: (Math.random() - 0.5) * 8 - 2,
        life: 60,
        maxLife: 60,
        color,
        size: 2 + Math.random() * 3,
      })
    }
    setParticles((prev) => [...prev, ...newParticles])
  }, [])

  const purchaseUpgrade = useCallback((upgradeId: string) => {
    setPlayerProgress((prev) => {
      const upgrade = prev.shipUpgrades.find((u) => u.id === upgradeId)
      if (!upgrade || upgrade.currentLevel >= upgrade.maxLevel) return prev

      const cost = upgrade.cost * (upgrade.currentLevel + 1)
      if (prev.totalCoins < cost) return prev

      const newUpgrades = prev.shipUpgrades.map((u) =>
        u.id === upgradeId ? { ...u, currentLevel: u.currentLevel + 1 } : u,
      )

      return {
        ...prev,
        totalCoins: prev.totalCoins - cost,
        shipUpgrades: newUpgrades,
      }
    })
  }, [])

  const updateChallengeProgress = useCallback((type: DailyChallenge["type"], amount: number) => {
    setPlayerProgress((prev) => ({
      ...prev,
      dailyChallenges: prev.dailyChallenges.map((challenge) => {
        if (challenge.type === type && !challenge.completed) {
          const newProgress = challenge.progress + amount
          const completed = newProgress >= challenge.target
          if (completed && !challenge.completed) {
            // Award challenge reward
            return { ...challenge, progress: newProgress, completed: true }
          }
          return { ...challenge, progress: newProgress }
        }
        return challenge
      }),
    }))
  }, [])

  const purchaseOutfit = useCallback((outfitId: string) => {
    setPlayerProgress((prev) => {
      const outfit = prev.pirateOutfits.find((o) => o.id === outfitId)
      if (!outfit || outfit.unlocked || prev.totalCoins < outfit.cost) return prev

      return {
        ...prev,
        totalCoins: prev.totalCoins - outfit.cost,
        pirateOutfits: prev.pirateOutfits.map((o) => (o.id === outfitId ? { ...o, unlocked: true } : o)),
      }
    })
  }, [])

  const selectOutfit = useCallback((outfitId: string) => {
    setPlayerProgress((prev) => ({
      ...prev,
      selectedOutfit: outfitId,
    }))
  }, [])

  // Enhanced drawing functions
  const drawPixelPirate = useCallback(
    (ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, isSliding: boolean) => {
      const scale = width / 32
      const selectedOutfit = playerProgress.pirateOutfits.find((o) => o.id === playerProgress.selectedOutfit)
      const outfit = selectedOutfit?.parts || { hat: "black", beard: "brown", shirt: "red", accessory: "sword" }

      // Body
      const shirtColors = {
        red: "#ea580c",
        blue: "#2563eb",
        ghostly: "#e5e7eb",
        royal: "#7c3aed",
      }
      ctx.fillStyle = shirtColors[outfit.shirt as keyof typeof shirtColors] || "#ea580c"
      ctx.fillRect(x + 8 * scale, y + 16 * scale, 16 * scale, 16 * scale)

      // Head
      ctx.fillStyle = outfit.shirt === "ghostly" ? "#f3f4f6" : "#fdbcb4"
      ctx.fillRect(x + 10 * scale, y + 8 * scale, 12 * scale, 12 * scale)

      // Hat
      const hatColors = {
        black: "#000000",
        feathered: "#4b5563",
        tattered: "#374151",
        crown: "#fbbf24",
      }
      ctx.fillStyle = hatColors[outfit.hat as keyof typeof hatColors] || "#000000"
      ctx.fillRect(x + 6 * scale, y + 4 * scale, 20 * scale, 8 * scale)
      ctx.fillRect(x + 8 * scale, y + 2 * scale, 16 * scale, 4 * scale)

      // Hat decoration
      if (outfit.hat === "feathered") {
        ctx.fillStyle = "#ef4444"
        ctx.fillRect(x + 24 * scale, y + 2 * scale, 2 * scale, 8 * scale)
      } else if (outfit.hat === "crown") {
        ctx.fillStyle = "#fbbf24"
        for (let i = 0; i < 3; i++) {
          ctx.fillRect(x + (10 + i * 6) * scale, y + 1 * scale, 2 * scale, 3 * scale)
        }
      }

      // Skull on hat (except crown)
      if (outfit.hat !== "crown") {
        ctx.fillStyle = "#ffffff"
        ctx.fillRect(x + 12 * scale, y + 6 * scale, 8 * scale, 4 * scale)
        ctx.fillStyle = "#000000"
        ctx.fillRect(x + 13 * scale, y + 7 * scale, 2 * scale, 1 * scale)
        ctx.fillRect(x + 17 * scale, y + 7 * scale, 2 * scale, 1 * scale)
      }

      // Eyes
      ctx.fillStyle = outfit.shirt === "ghostly" ? "#ef4444" : "#000000"
      ctx.fillRect(x + 12 * scale, y + 12 * scale, 2 * scale, 2 * scale)
      ctx.fillRect(x + 18 * scale, y + 12 * scale, 2 * scale, 2 * scale)

      // Beard
      const beardColors = {
        brown: "#8b4513",
        white: "#f9fafb",
        wispy: "#d1d5db",
        golden: "#fbbf24",
      }
      ctx.fillStyle = beardColors[outfit.beard as keyof typeof beardColors] || "#8b4513"
      ctx.fillRect(x + 10 * scale, y + 18 * scale, 12 * scale, 4 * scale)

      // Arms
      ctx.fillStyle = outfit.shirt === "ghostly" ? "#f3f4f6" : "#fdbcb4"
      ctx.fillRect(x + 4 * scale, y + 18 * scale, 6 * scale, 8 * scale)
      ctx.fillRect(x + 22 * scale, y + 18 * scale, 6 * scale, 8 * scale)

      // Legs (adjust for sliding)
      if (!isSliding) {
        ctx.fillStyle = "#654321"
        ctx.fillRect(x + 10 * scale, y + 26 * scale, 5 * scale, 6 * scale)
        ctx.fillRect(x + 17 * scale, y + 26 * scale, 5 * scale, 6 * scale)
      } else {
        ctx.fillRect(x + 8 * scale, y + 28 * scale, 16 * scale, 4 * scale)
      }

      // Accessory
      if (outfit.accessory === "sword") {
        ctx.fillStyle = "#c0c0c0"
        ctx.fillRect(x + 26 * scale, y + 14 * scale, 2 * scale, 12 * scale)
        ctx.fillStyle = "#8b4513"
        ctx.fillRect(x + 25 * scale, y + 24 * scale, 4 * scale, 3 * scale)
      } else if (outfit.accessory === "telescope") {
        ctx.fillStyle = "#8b4513"
        ctx.fillRect(x + 26 * scale, y + 16 * scale, 6 * scale, 3 * scale)
        ctx.fillStyle = "#c0c0c0"
        ctx.fillRect(x + 30 * scale, y + 17 * scale, 2 * scale, 1 * scale)
      } else if (outfit.accessory === "lantern") {
        ctx.fillStyle = "#fbbf24"
        ctx.fillRect(x + 26 * scale, y + 14 * scale, 4 * scale, 8 * scale)
        ctx.fillStyle = "#ffffff"
        ctx.fillRect(x + 27 * scale, y + 16 * scale, 2 * scale, 4 * scale)
      } else if (outfit.accessory === "scepter") {
        ctx.fillStyle = "#fbbf24"
        ctx.fillRect(x + 26 * scale, y + 12 * scale, 2 * scale, 14 * scale)
        ctx.fillRect(x + 24 * scale, y + 12 * scale, 6 * scale, 4 * scale)
      }
    },
    [playerProgress.pirateOutfits, playerProgress.selectedOutfit],
  )

  const drawPixelCrab = useCallback((ctx: CanvasRenderingContext2D, x: number, y: number, frame: number) => {
    const scale = 1
    const wobble = Math.sin(frame * 0.2) * 2

    // Body
    ctx.fillStyle = "#ff6b6b"
    ctx.fillRect(x + 8, y + 12, 16, 12)

    // Shell pattern
    ctx.fillStyle = "#ff4757"
    ctx.fillRect(x + 10, y + 14, 4, 2)
    ctx.fillRect(x + 18, y + 14, 4, 2)
    ctx.fillRect(x + 12, y + 18, 8, 2)

    // Eyes
    ctx.fillStyle = "#000000"
    ctx.fillRect(x + 6, y + 8, 2, 4)
    ctx.fillRect(x + 24, y + 8, 2, 4)
    ctx.fillStyle = "#ffffff"
    ctx.fillRect(x + 6, y + 8, 1, 2)
    ctx.fillRect(x + 24, y + 8, 1, 2)

    // Claws (animated)
    ctx.fillStyle = "#ff4757"
    ctx.fillRect(x - 2 + wobble, y + 16, 8, 6)
    ctx.fillRect(x + 26 - wobble, y + 16, 8, 6)

    // Legs
    ctx.fillStyle = "#ff6b6b"
    for (let i = 0; i < 6; i++) {
      const legX = x + 6 + i * 3
      const legY = y + 24 + Math.sin(frame * 0.3 + i) * 1
      ctx.fillRect(legX, legY, 2, 4)
    }
  }, [])

  const drawMoonwalkCrab = useCallback((ctx: CanvasRenderingContext2D, x: number, y: number, frame: number) => {
    const scale = 1
    const moonwalkSlide = Math.sin(frame * 0.3) * 3

    // Body (slightly tilted for moonwalk effect)
    ctx.fillStyle = "#ff6b6b"
    ctx.fillRect(x + 8 + moonwalkSlide, y + 12, 16, 12)

    // Shell pattern with sparkles (moonwalk magic!)
    ctx.fillStyle = "#ff4757"
    ctx.fillRect(x + 10 + moonwalkSlide, y + 14, 4, 2)
    ctx.fillRect(x + 18 + moonwalkSlide, y + 14, 4, 2)
    ctx.fillRect(x + 12 + moonwalkSlide, y + 18, 8, 2)

    // Sparkle effects
    ctx.fillStyle = "#ffffff"
    ctx.fillRect(x + 6 + Math.sin(frame * 0.2) * 2, y + 10, 1, 1)
    ctx.fillRect(x + 26 + Math.sin(frame * 0.25) * 2, y + 16, 1, 1)

    // Eyes with sunglasses (cool moonwalking crab)
    ctx.fillStyle = "#000000"
    ctx.fillRect(x + 5, y + 8, 6, 4)
    ctx.fillRect(x + 21, y + 8, 6, 4)

    // Claws doing the moonwalk gesture
    ctx.fillStyle = "#ff4757"
    ctx.fillRect(x - 2 - moonwalkSlide, y + 16, 8, 6)
    ctx.fillRect(x + 26 + moonwalkSlide, y + 16, 8, 6)

    // Legs in moonwalk position
    ctx.fillStyle = "#ff6b6b"
    for (let i = 0; i < 6; i++) {
      const legX = x + 6 + i * 3 + moonwalkSlide
      const legY = y + 24 + Math.sin(frame * 0.4 + i + Math.PI) * 2 // Reverse leg movement
      ctx.fillRect(legX, legY, 2, 4)
    }
  }, [])

  const drawParrot = useCallback(
    (ctx: CanvasRenderingContext2D, x: number, y: number, frame: number, obstacle: Obstacle) => {
      const bobbing = Math.sin(frame * 0.1) * 3
      const wingFlap = Math.sin(frame * 0.3) * 2

      // Body
      ctx.fillStyle = "#32cd32"
      ctx.fillRect(x + 8, y + 8 + bobbing, 16, 20)

      // Wings
      ctx.fillStyle = "#228b22"
      ctx.fillRect(x + 4 + wingFlap, y + 12 + bobbing, 8, 12)
      ctx.fillRect(x + 20 - wingFlap, y + 12 + bobbing, 8, 12)

      // Head
      ctx.fillStyle = "#ff6347"
      ctx.fillRect(x + 10, y + 4 + bobbing, 12, 12)

      // Beak
      ctx.fillStyle = "#ffa500"
      ctx.fillRect(x + 6, y + 8 + bobbing, 6, 4)

      // Eye
      ctx.fillStyle = "#000000"
      ctx.fillRect(x + 14, y + 6 + bobbing, 3, 3)
      ctx.fillStyle = "#ffffff"
      ctx.fillRect(x + 15, y + 6 + bobbing, 1, 1)

      // Tail feathers
      ctx.fillStyle = "#ff4500"
      ctx.fillRect(x + 24, y + 16 + bobbing, 6, 3)
      ctx.fillRect(x + 24, y + 20 + bobbing, 6, 3)

      // Feet
      ctx.fillStyle = "#ffa500"
      ctx.fillRect(x + 10, y + 28 + bobbing, 3, 4)
      ctx.fillRect(x + 19, y + 28 + bobbing, 3, 4)

      // Laughing expression when player is hit
      if (frame % 120 < 30) {
        ctx.fillStyle = "#000000"
        ctx.fillRect(x + 12, y + 10 + bobbing, 2, 1) // Squinting eye
        ctx.fillRect(x + 16, y + 10 + bobbing, 2, 1)
      }
    },
    [],
  )

  const drawTreasureChest = useCallback((ctx: CanvasRenderingContext2D, x: number, y: number, frame: number) => {
    const glow = Math.sin(frame * 0.1) * 0.3 + 0.7

    // Chest body
    ctx.fillStyle = "#8b4513"
    ctx.fillRect(x, y + 8, 40, 20)

    // Chest lid
    ctx.fillStyle = "#a0522d"
    ctx.fillRect(x, y, 40, 12)

    // Metal bands
    ctx.fillStyle = "#696969"
    ctx.fillRect(x, y + 6, 40, 2)
    ctx.fillRect(x, y + 18, 40, 2)
    ctx.fillRect(x + 18, y, 4, 28)

    // Lock
    ctx.fillStyle = "#ffd700"
    ctx.fillRect(x + 16, y + 12, 8, 6)
    ctx.fillStyle = "#000000"
    ctx.fillRect(x + 18, y + 14, 4, 2)

    // Treasure glow effect
    ctx.fillStyle = `rgba(255, 215, 0, ${glow * 0.3})`
    ctx.fillRect(x - 2, y - 2, 44, 32)

    // Sparkles around chest
    for (let i = 0; i < 3; i++) {
      const sparkleX = x + Math.sin(frame * 0.1 + i * 2) * 25 + 20
      const sparkleY = y + Math.cos(frame * 0.15 + i * 2) * 15 + 14
      ctx.fillStyle = "#ffffff"
      ctx.fillRect(sparkleX, sparkleY, 1, 1)
    }
  }, [])

  const drawPixelBarrel = useCallback((ctx: CanvasRenderingContext2D, x: number, y: number) => {
    // Main barrel
    ctx.fillStyle = "#8b4513"
    ctx.fillRect(x, y, 32, 32)

    // Wood planks
    ctx.fillStyle = "#a0522d"
    for (let i = 0; i < 4; i++) {
      ctx.fillRect(x + i * 8, y, 6, 32)
    }

    // Metal bands
    ctx.fillStyle = "#696969"
    ctx.fillRect(x, y + 8, 32, 3)
    ctx.fillRect(x, y + 21, 32, 3)

    // Highlights
    ctx.fillStyle = "#daa520"
    ctx.fillRect(x + 2, y + 2, 2, 28)
    ctx.fillRect(x + 10, y + 2, 2, 28)
    ctx.fillRect(x + 18, y + 2, 2, 28)
    ctx.fillRect(x + 26, y + 2, 2, 28)
  }, [])

  const drawWaves = useCallback((ctx: CanvasRenderingContext2D, frame: number, canvasWidth: number, canvasHeight: number) => {
    ctx.fillStyle = "#4682b4"
    for (let x = 0; x < canvasWidth + 50; x += 20) {
      const waveHeight = Math.sin((x + frame * 2) * 0.02) * 8 + 5
      ctx.fillRect(x, canvasHeight - waveHeight, 20, waveHeight)
    }

    // Wave foam
    ctx.fillStyle = "#ffffff"
    for (let x = 0; x < canvasWidth + 50; x += 30) {
      const foamHeight = Math.sin((x + frame * 3) * 0.03) * 3 + 2
      ctx.fillRect(x, canvasHeight - foamHeight, 15, 2)
    }
  }, [])

  const drawClouds = useCallback(
    (ctx: CanvasRenderingContext2D) => {
      clouds.forEach((cloud) => {
        ctx.fillStyle = "#ffffff"
        // Main cloud body
        ctx.fillRect(cloud.x, cloud.y, cloud.size, cloud.size * 0.6)
        ctx.fillRect(cloud.x + cloud.size * 0.2, cloud.y - cloud.size * 0.2, cloud.size * 0.6, cloud.size * 0.4)
        ctx.fillRect(cloud.x + cloud.size * 0.4, cloud.y - cloud.size * 0.1, cloud.size * 0.4, cloud.size * 0.3)

        // Cloud shadow
        ctx.fillStyle = "#f0f0f0"
        ctx.fillRect(cloud.x + 2, cloud.y + cloud.size * 0.4, cloud.size - 4, cloud.size * 0.2)
      })
    },
    [clouds],
  )

  const drawEnhancedCoin = useCallback((ctx: CanvasRenderingContext2D, x: number, y: number, frame: number) => {
    const rotation = Math.sin(frame * 0.1) * 0.3
    const scale = 1 + Math.sin(frame * 0.15) * 0.1

    ctx.save()
    ctx.translate(x + 8, y + 8)
    ctx.scale(scale, 1)
    ctx.rotate(rotation)

    // Coin body
    ctx.fillStyle = "#ffd700"
    ctx.beginPath()
    ctx.arc(0, 0, 8, 0, Math.PI * 2)
    ctx.fill()

    // Inner circle
    ctx.fillStyle = "#ffed4e"
    ctx.beginPath()
    ctx.arc(0, 0, 6, 0, Math.PI * 2)
    ctx.fill()

    // Dollar sign
    ctx.fillStyle = "#b8860b"
    ctx.fillRect(-1, -6, 2, 12)
    ctx.fillRect(-4, -4, 8, 2)
    ctx.fillRect(-4, 2, 8, 2)

    // Shine effect
    ctx.fillStyle = "#ffffff"
    ctx.beginPath()
    ctx.arc(-3, -3, 2, 0, Math.PI * 2)
    ctx.fill()

    ctx.restore()
  }, [])

  const drawPowerUp = useCallback((ctx: CanvasRenderingContext2D, powerUp: PowerUp, frame: number) => {
    const float = Math.sin(frame * 0.1 + powerUp.x * 0.01) * 3
    const glow = Math.sin(frame * 0.15) * 0.3 + 0.7

    ctx.save()
    ctx.translate(powerUp.x + powerUp.width / 2, powerUp.y + powerUp.height / 2 + float)

    switch (powerUp.type) {
      case "speed-boost":
        // Lightning bolt
        ctx.fillStyle = `rgba(255, 255, 0, ${glow})`
        ctx.fillRect(-8, -10, 4, 8)
        ctx.fillRect(-6, -2, 8, 4)
        ctx.fillRect(2, 2, 4, 8)
        break
      case "coin-magnet":
        // Magnet
        ctx.fillStyle = `rgba(255, 0, 0, ${glow})`
        ctx.fillRect(-8, -6, 4, 12)
        ctx.fillRect(4, -6, 4, 12)
        ctx.fillStyle = `rgba(128, 128, 128, ${glow})`
        ctx.fillRect(-8, -8, 16, 4)
        break
      case "extra-life":
        // Heart
        ctx.fillStyle = `rgba(255, 20, 147, ${glow})`
        ctx.fillRect(-6, -4, 4, 4)
        ctx.fillRect(2, -4, 4, 4)
        ctx.fillRect(-8, -2, 8, 6)
        ctx.fillRect(0, -2, 8, 6)
        ctx.fillRect(-6, 4, 12, 4)
        ctx.fillRect(-4, 8, 8, 2)
        break
    }

    ctx.restore()
  }, [])

  const drawBanana = useCallback((ctx: CanvasRenderingContext2D, projectile: Projectile) => {
    ctx.fillStyle = "#ffff00"
    ctx.fillRect(projectile.x, projectile.y, 8, 4)
    ctx.fillStyle = "#ffd700"
    ctx.fillRect(projectile.x + 1, projectile.y + 1, 6, 2)

    // Banana curve
    ctx.fillStyle = "#000000"
    ctx.fillRect(projectile.x + 2, projectile.y, 1, 1)
    ctx.fillRect(projectile.x + 5, projectile.y + 3, 1, 1)
  }, [])

  const drawShip = useCallback((ctx: CanvasRenderingContext2D, x: number, y: number, upgrades: ShipUpgrade[]) => {
    const scale = 2

    // Hull (gets stronger with hull upgrades)
    const hullUpgrade = upgrades.find((u) => u.id === "hull")
    const hullLevel = hullUpgrade?.currentLevel || 0
    ctx.fillStyle = hullLevel > 0 ? "#8b4513" : "#654321"
    ctx.fillRect(x, y + 20 * scale, 60 * scale, 20 * scale)

    // Hull reinforcements
    if (hullLevel > 0) {
      ctx.fillStyle = "#696969"
      for (let i = 0; i < hullLevel; i++) {
        ctx.fillRect(x + (10 + i * 15) * scale, y + 25 * scale, 8 * scale, 10 * scale)
      }
    }

    // Mast
    ctx.fillStyle = "#8b4513"
    ctx.fillRect(x + 25 * scale, y, 4 * scale, 30 * scale)

    // Sails (get bigger/better with sail upgrades)
    const sailUpgrade = upgrades.find((u) => u.id === "sails")
    const sailLevel = sailUpgrade?.currentLevel || 0
    const sailWidth = 20 + sailLevel * 5
    const sailHeight = 15 + sailLevel * 3

    ctx.fillStyle = sailLevel > 2 ? "#ffffff" : sailLevel > 0 ? "#f0f0f0" : "#e0e0e0"
    ctx.fillRect(x + (30 - sailWidth / 2) * scale, y + 5 * scale, sailWidth * scale, sailHeight * scale)

    // Compass (glows if upgraded)
    const compassUpgrade = upgrades.find((u) => u.id === "compass")
    const compassLevel = compassUpgrade?.currentLevel || 0
    if (compassLevel > 0) {
      const glow = Math.sin(Date.now() * 0.01) * 0.3 + 0.7
      ctx.fillStyle = `rgba(255, 215, 0, ${glow})`
      ctx.fillRect(x + 45 * scale, y + 25 * scale, 8 * scale, 8 * scale)
    }

    // Crew (shows number based on crew upgrade)
    const crewUpgrade = upgrades.find((u) => u.id === "crew")
    const crewLevel = crewUpgrade?.currentLevel || 0
    for (let i = 0; i < crewLevel; i++) {
      ctx.fillStyle = "#fdbcb4"
      ctx.fillRect(x + (15 + i * 10) * scale, y + 15 * scale, 4 * scale, 8 * scale)
      // Tiny pirate hat
      ctx.fillStyle = "#000000"
      ctx.fillRect(x + (14 + i * 10) * scale, y + 13 * scale, 6 * scale, 3 * scale)
    }
  }, [])

  // Game loop
  const gameLoop = useCallback(() => {
    if (!gameState.isPlaying || gameState.isPaused) return

    const canvas = canvasRef.current
    const ctx = canvas?.getContext("2d")
    if (!canvas || !ctx) return

    // Update animation frame
    setAnimationFrame((prev) => prev + 1)

    // Clear canvas
    ctx.clearRect(0, 0, canvasSize.width, canvasSize.height)

    const skyGradient = ctx.createLinearGradient(0, 0, 0, canvasSize.height * 0.7)
    skyGradient.addColorStop(0, "#87ceeb")
    skyGradient.addColorStop(0.5, "#98d8e8")
    skyGradient.addColorStop(1, "#4682b4")
    ctx.fillStyle = skyGradient
    ctx.fillRect(0, 0, canvasSize.width, canvasSize.height * 0.7)

    // Draw clouds
    drawClouds(ctx)

    // Update and draw clouds movement
    setClouds((prev) =>
      prev.map((cloud) => ({
        ...cloud,
        x: cloud.x < -cloud.size ? canvasSize.width + Math.random() * 200 : cloud.x - cloud.speed,
      })),
    )

    // Draw animated waves
    drawWaves(ctx, animationFrame, canvasSize.width, canvasSize.height)

    // Draw moving dock planks with enhanced detail
    ctx.fillStyle = "#8b4513"
    for (let i = 0; i < CANVAS_WIDTH + 100; i += 50) {
      const x = (i - backgroundX) % (CANVAS_WIDTH + 100)
      ctx.fillRect(x, 332, 48, 68)

      // Wood grain
      ctx.fillStyle = "#a0522d"
      ctx.fillRect(x + 4, 332, 2, 68)
      ctx.fillRect(x + 20, 332, 2, 68)
      ctx.fillRect(x + 36, 332, 2, 68)

      // Nails
      ctx.fillStyle = "#696969"
      ctx.fillRect(x + 8, 340, 3, 3)
      ctx.fillRect(x + 37, 340, 3, 3)
      ctx.fillRect(x + 8, 380, 3, 3)
      ctx.fillRect(x + 37, 380, 3, 3)

      // Border
      ctx.strokeStyle = "#654321"
      ctx.lineWidth = 2
      ctx.strokeRect(x, 332, 48, 68)
    }

    // Update player physics
    setPlayer((prev) => {
      let newY = prev.y + prev.velocityY
      let newVelocityY = prev.velocityY + GRAVITY
      let newIsJumping = prev.isJumping

      if (newY >= prev.groundY) {
        newY = prev.groundY
        newVelocityY = 0
        newIsJumping = false
      }

      return {
        ...prev,
        y: newY,
        velocityY: newVelocityY,
        isJumping: newIsJumping,
      }
    })

    // Draw enhanced player
    drawPixelPirate(ctx, player.x, player.y, player.width, player.height, player.isSliding)

    // Update obstacles
    setObstacles((prev) => {
      const updated = prev
        .map((obstacle) => {
          const newObstacle = { ...obstacle }

          // Update position
          if (obstacle.type === "moonwalk-crab") {
            // Moonwalk crabs move slower and backwards
            newObstacle.x = obstacle.x - gameState.gameSpeed * 0.7
          } else if (obstacle.type === "parrot") {
            // Parrots bob up and down
            newObstacle.x = obstacle.x - gameState.gameSpeed
            if (obstacle.behavior) {
              newObstacle.y =
                obstacle.y + Math.sin(animationFrame * obstacle.behavior.frequency!) * obstacle.behavior.amplitude!
            }

            // Parrots throw bananas occasionally
            if (Math.random() < 0.02 && obstacle.x < CANVAS_WIDTH && obstacle.x > 0) {
              const newBanana: Projectile = {
                x: obstacle.x,
                y: obstacle.y + 16,
                velocityX: -3,
                velocityY: Math.random() * 4 - 2,
                width: 8,
                height: 4,
                type: "banana",
              }
              setProjectiles((prev) => [...prev, newBanana])
            }
          } else {
            newObstacle.x = obstacle.x - gameState.gameSpeed
          }

          return newObstacle
        })
        .filter((obstacle) => obstacle.x > -obstacle.width)

      // Add new obstacles
      if (updated.length === 0 || updated[updated.length - 1].x < CANVAS_WIDTH - 200) {
        updated.push(generateObstacle())
      }

      return updated
    })

    // Draw enhanced obstacles
    obstacles.forEach((obstacle) => {
      switch (obstacle.type) {
        case "crab":
          drawPixelCrab(ctx, obstacle.x, obstacle.y, animationFrame)
          break
        case "moonwalk-crab":
          drawMoonwalkCrab(ctx, obstacle.x, obstacle.y, animationFrame)
          break
        case "parrot":
          drawParrot(ctx, obstacle.x, obstacle.y, animationFrame, obstacle)
          break
        case "barrel":
          drawPixelBarrel(ctx, obstacle.x, obstacle.y)
          break
        case "treasure-chest":
          drawTreasureChest(ctx, obstacle.x, obstacle.y, animationFrame)
          break
        case "gap":
          // Enhanced water gap with bubbles
          ctx.fillStyle = "#4682b4"
          ctx.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height)

          // Bubbles
          for (let i = 0; i < 3; i++) {
            const bubbleX = obstacle.x + Math.random() * obstacle.width
            const bubbleY = obstacle.y + Math.sin(animationFrame * 0.1 + i) * 10 + 20
            ctx.fillStyle = "#87ceeb"
            ctx.beginPath()
            ctx.arc(bubbleX, bubbleY, 2 + Math.sin(animationFrame * 0.05 + i), 0, Math.PI * 2)
            ctx.fill()
          }
          break
      }
    })

    setProjectiles((prev) => {
      return prev
        .map((projectile) => ({
          ...projectile,
          x: projectile.x + projectile.velocityX,
          y: projectile.y + projectile.velocityY,
          velocityY: projectile.velocityY + 0.2,
        }))
        .filter(
          (projectile) =>
            projectile.x > -projectile.width &&
            projectile.x < CANVAS_WIDTH + projectile.width &&
            projectile.y < CANVAS_HEIGHT,
        )
    })

    projectiles.forEach((projectile) => {
      drawBanana(ctx, projectile)
    })

    setPowerUps((prev) => {
      const updated = prev
        .map((powerUp) => ({
          ...powerUp,
          x: powerUp.x - gameState.gameSpeed,
        }))
        .filter((powerUp) => powerUp.x > -powerUp.width && !powerUp.collected)

      // Add new power-ups occasionally
      if (Math.random() < 0.005) {
        updated.push(generatePowerUp())
      }

      return updated
    })

    // Draw power-ups
    powerUps.forEach((powerUp) => {
      if (!powerUp.collected) {
        drawPowerUp(ctx, powerUp, animationFrame)
      }
    })

    setCoins((prev) => {
      const updated = prev
        .map((coin) => {
          const magnetPos = checkCoinMagnet(coin)
          return {
            ...coin,
            x: magnetPos.x - gameState.gameSpeed,
            y: magnetPos.y,
          }
        })
        .filter((coin) => coin.x > -coin.width && !coin.collected)

      // Add new coins
      if (Math.random() < 0.02) {
        updated.push(generateCoin())
      }

      return updated
    })

    // Draw enhanced coins
    coins.forEach((coin) => {
      if (!coin.collected) {
        drawEnhancedCoin(ctx, coin.x, coin.y, animationFrame)
      }
    })

    // Update and draw particles
    setParticles((prev) => {
      return prev
        .map((particle) => ({
          ...particle,
          x: particle.x + particle.velocityX,
          y: particle.y + particle.velocityY,
          velocityY: particle.velocityY + 0.2,
          life: particle.life - 1,
        }))
        .filter((particle) => particle.life > 0)
    })

    particles.forEach((particle) => {
      const alpha = particle.life / particle.maxLife
      ctx.fillStyle =
        particle.color +
        Math.floor(alpha * 255)
          .toString(16)
          .padStart(2, "0")
      ctx.fillRect(particle.x, particle.y, particle.size, particle.size)
    })

    obstacles.forEach((obstacle) => {
      if (checkCollision(player, obstacle)) {
        if (obstacle.type === "gap" && player.y + player.height >= obstacle.y) {
          // Fell in water
          addParticles(player.x + player.width / 2, player.y + player.height, "#4682b4", 10)
          setGameState((prev) => ({ ...prev, lives: Math.max(1, prev.lives - 1) }))
        } else if (obstacle.type === "treasure-chest") {
          // Treasure chest gives bonus coins
          addParticles(obstacle.x + obstacle.width / 2, obstacle.y + obstacle.height / 2, "#ffd700", 15)
          setGameState((prev) => ({ ...prev, coins: prev.coins + 5, score: prev.score + 50 }))
          // Remove the treasure chest
          setObstacles((prev) => prev.filter((obs) => obs !== obstacle))
        } else if (obstacle.type !== "gap") {
          // Hit obstacle
          addParticles(player.x + player.width / 2, player.y + player.height / 2, "#ff0000", 8)
          setGameState((prev) => ({ ...prev, lives: Math.max(1, prev.lives - 1) }))
        }
      }
    })

    // Check projectile collisions
    projectiles.forEach((projectile) => {
      if (checkCollision(player, projectile)) {
        addParticles(projectile.x + projectile.width / 2, projectile.y + projectile.height / 2, "#ffff00", 6)
        setGameState((prev) => ({ ...prev, lives: Math.max(1, prev.lives - 1) }))
        setProjectiles((prev) => prev.filter((proj) => proj !== projectile))
      }
    })

    // Check coin collection with particle effects
    setCoins((prev) =>
      prev.map((coin) => {
        if (!coin.collected && checkCollision(player, coin)) {
          addParticles(coin.x + coin.width / 2, coin.y + coin.height / 2, "#ffd700", 8)
          setGameState((prevState) => ({
            ...prevState,
            coins: prevState.coins + 1,
            score: prevState.score + 10,
          }))
          return { ...coin, collected: true }
        }
        return coin
      }),
    )

    setPowerUps((prev) =>
      prev.map((powerUp) => {
        if (!powerUp.collected && checkCollision(player, powerUp)) {
          addParticles(powerUp.x + powerUp.width / 2, powerUp.y + powerUp.height / 2, "#ffffff", 12)

          switch (powerUp.type) {
            case "speed-boost":
              // Temporary speed boost (implement in future)
              setGameState((prevState) => ({ ...prevState, score: prevState.score + 25 }))
              break
            case "coin-magnet":
              // Coin magnet effect (implement in future)
              setGameState((prevState) => ({ ...prevState, score: prevState.score + 25 }))
              break
            case "extra-life":
              setGameState((prevState) => ({
                ...prevState,
                lives: Math.min(prevState.lives + 1, 5),
                score: prevState.score + 50,
              }))
              break
          }

          return { ...powerUp, collected: true }
        }
        return powerUp
      }),
    )

    // Update background
    setBackgroundX((prev) => (prev + gameState.gameSpeed) % 100)

    // Update score
    setGameState((prev) => ({ ...prev, score: prev.score + 1 }))

    // Check game over
    if (gameState.lives <= 1) {
      setGameState((prev) => ({ ...prev, isPlaying: false }))
      setPlayerProgress((prev) => ({
        ...prev,
        gamesPlayed: prev.gamesPlayed + 1,
        bestScore: Math.max(prev.bestScore, prev.totalCoins + gameState.coins),
        totalCoins: prev.totalCoins + gameState.coins,
      }))
    }
  }, [
    gameState,
    player,
    obstacles,
    coins,
    powerUps,
    projectiles,
    backgroundX,
    particles,
    clouds,
    animationFrame,
    checkCollision,
    checkCoinMagnet,
    generateObstacle,
    generateCoin,
    generatePowerUp,
    addParticles,
    drawPixelPirate,
    drawPixelCrab,
    drawMoonwalkCrab,
    drawParrot,
    drawPixelBarrel,
    drawTreasureChest,
    drawPowerUp,
    drawBanana,
    drawWaves,
    drawClouds,
    drawEnhancedCoin,
  ])

  // Start game loop
  useEffect(() => {
    if (gameState.isPlaying && !gameState.isPaused) {
      animationRef.current = requestAnimationFrame(gameLoop)
    }
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [gameState.isPlaying, gameState.isPaused, gameLoop])

  const startGame = () => {
    const shipBoosts = calculateShipBoosts(playerProgress.shipUpgrades)
    const newLevelSeed = Math.floor(Math.random() * 10000)
    const baseSpeed = getMobileSpeed()

    setGameState({
      isPlaying: true,
      isPaused: false,
      score: 0,
      coins: 0,
      lives: Math.max(1, 3 + shipBoosts.startingLives + shipBoosts.extraLives),
      gameSpeed: baseSpeed * shipBoosts.speedMultiplier,
      shipBoosts,
      currentCatchphrase: generateAICatchphrase(),
      levelSeed: newLevelSeed,
    })
    setPlayer({
      x: 100,
      y: 300,
      width: 32,
      height: 32,
      velocityY: 0,
      isJumping: false,
      isSliding: false,
      groundY: 300,
    })
    setObstacles([])
    setCoins([])
    setPowerUps([])
    setProjectiles([])
    setBackgroundX(0)
    setParticles([])
    setShowShipUpgrades(false)
    
    // Clear any existing game over timer
    if (gameOverTimer) {
      clearTimeout(gameOverTimer)
      setGameOverTimer(null)
    }
  }

  const handleGameOver = useCallback(() => {
    const newCatchphrase = generateAICatchphrase()
    setGameState((prev) => ({ ...prev, currentCatchphrase: newCatchphrase }))

    // Update challenge progress
    updateChallengeProgress("score", gameState.score)
    updateChallengeProgress("coins", gameState.coins)
    updateChallengeProgress("survival", Math.floor(gameState.score / 10)) // Approximate survival time

    // Award coins for completed challenges
    const completedChallenges = playerProgress.dailyChallenges.filter(
      (c) =>
        !c.completed &&
        ((c.type === "score" && gameState.score >= c.target) ||
          (c.type === "coins" && gameState.coins >= c.target) ||
          (c.type === "survival" && Math.floor(gameState.score / 10) >= c.target)),
    )

    const challengeRewards = completedChallenges.reduce((total, challenge) => total + challenge.reward, 0)

    setPlayerProgress((prev) => ({
      ...prev,
      totalCoins: prev.totalCoins + gameState.coins + challengeRewards,
      gamesPlayed: prev.gamesPlayed + 1,
      bestScore: Math.max(prev.bestScore, gameState.score),
      totalSurvivalTime: prev.totalSurvivalTime + Math.floor(gameState.score / 10),
    }))
    setShowShipUpgrades(true)
  }, [gameState.coins, gameState.score, updateChallengeProgress, playerProgress.dailyChallenges])

  useEffect(() => {
    if (gameState.lives <= 1 && gameState.isPlaying) {
      // Clear any existing timer
      if (gameOverTimer) {
        clearTimeout(gameOverTimer)
      }
      
      // Add 2-second delay before showing game over
      const timer = setTimeout(() => {
        setGameState((prev) => ({ ...prev, isPlaying: false }))
        handleGameOver()
        setGameOverTimer(null)
      }, 2000)
      
      setGameOverTimer(timer)
    }
    
    // Cleanup timer on unmount
    return () => {
      if (gameOverTimer) {
        clearTimeout(gameOverTimer)
      }
    }
  }, [gameState.lives, gameState.isPlaying, handleGameOver, gameOverTimer])

  const pauseGame = () => {
    setGameState((prev) => ({ ...prev, isPaused: !prev.isPaused }))
  }

  return (
    <div className="flex flex-col items-center gap-2 sm:gap-4 max-w-4xl mx-auto p-1 sm:p-4 min-h-screen">
      {/* Enhanced Game HUD */}
      <Card className="w-full p-1 sm:p-4 bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-200 shadow-lg">
        <div className="flex flex-col sm:flex-row justify-between items-center text-card-foreground gap-1 sm:gap-0">
          <div className="flex flex-wrap gap-2 sm:gap-6 items-center justify-center sm:justify-start">
            <span className="font-bold text-xs sm:text-lg">
              Score: <span className="text-amber-600">{gameState.score}</span>
            </span>
            <span className="font-bold text-xs sm:text-lg">
              Coins: <span className="text-yellow-500">{gameState.coins}</span>
            </span>
            <span className="font-bold text-xs sm:text-lg">
              Lives: <span className="text-red-500">{"❤️".repeat(gameState.lives)}</span>
            </span>
            <span className="font-bold text-accent bg-amber-100 px-1 sm:px-2 py-1 rounded text-xs sm:text-base">
              Bank: {playerProgress.totalCoins}
            </span>
          </div>
          <div className="flex gap-2 items-center">
            {gameState.isPlaying && (
              <span className="text-xs text-muted-foreground bg-blue-100 px-2 py-1 rounded">
                {generateAILevelPattern(gameState.levelSeed + Math.floor(gameState.score / 500)).name}
              </span>
            )}
            {gameState.isPlaying && (
              <Button
                onClick={pauseGame}
                variant="outline"
                size="sm"
                className="border-amber-300 hover:bg-amber-50 bg-transparent"
              >
                {gameState.isPaused ? "Resume" : "Pause"}
              </Button>
            )}
            {!gameState.isPlaying && (
              <div className="flex gap-1">
                <Button onClick={() => setShowShipUpgrades(!showShipUpgrades)} variant="outline" size="sm">
                  Ship
                </Button>
                <Button onClick={() => setShowChallenges(!showChallenges)} variant="outline" size="sm">
                  Challenges
                </Button>
                <Button onClick={() => setShowOutfits(!showOutfits)} variant="outline" size="sm">
                  Outfits
                </Button>
                <Button onClick={() => setShowLeaderboard(!showLeaderboard)} variant="outline" size="sm">
                  Stats
                </Button>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Game Canvas */}
      <div className="relative w-full flex justify-center px-1 sm:px-2">
        <canvas
          ref={canvasRef}
          width={canvasSize.width}
          height={canvasSize.height}
          className="game-canvas pixel-art rounded-lg shadow-2xl border-2 sm:border-4 border-amber-200"
          style={{ 
            width: `${canvasSize.width}px`, 
            height: `${canvasSize.height}px`,
            maxWidth: '100%'
          }}
          onTouchStart={handleTouchStart}
          onClick={gameState.isPlaying ? undefined : startGame}
        />

        {/* Daily Challenges Screen */}
        {showChallenges && !gameState.isPlaying && (
          <div className="absolute inset-0 bg-black/80 flex items-center justify-center rounded-lg p-4">
            <Card className="p-6 bg-card max-w-2xl w-full">
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-card-foreground mb-2">Daily Challenges</h2>
                <p className="text-muted-foreground">Complete challenges to earn bonus coins!</p>
              </div>

              <div className="space-y-4 mb-6">
                {playerProgress.dailyChallenges.map((challenge) => (
                  <Card
                    key={challenge.id}
                    className={`p-4 ${challenge.completed ? "bg-green-50 border-green-200" : "bg-muted"}`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-bold text-card-foreground">{challenge.name}</h3>
                      <span
                        className={`text-sm px-2 py-1 rounded ${challenge.completed ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}`}
                      >
                        {challenge.completed ? "Complete!" : `${challenge.progress}/${challenge.target}`}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">{challenge.description}</p>
                    <div className="flex justify-between items-center">
                      <div className="w-full bg-gray-200 rounded-full h-2 mr-4">
                        <div
                          className={`h-2 rounded-full ${challenge.completed ? "bg-green-500" : "bg-blue-500"}`}
                          style={{ width: `${Math.min(100, (challenge.progress / challenge.target) * 100)}%` }}
                        ></div>
                      </div>
                      <span className="text-sm font-medium text-amber-600">{challenge.reward} coins</span>
                    </div>
                  </Card>
                ))}
              </div>

              <div className="text-center">
                <Button onClick={() => setShowChallenges(false)} className="bg-primary text-primary-foreground">
                  Close
                </Button>
              </div>
            </Card>
          </div>
        )}

        {/* Pirate Outfits Screen */}
        {showOutfits && !gameState.isPlaying && (
          <div className="absolute inset-0 bg-black/80 flex items-center justify-center rounded-lg p-4">
            <Card className="p-6 bg-card max-w-3xl w-full max-h-full overflow-y-auto">
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-card-foreground mb-2">Pirate Outfits</h2>
                <p className="text-muted-foreground">Customize your pirate's appearance!</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {playerProgress.pirateOutfits.map((outfit) => (
                  <Card
                    key={outfit.id}
                    className={`p-4 ${playerProgress.selectedOutfit === outfit.id ? "bg-blue-50 border-blue-200" : "bg-muted"}`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-bold text-card-foreground">{outfit.name}</h3>
                      <span
                        className={`text-xs px-2 py-1 rounded ${outfit.unlocked ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}`}
                      >
                        {outfit.unlocked ? "Owned" : `${outfit.cost} coins`}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">{outfit.description}</p>

                    <div className="flex justify-between items-center">
                      {outfit.unlocked ? (
                        <Button
                          onClick={() => selectOutfit(outfit.id)}
                          disabled={playerProgress.selectedOutfit === outfit.id}
                          size="sm"
                          className={playerProgress.selectedOutfit === outfit.id ? "bg-blue-500" : "bg-primary"}
                        >
                          {playerProgress.selectedOutfit === outfit.id ? "Selected" : "Select"}
                        </Button>
                      ) : (
                        <Button
                          onClick={() => purchaseOutfit(outfit.id)}
                          disabled={playerProgress.totalCoins < outfit.cost}
                          size="sm"
                          className="bg-amber-500 hover:bg-amber-600"
                        >
                          Purchase
                        </Button>
                      )}
                    </div>
                  </Card>
                ))}
              </div>

              <div className="text-center">
                <Button onClick={() => setShowOutfits(false)} className="bg-primary text-primary-foreground">
                  Close
                </Button>
              </div>
            </Card>
          </div>
        )}

        {/* Stats/Leaderboard Screen */}
        {showLeaderboard && !gameState.isPlaying && (
          <div className="absolute inset-0 bg-black/80 flex items-center justify-center rounded-lg p-4">
            <Card className="p-6 bg-card max-w-2xl w-full">
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-card-foreground mb-2">Pirate Statistics</h2>
                <p className="text-muted-foreground">Your legendary pirate achievements!</p>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <Card className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 text-center">
                  <h3 className="font-bold text-blue-800 mb-2">Best Score</h3>
                  <p className="text-2xl font-bold text-blue-600">{playerProgress.bestScore}</p>
                </Card>
                <Card className="p-4 bg-gradient-to-br from-yellow-50 to-yellow-100 text-center">
                  <h3 className="font-bold text-yellow-800 mb-2">Total Coins</h3>
                  <p className="text-2xl font-bold text-yellow-600">{playerProgress.totalCoins}</p>
                </Card>
                <Card className="p-4 bg-gradient-to-br from-green-50 to-green-100 text-center">
                  <h3 className="font-bold text-green-800 mb-2">Games Played</h3>
                  <p className="text-2xl font-bold text-green-600">{playerProgress.gamesPlayed}</p>
                </Card>
                <Card className="p-4 bg-gradient-to-br from-purple-50 to-purple-100 text-center">
                  <h3 className="font-bold text-purple-800 mb-2">Survival Time</h3>
                  <p className="text-2xl font-bold text-purple-600">
                    {Math.floor(playerProgress.totalSurvivalTime / 60)}m {playerProgress.totalSurvivalTime % 60}s
                  </p>
                </Card>
              </div>

              <div className="text-center">
                <Button onClick={() => setShowLeaderboard(false)} className="bg-primary text-primary-foreground">
                  Close
                </Button>
              </div>
            </Card>
          </div>
        )}

        {/* Ship Upgrades Screen */}
        {showShipUpgrades && !gameState.isPlaying && (
          <div className="absolute inset-0 bg-black/80 flex items-center justify-center rounded-lg p-4">
            <Card className="p-6 bg-card max-w-2xl w-full max-h-full overflow-y-auto">
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-card-foreground mb-2">Ship Upgrades</h2>
                <p className="text-muted-foreground">Coins Available: {playerProgress.totalCoins}</p>

                {/* Ship Visualization */}
                <div className="my-4 flex justify-center">
                  <canvas
                    width={200}
                    height={100}
                    className="pixel-art border border-border rounded"
                    ref={(canvas) => {
                      if (canvas) {
                        const ctx = canvas.getContext("2d")
                        if (ctx) {
                          ctx.clearRect(0, 0, 200, 100)
                          ctx.fillStyle = "#87ceeb"
                          ctx.fillRect(0, 0, 200, 100)
                          drawShip(ctx, 20, 20, playerProgress.shipUpgrades)
                        }
                      }
                    }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {playerProgress.shipUpgrades.map((upgrade) => {
                  const cost = upgrade.cost * (upgrade.currentLevel + 1)
                  const canAfford = playerProgress.totalCoins >= cost
                  const isMaxLevel = upgrade.currentLevel >= upgrade.maxLevel

                  return (
                    <Card key={upgrade.id} className="p-4 bg-muted">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-bold text-card-foreground">{upgrade.name}</h3>
                        <span className="text-sm text-muted-foreground">
                          Level {upgrade.currentLevel}/{upgrade.maxLevel}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">{upgrade.description}</p>

                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">{isMaxLevel ? "MAX LEVEL" : `${cost} coins`}</span>
                        <Button
                          onClick={() => purchaseUpgrade(upgrade.id)}
                          disabled={!canAfford || isMaxLevel}
                          size="sm"
                          className="bg-primary text-primary-foreground"
                        >
                          {isMaxLevel ? "Maxed" : "Upgrade"}
                        </Button>
                      </div>
                    </Card>
                  )
                })}
              </div>

              <div className="text-center">
                <Button onClick={() => setShowShipUpgrades(false)} className="bg-primary text-primary-foreground">
                  Close
                </Button>
              </div>
            </Card>
          </div>
        )}

        {/* Game Over / Start Screen */}
        {!gameState.isPlaying && !showShipUpgrades && !showChallenges && !showOutfits && !showLeaderboard && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-lg">
            <Card className="p-8 text-center bg-gradient-to-br from-amber-50 to-orange-100 border-2 border-amber-200 shadow-2xl">
              <h2 className="text-3xl font-bold text-amber-800 mb-4">
                {gameState.score > 0 ? "Game Over!" : "Pixel Pirate Escape"}
              </h2>
              {gameState.score > 0 && (
                <div className="mb-6 text-card-foreground">
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="bg-blue-100 p-3 rounded">
                      <p className="text-sm text-blue-600">Final Score</p>
                      <p className="text-xl font-bold text-blue-800">{gameState.score}</p>
                    </div>
                    <div className="bg-yellow-100 p-3 rounded">
                      <p className="text-sm text-yellow-600">Coins Collected</p>
                      <p className="text-xl font-bold text-yellow-800">{gameState.coins}</p>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 mb-2">Best Score: {playerProgress.bestScore}</p>
                  <p className="text-lg italic text-amber-700 bg-amber-100 p-3 rounded-lg border border-amber-200">
                    "{gameState.currentCatchphrase}" 🏴‍☠️
                  </p>
                </div>
              )}
              <div className="flex gap-3 justify-center">
                <Button onClick={startGame} className="bg-amber-600 hover:bg-amber-700 text-white px-6 py-2 text-lg">
                  {gameState.score > 0 ? "Try Again" : "Start Adventure"}
                </Button>
                <Button
                  onClick={() => setShowShipUpgrades(true)}
                  variant="outline"
                  className="border-amber-300 hover:bg-amber-50"
                >
                  Ship Upgrades
                </Button>
              </div>
            </Card>
          </div>
        )}

        {/* Pause Screen */}
        {gameState.isPlaying && gameState.isPaused && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-lg">
            <Card className="p-6 text-center bg-card">
              <h2 className="text-2xl font-bold text-card-foreground mb-4">Paused</h2>
              <Button onClick={pauseGame} className="bg-primary text-primary-foreground">
                Resume
              </Button>
            </Card>
          </div>
        )}
      </div>

      {/* Enhanced Controls */}
      <Card className="w-full p-1 sm:p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200">
        <div className="text-center text-card-foreground">
          <h3 className="font-bold mb-1 sm:mb-3 text-blue-800 text-xs sm:text-base">Controls & Status</h3>
          <div className="flex flex-col sm:flex-row justify-center gap-1 sm:gap-8 text-xs mb-1 sm:mb-2">
            <div className="bg-white p-1 sm:p-2 rounded border">
              <strong className="text-blue-600">PC:</strong> Space/↑ to Jump, ↓ to Slide
            </div>
            <div className="bg-white p-1 sm:p-2 rounded border">
              <strong className="text-blue-600">Mobile:</strong> Tap upper half to Jump, lower half to Slide
            </div>
          </div>
          <div className="flex flex-wrap justify-center gap-1 sm:gap-2 text-xs">
            {gameState.shipBoosts.speedMultiplier > 1 && (
              <span className="bg-green-100 text-green-800 px-1 sm:px-2 py-1 rounded">Speed Boost Active!</span>
            )}
            {gameState.isPlaying && (
              <span className="bg-blue-100 text-blue-800 px-1 sm:px-2 py-1 rounded">
                AI Level: {generateAILevelPattern(gameState.levelSeed + Math.floor(gameState.score / 500)).name}
              </span>
            )}
            <span className="bg-purple-100 text-purple-800 px-1 sm:px-2 py-1 rounded">
              Outfit: {playerProgress.pirateOutfits.find((o) => o.id === playerProgress.selectedOutfit)?.name}
            </span>
          </div>
        </div>
      </Card>
    </div>
  )
}
