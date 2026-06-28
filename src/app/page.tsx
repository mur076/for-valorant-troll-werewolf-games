"use client";

import React, { useState, useEffect, useMemo } from "react";
import { AgentData, GameSettings, Player, Round, PlayerRoundInput, GameState } from "@/types/game";
import { safeBtoa, safeAtob, getDefaultVoteFor } from "@/utils/helpers";
import GameSetup from "@/components/GameSetup";
import Leaderboard from "@/components/Leaderboard";
import RoundInputForm from "@/components/RoundInputForm";
import MatchHistory from "@/components/MatchHistory";

// --- 定数 ---
const STORAGE_KEY = "valo_troll_score_game";
const TTL_MS = 3 * 24 * 60 * 60 * 1000; // 3日間 (72時間)

const DEFAULT_SETTINGS: GameSettings = {
  maxRounds: 7, // デフォルト7戦
  scoreCitizenWin: 2,
  scoreTrollWin: 3,
  scoreSpottedBonus: 2,
  enableSpottedBonusOnLose: true, // 敗北時も適用ON
  
  // 市民有利アドバンスドルール配点
  scoreTrollSpottedUnanimousPenalty: -3,
  scoreCitizenPerfectWinBonus: 2,
  scoreTrollPerfectLosePenalty: -2,
  scoreCitizenPerfectLosePenalty: -1,
  scoreTrollPerfectWinBonus: 1,
  scoreTrollCompleteConcealBonus: 1,
  scoreCitizenCompleteConcealPenalty: -1,
  scoreTrollObviousPenalty: -2,
  scoreTrollArtisticBonus: 1,
};

