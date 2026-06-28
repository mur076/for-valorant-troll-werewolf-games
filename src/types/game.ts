export interface AgentData {
  uuid: string;
  displayName: string;
  displayIcon: string;
  fullPortrait: string;
  backgroundGradientColors: string[];
}

export interface Player {
  id: string; // "p1" ~ "p5"
  name: string;
  totalScore: number;
  agent?: AgentData;
}

export interface PlayerRoundInput {
  playerId: string;
  role: "citizen" | "troll";
  votedFor: string; // 投票した相手のプレイヤーID
  score: number; // このラウンドで獲得したスコア
  agent?: AgentData; // このラウンドで使用したエージェント
  isObviousTroll?: boolean; // トロール評価：戦犯フラグ
  isArtisticTroll?: boolean; // トロール評価：芸術的フラグ
}

export interface Round {
  roundNumber: number;
  trollPlayerId: string; // 本当のトロールだったプレイヤーID
  winningTeam: "citizen" | "troll"; // 勝利したチーム
  inputs: Record<string, PlayerRoundInput>; // プレイヤーID -> 入力＆結果
  isObviousTroll?: boolean; // トロール評価：戦犯フラグ
  isArtisticTroll?: boolean; // トロール評価：芸術的フラグ
}

export interface GameSettings {
  maxRounds: number;
  scoreCitizenWin: number;
  scoreTrollWin: number;
  scoreSpottedBonus: number;
  enableSpottedBonusOnLose: boolean; // 敗北した市民でもトロール的中時にボーナスを与えるか
  
  // 身内戦盛り上げ用アドバンスドスコアルール
  scoreTrollSpottedUnanimousPenalty: number; // 満場一致トロールペナルティ (トロール失点)
  scoreCitizenPerfectWinBonus: number;       // 市民完全勝利ボーナス (市民得点)
  scoreTrollPerfectLosePenalty: number;      // 市民投票的中ペナルティ (トロール失点)
  scoreCitizenPerfectLosePenalty: number;    // トロール完全勝利ペナルティ (市民失点)
  scoreTrollPerfectWinBonus: number;         // トロール完全勝利ボーナス (トロール得点)
  scoreTrollCompleteConcealBonus: number;    // トロール完全隠蔽大ボーナス (トロール得点)
  scoreCitizenCompleteConcealPenalty: number; // 市民完全隠蔽ペナルティ (市民失点)
  scoreTrollObviousPenalty: number;          // 戦犯トロールペナルティ (トロール失点)
  scoreTrollArtisticBonus: number;           // 芸術的トロールボーナス (トロール得点)
}

export interface GameState {
  players: Player[];
  rounds: Round[];
  currentRound: number; // 進行中のラウンド番号 (1~N)
  isFinished: boolean;
  timestamp: number;
  settings: GameSettings;
}
