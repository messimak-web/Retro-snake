/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { HelpCircle, Trophy, Play, RotateCcw, Pause, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Palette } from 'lucide-react';
import { soundService } from './services/soundService';

const GRID_SIZE = 20;
const INITIAL_SNAKE = [{ x: 10, y: 10 }, { x: 10, y: 11 }, { x: 10, y: 12 }];
const INITIAL_DIRECTION = 'UP';

type Point = { x: number; y: number };
type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';
type GameState = 'START' | 'PLAYING' | 'PAUSED' | 'GAME_OVER' | 'TUTORIAL';
type Difficulty = 'EASY' | 'MEDIUM' | 'HARD';

const SPEEDS: Record<Difficulty, number> = {
  EASY: 160,
  MEDIUM: 120,
  HARD: 80
};

const MULTIPLIERS: Record<Difficulty, number> = {
  EASY: 0.5,
  MEDIUM: 1,
  HARD: 2
};

interface TutorialStep {
  title: string;
  desc: string;
  highlight?: 'CONTROLS' | 'GRID' | 'STATS';
}

const TUTORIAL_STEPS: TutorialStep[] = [
  {
    title: 'MANUAL OVERRIDE',
    desc: 'Use the DIRECTIONAL MATRIX or ARROW KEYS to steer the prototype.',
    highlight: 'CONTROLS'
  },
  {
    title: 'ENERGY CORE',
    desc: 'Locate and assimilate energy pulses (FOOD) to extend your mission length.',
    highlight: 'GRID'
  },
  {
    title: 'SYSTEM INTEGRITY',
    desc: 'Colliding with boundaries or your own structural segments will result in CATASTROPHIC FAILURE.',
    highlight: 'GRID'
  },
  {
    title: 'SCORE PROTOCOL',
    desc: 'Your performance is logged in the side panels. Aim for peak efficiency.',
    highlight: 'STATS'
  }
];

interface Theme {
  id: string;
  name: string;
  bgLcd: string;
  snake: string;
  food: string;
  text: string;
  accent: string;
  border: string;
}

const THEMES: Theme[] = [
  { 
    id: 'classic', 
    name: 'Classic LCD', 
    bgLcd: '#8BB22C', 
    snake: '#1a2b00', 
    food: '#1a2b00', 
    text: '#1a2b00',
    accent: '#10b981', // Emerald
    border: '#000000'
  },
  { 
    id: 'cyberpunk', 
    name: 'Cyberpunk', 
    bgLcd: '#0a0a2e', 
    snake: '#00f7ff', 
    food: '#ff00ff', 
    text: '#00f7ff',
    accent: '#f43f5e', // Rose
    border: '#00f7ff'
  },
  { 
    id: 'amber', 
    name: 'Amber CRT', 
    bgLcd: '#1a1000', 
    snake: '#ffb000', 
    food: '#ffb000', 
    text: '#ffb000',
    accent: '#f59e0b', // Amber
    border: '#ffb000'
  },
  { 
    id: 'gameboy', 
    name: 'Pocket', 
    bgLcd: '#c4cfa1', 
    snake: '#2d331c', 
    food: '#2d331c', 
    text: '#2d331c',
    accent: '#4ade80', // Green
    border: '#2d331c'
  },
];

