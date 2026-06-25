"use client";

import React, { useState, useEffect, useMemo } from "react";

// --- 型定義 ---
interface Player {
  id: string; // "p1" ~ "p5"
  name: string;
  totalScore: number;
}

interface PlayerRoundInput {
  playerId: string;
  role: "citizen" | "troll";
  votedFor: string; // 投票した相手のプレイヤーID
  score: number; // このラウンドで獲得したスコア
}

interface Round {
  roundNumber: number;
  trollPlayerId: string; // 本当のトロールだったプレイヤーID
  winningTeam: "citizen" | "troll"; // 勝利したチーム
  inputs: Record<string, PlayerRoundInput>; // プレイヤーID -> 入力＆結果
}

interface GameState {
  players: Player[];
  rounds: Round[];
  currentRound: number; // 進行中のラウンド番号 (1~10)
  isFinished: boolean;
  timestamp: number;
}

// --- 定数 ---
const STORAGE_KEY = "valo_troll_score_game";
const TTL_MS = 3 * 24 * 60 * 60 * 1000; // 3日間 (72時間)

// UTF-8文字列を安全にBase64エンコードする関数
const safeBtoa = (str: string): string => {
  try {
    return btoa(
      encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_, p1) =>
        String.fromCharCode(parseInt(p1, 16))
      )
    );
  } catch (e) {
    console.error("Base64 encoding error", e);
    return "";
  }
};

