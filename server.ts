import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";
import { GameData, GameState, Question, Player, ServerToClientEvents, ClientToServerEvents } from "./src/types";

const app = express();
const httpServer = createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: {
    origin: "*",
  },
});

const PORT = 3000;

const QUESTIONS: Question[] = [
  {
    id: 1,
    text: "เจ้าบ่าวและเจ้าสาวเจอกันครั้งแรกที่ไหน?",
    options: ["มหาวิทยาลัย", "ที่ทำงาน", "ร้านกาแฟ", "งานแต่งเพื่อน"],
    correctAnswer: 0,
  },
  {
    id: 2,
    text: "ใครเป็นคนสารภาพรักก่อน?",
    options: ["เจ้าบ่าว", "เจ้าสาว", "พร้อมกัน", "ไม่มีใครสารภาพ"],
    correctAnswer: 0,
  },
  {
    id: 3,
    text: "เมนูโปรดที่ทั้งคู่ชอบทานด้วยกันคืออะไร?",
    options: ["ชาบู", "ส้มตำ", "พิซซ่า", "อาหารญี่ปุ่น"],
    correctAnswer: 1,
  },
  {
    id: 4,
    text: "ทริปแรกที่ไปเที่ยวด้วยกันคือที่ไหน?",
    options: ["เชียงใหม่", "ภูเก็ต", "ญี่ปุ่น", "เกาหลี"],
    correctAnswer: 2,
  },
  {
    id: 5,
    text: "เจ้าบ่าวกลัวอะไรมากที่สุด?",
    options: ["แมลงสาบ", "ความสูง", "ผี", "เมีย"],
    correctAnswer: 3,
  }
];

let gameState: GameData = {
  state: 'LOBBY',
  currentQuestionIndex: 0,
  questions: QUESTIONS,
  players: {},
  timer: 0,
};

// Track internal state for scoring
const playerFirstAnswers: Record<string, number | null> = {};
const correctAnswersCount: { count: number } = { count: 0 };

function broadcastUpdate() {
  io.emit('gameUpdate', gameState);
}

let timerInterval: NodeJS.Timeout | null = null;

function startTimer(duration: number, onComplete: () => void) {
  if (timerInterval) clearInterval(timerInterval);
  gameState.timer = duration;
  broadcastUpdate();

  timerInterval = setInterval(() => {
    gameState.timer--;
    if (gameState.timer <= 0) {
      if (timerInterval) clearInterval(timerInterval);
      onComplete();
    } else {
      broadcastUpdate();
    }
  }, 1000);
}

function calculateScores() {
  const currentQuestion = QUESTIONS[gameState.currentQuestionIndex];
  const players = Object.values(gameState.players)
    .filter(p => !p.isHost)
    .sort((a, b) => (a.answerTime || Infinity) - (b.answerTime || Infinity));
  
  // Reset correct count for this question
  let correctCount = 0;

  players.forEach(player => {
    const isCorrect = player.currentAnswer === currentQuestion.correctAnswer;
    let points = 0;
    let reason = "";

    if (isCorrect) {
      const firstAnswer = playerFirstAnswers[player.id];
      const wasFirstCorrect = firstAnswer === currentQuestion.correctAnswer;
      
      if (!player.hasChangedAnswer && wasFirstCorrect) {
        // No change and first was correct
        if (correctCount < 5) {
          points = 20;
          reason = "5 คนแรกที่ตอบถูกและไม่เปลี่ยนคำตอบ!";
        } else {
          points = 10;
          reason = "ตอบถูกและไม่เปลี่ยนคำตอบ";
        }
        correctCount++;
      } else if (player.hasChangedAnswer) {
        // Changed answer
        if (gameState.timer <= 3) {
          points = 5;
          reason = "เปลี่ยนมาตอบถูกในช่วง 3 วินาทีสุดท้าย";
        } else {
          points = 10;
          reason = "เปลี่ยนมาตอบถูก";
        }
      } else {
        // Correct but first answer was wrong (this is covered by hasChangedAnswer)
        // Or correct but first answer was correct and they changed it (also hasChangedAnswer)
        points = 10;
        reason = "ตอบถูก";
      }
    } else {
      points = 0;
      reason = "คำตอบไม่ถูกต้อง";
    }

    player.lastScoreChange = points;
    player.score += points;
    
    io.to(player.id).emit('answerFeedback', {
      correct: isCorrect,
      points,
      reason
    });
  });
}

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("join", (name, isHost, avatar) => {
    gameState.players[socket.id] = {
      id: socket.id,
      name,
      avatar,
      score: 0,
      lastScoreChange: 0,
      currentAnswer: null,
      hasChangedAnswer: false,
      answerTime: null,
      isHost: !!isHost,
    };
    broadcastUpdate();
  });

  socket.on("submitAnswer", (answerIndex) => {
    const player = gameState.players[socket.id];
    if (!player || gameState.state !== 'QUESTION') return;

    if (playerFirstAnswers[socket.id] === undefined) {
      playerFirstAnswers[socket.id] = answerIndex;
    } else {
      player.hasChangedAnswer = true;
    }

    player.currentAnswer = answerIndex;
    player.answerTime = Date.now();
    broadcastUpdate();
  });

  socket.on("hostStartGame", () => {
    const player = gameState.players[socket.id];
    if (!player?.isHost) return;

    gameState.currentQuestionIndex = 0;
    Object.values(gameState.players).forEach(p => {
      p.score = 0;
      p.lastScoreChange = 0;
    });
    startReadingPhase();
  });

  socket.on("hostNextQuestion", () => {
    const player = gameState.players[socket.id];
    if (!player?.isHost) return;

    if (gameState.currentQuestionIndex < QUESTIONS.length - 1) {
      gameState.currentQuestionIndex++;
      startReadingPhase();
    } else {
      gameState.state = 'FINAL_RESULTS';
      broadcastUpdate();
    }
  });

  socket.on("hostResetGame", () => {
    const player = gameState.players[socket.id];
    if (!player?.isHost) return;

    gameState.state = 'LOBBY';
    gameState.currentQuestionIndex = 0;
    Object.values(gameState.players).forEach(p => {
      p.score = 0;
      p.lastScoreChange = 0;
      p.currentAnswer = null;
      p.hasChangedAnswer = false;
    });
    broadcastUpdate();
  });

  socket.on("disconnect", () => {
    delete gameState.players[socket.id];
    delete playerFirstAnswers[socket.id];
    broadcastUpdate();
  });
});

function startReadingPhase() {
  gameState.state = 'READING';
  // Reset player answers for the new question
  Object.values(gameState.players).forEach(p => {
    p.currentAnswer = null;
    p.hasChangedAnswer = false;
    p.lastScoreChange = 0;
  });
  // Clear first answers tracking
  for (const key in playerFirstAnswers) delete playerFirstAnswers[key];

  startTimer(5, () => {
    gameState.state = 'QUESTION';
    startTimer(15, () => {
      calculateScores();
      gameState.state = 'REVEAL';
      broadcastUpdate();
      
      startTimer(5, () => {
        gameState.state = 'LEADERBOARD';
        broadcastUpdate();
      });
    });
  });
}

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