export default function App() {
  const [snake, setSnake] = useState<Point[]>(INITIAL_SNAKE);
  const [food, setFood] = useState<Point>({ x: 5, y: 5 });
  const [direction, setDirection] = useState<Direction>(INITIAL_DIRECTION);
  const [gameState, setGameState] = useState<GameState>('START');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [highScoreList, setHighScoreList] = useState<number[]>([]);
  const [difficulty, setDifficulty] = useState<Difficulty>('MEDIUM');
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [trail, setTrail] = useState<Point[]>([]);
  const [currentTheme, setCurrentTheme] = useState<Theme>(THEMES[0]);
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);
  const [bufferedDirections, setBufferedDirections] = useState<Direction[]>([]);
  
  const lastDirection = useRef<Direction>(INITIAL_DIRECTION);
  const inputBuffer = useRef<Direction[]>([]);
  const gameInterval = useRef<NodeJS.Timeout | null>(null);

  // Load high score and personal theme
  useEffect(() => {
    const savedScore = localStorage.getItem('snakeHighScore');
    if (savedScore) setHighScore(parseInt(savedScore, 10));

    const savedThemeId = localStorage.getItem('snakeTheme');
    if (savedThemeId) {
      const found = THEMES.find(t => t.id === savedThemeId);
      if (found) setCurrentTheme(found);
    }

    const savedDiff = localStorage.getItem('snakeDifficulty') as Difficulty;
    if (savedDiff && SPEEDS[savedDiff]) setDifficulty(savedDiff);

    const savedList = localStorage.getItem('snakeHighScoreList');
    if (savedList) setHighScoreList(JSON.parse(savedList));

    const tutorialSeen = localStorage.getItem('snakeTutorialSeen');
    if (!tutorialSeen) {
      setGameState('TUTORIAL');
    }
  }, []);

  // Save high score
  useEffect(() => {
    if (score > highScore) {
      setHighScore(score);
      localStorage.setItem('snakeHighScore', score.toString());
    }
  }, [score, highScore]);

  const changeTheme = (theme: Theme) => {
    setCurrentTheme(theme);
    localStorage.setItem('snakeTheme', theme.id);
    setShowThemePicker(false);
  };

  const changeDifficulty = (diff: Difficulty) => {
    setDifficulty(diff);
    localStorage.setItem('snakeDifficulty', diff);
  };

  const generateFood = useCallback((currentSnake: Point[]) => {
    let newFood: Point;
    while (true) {
      newFood = {
        x: Math.floor(Math.random() * GRID_SIZE),
        y: Math.floor(Math.random() * GRID_SIZE),
      };
      if (!currentSnake.some(segment => segment.x === newFood.x && segment.y === newFood.y)) {
        break;
      }
    }
    setFood(newFood);
  }, []);

  const startGame = () => {
    soundService.playStart();
    setGameState('PLAYING');
  };

  const togglePause = () => {
    if (gameState === 'PLAYING') {
      setGameState('PAUSED');
    } else if (gameState === 'PAUSED') {
      setGameState('PLAYING');
    }
  };

  const startTutorial = () => {
    setTutorialStep(0);
    setGameState('TUTORIAL');
  };

  const nextTutorial = () => {
    if (tutorialStep < TUTORIAL_STEPS.length - 1) {
      setTutorialStep(s => s + 1);
    } else {
      skipTutorial();
    }
  };

  const skipTutorial = () => {
    localStorage.setItem('snakeTutorialSeen', 'true');
    setGameState('START');
  };

  const resetGame = () => {
    if (gameState === 'PLAYING' || gameState === 'PAUSED') {
      setShowResetConfirm(true);
      if (gameState === 'PLAYING') setGameState('PAUSED');
    } else {
      performReset();
    }
  };

  const performReset = () => {
    soundService.playStart();
    setSnake(INITIAL_SNAKE);
    setDirection(INITIAL_DIRECTION);
    lastDirection.current = INITIAL_DIRECTION;
    inputBuffer.current = [];
    setBufferedDirections([]);
    setTrail([]);
    setScore(0);
    setGameState('PLAYING');
    generateFood(INITIAL_SNAKE);
    setShowResetConfirm(false);
  };

  const moveSnake = useCallback(() => {
    setSnake(prevSnake => {
      // Input buffering logic
      let nextDir = direction;
      if (inputBuffer.current.length > 0) {
        nextDir = inputBuffer.current.shift()!;
        setDirection(nextDir);
        setBufferedDirections([...inputBuffer.current]);
      }

      const head = { ...prevSnake[0] };

      switch (nextDir) {
        case 'UP': head.y -= 1; break;
        case 'DOWN': head.y += 1; break;
        case 'LEFT': head.x -= 1; break;
        case 'RIGHT': head.x += 1; break;
      }

      // Check collision with walls or self
      if (head.x < 0 || head.x >= GRID_SIZE || head.y < 0 || head.y >= GRID_SIZE || prevSnake.some(segment => segment.x === head.x && segment.y === head.y)) {
        soundService.playGameOver();
        setGameState('GAME_OVER');
        
        // Update high score list
        setHighScoreList(prev => {
          const newList = [...prev, score].sort((a, b) => b - a).slice(0, 5);
          localStorage.setItem('snakeHighScoreList', JSON.stringify(newList));
          return newList;
        });
        
        return prevSnake;
      }

      const newSnake = [head, ...prevSnake];

      // Check collision with food
      if (head.x === food.x && head.y === food.y) {
        soundService.playEat();
        setScore(s => s + Math.round(10 * MULTIPLIERS[difficulty]));
        generateFood(newSnake);
      } else {
        const oldTail = newSnake.pop();
        if (oldTail) {
          setTrail(prev => [oldTail, ...prev].slice(0, 5));
        }
        soundService.playMove();
      }

      lastDirection.current = nextDir;
      return newSnake;
    });
  }, [direction, food, generateFood, difficulty, score]);

  useEffect(() => {
    if (gameState === 'PLAYING') {
      gameInterval.current = setInterval(moveSnake, SPEEDS[difficulty]);
    } else {
      if (gameInterval.current) clearInterval(gameInterval.current);
    }
    return () => {
      if (gameInterval.current) clearInterval(gameInterval.current);
    };
  }, [gameState, moveSnake, difficulty]);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      const addDir = (dir: Direction) => {
        const lastInQueue = inputBuffer.current.length > 0 
          ? inputBuffer.current[inputBuffer.current.length - 1] 
          : lastDirection.current;

        const isOpposite = (d1: Direction, d2: Direction) => {
          return (d1 === 'UP' && d2 === 'DOWN') ||
                 (d1 === 'DOWN' && d2 === 'UP') ||
                 (d1 === 'LEFT' && d2 === 'RIGHT') ||
                 (d1 === 'RIGHT' && d2 === 'LEFT');
        };

        if (!isOpposite(dir, lastInQueue) && inputBuffer.current.length < 3) {
          inputBuffer.current.push(dir);
          setBufferedDirections([...inputBuffer.current]);
        }
      };

      switch (e.key) {
        case 'ArrowUp': addDir('UP'); break;
        case 'ArrowDown': addDir('DOWN'); break;
        case 'ArrowLeft': addDir('LEFT'); break;
        case 'ArrowRight': addDir('RIGHT'); break;
        case 'Escape':
          togglePause();
          break;
        case 'r':
        case 'R':
          resetGame();
          break;
        case 't':
        case 'T':
          setShowThemePicker(p => !p);
          break;
        case ' ': // Space to pause or start
          if (gameState === 'PLAYING' || gameState === 'PAUSED') togglePause();
          else if (gameState === 'START') startGame();
          break;
      }
    };
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [gameState]);

  const handleOnScreenControl = (dir: Direction) => {
    const lastInQueue = inputBuffer.current.length > 0 
      ? inputBuffer.current[inputBuffer.current.length - 1] 
      : lastDirection.current;

    const isOpposite = (d1: Direction, d2: Direction) => {
      return (d1 === 'UP' && d2 === 'DOWN') ||
             (d1 === 'DOWN' && d2 === 'UP') ||
             (d1 === 'LEFT' && d2 === 'RIGHT') ||
             (d1 === 'RIGHT' && d2 === 'LEFT');
    };

    if (!isOpposite(dir, lastInQueue) && inputBuffer.current.length < 3) {
      inputBuffer.current.push(dir);
      setBufferedDirections([...inputBuffer.current]);
    }
  };

  return (
    <div className="w-[1024px] h-[768px] mx-auto flex overflow-hidden p-8 gap-8 select-none">
      {/* Left Sidebar */}
      <div className="w-1/4 flex flex-col justify-between relative">
        <AnimatePresence>
          {gameState === 'TUTORIAL' && TUTORIAL_STEPS[tutorialStep].highlight === 'STATS' && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="absolute -inset-2 border-2 border-emerald-500 rounded-[2rem] z-50 pointer-events-none shadow-[0_0_20px_rgba(16,185,129,0.3)]"
            />
          )}
        </AnimatePresence>
        
        <div className="space-y-8">
          <div>
            <h1 className="text-4xl font-black tracking-tighter uppercase leading-none transition-colors duration-500" style={{ color: currentTheme.accent }}>
              Nostalgia<br/>Snake
            </h1>
            <div className="h-1.5 w-16 mt-4 shadow-lg transition-all duration-500" style={{ backgroundColor: currentTheme.accent }} />
          </div>
          
          <div className="space-y-4">
            <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl">
              <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest mb-2">Current Score</p>
              <p className="text-4xl font-mono tabular-nums transition-colors duration-500" style={{ color: currentTheme.accent }}>
                {score.toString().padStart(6, '0')}
              </p>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl shadow-inner">
              <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest mb-2">High Score</p>
              <p className="text-4xl font-mono text-zinc-300 tabular-nums">
                {highScore.toString().padStart(6, '0')}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">Speed Level</p>
            <div className="flex gap-1 h-2.5">
              {[...Array(5)].map((_, i) => (
                <div 
                  key={i} 
                  className="flex-1 transition-all duration-500" 
                  style={{ backgroundColor: i < Math.min(5, Math.floor(score/100) + 1) ? currentTheme.accent : '#27272a' }}
                />
              ))}
            </div>
            <p className="text-right text-[10px] font-mono text-zinc-500 italic uppercase">
              Phase {Math.floor(score/100) + 1} - {score < 200 ? 'Noob' : score < 500 ? 'Pro' : 'Expert'}
            </p>
          </div>

          <button 
            onClick={startTutorial}
            className="w-full flex items-center justify-center gap-3 p-4 bg-zinc-900 border border-zinc-800 rounded-2xl text-[10px] font-black tracking-widest text-zinc-400 hover:text-emerald-500 hover:border-emerald-500/50 transition-all active:scale-95"
          >
            <HelpCircle size={16} />
            DIAGNOSTICS / TUTORIAL
          </button>
        </div>

        <div className="text-zinc-600 text-[11px] leading-relaxed font-medium uppercase tracking-tighter">
          <p>Original engine v2.4.0</p>
          <p>© 1997 RETROSYSTEMS GLOBAL</p>
        </div>
      </div>

      {/* Center: Game Board */}
      <motion.div 
        animate={gameState === 'GAME_OVER' ? {
          x: [0, -10, 10, -10, 10, -5, 5, -2, 2, 0],
          y: [0, -5, 5, -5, 5, -2, 2, -1, 1, 0],
          transition: { duration: 0.8, ease: "easeInOut" }
        } : {}}
        className="flex-1 flex flex-col h-full relative"
      >
        <AnimatePresence>
          {gameState === 'TUTORIAL' && TUTORIAL_STEPS[tutorialStep].highlight === 'GRID' && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="absolute -inset-2 border-2 border-emerald-500 rounded-[2rem] z-50 pointer-events-none shadow-[0_0_20px_rgba(16,185,129,0.3)]"
            />
          )}
        </AnimatePresence>

        <div 
          className="flex-1 border-[12px] border-zinc-900 rounded-2xl relative overflow-hidden transition-all duration-700 shadow-2xl"
          style={{ backgroundColor: currentTheme.bgLcd, boxShadow: `0 0 50px rgba(0,0,0,0.5), inset 0 0 30px rgba(0,0,0,0.1)` }}
        >
          {/* LCD Texture Overlay */}
          <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: `radial-gradient(${currentTheme.text} 0.5px, transparent 0.5px)`, backgroundSize: '3px 3px' }} />
          
          {/* LCD Frame Info */}
          <div className="absolute top-3 left-5 right-5 flex justify-between font-mono text-[10px] font-black tracking-widest z-20 transition-colors duration-500" style={{ color: currentTheme.text }}>
            <span className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full animate-pulse transition-colors duration-500" style={{ backgroundColor: currentTheme.text }} />
              STATUS: {gameState}
            </span>
            <span>OS: SNAKE_6110_EMU</span>
          </div>
          
          {/* Main Game Surface */}
          <div className="relative w-full h-full p-4">
            <div className="relative w-full h-full">
              {/* Trail */}
              {trail.map((segment, i) => (
                <motion.div
                  key={`trail-${segment.x}-${segment.y}-${i}`}
                  initial={{ opacity: 0.4 }}
                  animate={{ opacity: 0 }}
                  transition={{ duration: 0.5 }}
                  className="absolute w-[4.8%] h-[4.8%] rounded-full"
                  style={{ 
                    left: `${segment.x * 5}%`, 
                    top: `${segment.y * 5}%`,
                    backgroundColor: currentTheme.text,
                    opacity: 0.3 / (i + 1)
                  }}
                />
              ))}
              {/* Food */}
              <motion.div 
                key={`food-${food.x}-${food.y}`}
                initial={{ scale: 0, rotate: -45 }}
                animate={{ scale: 1, rotate: 0 }}
                className="absolute w-[5%] h-[5%] rounded-xs shadow-sm"
                style={{ 
                  left: `${food.x * 5}%`, 
                  top: `${food.y * 5}%`,
                  backgroundColor: currentTheme.food,
                  boxShadow: `0 0 10px ${currentTheme.food}66`
                }}
              />
              {/* Snake */}
              {snake.map((segment, i) => (
                <motion.div 
                  key={`${segment.x}-${segment.y}-${i}`}
                  initial={i === 0 ? { scale: 1.2 } : { scale: 0.8 }}
                  animate={{ scale: i === 0 ? 1.05 : 1 }}
                  layout
                  className={`absolute w-[4.8%] h-[4.8%] transition-all duration-200 ${i === 0 ? 'rounded-xs z-10' : 'rounded-sm'}`}
                  style={{ 
                    left: `${segment.x * 5}%`, 
                    top: `${segment.y * 5}%`,
                    backgroundColor: currentTheme.snake,
                    opacity: i === 0 ? 1 : 0.8
                  }}
                />
              ))}
            </div>
          </div>

          {/* Overlays */}
          <AnimatePresence>
            {gameState === 'PAUSED' && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-40 bg-black/20 flex flex-col items-center justify-center cursor-pointer"
                onClick={togglePause}
              >
                <motion.div 
                  animate={{ scale: [1, 1.1, 1] }} 
                  transition={{ repeat: Infinity, duration: 2 }}
                  className="bg-zinc-950/80 px-6 py-2 rounded-full border border-emerald-500/50 flex items-center gap-3 backdrop-blur-md"
                >
                  <Pause size={16} className="text-emerald-500 animate-pulse" />
                  <span className="text-[10px] font-black tracking-[0.2em] text-emerald-500">SYSTEM_PAUSED</span>
                </motion.div>
                <p className="mt-4 text-[9px] font-black text-white/40 uppercase tracking-widest">Click anywhere to resume</p>
              </motion.div>
            )}

            {gameState !== 'PLAYING' && gameState !== 'PAUSED' && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 backdrop-blur-[2px] flex items-center justify-center p-8 z-30"
                style={{ backgroundColor: `${currentTheme.bgLcd}66` }}
              >
                <div className="border-[6px] p-8 text-center shadow-2xl transition-all duration-500" style={{ borderColor: currentTheme.text, backgroundColor: currentTheme.bgLcd }}>
                  {gameState === 'START' && (
                    <div className="space-y-6">
                      <div className="space-y-1">
                        <h2 className="text-4xl font-black italic leading-none transition-colors" style={{ color: currentTheme.text }}>SNAKE II</h2>
                        <p className="text-[10px] font-bold tracking-widest transition-colors" style={{ color: currentTheme.text }}>NOKIA SYSTEMS INC</p>
                      </div>

                      <div className="flex flex-col gap-2 p-2 border-2" style={{ borderColor: currentTheme.text }}>
                        <p className="text-[9px] font-black uppercase tracking-widest mb-1" style={{ color: currentTheme.text }}>Difficulty Matrix</p>
                        <div className="flex gap-1">
                          {(['EASY', 'MEDIUM', 'HARD'] as Difficulty[]).map(d => (
                            <button 
                              key={d}
                              onClick={() => changeDifficulty(d)}
                              className={`flex-1 py-1 text-[8px] font-black transition-all ${difficulty === d ? 'scale-105' : 'opacity-40'}`}
                              style={{ 
                                backgroundColor: difficulty === d ? currentTheme.text : 'transparent',
                                color: difficulty === d ? currentTheme.bgLcd : currentTheme.text,
                                border: `1px solid ${currentTheme.text}`
                              }}
                            >
                              {d}
                            </button>
                          ))}
                        </div>
                      </div>

                      <button 
                        onClick={startGame}
                        className="px-8 py-3 text-sm font-black hover:scale-105 transition-all w-full"
                        style={{ backgroundColor: currentTheme.text, color: currentTheme.bgLcd }}
                      >
                        BOOT SEQUENCE
                      </button>
                    </div>
                  )}

                  {gameState === 'PAUSED' && (
                    <div className="space-y-4">
                      <div className="w-16 h-16 bg-zinc-950 rounded-2xl flex items-center justify-center mx-auto border-2 border-emerald-500/30">
                        <Pause size={32} className="text-emerald-500" />
                      </div>
                      <h2 className="text-4xl font-black transition-colors" style={{ color: currentTheme.text }}>PAUSED</h2>
                      <button 
                        onClick={() => setGameState('PLAYING')}
                        className="px-8 py-3 text-sm font-black hover:scale-105 transition-all shadow-xl"
                        style={{ backgroundColor: currentTheme.text, color: currentTheme.bgLcd }}
                      >
                        RESUME SESSION
                      </button>
                    </div>
                  )}

                  {gameState === 'GAME_OVER' && (
                    <div className="space-y-6 min-w-[200px]">
                      <div className="space-y-1">
                        <motion.h2 
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="text-3xl font-black italic leading-none transition-colors" 
                          style={{ color: currentTheme.text }}
                        >
                          CRITICAL FAIL
                        </motion.h2>
                        <p className="text-[10px] font-bold tracking-widest transition-colors opacity-60" style={{ color: currentTheme.text }}>SYSTEM_HALTED</p>
                      </div>
                      
                      <div className="space-y-2 py-4 border-y-2" style={{ borderColor: `${currentTheme.text}33` }}>
                        <div className="flex justify-between text-[11px] font-bold" style={{ color: currentTheme.text }}>
                          <span>FINAL SCORE:</span>
                          <span>{score.toString().padStart(6, '0')}</span>
                        </div>
                        <div className="flex justify-between text-[11px] font-bold opacity-60" style={{ color: currentTheme.text }}>
                          <span>RECORD HIGH:</span>
                          <span>{highScore.toString().padStart(6, '0')}</span>
                        </div>
                      </div>

                      <div className="flex flex-col gap-2">
                        <button 
                          onClick={performReset}
                          className="px-8 py-3 text-sm font-black hover:scale-105 transition-all flex items-center justify-center gap-2"
                          style={{ backgroundColor: currentTheme.text, color: currentTheme.bgLcd }}
                        >
                          <RotateCcw size={16} />
                          RETRY MISSION
                        </button>
                        <button 
                          onClick={() => setGameState('START')}
                          className="px-8 py-2 text-[10px] font-black border-2 transition-all hover:bg-black/5"
                          style={{ borderColor: currentTheme.text, color: currentTheme.text }}
                        >
                          MAIN MENU
                        </button>
                      </div>
                    </div>
                  )}

                  {gameState === 'TUTORIAL' && (
                    <div className="space-y-6 max-w-xs mx-auto">
                      <div className="space-y-1">
                        <h2 className="text-2xl font-black italic transition-colors leading-tight" style={{ color: currentTheme.text }}>
                          {TUTORIAL_STEPS[tutorialStep].title}
                        </h2>
                        <div className="h-1 w-8 mx-auto" style={{ backgroundColor: currentTheme.text }} />
                      </div>
                      
                      <p className="text-[11px] font-bold leading-relaxed transition-colors opacity-80" style={{ color: currentTheme.text }}>
                        {TUTORIAL_STEPS[tutorialStep].desc}
                      </p>

                      <div className="flex gap-2">
                        <button 
                          onClick={skipTutorial}
                          className="flex-1 px-4 py-2 text-[10px] font-black border-2 transition-all hover:bg-black/5"
                          style={{ borderColor: currentTheme.text, color: currentTheme.text }}
                        >
                          SKIP
                        </button>
                        <button 
                          onClick={nextTutorial}
                          className="flex-1 px-4 py-2 text-[10px] font-black transition-all hover:scale-105"
                          style={{ backgroundColor: currentTheme.text, color: currentTheme.bgLcd }}
                        >
                          {tutorialStep === TUTORIAL_STEPS.length - 1 ? 'TERMINATE' : 'PROCEED'}
                        </button>
                      </div>
                      
                      <div className="flex justify-center gap-1.5">
                        {TUTORIAL_STEPS.map((_, i) => (
                          <div 
                            key={i} 
                            className="w-1.5 h-1.5 rounded-full transition-all"
                            style={{ 
                              backgroundColor: currentTheme.text,
                              opacity: i === tutorialStep ? 1 : 0.2,
                              transform: i === tutorialStep ? 'scale(1.2)' : 'none'
                            }} 
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Confirmation Dialog Overseas */}
          <AnimatePresence>
            {showResetConfirm && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-50 backdrop-blur-md flex items-center justify-center p-8"
                style={{ backgroundColor: `${currentTheme.bgLcd}dd` }}
              >
                <div className="border-[6px] p-8 text-center shadow-2xl transition-all duration-500 max-w-xs" style={{ borderColor: currentTheme.text, backgroundColor: currentTheme.bgLcd }}>
                  <h3 className="text-xl font-black leading-tight mb-4" style={{ color: currentTheme.text }}>
                    TERMINATE PROTOCOL?<br/>
                    <span className="text-[10px] opacity-60 uppercase tracking-widest">Wipe current session data?</span>
                  </h3>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => {
                        setShowResetConfirm(false);
                        setGameState('PLAYING');
                      }}
                      className="flex-1 px-4 py-3 text-[10px] font-black border-2 transition-all hover:bg-black/5"
                      style={{ borderColor: currentTheme.text, color: currentTheme.text }}
                    >
                      NEGATIVE
                    </button>
                    <button 
                      onClick={performReset}
                      className="flex-1 px-4 py-3 text-[10px] font-black transition-all hover:scale-105 shadow-lg"
                      style={{ backgroundColor: currentTheme.text, color: currentTheme.bgLcd }}
                    >
                      AFFIRMATIVE
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Theme Picker Overlay */}
          <AnimatePresence>
            {showThemePicker && (
              <motion.div 
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                className="absolute inset-x-0 bottom-0 h-1/2 bg-zinc-900/95 backdrop-blur-md z-40 p-6 flex flex-col gap-4 border-t border-emerald-500/20"
              >
                <div className="flex justify-between items-center">
                  <h3 className="text-xs font-black uppercase tracking-widest text-emerald-500">Visual Matrix Selection</h3>
                  <button onClick={() => setShowThemePicker(false)} className="text-[10px] font-bold text-zinc-500 hover:text-white uppercase tracking-tighter">Close [X]</button>
                </div>
                <div className="grid grid-cols-2 gap-4 flex-1">
                  {THEMES.map(theme => (
                    <button 
                      key={theme.id}
                      onClick={() => changeTheme(theme)}
                      className={`flex flex-col gap-2 p-3 rounded-xl border-2 transition-all ${currentTheme.id === theme.id ? 'border-emerald-500 bg-emerald-500/10' : 'border-zinc-800 bg-zinc-800/50'}`}
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full" style={{ backgroundColor: theme.bgLcd }} />
                        <span className="text-[10px] font-bold text-zinc-300">{theme.name}</span>
                      </div>
                      <div className="h-2 w-full rounded-full flex gap-1 overflow-hidden opacity-50">
                        <div className="flex-1" style={{ backgroundColor: theme.bgLcd }} />
                        <div className="flex-1" style={{ backgroundColor: theme.snake }} />
                        <div className="flex-1" style={{ backgroundColor: theme.accent }} />
                      </div>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        
        <div className="mt-8 flex justify-center gap-4">
          <button 
            onClick={togglePause}
            disabled={gameState === 'START' || gameState === 'GAME_OVER' || gameState === 'TUTORIAL'}
            className="px-6 py-3 bg-zinc-900 border border-zinc-800 rounded-2xl text-[10px] font-black tracking-widest text-zinc-500 flex items-center gap-2 hover:bg-zinc-800 transition-all active:scale-95 disabled:opacity-30 disabled:pointer-events-none"
          >
            <Pause size={14} className={gameState === 'PAUSED' ? 'text-emerald-500' : ''} />
            {gameState === 'PAUSED' ? 'RESUME' : 'PAUSE'} [ESC]
          </button>
          <KeyIndicator k="R" label="RESET" />
          <button 
            onClick={() => setShowThemePicker(p => !p)}
            className="px-6 py-3 bg-zinc-900 border border-zinc-800 rounded-2xl text-[10px] font-black tracking-widest text-emerald-500 flex items-center gap-2 hover:bg-zinc-800 transition-all active:scale-95"
          >
            <Palette size={14} />
            THEMES [T]
          </button>
        </div>
      </motion.div>

      {/* Right Sidebar */}
      <div className="w-1/4 flex flex-col gap-6 relative">
        <AnimatePresence>
          {gameState === 'TUTORIAL' && TUTORIAL_STEPS[tutorialStep].highlight === 'CONTROLS' && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="absolute -inset-2 border-2 border-emerald-500 rounded-[2rem] z-50 pointer-events-none shadow-[0_0_20px_rgba(16,185,129,0.3)]"
            />
          )}
        </AnimatePresence>

        <div className="bg-zinc-900/50 rounded-3xl p-10 border border-zinc-800 flex flex-col items-center justify-center flex-1 shadow-2xl relative overflow-hidden backdrop-blur-sm">
          {/* Command Queue */}
          <div className="absolute top-6 left-0 right-0 px-6 flex flex-col items-center gap-2">
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-600 mb-1">Command Queue</p>
            <div className="flex gap-2 h-8">
              <AnimatePresence mode="popLayout">
                {bufferedDirections.map((dir, i) => (
                  <motion.div
                    key={`${dir}-${i}`}
                    initial={{ opacity: 0, scale: 0.5, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.5, x: -20 }}
                    className="w-8 h-8 rounded-lg bg-zinc-950 border border-zinc-800 flex items-center justify-center shadow-lg"
                  >
                    <div style={{ color: currentTheme.accent }}>
                      {dir === 'UP' && <ChevronUp size={16} />}
                      {dir === 'DOWN' && <ChevronDown size={16} />}
                      {dir === 'LEFT' && <ChevronLeft size={16} />}
                      {dir === 'RIGHT' && <ChevronRight size={16} />}
                    </div>
                  </motion.div>
                ))}
                {bufferedDirections.length === 0 && (
                  <div className="flex items-center justify-center text-[8px] font-bold text-zinc-800 uppercase tracking-widest italic h-full">
                    No active queue
                  </div>
                )}
              </AnimatePresence>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 relative z-10 mt-8">
            <div></div>
            <ControlButton 
              icon={<ChevronUp size={28} />} 
              onClick={() => handleOnScreenControl('UP')}
              active={direction === 'UP' || bufferedDirections.includes('UP')}
              accent={currentTheme.accent}
            />
            <div></div>
            <ControlButton 
              icon={<ChevronLeft size={28} />} 
              onClick={() => handleOnScreenControl('LEFT')}
              active={direction === 'LEFT' || bufferedDirections.includes('LEFT')}
              accent={currentTheme.accent}
            />
            <div className="w-16 h-16 bg-zinc-950 rounded-2xl shadow-inner border border-zinc-800 flex items-center justify-center">
              <div className="w-3 h-3 rounded-full transition-colors duration-500 animate-pulse" style={{ backgroundColor: currentTheme.accent, boxShadow: `0 0 10px ${currentTheme.accent}` }} />
            </div>
            <ControlButton 
              icon={<ChevronRight size={28} />} 
              onClick={() => handleOnScreenControl('RIGHT')}
              active={direction === 'RIGHT' || bufferedDirections.includes('RIGHT')}
              accent={currentTheme.accent}
            />
            <div></div>
            <ControlButton 
              icon={<ChevronDown size={28} />} 
              onClick={() => handleOnScreenControl('DOWN')}
              active={direction === 'DOWN' || bufferedDirections.includes('DOWN')}
              accent={currentTheme.accent}
            />
            <div></div>
          </div>
          <p className="mt-12 text-[10px] text-zinc-500 font-black uppercase tracking-[0.3em]">Directional Matrix</p>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Trophy size={14} className="text-emerald-500" />
              <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Leaderboard</p>
            </div>
            <span className="text-[9px] font-mono text-zinc-600">TOP_5</span>
          </div>
          
          <div className="space-y-2">
            {highScoreList.length > 0 ? (
              highScoreList.map((s, i) => (
                <div key={i} className="flex items-center justify-between font-mono text-[11px]">
                  <span className="text-zinc-600">#{i + 1}</span>
                  <span className={`${i === 0 ? 'text-emerald-500 font-bold' : 'text-zinc-400'}`}>
                    {s.toString().padStart(6, '0')}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-[10px] text-zinc-700 italic text-center py-2">No records logged...</p>
            )}
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-2.5 h-2.5 rounded-full shadow-lg transition-colors duration-500" style={{ backgroundColor: currentTheme.accent }} />
            <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: currentTheme.accent }}>Device Status</p>
          </div>
          <p className="text-[11px] font-mono leading-relaxed uppercase transition-opacity" style={{ color: `${currentTheme.accent}66` }}>
            Signal: Strong<br/>
            Battery: 98%<br/>
            Temp: 32°C [Stable]
          </p>
        </div>
      </div>
    </div>
  );
}

function KeyIndicator({ k, label }: { k: string, label: string }) {
  return (
    <div className="px-6 py-3 bg-zinc-900 border border-zinc-800 rounded-2xl text-[10px] font-black tracking-widest text-zinc-500 flex items-center gap-2">
      <span className="bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-400">{k}</span> {label}
    </div>
  );
}

function ControlButton({ icon, onClick, active, accent }: { icon: ReactNode, onClick: () => void, active: boolean, accent: string }) {
  return (
    <button 
      onClick={onClick}
      className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-150 
        ${active ? 'border-b-0 translate-y-1' : 'bg-zinc-800 text-zinc-500 border-b-4 border-zinc-950 hover:bg-zinc-700 active:translate-y-1 active:border-b-0'}`}
      style={{ 
        backgroundColor: active ? accent : undefined, 
        color: active ? '#000' : undefined 
      }}
    >
      {icon}
    </button>
  );
}

