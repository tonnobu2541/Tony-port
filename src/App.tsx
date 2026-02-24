import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { motion, AnimatePresence } from 'motion/react';
import { QRCodeSVG } from 'qrcode.react';
import confetti from 'canvas-confetti';
import { 
  Trophy, 
  Users, 
  Timer, 
  CheckCircle2, 
  XCircle, 
  Crown, 
  ArrowRight, 
  RefreshCw,
  Camera,
  Upload,
  Play
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { GameData, Player, ServerToClientEvents, ClientToServerEvents } from './types.ts';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io();

export default function App() {
  const [gameState, setGameState] = useState<GameData | null>(null);
  const [playerName, setPlayerName] = useState('');
  const [avatar, setAvatar] = useState<string | null>(null);
  const [isJoined, setIsJoined] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const [feedback, setFeedback] = useState<{ correct: boolean; points: number; reason: string } | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);

  useEffect(() => {
    socket.on('gameUpdate', (data) => {
      setGameState(data);
    });

    socket.on('answerFeedback', (data) => {
      setFeedback(data);
      setShowFeedback(true);
      setTimeout(() => setShowFeedback(false), 5000);
    });

    return () => {
      socket.off('gameUpdate');
      socket.off('answerFeedback');
    };
  }, []);

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerName.trim()) return;
    socket.emit('join', playerName, false, avatar || undefined);
    setIsJoined(true);
  };

  const handleHostJoin = () => {
    socket.emit('join', 'Host', true);
    setIsJoined(true);
    setIsHost(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatar(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  if (!isJoined) {
    return (
      <div className="min-h-screen bg-pink-50 flex flex-col items-center justify-center p-4 font-sans">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-8 rounded-3xl shadow-xl w-full max-w-md border-4 border-blue-100"
        >
          <div className="flex justify-center mb-6">
            <div className="bg-pink-100 p-4 rounded-full">
              <Trophy className="w-12 h-12 text-pink-500" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-center text-blue-600 mb-2">Wedding Quiz</h1>
          <p className="text-center text-gray-500 mb-8">ร่วมสนุกไปกับเรื่องราวของคู่บ่าวสาว</p>
          
          <form onSubmit={handleJoin} className="space-y-6">
            <div className="flex flex-col items-center space-y-4">
              <div className="relative group">
                <div className="w-24 h-24 rounded-full bg-pink-50 border-4 border-pink-100 overflow-hidden flex items-center justify-center relative">
                  {avatar ? (
                    <img src={avatar} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <Camera className="w-8 h-8 text-pink-300" />
                  )}
                </div>
                <label className="absolute bottom-0 right-0 bg-blue-500 p-2 rounded-full cursor-pointer shadow-lg hover:bg-blue-600 transition-colors">
                  <Upload className="w-4 h-4 text-white" />
                  <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                </label>
              </div>
              <p className="text-xs text-gray-400 font-medium">อัปโหลดรูปภาพของคุณ (ไม่บังคับ)</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อของคุณ</label>
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="ใส่ชื่อเล่นของคุณ..."
                className="w-full px-4 py-3 rounded-xl border-2 border-pink-100 focus:border-pink-300 focus:ring-0 outline-none transition-all"
                maxLength={15}
              />
            </div>
            <button
              type="submit"
              className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 rounded-xl shadow-lg transform active:scale-95 transition-all"
            >
              เข้าสู่เกม
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-gray-100">
            <button
              onClick={handleHostJoin}
              className="w-full text-gray-400 hover:text-gray-600 text-sm font-medium transition-colors"
            >
              เข้าสู่ระบบในฐานะ Host
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  if (!gameState) return null;

  return (
    <div className="min-h-screen bg-pink-50 font-sans">
      <AnimatePresence>
        {showFeedback && feedback && (
          <FeedbackPopup feedback={feedback} />
        )}
      </AnimatePresence>

      <div className="max-w-4xl mx-auto p-4 md:p-8">
        {gameState.state === 'LOBBY' && (
          <LobbyView gameState={gameState} isHost={isHost} />
        )}
        {gameState.state === 'READING' && (
          <ReadingView gameState={gameState} />
        )}
        {gameState.state === 'QUESTION' && (
          <QuestionView gameState={gameState} isHost={isHost} />
        )}
        {gameState.state === 'REVEAL' && (
          <RevealView gameState={gameState} />
        )}
        {gameState.state === 'LEADERBOARD' && (
          <LeaderboardView gameState={gameState} isHost={isHost} />
        )}
        {gameState.state === 'FINAL_RESULTS' && (
          <FinalResultsView gameState={gameState} isHost={isHost} />
        )}
      </div>

      {isHost && <HostControls gameState={gameState} />}
    </div>
  );
}

function LobbyView({ gameState, isHost }: { gameState: GameData; isHost: boolean }) {
  const players = Object.values(gameState.players).filter(p => !p.isHost);
  const appUrl = typeof window !== 'undefined' ? window.location.origin : '';

  return (
    <div className="flex flex-col items-center space-y-8">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="text-center"
      >
        <h2 className="text-4xl font-black text-blue-600 mb-4">เตรียมพร้อมเริ่มเกม!</h2>
        <p className="text-xl text-pink-500 font-medium">รอผู้จัดงานเริ่มการแข่งขัน...</p>
      </motion.div>

      {isHost && (
        <div className="bg-white p-8 rounded-3xl shadow-xl flex flex-col items-center border-4 border-blue-100">
          <p className="text-gray-600 mb-4 font-bold">สแกนเพื่อเข้าเล่น</p>
          <div className="bg-white p-4 rounded-2xl shadow-inner border-2 border-pink-50">
            <QRCodeSVG value={appUrl} size={200} />
          </div>
          <p className="mt-4 text-blue-500 font-mono text-sm">{appUrl}</p>
        </div>
      )}

      <div className="w-full">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-gray-700 flex items-center gap-2">
            <Users className="text-blue-500" />
            ผู้เล่นที่เข้าร่วม ({players.length})
          </h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <AnimatePresence>
            {players.map((player) => (
              <motion.div
                key={player.id}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="bg-white px-4 py-3 rounded-2xl shadow-sm border-2 border-pink-100 text-center font-bold text-gray-700"
              >
                <div className="w-12 h-12 rounded-full bg-pink-50 border-2 border-pink-100 overflow-hidden flex items-center justify-center mb-2 mx-auto">
                  {player.avatar ? (
                    <img src={player.avatar} alt={player.name} className="w-full h-full object-cover" />
                  ) : (
                    <Users className="w-6 h-6 text-pink-300" />
                  )}
                </div>
                {player.name}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function ReadingView({ gameState }: { gameState: GameData }) {
  const question = gameState.questions[gameState.currentQuestionIndex];
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center space-y-6"
      >
        <div className="inline-block bg-blue-100 text-blue-600 px-6 py-2 rounded-full font-bold text-lg">
          คำถามข้อที่ {gameState.currentQuestionIndex + 1}
        </div>
        <h2 className="text-4xl md:text-5xl font-black text-gray-800 leading-tight">
          {question.text}
        </h2>
      </motion.div>

      <div className="relative">
        <svg className="w-24 h-24 transform -rotate-90">
          <circle
            cx="48"
            cy="48"
            r="40"
            stroke="currentColor"
            strokeWidth="8"
            fill="transparent"
            className="text-pink-100"
          />
          <motion.circle
            cx="48"
            cy="48"
            r="40"
            stroke="currentColor"
            strokeWidth="8"
            fill="transparent"
            strokeDasharray="251.2"
            initial={{ strokeDashoffset: 0 }}
            animate={{ strokeDashoffset: 251.2 }}
            transition={{ duration: 5, ease: "linear" }}
            className="text-pink-500"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center text-2xl font-black text-pink-600">
          {gameState.timer}
        </div>
      </div>
    </div>
  );
}

function QuestionView({ gameState, isHost }: { gameState: GameData; isHost: boolean }) {
  const question = gameState.questions[gameState.currentQuestionIndex];
  const players = Object.values(gameState.players).filter(p => !p.isHost);
  const myPlayer = gameState.players[socket.id];
  
  const stats = question.options.map((_, idx) => {
    const count = players.filter(p => p.currentAnswer === idx).length;
    const percentage = players.length > 0 ? (count / players.length) * 100 : 0;
    return { count, percentage };
  });

  const handleAnswer = (idx: number) => {
    if (isHost) return;
    socket.emit('submitAnswer', idx);
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div className="bg-white px-6 py-2 rounded-full shadow-sm border-2 border-blue-100 font-bold text-blue-600 flex items-center gap-2">
          <Timer className="w-5 h-5" />
          {gameState.timer} วินาที
        </div>
        <div className="bg-white px-6 py-2 rounded-full shadow-sm border-2 border-pink-100 font-bold text-pink-500 flex items-center gap-2">
          <Users className="w-5 h-5" />
          ตอบแล้ว {players.filter(p => p.currentAnswer !== null).length}/{players.length}
        </div>
      </div>

      <h2 className="text-3xl font-black text-gray-800 text-center mb-12">
        {question.text}
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {question.options.map((option, idx) => {
          const isSelected = myPlayer?.currentAnswer === idx;
          return (
            <button
              key={idx}
              onClick={() => handleAnswer(idx)}
              disabled={isHost}
              className={cn(
                "relative overflow-hidden group p-6 rounded-3xl text-left transition-all transform active:scale-[0.98]",
                isSelected 
                  ? "bg-blue-500 text-white shadow-blue-200 shadow-lg ring-4 ring-blue-200" 
                  : "bg-white text-gray-700 hover:bg-blue-50 shadow-md border-2 border-blue-50"
              )}
            >
              <div className="relative z-10 flex justify-between items-center">
                <span className="text-xl font-bold">{option}</span>
                <span className="text-sm font-black opacity-60">
                  {stats[idx].count} คน ({Math.round(stats[idx].percentage)}%)
                </span>
              </div>
              
              {/* Progress Bar Background */}
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${stats[idx].percentage}%` }}
                className={cn(
                  "absolute left-0 top-0 bottom-0 opacity-10 transition-all",
                  isSelected ? "bg-white" : "bg-blue-500"
                )}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}

function RevealView({ gameState }: { gameState: GameData }) {
  const question = gameState.questions[gameState.currentQuestionIndex];
  const players = Object.values(gameState.players).filter(p => !p.isHost);
  
  const stats = question.options.map((_, idx) => {
    const count = players.filter(p => p.currentAnswer === idx).length;
    const percentage = players.length > 0 ? (count / players.length) * 100 : 0;
    return { count, percentage };
  });

  return (
    <div className="space-y-8">
      <div className="text-center space-y-4">
        <div className="inline-block bg-pink-100 text-pink-600 px-6 py-2 rounded-full font-bold text-lg">
          เฉลยคำตอบ
        </div>
        <h2 className="text-3xl font-black text-gray-800">
          {question.text}
        </h2>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {question.options.map((option, idx) => {
          const isCorrect = idx === question.correctAnswer;
          return (
            <motion.div
              key={idx}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.1 }}
              className={cn(
                "relative overflow-hidden p-6 rounded-3xl border-2 transition-all",
                isCorrect 
                  ? "bg-green-50 border-green-500 shadow-lg shadow-green-100" 
                  : "bg-white border-gray-100 opacity-60"
              )}
            >
              <div className="relative z-10 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  {isCorrect && <CheckCircle2 className="w-6 h-6 text-green-500" />}
                  <span className={cn("text-xl font-bold", isCorrect ? "text-green-700" : "text-gray-700")}>
                    {option}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-lg font-black text-blue-600">{stats[idx].count} คน</span>
                  <p className="text-xs font-bold text-gray-400">{Math.round(stats[idx].percentage)}%</p>
                </div>
              </div>
              
              {/* Progress Bar Background */}
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${stats[idx].percentage}%` }}
                className={cn(
                  "absolute left-0 top-0 bottom-0 opacity-10",
                  isCorrect ? "bg-green-500" : "bg-blue-500"
                )}
              />
            </motion.div>
          );
        })}
      </div>

      <div className="text-center">
        <div className="inline-flex items-center gap-2 text-gray-400 font-bold">
          <Timer className="w-5 h-5" />
          กำลังไปหน้า Leaderboard ใน {gameState.timer} วินาที...
        </div>
      </div>
    </div>
  );
}

function LeaderboardView({ gameState, isHost }: { gameState: GameData; isHost: boolean }) {
  const players = Object.values(gameState.players)
    .filter(p => !p.isHost)
    .sort((a, b) => b.score - a.score);
  
  const myPlayer = gameState.players[socket.id];
  const myRank = players.findIndex(p => p.id === socket.id) + 1;
  const top10 = players.slice(0, 10);

  return (
    <div className="space-y-8 pb-32">
      <div className="text-center">
        <h2 className="text-4xl font-black text-blue-600 mb-2">Leaderboard</h2>
        <p className="text-pink-500 font-bold">อันดับคะแนนปัจจุบัน</p>
      </div>

      <div className="bg-white rounded-3xl shadow-xl overflow-hidden border-4 border-blue-100">
        {top10.map((player, idx) => (
          <LeaderboardItem 
            key={player.id} 
            player={player} 
            rank={idx + 1} 
            isMe={player.id === socket.id} 
          />
        ))}
        
        {/* If I'm not in top 10, show me at the bottom */}
        {!isHost && myRank > 10 && (
          <>
            <div className="h-px bg-gray-100 flex items-center justify-center">
              <span className="bg-white px-4 text-gray-300">...</span>
            </div>
            <LeaderboardItem 
              player={myPlayer} 
              rank={myRank} 
              isMe={true} 
            />
          </>
        )}
      </div>

      {/* Bottom Rank Display */}
      {!isHost && (
        <motion.div 
          initial={{ y: 100 }}
          animate={{ y: 0 }}
          className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-pink-50 to-transparent pointer-events-none"
        >
          <div className="max-w-md mx-auto bg-blue-600 text-white p-4 rounded-2xl shadow-2xl flex justify-between items-center pointer-events-auto">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 p-2 rounded-lg">
                <Crown className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs opacity-80 uppercase tracking-wider font-bold">อันดับของคุณ</p>
                <p className="text-xl font-black">อันดับที่ {myRank} จาก {players.length}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs opacity-80 uppercase tracking-wider font-bold">คะแนนรวม</p>
              <p className="text-xl font-black">{myPlayer?.score} PT</p>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}

function LeaderboardItem({ player, rank, isMe }: { player: Player; rank: number; isMe: boolean; key?: any }) {
  const [displayScore, setDisplayScore] = useState(player.score - player.lastScoreChange);
  const [showChange, setShowChange] = useState(player.lastScoreChange > 0);

  useEffect(() => {
    if (player.lastScoreChange > 0) {
      const timer = setTimeout(() => {
        setDisplayScore(player.score);
        setShowChange(false);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [player.score, player.lastScoreChange]);

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className={cn(
        "flex items-center justify-between p-4 border-b border-gray-50 last:border-0",
        isMe ? "bg-blue-50" : "bg-white"
      )}
    >
      <div className="flex items-center gap-4">
        <span className={cn(
          "w-8 h-8 flex items-center justify-center rounded-full font-black text-sm",
          rank === 1 ? "bg-yellow-400 text-white" : 
          rank === 2 ? "bg-gray-300 text-white" :
          rank === 3 ? "bg-amber-600 text-white" : "text-gray-400"
        )}>
          {rank}
        </span>
        <div className="w-10 h-10 rounded-full bg-gray-100 border-2 border-white overflow-hidden flex items-center justify-center shadow-sm">
          {player.avatar ? (
            <img src={player.avatar} alt={player.name} className="w-full h-full object-cover" />
          ) : (
            <Users className="w-5 h-5 text-gray-400" />
          )}
        </div>
        <span className={cn("font-bold text-lg", isMe ? "text-blue-600" : "text-gray-700")}>
          {player.name}
          {isMe && <span className="ml-2 text-xs bg-blue-200 text-blue-600 px-2 py-0.5 rounded-full">YOU</span>}
        </span>
      </div>
      <div className="text-right">
        <div className="font-black text-xl text-gray-800 flex items-center justify-end gap-2">
          {showChange ? (
            <motion.span 
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-green-500 text-sm font-bold"
            >
              {displayScore} + {player.lastScoreChange}
            </motion.span>
          ) : (
            <span>{displayScore}</span>
          )}
          <span className="text-xs text-gray-400 font-bold">PT</span>
        </div>
      </div>
    </motion.div>
  );
}

function FinalResultsView({ gameState, isHost }: { gameState: GameData; isHost: boolean }) {
  const players = Object.values(gameState.players)
    .filter(p => !p.isHost)
    .sort((a, b) => b.score - a.score);
  
  const winners = players.slice(0, 3);

  useEffect(() => {
    confetti({
      particleCount: 150,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#3b82f6', '#ec4899', '#ffffff']
    });
  }, []);

  return (
    <div className="flex flex-col items-center space-y-12 py-8">
      <div className="text-center">
        <motion.div
          animate={{ rotate: [0, -10, 10, -10, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="inline-block mb-4"
        >
          <Crown className="w-20 h-20 text-yellow-400" />
        </motion.div>
        <h2 className="text-5xl font-black text-blue-600 mb-2">จบการแข่งขัน!</h2>
        <p className="text-pink-500 text-xl font-bold">ขอแสดงความยินดีกับผู้ชนะ</p>
      </div>

      <div className="flex items-end justify-center gap-4 w-full max-w-2xl h-64">
        {/* 2nd Place */}
        {winners[1] && (
          <div className="flex flex-col items-center flex-1">
            <div className="text-center mb-2">
              <div className="w-16 h-16 rounded-full bg-white border-4 border-gray-200 overflow-hidden mx-auto mb-2 shadow-md">
                {winners[1].avatar ? (
                  <img src={winners[1].avatar} alt={winners[1].name} className="w-full h-full object-cover" />
                ) : (
                  <Users className="w-8 h-8 text-gray-300 m-auto mt-3" />
                )}
              </div>
              <p className="font-bold text-gray-600 truncate w-24">{winners[1].name}</p>
              <p className="text-xs font-black text-blue-500">{winners[1].score} PT</p>
            </div>
            <motion.div 
              initial={{ height: 0 }}
              animate={{ height: '60%' }}
              className="w-full bg-gray-200 rounded-t-2xl flex items-center justify-center text-4xl font-black text-gray-400"
            >
              2
            </motion.div>
          </div>
        )}
        {/* 1st Place */}
        {winners[0] && (
          <div className="flex flex-col items-center flex-1">
            <div className="text-center mb-2">
              <Crown className="w-8 h-8 text-yellow-400 mx-auto mb-1" />
              <div className="w-20 h-20 rounded-full bg-white border-4 border-blue-400 overflow-hidden mx-auto mb-2 shadow-lg">
                {winners[0].avatar ? (
                  <img src={winners[0].avatar} alt={winners[0].name} className="w-full h-full object-cover" />
                ) : (
                  <Users className="w-10 h-10 text-blue-200 m-auto mt-4" />
                )}
              </div>
              <p className="font-black text-blue-600 truncate w-32 text-lg">{winners[0].name}</p>
              <p className="text-sm font-black text-pink-500">{winners[0].score} PT</p>
            </div>
            <motion.div 
              initial={{ height: 0 }}
              animate={{ height: '100%' }}
              className="w-full bg-blue-500 rounded-t-2xl flex items-center justify-center text-6xl font-black text-white shadow-xl"
            >
              1
            </motion.div>
          </div>
        )}
        {/* 3rd Place */}
        {winners[2] && (
          <div className="flex flex-col items-center flex-1">
            <div className="text-center mb-2">
              <div className="w-14 h-14 rounded-full bg-white border-4 border-amber-200 overflow-hidden mx-auto mb-2 shadow-md">
                {winners[2].avatar ? (
                  <img src={winners[2].avatar} alt={winners[2].name} className="w-full h-full object-cover" />
                ) : (
                  <Users className="w-7 h-7 text-amber-200 m-auto mt-2.5" />
                )}
              </div>
              <p className="font-bold text-gray-600 truncate w-24">{winners[2].name}</p>
              <p className="text-xs font-black text-blue-500">{winners[2].score} PT</p>
            </div>
            <motion.div 
              initial={{ height: 0 }}
              animate={{ height: '40%' }}
              className="w-full bg-amber-100 rounded-t-2xl flex items-center justify-center text-3xl font-black text-amber-600"
            >
              3
            </motion.div>
          </div>
        )}
      </div>

      <div className="w-full max-w-md bg-white p-6 rounded-3xl shadow-lg border-2 border-pink-100">
        <h3 className="text-center font-bold text-gray-400 uppercase tracking-widest text-sm mb-4">อันดับอื่นๆ</h3>
        <div className="space-y-3">
          {players.slice(3, 8).map((player, idx) => (
            <div key={player.id} className="flex justify-between items-center px-4 py-2 bg-pink-50 rounded-xl">
              <div className="flex items-center gap-3">
                <span className="font-black text-pink-300">{idx + 4}</span>
                <span className="font-bold text-gray-700">{player.name}</span>
              </div>
              <span className="font-black text-blue-500">{player.score} PT</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function FeedbackPopup({ feedback }: { feedback: { correct: boolean; points: number; reason: string } }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.5, y: 50 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.5, y: -50 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
    >
      <div className={cn(
        "bg-white p-8 rounded-[40px] shadow-2xl border-8 flex flex-col items-center text-center max-w-xs w-full pointer-events-auto",
        feedback.correct ? "border-green-100" : "border-red-100"
      )}>
        <div className={cn(
          "p-4 rounded-full mb-4",
          feedback.correct ? "bg-green-100 text-green-500" : "bg-red-100 text-red-500"
        )}>
          {feedback.correct ? <CheckCircle2 className="w-16 h-16" /> : <XCircle className="w-16 h-16" />}
        </div>
        <h3 className={cn(
          "text-3xl font-black mb-2",
          feedback.correct ? "text-green-600" : "text-red-600"
        )}>
          {feedback.correct ? "ถูกต้อง!" : "ผิดจ้า!"}
        </h3>
        <p className="text-gray-500 font-bold mb-4">{feedback.reason}</p>
        <div className="bg-blue-50 px-6 py-2 rounded-full text-blue-600 font-black text-xl">
          +{feedback.points} PT
        </div>
      </div>
    </motion.div>
  );
}

function HostControls({ gameState }: { gameState: GameData }) {
  const isLastQuestion = gameState.currentQuestionIndex === gameState.questions.length - 1;

  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-white/80 backdrop-blur-md p-4 rounded-3xl shadow-2xl border-2 border-blue-100">
      {gameState.state === 'LOBBY' && (
        <button
          onClick={() => socket.emit('hostStartGame')}
          className="bg-green-500 hover:bg-green-600 text-white px-8 py-3 rounded-2xl font-black flex items-center gap-2 transition-all shadow-lg shadow-green-100"
        >
          <Play className="w-5 h-5" />
          เริ่มเกม
        </button>
      )}
      {gameState.state === 'LEADERBOARD' && (
        <button
          onClick={() => socket.emit('hostNextQuestion')}
          className="bg-blue-500 hover:bg-blue-600 text-white px-8 py-3 rounded-2xl font-black flex items-center gap-2 transition-all shadow-lg shadow-blue-100"
        >
          {isLastQuestion ? 'ดูผลการแข่งขัน' : 'คำถามถัดไป'}
          <ArrowRight className="w-5 h-5" />
        </button>
      )}
      {(gameState.state === 'FINAL_RESULTS' || gameState.state === 'LEADERBOARD') && (
        <button
          onClick={() => socket.emit('hostResetGame')}
          className="bg-gray-100 hover:bg-gray-200 text-gray-600 px-6 py-3 rounded-2xl font-black flex items-center gap-2 transition-all"
        >
          <RefreshCw className="w-5 h-5" />
          เริ่มใหม่
        </button>
      )}
    </div>
  );
}