// Base64から安全にUTF-8文字列をデコードする関数
const safeAtob = (str: string): string => {
  try {
    return decodeURIComponent(
      atob(str)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
  } catch (e) {
    console.error("Base64 decoding error", e);
    return "";
  }
};

export default function TrollWerewolfApp() {
  // --- トースト通知の制御ステート＆関数 (先頭で宣言) ---
  const [notification, setNotification] = useState<string | null>(null);
  
  const showToast = (message: string) => {
    setTimeout(() => {
      setNotification(message);
    }, 0);
    setTimeout(() => {
      setNotification((prev) => (prev === message ? null : prev));
    }, 4000);
  };

  // --- 初期値の遅延評価 (Lazy Initialization) ---
  const [gameState, setGameState] = useState<GameState | null>(() => {
    if (typeof window === "undefined") return null;

    // 1. URLパラメータの確認
    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = urlParams.get("room");

    if (roomParam) {
      const decoded = safeAtob(roomParam);
      if (decoded) {
        try {
          const parsed = JSON.parse(decoded);
          if (
            parsed.players &&
            Array.isArray(parsed.players) &&
            parsed.players.length === 5
          ) {
            return {
              players: parsed.players,
              rounds: parsed.rounds || [],
              currentRound: parsed.currentRound || 1,
              isFinished: !!parsed.isFinished,
              timestamp: parsed.timestamp || Date.now(),
            };
          }
        } catch (e) {
          console.error("Failed to parse room data from URL", e);
        }
      }
    }

    // 2. LocalStorageの確認 (URLパラメータがない、またはパース失敗時)
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed: GameState = JSON.parse(saved);
        const now = Date.now();
        if (now - parsed.timestamp > TTL_MS) {
          localStorage.removeItem(STORAGE_KEY);
        } else {
          return parsed;
        }
      } catch (e) {
        console.error("Failed to load game from localStorage", e);
      }
    }
    return null;
  });

  const [isReadOnly, setIsReadOnly] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    const urlParams = new URLSearchParams(window.location.search);
    return !!urlParams.get("room");
  });

  const [tempPlayerNames, setTempPlayerNames] = useState<string[]>([
    "",
    "",
    "",
    "",
    "",
  ]);

  // ラウンド入力用の一時ステート
  const [roundTrollId, setRoundTrollId] = useState<string>("p1");
  const [roundWinningTeam, setRoundWinningTeam] = useState<"citizen" | "troll">("citizen");
  const [roundVotes, setRoundVotes] = useState<Record<string, string>>({});

  // アコーディオン開閉状態 (ラウンド番号を保持)
  const [openAccordion, setOpenAccordion] = useState<number | null>(null);

  // --- 初期ロード時のトースト通知 ---
  useEffect(() => {
    if (typeof window === "undefined") return;
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("room")) {
      showToast("共有データを読み込みました（閲覧モード）");
    } else {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Date.now() - parsed.timestamp > TTL_MS) {
            showToast("セッション有効期限（3日）が切れたため、データを初期化しました");
          }
        } catch {
          // ignore
        }
      }
    }
  }, []);

  // 自分自身以外のデフォルトの投票先を取得するヘルパー
  const getDefaultVoteFor = (playerId: string) => {
    if (!gameState) return "";
    const other = gameState.players.find((op) => op.id !== playerId);
    return other ? other.id : "";
  };

  // --- ゲーム開始 (プレイヤー登録) ---
  const handleStartGame = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const finalPlayers: Player[] = tempPlayerNames.map((name, index) => {
      const fallbackName = `プレイヤー ${index + 1}`;
      return {
        id: `p${index + 1}`,
        name: name.trim() || fallbackName,
        totalScore: 0,
      };
    });

    const newState: GameState = {
      players: finalPlayers,
      rounds: [],
      currentRound: 1,
      isFinished: false,
      timestamp: Date.now(),
    };

    setGameState(newState);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
    setIsReadOnly(false);
    showToast("ゲームを開始しました！");
  };

  // --- スコアボードの順位付け (合計スコア順ソート) ---
  const rankedPlayers = useMemo(() => {
    if (!gameState) return [];
    return [...gameState.players].sort((a, b) => b.totalScore - a.totalScore);
  }, [gameState]);

  // --- ラウンド確定 & スコア計算 ---
  const handleConfirmRound = () => {
    if (!gameState) return;

    // 各プレイヤーのこのラウンドの入力＆スコアを計算
    const roundInputs: Record<string, PlayerRoundInput> = {};
    const updatedPlayers = gameState.players.map((player) => {
      const isTroll = player.id === roundTrollId;
      const role = isTroll ? ("troll" as const) : ("citizen" as const);
      
      // 投票先が未入力、または自分自身だった場合はデフォルトにフォールバック
      let votedFor = roundVotes[player.id];
      if (!votedFor || votedFor === player.id) {
        votedFor = getDefaultVoteFor(player.id);
      }

      // 勝敗の判定
      const isWin = isTroll
        ? roundWinningTeam === "troll"
        : roundWinningTeam === "citizen";

      // 得点計算
      let score = 0;
      if (isWin) {
        if (isTroll) {
          score = 4; // トロールで勝利: +4点
        } else {
          score = 2; // 市民で勝利: +2点
          // 投票先が本当のトロールと一致していたら、トロール見破りボーナス +1点
          if (votedFor === roundTrollId) {
            score += 1;
          }
        }
      } else {
        score = 0; // 敗北: 0点
      }

      roundInputs[player.id] = {
        playerId: player.id,
        role,
        votedFor,
        score,
      };

      return {
        ...player,
        totalScore: player.totalScore + score,
      };
    });

    const newRound: Round = {
      roundNumber: gameState.currentRound,
      trollPlayerId: roundTrollId,
      winningTeam: roundWinningTeam,
      inputs: roundInputs,
    };

    const nextRoundNumber = gameState.currentRound + 1;
    const isFinished = gameState.currentRound >= 10;

    const newState: GameState = {
      players: updatedPlayers,
      rounds: [...gameState.rounds, newRound],
      currentRound: isFinished ? gameState.currentRound : nextRoundNumber,
      isFinished,
      timestamp: Date.now(),
    };

    setGameState(newState);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));

    // 次のラウンド用にフォーム入力をリセット
    setRoundWinningTeam("citizen");
    setRoundVotes({});
    showToast(`第 ${gameState.currentRound} 回戦を確定しました`);
  };

  // --- ゲームデータの破棄 (リセット) ---
  const handleDiscardGame = () => {
    if (window.confirm("これまでのゲームデータをすべて破棄して、最初からやり直しますか？")) {
      localStorage.removeItem(STORAGE_KEY);
      setGameState(null);
      setTempPlayerNames(["", "", "", "", ""]);
      setIsReadOnly(false);
      setRoundVotes({});
      setRoundTrollId("p1");
      setRoundWinningTeam("citizen");
      setOpenAccordion(null);
      
      // URLのパラメータも消去
      if (window.location.search) {
        window.history.replaceState({}, "", window.location.pathname);
      }
      showToast("ゲームデータを破棄しました");
    }
  };

  // --- 結果をURLで共有 ---
  const handleShareUrl = () => {
    if (!gameState) return;
    
    const shareData = {
      players: gameState.players,
      rounds: gameState.rounds,
      currentRound: gameState.currentRound,
      isFinished: gameState.isFinished,
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

  // --- 編集モードへの引き継ぎ ---
  const handleTakeoverEdit = () => {
    if (!gameState) return;

    const newState = {
      ...gameState,
      timestamp: Date.now(), // タイムスタンプを現在に更新
    };

    setGameState(newState);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
    setIsReadOnly(false);

    // URLの ?room=xxx を消去して履歴をクリーンに
    window.history.replaceState({}, "", window.location.pathname);
    showToast("このデータを元に、編集の引き継ぎが完了しました！");
  };

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
              className="px-4 py-2 border border-val-cyan text-val-cyan hover:bg-val-cyan hover:text-val-dark transition-all duration-300 font-mono text-xs uppercase tracking-wider font-bold val-clip-button flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 10.742l4.828-2.414m0 0a3 3 0 10-3.62-4.3l-4.83 2.42m0 0a3 3 0 100 4.6l4.829 2.41m-1.282-1.28l4.828 2.414m-.24 4.316a3 3 0 103.62-4.3L13.5 15" />
              </svg>
              URLで共有
            </button>
            <button
              onClick={handleDiscardGame}
              className="px-4 py-2 border border-val-red/40 text-val-red hover:border-val-red hover:bg-val-red hover:text-val-light transition-all duration-300 font-mono text-xs uppercase tracking-wider font-bold val-clip-button flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
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
            <svg className="w-5 h-5 flex-shrink-0 animate-pulse" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <span className="font-semibold tracking-wide">
              【共有データ閲覧中】現在、読み取り専用モードです。スコアの編集はできません。
            </span>
          </div>
          <button
            onClick={handleTakeoverEdit}
            className="px-4 py-1.5 bg-val-cyan hover:bg-val-cyan/85 text-val-black font-bold rounded text-xs uppercase tracking-wider transition-colors shadow-lg shadow-val-cyan/20"
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
          /* ==================== 1. プレイヤー登録画面 ==================== */
          <div className="max-w-xl mx-auto w-full my-auto py-12">
            <div className="bg-val-gray/40 border border-val-red/20 rounded p-6 md:p-8 backdrop-blur-md relative overflow-hidden val-clip-top-right">
              {/* 装飾用の赤いライン */}
              <div className="absolute top-0 right-0 w-32 h-1 bg-val-red"></div>
              
              <h2 className="text-xl font-bold tracking-widest text-val-red uppercase mb-2">PLAYER REGISTRATION</h2>
              <p className="text-xs text-zinc-400 mb-6 font-mono">トロール人狼に参加する5人のプレイヤー名を入力してください（未入力の場合は自動設定されます）</p>

              <form onSubmit={handleStartGame} className="space-y-4">
                {tempPlayerNames.map((name, index) => (
                  <div key={index} className="flex flex-col gap-1.5">
                    <label className="text-xs font-mono text-zinc-400 flex justify-between">
                      <span>PLAYER 0{index + 1}</span>
                      {index === 0 && <span className="text-val-red">HOST</span>}
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-val-red font-mono text-sm font-bold">
                        {"//"}
                      </span>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => {
                          const val = [...tempPlayerNames];
                          val[index] = e.target.value;
                          setTempPlayerNames(val);
                        }}
                        placeholder={`プレイヤー ${index + 1}`}
                        maxLength={15}
                        className="w-full bg-val-black/80 border border-zinc-700 focus:border-val-red text-val-light px-9 py-2.5 rounded font-medium focus:outline-none transition-colors text-sm placeholder-zinc-600"
                      />
                    </div>
                  </div>
                ))}

                <button
                  type="submit"
                  className="w-full mt-6 bg-val-red hover:bg-val-red/90 text-val-light font-black text-sm uppercase tracking-widest py-3 transition-colors duration-300 val-clip-button border-b-4 border-black/40 shadow-xl shadow-val-red/10 flex justify-center items-center gap-2"
                >
                  ゲーム開始 (10回戦)
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </button>
              </form>
            </div>
          </div>
        ) : (
          /* ==================== 2. ゲーム進行中画面 ==================== */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8 items-start">
            
            {/* --- 左カラム (登録プレイヤー状況 / スコア操作など) (6 / 12) --- */}
            <div className="lg:col-span-7 flex flex-col gap-6 md:gap-8">
              
              {/* 10回戦終了時の優勝リザルト */}
              {gameState.isFinished ? (
                <div className="bg-val-gray/40 border-2 border-val-cyan/60 rounded p-6 backdrop-blur-md relative overflow-hidden val-clip-top-right shadow-2xl shadow-val-cyan/5">
                  <div className="absolute top-0 right-0 w-24 h-1 bg-val-cyan"></div>
                  <div className="text-center py-6">
                    <span className="text-val-cyan text-xs font-mono tracking-widest uppercase">MATCH COMPLETED</span>
                    <h2 className="text-3xl font-black text-val-light tracking-wider mt-2 mb-6 uppercase">
                      🎉 優勝者発表 🎉
                    </h2>

                    {/* 最多得点者の検出 */}
                    {(() => {
                      const maxScore = Math.max(...gameState.players.map((p) => p.totalScore));
                      const winners = gameState.players.filter((p) => p.totalScore === maxScore);

                      return (
                        <div className="flex flex-col items-center gap-4">
                          <div className="flex flex-wrap justify-center gap-4">
                            {winners.map((winner) => (
                              <div key={winner.id} className="relative group px-8 py-5 bg-val-black/75 border border-val-cyan/40 rounded val-clip-path min-w-[200px] flex flex-col items-center shadow-lg">
                                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-val-cyan text-val-black text-[10px] font-black tracking-widest px-2.5 py-0.5 rounded">
                                  CHAMPION
                                </div>
                                <span className="text-3xl mt-2">👑</span>
                                <span className="text-2xl font-bold tracking-wide mt-2 text-val-cyan">
                                  {winner.name}
                                </span>
                                <span className="text-sm font-mono text-zinc-400 mt-1">
                                  {winner.totalScore} PTS
                                </span>
                              </div>
                            ))}
                          </div>
                          
                          <p className="text-zinc-400 text-xs mt-6 max-w-md mx-auto leading-relaxed">
                            全10回戦にわたる熱いトロール人狼バトルが終了しました！お疲れ様でした。下の「データ破棄」ボタンから、いつでも新規ゲームを開始できます。
                          </p>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              ) : (
                /* ラウンド入力コントローラー */
                <div className="bg-val-gray/40 border border-val-red/20 rounded p-6 backdrop-blur-md relative overflow-hidden val-clip-top-right">
                  <div className="absolute top-0 right-0 w-24 h-1 bg-val-red"></div>
                  
                  {/* タイトル & ラウンド数 */}
                  <div className="flex justify-between items-center border-b border-zinc-800 pb-4 mb-6">
                    <div>
                      <span className="text-val-red text-xs font-mono tracking-widest uppercase">CURRENT ROUND</span>
                      <h2 className="text-2xl font-black tracking-wider text-val-light">
                        第 {gameState.currentRound} 回戦 入力
                      </h2>
                    </div>
                    <div className="text-right">
                      <span className="block text-[10px] text-zinc-500 font-mono">PROGRESS</span>
                      <span className="text-xl font-mono font-bold text-val-red">
                        {gameState.currentRound}<span className="text-zinc-600 text-sm">/10</span>
                      </span>
                    </div>
                  </div>

                  {isReadOnly ? (
                    <div className="py-8 text-center bg-val-black/50 border border-dashed border-zinc-800 rounded">
                      <p className="text-zinc-500 text-sm font-medium">
                        閲覧モードのため、ラウンド結果の入力はできません。
                      </p>
                      <p className="text-zinc-600 text-xs mt-2">
                        スコアを入力・編集したい場合は、上部の「編集を引き継ぐ」を押してください。
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      
                      {/* Q1. 本当のトロールは誰？ */}
                      <div>
                        <label className="text-xs font-mono text-val-red tracking-wider uppercase block mb-2.5">
                          Q1. 本当のトロールは誰でしたか？
                        </label>
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                          {gameState.players.map((p) => (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => setRoundTrollId(p.id)}
                              className={`py-2 px-3 text-xs font-bold border rounded transition-all duration-200 val-clip-path ${
                                roundTrollId === p.id
                                  ? "bg-val-red border-val-red text-val-light shadow-md shadow-val-red/10"
                                  : "bg-val-black/60 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-val-light"
                              }`}
                            >
                              {p.name}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Q2. どちらが勝ちましたか？ */}
                      <div>
                        <label className="text-xs font-mono text-val-red tracking-wider uppercase block mb-2.5">
                          Q2. どちらのチームが勝利しましたか？
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                          <button
                            type="button"
                            onClick={() => setRoundWinningTeam("citizen")}
                            className={`py-3 px-4 text-xs font-black border rounded tracking-widest uppercase transition-all duration-200 val-clip-path ${
                              roundWinningTeam === "citizen"
                                ? "bg-val-cyan/15 border-val-cyan text-val-cyan shadow-md shadow-val-cyan/5"
                                : "bg-val-black/60 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-val-light"
                            }`}
                          >
                            市民チームの勝ち (+2点)
                          </button>
                          <button
                            type="button"
                            onClick={() => setRoundWinningTeam("troll")}
                            className={`py-3 px-4 text-xs font-black border rounded tracking-widest uppercase transition-all duration-200 val-clip-path ${
                              roundWinningTeam === "troll"
                                ? "bg-val-red/15 border-val-red text-val-red shadow-md shadow-val-red/5"
                                : "bg-val-black/60 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-val-light"
                            }`}
                          >
                            トロールの勝ち (+4点)
                          </button>
                        </div>
                      </div>

                      {/* Q3. 各プレイヤーのトロール投票先 */}
                      <div>
                        <div className="flex justify-between items-center mb-2.5">
                          <label className="text-xs font-mono text-val-red tracking-wider uppercase">
                            Q3. 各プレイヤーがトロールだと思って投票した相手は？
                          </label>
                          <span className="text-[10px] text-zinc-500 font-mono">市民がトロールを見破ると+1点ボーナス</span>
                        </div>

                        <div className="space-y-3 bg-val-black/40 border border-zinc-800/80 rounded p-4">
                          {gameState.players.map((p) => {
                            const isThisPlayerTroll = p.id === roundTrollId;
                            return (
                              <div key={p.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-1.5 border-b border-zinc-900 last:border-0">
                                <div className="flex items-center gap-2.5">
                                  <span className="text-xs font-semibold tracking-wide text-zinc-200">
                                    {p.name}
                                  </span>
                                  {isThisPlayerTroll ? (
                                    <span className="text-[10px] font-mono bg-val-red/20 text-val-red px-2 py-0.5 rounded border border-val-red/30">
                                      TROLL
                                    </span>
                                  ) : (
                                    <span className="text-[10px] font-mono bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded">
                                      CITIZEN
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] text-zinc-500 font-mono uppercase">VOTED FOR:</span>
                                  <select
                                    value={roundVotes[p.id] || getDefaultVoteFor(p.id)}
                                    onChange={(e) => {
                                      setRoundVotes({
                                        ...roundVotes,
                                        [p.id]: e.target.value,
                                      });
                                    }}
                                    className="bg-val-black border border-zinc-800 text-zinc-300 text-xs font-semibold rounded px-2.5 py-1.5 focus:border-val-red focus:outline-none transition-colors min-w-[140px]"
                                  >
                                    {gameState.players
                                      .filter((other) => other.id !== p.id)
                                      .map((other) => (
                                        <option key={other.id} value={other.id}>
                                          {other.name}
                                        </option>
                                      ))}
                                  </select>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* 確定ボタン */}
                      <button
                        onClick={handleConfirmRound}
                        className="w-full mt-4 bg-val-red hover:bg-val-red/90 text-val-light font-black text-sm uppercase tracking-widest py-3 transition-colors duration-300 val-clip-button border-b-4 border-black/40 shadow-xl shadow-val-red/10"
                      >
                        第 {gameState.currentRound} 回戦を確定する
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* --- 右カラム (リアルタイムランキングスコアボード) (5 / 12) --- */}
            <div className="lg:col-span-5 flex flex-col gap-6">
              <div className="bg-val-gray/40 border border-zinc-800 rounded p-6 backdrop-blur-md relative overflow-hidden val-clip-top-right">
                <div className="absolute top-0 right-0 w-24 h-1 bg-val-cyan"></div>
                
                <h2 className="text-xl font-bold tracking-widest text-val-cyan uppercase mb-2 flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                  </svg>
                  REAL-TIME LEADERBOARD
                </h2>
                <p className="text-xs text-zinc-400 mb-6 font-mono">合計ポイントに基づくプレイヤーランキング</p>

                {/* スコアリスト */}
                <div className="space-y-3">
                  {rankedPlayers.map((player, index) => {
                    const rank = index + 1;
                    let rankBadgeClass = "bg-zinc-800 text-zinc-400";
                    let rankIcon = "";
                    let borderClass = "border-zinc-800/80";

                    if (rank === 1) {
                      rankBadgeClass = "bg-yellow-500/20 text-yellow-500 border border-yellow-500/40";
                      rankIcon = "👑";
                      borderClass = "border-yellow-500/30 bg-yellow-500/5";
                    } else if (rank === 2) {
                      rankBadgeClass = "bg-slate-300/20 text-slate-300 border border-slate-300/40";
                      rankIcon = "🥈";
                      borderClass = "border-slate-300/20 bg-slate-300/5";
                    } else if (rank === 3) {
                      rankBadgeClass = "bg-amber-700/20 text-amber-600 border border-amber-700/40";
                      rankIcon = "🥉";
                      borderClass = "border-amber-700/20 bg-amber-700/5";
                    }

                    return (
                      <div
                        key={player.id}
                        className={`flex items-center justify-between p-4 bg-val-black/60 border rounded transition-all duration-500 val-clip-path ${borderClass}`}
                      >
                        <div className="flex items-center gap-3">
                          <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black font-mono ${rankBadgeClass}`}>
                            {rank}
                          </span>
                          <div className="flex flex-col">
                            <span className="font-bold tracking-wide text-sm flex items-center gap-1.5">
                              {player.name}
                              {rankIcon && <span className="text-xs">{rankIcon}</span>}
                            </span>
                            <span className="text-[10px] text-zinc-500 font-mono">PLAYER ID: {player.id.toUpperCase()}</span>
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="text-xl font-bold font-mono text-val-cyan tracking-wider">
                            {player.totalScore}
                          </span>
                          <span className="text-[10px] text-zinc-500 font-mono ml-1">PTS</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ==================== 3. 履歴（ログ）エリア ==================== */}
        {gameState && gameState.rounds.length > 0 && (
          <div className="w-full mt-2">
            <div className="bg-val-gray/40 border border-zinc-800 rounded p-6 backdrop-blur-md relative overflow-hidden val-clip-top-right">
              <div className="absolute top-0 right-0 w-24 h-1 bg-zinc-600"></div>

              <h2 className="text-xl font-bold tracking-widest text-zinc-300 uppercase mb-2 flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                MATCH HISTORY
              </h2>
              <p className="text-xs text-zinc-500 mb-6 font-mono">過去ラウンドの役職・投票・ポイント獲得履歴</p>

              <div className="space-y-3">
                {gameState.rounds.map((round) => {
                  const isOpen = openAccordion === round.roundNumber;
                  const winnerText = round.winningTeam === "citizen" ? "市民チームの勝利" : "トロールの勝利";
                  const winnerBadgeColor = round.winningTeam === "citizen" ? "bg-val-cyan/10 text-val-cyan border-val-cyan/20" : "bg-val-red/10 text-val-red border-val-red/20";
                  const trollName = gameState.players.find((p) => p.id === round.trollPlayerId)?.name || "不明";

                  return (
                    <div key={round.roundNumber} className="border border-zinc-800/80 rounded bg-val-black/40 overflow-hidden val-clip-path transition-all duration-300">
                      
                      {/* アコーディオンヘッダー */}
                      <button
                        onClick={() => setOpenAccordion(isOpen ? null : round.roundNumber)}
                        className="w-full px-5 py-3.5 flex items-center justify-between gap-4 text-left hover:bg-val-gray/25 transition-colors duration-200"
                      >
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="text-sm font-black font-mono text-val-red uppercase tracking-wider">
                            第 {round.roundNumber} 回戦
                          </span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 border rounded uppercase font-mono ${winnerBadgeColor}`}>
                            {winnerText}
                          </span>
                          <span className="text-xs text-zinc-400">
                            トロール: <span className="font-semibold text-val-light">{trollName}</span>
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-zinc-500 font-mono uppercase">{isOpen ? "CLOSE" : "DETAILS"}</span>
                          <svg
                            className={`w-4 h-4 text-zinc-500 transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </button>

                      {/* アコーディオン詳細パネル */}
                      {isOpen && (
                        <div className="px-5 pb-5 pt-2 border-t border-zinc-900 bg-val-black/60 space-y-3">
                          <div className="grid grid-cols-1 sm:grid-cols-5 gap-3.5 mt-2">
                            {gameState.players.map((p) => {
                              const input = round.inputs[p.id];
                              if (!input) return null;
                              
                              const isTroll = input.role === "troll";
                              const votedName = gameState.players.find((vp) => vp.id === input.votedFor)?.name || "未投票";
                              const isWin = isTroll
                                ? round.winningTeam === "troll"
                                : round.winningTeam === "citizen";
                                
                              // トロール見破り成否
                              const isVotedTrollCorrect = !isTroll && input.votedFor === round.trollPlayerId;

                              return (
                                <div key={p.id} className="p-3.5 bg-val-gray/15 border border-zinc-800/80 rounded val-clip-path flex flex-col justify-between">
                                  <div>
                                    <div className="flex justify-between items-center mb-2">
                                      <span className="font-bold text-xs tracking-wide text-val-light block truncate max-w-[80px]">
                                        {p.name}
                                      </span>
                                      {isTroll ? (
                                        <span className="text-[9px] font-mono font-bold bg-val-red/20 text-val-red border border-val-red/30 px-1.5 py-0.2 rounded">
                                          TROLL
                                        </span>
                                      ) : (
                                        <span className="text-[9px] font-mono bg-zinc-800 text-zinc-400 px-1.5 py-0.2 rounded">
                                          CITIZEN
                                        </span>
                                      )}
                                    </div>

                                    {/* 投票と勝敗のログ */}
                                    <div className="space-y-1 text-[10px] text-zinc-400 font-mono">
                                      <div>
                                        投票: <span className={`font-semibold ${isVotedTrollCorrect ? "text-val-cyan" : "text-zinc-400"}`}>{votedName}</span>
                                        {isVotedTrollCorrect && <span className="ml-1 text-[8px] bg-val-cyan/15 text-val-cyan border border-val-cyan/20 px-1 rounded">的中</span>}
                                      </div>
                                      <div>
                                        結果: <span className={isWin ? "text-val-cyan font-bold" : "text-zinc-600"}>{isWin ? "WIN" : "LOSE"}</span>
                                      </div>
                                    </div>
                                  </div>

                                  <div className="mt-3 pt-2 border-t border-zinc-900 flex justify-between items-end">
                                    <span className="text-[9px] text-zinc-500 font-mono">SCORE:</span>
                                    <span className={`text-base font-bold font-mono ${input.score > 0 ? "text-val-cyan" : "text-zinc-500"}`}>
                                      +{input.score}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* --- フッター --- */}
      <footer className="mt-auto border-t border-zinc-900 bg-val-dark/95 py-6 px-6 text-center text-xs text-zinc-600 font-mono">
        <p>© 2026 VALO-TROLL SCOREBOARD. ALL RIGHTS RESERVED.</p>
        <p className="mt-1 text-[10px] text-zinc-700">VALORANT-inspired UI built with Next.js (App Router)</p>
      </footer>
    </div>
  );
}