export default function TrollWerewolfApp() {
  // --- 基本ステート ---
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [agents, setAgents] = useState<AgentData[]>([]);
  const [isReadOnly, setIsReadOnly] = useState<boolean>(false);
  const [isMounted, setIsMounted] = useState<boolean>(false);
  const [isStateInitialized, setIsStateInitialized] = useState<boolean>(false);
  const [notification, setNotification] = useState<string | null>(null);
  const [isRulebookOpen, setIsRulebookOpen] = useState<boolean>(false); // ルールブック用

  // --- トースト通知の制御 ---
  const showToast = (message: string) => {
    setNotification(message);
    setTimeout(() => {
      setNotification((prev) => (prev === message ? null : prev));
    }, 4000);
  };

  // 画像アセットのプリロード
  const preloadAgentAssets = (agentsList: AgentData[]) => {
    agentsList.forEach((agent) => {
      if (agent.displayIcon) {
        const img = new Image();
        img.src = agent.displayIcon;
      }
      if (agent.fullPortrait) {
        const img = new Image();
        img.src = agent.fullPortrait;
      }
    });
  };

  // --- 1. マウント処理 & エージェントAPIフェッチ ---
  useEffect(() => {
    setIsMounted(true);

    const fetchAgents = async () => {
      try {
        const res = await fetch("https://valorant-api.com/v1/agents?language=ja-JP&isPlayableCharacter=true");
        const json = await res.json();
        if (json.status === 200 && Array.isArray(json.data)) {
          // UUIDの重複排除（Riot APIの仕様でSovaなど同一エージェントが複数エントリーされる場合があるための対策）
          const seen = new Set<string>();
          const mapped: AgentData[] = [];
          
          json.data.forEach((item: any) => {
            if (!seen.has(item.uuid)) {
              seen.add(item.uuid);
              mapped.push({
                uuid: item.uuid,
                displayName: item.displayName,
                displayIcon: item.displayIcon,
                fullPortrait: item.fullPortrait || item.fullPortraitV2 || "",
                backgroundGradientColors: item.backgroundGradientColors || [],
              });
            }
          });
          
          setAgents(mapped);
          preloadAgentAssets(mapped);
        }
      } catch (e) {
        console.error("Failed to fetch agents from Valorant API", e);
        showToast("エージェント情報の取得に失敗しました。オフラインモードで動作します。");
      }
    };

    fetchAgents();
  }, []);

  // --- 2. ローカルストレージ & URL共有からの状態初期化 (エージェントロード後) ---
  useEffect(() => {
    if (!isMounted || isStateInitialized) return;
    
    // エージェントデータの読み込みが完了するのを待つ（空でもフォールバックとして次に進む）
    // APIが返ってこない場合のためのタイムアウトや空配列許容
    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = urlParams.get("room");
    let loadedState: GameState | null = null;
    let readOnlyMode = false;

    // A. URLパラメータからの復元
    if (roomParam) {
      readOnlyMode = true;
      const decoded = safeAtob(roomParam);
      if (decoded) {
        try {
          const parsed = JSON.parse(decoded);
          if (parsed.players && Array.isArray(parsed.players) && parsed.players.length === 5) {
            loadedState = {
              players: parsed.players,
              rounds: parsed.rounds || [],
              currentRound: parsed.currentRound || 1,
              isFinished: !!parsed.isFinished,
              timestamp: parsed.timestamp || Date.now(),
              settings: { ...DEFAULT_SETTINGS, ...parsed.settings },
            };
          }
        } catch {
          console.error("Failed to parse room data from URL");
        }
      }
    }

    // B. LocalStorageからの復元 (URLパラメータがない、または失敗したとき)
    if (!loadedState) {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          const parsed: GameState = JSON.parse(saved);
          const now = Date.now();
          if (now - parsed.timestamp > TTL_MS) {
            localStorage.removeItem(STORAGE_KEY);
            setTimeout(() => {
              showToast("セッション有効期限（3日）が切れたため、データを初期化しました");
            }, 100);
          } else {
            loadedState = {
              ...parsed,
              settings: { ...DEFAULT_SETTINGS, ...parsed.settings },
            };
          }
        } catch {
          console.error("Failed to load game from localStorage");
        }
      }
    }

    // C. ロードした状態にエージェント詳細情報を結合する
    if (loadedState) {
      const resolvedPlayers = loadedState.players.map((p) => {
        const agentUuid = p.agent?.uuid;
        if (agentUuid && agents.length > 0) {
          const latestAgent = agents.find((a) => a.uuid === agentUuid);
          if (latestAgent) {
            return { ...p, agent: latestAgent };
          }
        }
        return p;
      });

      const resolvedRounds = loadedState.rounds.map((round) => {
        const resolvedInputs: Record<string, PlayerRoundInput> = {};
        Object.entries(round.inputs).forEach(([playerId, input]) => {
          let resolvedAgent = input.agent;
          const agentUuid = input.agent?.uuid;
          if (agentUuid && agents.length > 0) {
            const latestAgent = agents.find((a) => a.uuid === agentUuid);
            if (latestAgent) {
              resolvedAgent = latestAgent;
            }
          }
          resolvedInputs[playerId] = {
            ...input,
            agent: resolvedAgent,
          };
        });
        return {
          ...round,
          inputs: resolvedInputs,
        };
      });

      setGameState({
        ...loadedState,
        players: resolvedPlayers,
        rounds: resolvedRounds,
      });
      setIsReadOnly(readOnlyMode);

      if (readOnlyMode) {
        setTimeout(() => {
          showToast("共有データを読み込みました（閲覧モード）");
        }, 100);
      }
    }

    setIsStateInitialized(true);
  }, [isMounted, agents, isStateInitialized]);

  // --- 3. ゲーム開始 (プレイヤー登録＆設定適用) ---
  const handleStartGame = (finalPlayers: Player[], gameSettings: GameSettings) => {
    const newState: GameState = {
      players: finalPlayers,
      rounds: [],
      currentRound: 1,
      isFinished: false,
      timestamp: Date.now(),
      settings: gameSettings,
    };

    setGameState(newState);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
    setIsReadOnly(false);
    showToast("ゲームを開始しました！");
  };

  // --- 4. ラウンド確定 & スコア計算 ---
  const handleConfirmRound = (
    trollPlayerId: string,
    winningTeam: "citizen" | "troll",
    votes: Record<string, string>,
    roundAgents: Record<string, string>, // プレイヤーID -> エージェントUUID
    isObviousTroll: boolean,
    isArtisticTroll: boolean
  ) => {
    if (!gameState) return;

    const {
      scoreCitizenWin,
      scoreTrollWin,
      scoreSpottedBonus,
      enableSpottedBonusOnLose,
      maxRounds,
      
      // 新スコアルール
      scoreTrollSpottedUnanimousPenalty,
      scoreCitizenPerfectWinBonus,
      scoreTrollPerfectLosePenalty,
      scoreCitizenPerfectLosePenalty,
      scoreTrollPerfectWinBonus,
      scoreTrollCompleteConcealBonus,
      scoreCitizenCompleteConcealPenalty,
      scoreTrollObviousPenalty,
      scoreTrollArtisticBonus,
    } = gameState.settings;

    // 各プレイヤーの得票数を集計
    const voteCounts: Record<string, number> = {};
    Object.values(votes).forEach((targetId) => {
      voteCounts[targetId] = (voteCounts[targetId] || 0) + 1;
    });

    const trollVotes = voteCounts[trollPlayerId] || 0;
    const maxVotes = Math.max(0, ...Object.values(voteCounts));

    // 市民側の投票勝利（的中）の定義: 本当のトロールが全プレイヤーの中で最多得票（同率含む）かつ1票以上獲得していること
    const isCitizenVoteWin = trollVotes > 0 && trollVotes === maxVotes;

    // トロール満場一致特定の判定 (市民4人全員がトロールに投票した場合)
    const isUnanimousSpotted = trollVotes === 4;

    const roundInputs: Record<string, PlayerRoundInput> = {};
    const updatedPlayers = gameState.players.map((player) => {
      const isTroll = player.id === trollPlayerId;
      const role = isTroll ? ("troll" as const) : ("citizen" as const);
      
      let votedFor = votes[player.id];
      if (!votedFor || votedFor === player.id) {
        votedFor = getDefaultVoteFor(gameState.players, player.id);
      }

      // このラウンドで使用したエージェントデータを取得
      const agentUuid = roundAgents[player.id];
      const roundAgent = agents.find((a) => a.uuid === agentUuid);

      // 勝敗の判定
      const isWin = isTroll
        ? winningTeam === "troll"
        : winningTeam === "citizen";

      const isThisVoterSpottedTroll = !isTroll && votedFor === trollPlayerId;

      // 得点計算
      let score = 0;

      if (!isTroll) {
        // 【市民側の得点計算】
        // 1. 基本勝利点
        if (isWin) {
          score += scoreCitizenWin;
        }

        // 2. 個別的中ボーナス (勝利時、または敗北時トグル有効時)
        if (isThisVoterSpottedTroll && (isWin || enableSpottedBonusOnLose)) {
          score += scoreSpottedBonus;
        }

        // 3. 市民完全勝利ボーナス (試合勝利 かつ 投票的中)
        if (isWin && isCitizenVoteWin) {
          score += scoreCitizenPerfectWinBonus;
        }

        // 4. トロール完全勝利ペナルティ (試合敗北 かつ 投票不的中)
        if (!isWin && !isCitizenVoteWin) {
          score += scoreCitizenPerfectLosePenalty;
        }

        // 5. トロール完全隠蔽ペナルティ (試合敗北 かつ トロール得票数0)
        if (!isWin && trollVotes === 0) {
          score += scoreCitizenCompleteConcealPenalty;
        }

      } else {
        // 【トロール側の得点計算】
        // 1. 基本勝利点
        if (isWin) {
          score += scoreTrollWin;
        }

        // 2. 満場一致ペナルティ (4票特定)
        if (isUnanimousSpotted) {
          score += scoreTrollSpottedUnanimousPenalty;
        }

        // 3. 市民投票的中ペナルティ (投票的中時)
        if (isCitizenVoteWin) {
          score += scoreTrollPerfectLosePenalty;
        }

        // 4. トロール完全勝利ボーナス (試合勝利 かつ 投票不的中)
        if (isWin && !isCitizenVoteWin) {
          score += scoreTrollPerfectWinBonus;
        }

        // 5. トロール完全隠蔽大ボーナス (試合勝利 かつ トロール得票数0)
        if (isWin && trollVotes === 0) {
          score += scoreTrollCompleteConcealBonus;
        }

        // 6. トロールプレイ特別評価 (戦犯/芸術的)
        if (isObviousTroll) {
          score += scoreTrollObviousPenalty;
        }
        if (isArtisticTroll) {
          score += scoreTrollArtisticBonus;
        }
      }

      roundInputs[player.id] = {
        playerId: player.id,
        role,
        votedFor,
        score,
        agent: roundAgent,
        isObviousTroll: isTroll ? isObviousTroll : undefined,
        isArtisticTroll: isTroll ? isArtisticTroll : undefined,
      };

      return {
        ...player,
        totalScore: player.totalScore + score,
        agent: roundAgent || player.agent, // スコアボード表示用の最新エージェントも更新
      };
    });

    const newRound: Round = {
      roundNumber: gameState.currentRound,
      trollPlayerId,
      winningTeam,
      inputs: roundInputs,
      isObviousTroll,
      isArtisticTroll,
    };

    const nextRoundNumber = gameState.currentRound + 1;
    const isFinished = gameState.currentRound >= maxRounds;

    const newState: GameState = {
      ...gameState,
      players: updatedPlayers,
      rounds: [...gameState.rounds, newRound],
      currentRound: isFinished ? gameState.currentRound : nextRoundNumber,
      isFinished,
      timestamp: Date.now(),
    };

    setGameState(newState);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
    showToast(`第 ${gameState.currentRound} 回戦を確定しました`);
  };

  // --- 5. ゲームデータの破棄 (リセット) ---
  const handleDiscardGame = () => {
    if (window.confirm("これまでのゲームデータをすべて破棄して、最初からやり直しますか？")) {
      localStorage.removeItem(STORAGE_KEY);
      setGameState(null);
      setIsReadOnly(false);
      
      if (window.location.search) {
        window.history.replaceState({}, "", window.location.pathname);
      }
      showToast("ゲームデータを破棄しました");
    }
  };

  // --- 6. 結果をURLで共有 ---
  const handleShareUrl = () => {
    if (!gameState) return;
    
    // 共有URLの肥大化を防ぐため、プレイヤーのエージェント情報は uuid のみに絞り込む
    const serializablePlayers = gameState.players.map((p) => ({
      id: p.id,
      name: p.name,
      totalScore: p.totalScore,
      agent: p.agent ? { uuid: p.agent.uuid } : undefined,
    }));

    const serializableRounds = gameState.rounds.map((round) => {
      const compressedInputs: Record<string, any> = {};
      Object.entries(round.inputs).forEach(([playerId, input]) => {
        compressedInputs[playerId] = {
          ...input,
          agent: input.agent ? { uuid: input.agent.uuid } : undefined,
        };
      });
      return {
        ...round,
        inputs: compressedInputs,
      };
    });

    const shareData = {
      players: serializablePlayers,
      rounds: serializableRounds,
      currentRound: gameState.currentRound,
      isFinished: gameState.isFinished,
      settings: gameState.settings,
    };

    const encoded = safeBtoa(JSON.stringify(shareData));
    const shareUrl = `${window.location.origin}${window.location.pathname}?room=${encoded}`;

    navigator.clipboard.writeText(shareUrl)
      .then(() => {
        showToast("共有URLをクリップボードにコピーしました！");
      })
      .catch((err) => {
        console.error("Failed to copy URL", err);
        showToast("コピーに失敗しました。ブラウザの権限を確認してください。");
      });
  };

  // --- 7. 編集モードへの引き継ぎ ---
  const handleTakeoverEdit = () => {
    if (!gameState) return;

    const newState = {
      ...gameState,
      timestamp: Date.now(),
    };

    setGameState(newState);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
    setIsReadOnly(false);

    window.history.replaceState({}, "", window.location.pathname);
    showToast("このデータを元に、編集の引き継ぎが完了しました！");
  };

  // マウント前のローディング表示
  if (!isMounted) {
    return (
      <div className="relative min-h-screen bg-val-black text-val-light cyber-bg scanline flex flex-col font-sans justify-center items-center">
        <div className="w-10 h-10 border-4 border-val-red border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-val-black text-val-light cyber-bg scanline flex flex-col font-sans">
      {/* --- ヘッダー --- */}
      <header className="border-b border-val-red/20 bg-val-dark/95 backdrop-blur-md px-6 py-4 flex flex-col md:flex-row justify-between items-center gap-4 sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <div className="w-3 h-8 bg-val-red skew-x-12 animate-pulse"></div>
          <div>
            <h1 className="text-xl md:text-2xl font-black tracking-widest text-val-light uppercase flex items-center gap-2">
              VALO-TROLL <span className="text-val-red text-sm font-semibold border border-val-red px-2 py-0.5 rounded">SCOREBOARD</span>
            </h1>
            <p className="text-xs text-zinc-500 font-mono tracking-wider">TROLL WEREWOLF GAME SCORE MANAGER</p>
          </div>
        </div>

        {gameState && (
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleShareUrl}
              className="px-4 py-2 border border-val-cyan text-val-cyan hover:bg-val-cyan hover:text-val-dark transition-all duration-300 font-mono text-xs uppercase tracking-wider font-bold val-clip-button flex items-center gap-1.5 cursor-pointer"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 10.742l4.828-2.414m0 0a3 3 0 10-3.62-4.3l-4.83 2.42m0 0a3 3 0 100 4.6l4.829 2.41m-1.282-1.28l4.828 2.414m-.24 4.316a3 3 0 103.62-4.3L13.5 15" />
              </svg>
              URLで共有
            </button>
            <button
              onClick={handleDiscardGame}
              className="px-4 py-2 border border-val-red/40 text-val-red hover:border-val-red hover:bg-val-red hover:text-val-light transition-all duration-300 font-mono text-xs uppercase tracking-wider font-bold val-clip-button flex items-center gap-1.5 cursor-pointer"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              データ破棄
            </button>
          </div>
        )}
      </header>

      {/* --- 閲覧モード時の上部通知 --- */}
      {isReadOnly && gameState && (
        <div className="bg-val-cyan/15 border-b border-val-cyan px-6 py-3 flex flex-col sm:flex-row justify-between items-center gap-3 text-sm z-20">
          <div className="flex items-center gap-2 text-val-cyan">
            <svg className="w-5 h-5 flex-shrink-0 animate-pulse" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <span className="font-semibold tracking-wide">
              【共有データ閲覧中】現在、読み取り専用モードです。スコアの編集はできません。
            </span>
          </div>
          <button
            onClick={handleTakeoverEdit}
            className="px-4 py-1.5 bg-val-cyan hover:bg-val-cyan/85 text-val-black font-bold rounded text-xs uppercase tracking-wider transition-colors shadow-lg shadow-val-cyan/20 cursor-pointer"
          >
            このデータをもとに編集を引き継ぐ
          </button>
        </div>
      )}

      {/* --- トースト通知 --- */}
      {notification && (
        <div className="fixed bottom-6 right-6 bg-val-dark/95 border border-val-red px-5 py-3 rounded shadow-2xl z-50 animate-bounce max-w-sm flex items-center gap-3">
          <span className="w-2 h-2 bg-val-red rounded-full"></span>
          <p className="text-sm font-semibold tracking-wide text-val-light">{notification}</p>
        </div>
      )}

      {/* --- メインコンテンツ --- */}
      <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full flex flex-col gap-6 md:gap-8">
        


        {!gameState ? (
          /* ==================== 1. プレイヤー登録 ＆ 設定画面 ==================== */
          <GameSetup agents={agents} onStartGame={handleStartGame} />
        ) : (
          /* ==================== 2. ゲーム進行中画面 ==================== */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8 items-start">
            
            {/* --- 左カラム (登録プレイヤー状況 / スコア操作など) --- */}
            <div className="lg:col-span-7 flex flex-col gap-6 md:gap-8">
              
              {/* 最終ラウンド終了時の優勝リザルト */}
              {gameState.isFinished ? (
                <div className="bg-val-gray/40 border-2 border-val-cyan/60 rounded p-6 backdrop-blur-md relative overflow-hidden val-clip-top-right shadow-2xl shadow-val-cyan/5">
                  <div className="absolute top-0 right-0 w-24 h-1 bg-val-cyan"></div>
                  <div className="text-center py-6">
                    <span className="text-val-cyan text-xs font-mono tracking-widest uppercase">MATCH COMPLETED</span>
                    <h2 className="text-3xl font-black text-val-light tracking-wider mt-2 mb-6 uppercase">
                      🎉 対戦終了リザルト 🎉
                    </h2>

                    {/* 最多得点者の検出 */}
                    {(() => {
                      const scores = gameState.players.map((p) => p.totalScore);
                      const maxScore = Math.max(...scores);
                      const minScore = Math.min(...scores);
                      
                      const winners = gameState.players.filter((p) => p.totalScore === maxScore);
                      const underdogs = gameState.players.filter((p) => p.totalScore === minScore);

                      return (
                        <div className="flex flex-col items-center gap-6">
                          
                          {/* 優勝者カード */}
                          <div className="w-full">
                            <span className="text-[10px] font-mono tracking-widest text-zinc-500 uppercase block mb-2">CHAMPIONS</span>
                            <div className="flex flex-wrap justify-center gap-4">
                              {winners.map((winner) => (
                                <div
                                  key={winner.id}
                                  className="relative group px-8 py-5 bg-yellow-500/5 border border-yellow-500/30 rounded val-clip-path min-w-[200px] flex flex-col items-center shadow-lg shadow-yellow-500/5 overflow-hidden"
                                >
                                  {/* 優勝エージェント立ち絵の背景透過表示 */}
                                  {winner.agent?.fullPortrait && (
                                    <div className="absolute inset-y-0 right-0 left-12 opacity-15 pointer-events-none select-none">
                                      <img
                                        src={winner.agent.fullPortrait}
                                        alt={winner.agent.displayName}
                                        className="w-full h-full object-contain object-right scale-110"
                                      />
                                    </div>
                                  )}
                                  
                                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-yellow-500 text-val-black text-[10px] font-black tracking-widest px-2.5 py-0.5 rounded">
                                    CHAMPION
                                  </div>
                                  <span className="text-3xl mt-2 z-10">👑</span>
                                  {winner.agent && (
                                    <img
                                      src={winner.agent.displayIcon}
                                      alt={winner.agent.displayName}
                                      className="w-12 h-12 rounded border border-yellow-500/40 bg-zinc-950/80 object-cover mt-2 z-10"
                                    />
                                  )}
                                  <span className="text-2xl font-bold tracking-wide mt-2 text-yellow-500 z-10">
                                    {winner.name}
                                  </span>
                                  <span className="text-sm font-mono text-zinc-400 mt-1 z-10">
                                    {winner.totalScore} PTS
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* 最下位カード (ECO AWARD) */}
                          <div className="w-full border-t border-zinc-800/80 pt-6">
                            <span className="text-[10px] font-mono tracking-widest text-zinc-500 uppercase block mb-2">ECO AWARD (UNDERDOG)</span>
                            <div className="flex flex-wrap justify-center gap-4">
                              {underdogs.map((ud) => (
                                <div key={ud.id} className="relative group px-6 py-4 bg-zinc-850/20 border border-zinc-700/50 rounded val-clip-path min-w-[180px] flex flex-col items-center shadow-md">
                                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-zinc-750 text-zinc-300 text-[9px] font-black tracking-widest px-2 py-0.5 rounded">
                                    ECO PLAYER
                                  </div>
                                  <span className="text-2xl mt-1">💀</span>
                                  {ud.agent && (
                                    <img
                                      src={ud.agent.displayIcon}
                                      alt={ud.agent.displayName}
                                      className="w-10 h-10 rounded border border-zinc-700 bg-zinc-950/80 object-cover mt-1.5"
                                    />
                                  )}
                                  <span className="text-lg font-bold tracking-wide mt-1 text-zinc-400">
                                    {ud.name}
                                  </span>
                                  <span className="text-xs font-mono text-zinc-500">
                                    {ud.totalScore} PTS
                                  </span>
                                </div>
                              ))}
                            </div>
                            <p className="text-[11px] text-zinc-500 mt-3 font-mono">
                              エコラウンドの達人。次はハーフアーマーとクラシックで耐え忍ぼう。
                            </p>
                          </div>
                          
                          <p className="text-zinc-500 text-[10px] mt-2 max-w-lg mx-auto leading-relaxed font-mono uppercase tracking-wider">
                            RULE: {gameState.settings.maxRounds} ROUNDS | CITIZEN WIN +{gameState.settings.scoreCitizenWin} | TROLL WIN +{gameState.settings.scoreTrollWin} | BONUS +{gameState.settings.scoreSpottedBonus} | BONUS ON LOSE: {gameState.settings.enableSpottedBonusOnLose ? "ON" : "OFF"}
                          </p>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              ) : (
                /* ラウンド入力コントローラー (ラウンド番号をキーに指定し、ラウンド変更時にステートをリセット) */
                <RoundInputForm
                  key={gameState.currentRound}
                  gameState={gameState}
                  agents={agents}
                  onConfirmRound={(trollId, winTeam, vts, agts, obvious, artistic) =>
                    handleConfirmRound(trollId, winTeam, vts, agts, obvious, artistic)
                  }
                  isReadOnly={isReadOnly}
                />
              )}
            </div>

            {/* --- 右カラム (リアルタイムランキングスコアボード) --- */}
            <div className="lg:col-span-5 flex flex-col gap-6">
              <Leaderboard gameState={gameState} />
            </div>
          </div>
        )}

        {/* ==================== 3. 履歴（ログ）エリア ==================== */}
        {gameState && <MatchHistory gameState={gameState} />}

        {/* --- ルールブック開閉エリア (ページ下部に配置して操作を邪魔しないように改善) --- */}
        <div className="w-full mt-4 border-t border-zinc-900 pt-6">
          <button
            type="button"
            onClick={() => setIsRulebookOpen(!isRulebookOpen)}
            className="w-full py-2.5 bg-val-cyan/10 border border-val-cyan/30 hover:border-val-cyan text-val-cyan rounded flex items-center justify-center gap-2 font-mono text-xs uppercase tracking-widest transition-all duration-300 hover:bg-val-cyan/15 hover:shadow-[0_0_15px_rgba(0,240,255,0.1)] cursor-pointer animate-fade-in"
          >
            <svg className={`w-4 h-4 transition-transform duration-300 ${isRulebookOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            {isRulebookOpen ? "ルールブックを閉じる" : "ルールブック（遊び方・配点）を表示"}
          </button>

          {isRulebookOpen && (
            <div className="glass-card rounded p-6 mt-3 relative overflow-hidden val-clip-top-right border border-val-cyan/30 animate-fade-in space-y-5">
              <div className="absolute top-0 right-0 w-24 h-1 bg-val-cyan"></div>
              
              {/* ルール概要 */}
              <div>
                <h3 className="text-sm font-bold tracking-widest text-val-cyan font-mono mb-2 uppercase">HOW TO PLAY - トロール人狼とは？</h3>
                <p className="text-xs text-zinc-350 leading-relaxed font-mono">
                  プレイヤーのうち1名が秘密裏に「トロール（人狼）」として指名されます。<br />
                  市民チームは「勝利」を目指しつつ「トロール」を見破ることを目的とします。<br />
                  トロールは「敗北」を目指しつつ、自分がトロールだとバレないように立ち回ることを目的とします。<br />
                  全ラウンドを戦い抜き、最も獲得スコアの高いプレイヤーが優勝（景品獲得）となります！
                </p>
              </div>

              {/* 配点リスト (リアルタイム適用反映) */}
              <div className="border-t border-zinc-900 pt-4">
                <h3 className="text-sm font-bold tracking-widest text-val-red font-mono mb-3 uppercase">SCORING RULES - 配点表 (現在の設定値)</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono text-zinc-400">
                  <div className="space-y-2">
                    <h4 className="text-[11px] font-bold text-val-cyan tracking-wider">// 市民向けルール</h4>
                    <ul className="space-y-1 bg-val-black/30 p-3 border border-zinc-900 rounded list-disc pl-5">
                      <li>市民チーム勝利: <span className="text-val-cyan">+{gameState?.settings.scoreCitizenWin ?? DEFAULT_SETTINGS.scoreCitizenWin} 点</span></li>
                      <li>トロール投票的中ボーナス: <span className="text-val-cyan">+{gameState?.settings.scoreSpottedBonus ?? DEFAULT_SETTINGS.scoreSpottedBonus} 点</span> {gameState?.settings.enableSpottedBonusOnLose ? "(敗北時も適用)" : "(敗北時は無効)"}</li>
                      <li>市民完全勝利ボーナス (試合勝利＋投票的中): <span className="text-val-cyan">+{gameState?.settings.scoreCitizenPerfectWinBonus ?? DEFAULT_SETTINGS.scoreCitizenPerfectWinBonus} 点</span></li>
                      <li>トロール完全勝利ペナルティ (試合敗北＋投票不的中): <span className="text-zinc-550">({gameState?.settings.scoreCitizenPerfectLosePenalty ?? DEFAULT_SETTINGS.scoreCitizenPerfectLosePenalty} 点)</span></li>
                      <li>トロール完全隠蔽ペナルティ (試合敗北＋トロール得票0): <span className="text-zinc-550">({gameState?.settings.scoreCitizenCompleteConcealPenalty ?? DEFAULT_SETTINGS.scoreCitizenCompleteConcealPenalty} 点)</span></li>
                    </ul>
                  </div>

                  <div className="space-y-2">
                    <h4 className="text-[11px] font-bold text-val-red tracking-wider">// トロール向けルール</h4>
                    <ul className="space-y-1 bg-val-black/30 p-3 border border-zinc-900 rounded list-disc pl-5">
                      <li>トロールチーム勝利: <span className="text-val-cyan">+{gameState?.settings.scoreTrollWin ?? DEFAULT_SETTINGS.scoreTrollWin} 点</span></li>
                      <li>満場一致トロールペナルティ (4票特定された場合): <span className="text-zinc-550">({gameState?.settings.scoreTrollSpottedUnanimousPenalty ?? DEFAULT_SETTINGS.scoreTrollSpottedUnanimousPenalty} 点)</span></li>
                      <li>市民投票的中ペナルティ (投票的中時): <span className="text-zinc-550">({gameState?.settings.scoreTrollPerfectLosePenalty ?? DEFAULT_SETTINGS.scoreTrollPerfectLosePenalty} 点)</span></li>
                      <li>トロール完全勝利ボーナス (試合勝利＋投票不中の場合): <span className="text-val-cyan">+{gameState?.settings.scoreTrollPerfectWinBonus ?? DEFAULT_SETTINGS.scoreTrollPerfectWinBonus} 点</span></li>
                      <li>トロール完全隠蔽ボーナス (試合勝利＋得票0の場合): <span className="text-val-cyan">+{gameState?.settings.scoreTrollCompleteConcealBonus ?? DEFAULT_SETTINGS.scoreTrollCompleteConcealBonus} 点</span></li>
                      <li>戦犯トロールペナルティ (バレバレ): <span className="text-zinc-550">({gameState?.settings.scoreTrollObviousPenalty ?? DEFAULT_SETTINGS.scoreTrollObviousPenalty} 点)</span></li>
                      <li>芸術的トロールボーナス (神プレイ): <span className="text-val-cyan">+{gameState?.settings.scoreTrollArtisticBonus ?? DEFAULT_SETTINGS.scoreTrollArtisticBonus} 点</span></li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* --- フッター --- */}
      <footer className="mt-auto border-t border-zinc-900 bg-val-dark/95 py-6 px-6 text-center text-xs text-zinc-600 font-mono">
        <p>© 2026 VALO-TROLL SCOREBOARD. ALL RIGHTS RESERVED.</p>
        <p className="mt-1 text-[10px] text-zinc-700">VALORANT-inspired UI built with Next.js (App Router)</p>
      </footer>
    </div>
  );
}
