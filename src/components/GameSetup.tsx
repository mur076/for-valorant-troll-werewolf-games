import React, { useState, useMemo } from "react";
import { AgentData, GameSettings, Player } from "@/types/game";

interface GameSetupProps {
  agents: AgentData[];
  onStartGame: (players: Player[], settings: GameSettings) => void;
}

export default function GameSetup({ agents, onStartGame }: GameSetupProps) {
  const [playerNames, setPlayerNames] = useState<string[]>(["", "", "", "", ""]);
  const [playerAgentUuids, setPlayerAgentUuids] = useState<(string | null)[]>([
    null,
    null,
    null,
    null,
    null,
  ]);

  // 設定入力用の文字列ステート (市民有利のゲームバランスをデフォルト値に設定)
  const [settingsStr, setSettingsStr] = useState({
    maxRounds: "7",
    scoreCitizenWin: "2",
    scoreTrollWin: "3",
    scoreSpottedBonus: "2",
    
    // 身内戦アドバンスドルール配点 (市民有利設定値)
    scoreTrollSpottedUnanimousPenalty: "-3",
    scoreCitizenPerfectWinBonus: "2",
    scoreTrollPerfectLosePenalty: "-2",
    scoreCitizenPerfectLosePenalty: "-1",
    scoreTrollPerfectWinBonus: "1",
    scoreTrollCompleteConcealBonus: "1",
    scoreCitizenCompleteConcealPenalty: "-1",
    scoreTrollObviousPenalty: "-2",
    scoreTrollArtisticBonus: "1",
  });
  const [enableSpottedBonusOnLose, setEnableSpottedBonusOnLose] = useState(true);

  // モーダル制御
  const [isAgentModalOpen, setIsAgentModalOpen] = useState(false);
  const [activePlayerIndex, setActivePlayerIndex] = useState<number | null>(null);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  // 数値のインクリメント/デクリメント処理 (マイナス値・範囲カスタム対応)
  const adjustSetting = (key: keyof typeof settingsStr, delta: number, min: number, max: number) => {
    setSettingsStr((prev) => {
      const currentVal = parseInt(prev[key]) || 0;
      const newVal = Math.max(min, Math.min(max, currentVal + delta));
      return {
        ...prev,
        [key]: newVal.toString(),
      };
    });
  };

  // 入力値変更ハンドラ (負の数および空文字許可)
  const handleInputChange = (key: keyof typeof settingsStr, value: string) => {
    // 空、ハイフンのみ、または整数パターンを許可
    if (value !== "" && value !== "-" && !/^-?\d+$/.test(value)) return;
    setSettingsStr((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  // 各キーの日本語ラベル定義
  const labelMap: Record<string, string> = {
    scoreTrollSpottedUnanimousPenalty: "満場一致トロールペナルティ (トロール失点)",
    scoreCitizenPerfectWinBonus: "市民完全勝利ボーナス (市民得点)",
    scoreTrollPerfectLosePenalty: "市民投票的中ペナルティ (トロール失点)",
    scoreCitizenPerfectLosePenalty: "トロール完全勝利ペナルティ (市民失点)",
    scoreTrollPerfectWinBonus: "トロール完全勝利ボーナス (トロール得点)",
    scoreTrollCompleteConcealBonus: "トロール完全隠蔽大ボーナス (トロール得点)",
    scoreCitizenCompleteConcealPenalty: "市民完全隠蔽ペナルティ (市民失点)",
    scoreTrollObviousPenalty: "戦犯トロールペナルティ (トロール失点)",
    scoreTrollArtisticBonus: "芸術的トロールボーナス (トロール得点)",
  };

  // バリデーション処理
  const validationErrors = useMemo(() => {
    const errors: Record<string, string> = {};
    
    // 対戦回数 (1~50)
    if (settingsStr.maxRounds === "") {
      errors.maxRounds = "数値を入力してください";
    } else {
      const val = parseInt(settingsStr.maxRounds);
      if (isNaN(val) || val < 1 || val > 50) {
        errors.maxRounds = "1〜50の範囲で入力してください";
      }
    }

    // 市民勝利ポイント (0~10)
    if (settingsStr.scoreCitizenWin === "") {
      errors.scoreCitizenWin = "数値を入力してください";
    } else {
      const val = parseInt(settingsStr.scoreCitizenWin);
      if (isNaN(val) || val < 0 || val > 10) {
        errors.scoreCitizenWin = "0〜10の範囲で入力してください";
      }
    }

    // トロール勝利ポイント (0~10)
    if (settingsStr.scoreTrollWin === "") {
      errors.scoreTrollWin = "数値を入力してください";
    } else {
      const val = parseInt(settingsStr.scoreTrollWin);
      if (isNaN(val) || val < 0 || val > 10) {
        errors.scoreTrollWin = "0〜10の範囲で入力してください";
      }
    }

    // 見破りボーナス (0~10)
    if (settingsStr.scoreSpottedBonus === "") {
      errors.scoreSpottedBonus = "数値を入力してください";
    } else {
      const val = parseInt(settingsStr.scoreSpottedBonus);
      if (isNaN(val) || val < 0 || val > 10) {
        errors.scoreSpottedBonus = "0〜10の範囲で入力してください";
      }
    }

    // アドバンスドルール配点のバリデーション (-10 ~ 10)
    const advancedKeys = [
      "scoreTrollSpottedUnanimousPenalty",
      "scoreCitizenPerfectWinBonus",
      "scoreTrollPerfectLosePenalty",
      "scoreCitizenPerfectLosePenalty",
      "scoreTrollPerfectWinBonus",
      "scoreTrollCompleteConcealBonus",
      "scoreCitizenCompleteConcealPenalty",
      "scoreTrollObviousPenalty",
      "scoreTrollArtisticBonus",
    ] as const;

    advancedKeys.forEach((key) => {
      const rawVal = settingsStr[key];
      if (rawVal === "" || rawVal === "-") {
        errors[key] = "数値を入力してください";
      } else {
        const val = parseInt(rawVal);
        if (isNaN(val) || val < -10 || val > 10) {
          errors[key] = "-10〜10の範囲で入力してください";
        }
      }
    });

    return errors;
  }, [settingsStr]);

  const isValid = Object.keys(validationErrors).length === 0;

  // エージェント選択モーダル処理
  const handleSelectAgent = (agentUuid: string) => {
    if (activePlayerIndex === null) return;
    const nextUuids = [...playerAgentUuids];
    
    const existingIndex = nextUuids.indexOf(agentUuid);
    if (existingIndex !== -1) {
      nextUuids[existingIndex] = null;
    }
    
    nextUuids[activePlayerIndex] = agentUuid;
    setPlayerAgentUuids(nextUuids);
    setIsAgentModalOpen(false);
    setActivePlayerIndex(null);
  };

  const openAgentModal = (playerIndex: number) => {
    setActivePlayerIndex(playerIndex);
    setIsAgentModalOpen(true);
  };

  const getSelectedUuids = () => {
    return playerAgentUuids.filter((uuid): uuid is string => uuid !== null);
  };

  const handleProceedToSettings = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSettingsModalOpen(true);
  };

  const handleStartGameFinal = () => {
    if (!isValid) return;

    const finalPlayers: Player[] = playerNames.map((name, index) => {
      const fallbackName = `プレイヤー ${index + 1}`;
      const agentUuid = playerAgentUuids[index];
      const agent = agents.find((a) => a.uuid === agentUuid);

      return {
        id: `p${index + 1}`,
        name: name.trim() || fallbackName,
        totalScore: 0,
        agent,
      };
    });

    onStartGame(finalPlayers, {
      maxRounds: parseInt(settingsStr.maxRounds) || 10,
      scoreCitizenWin: parseInt(settingsStr.scoreCitizenWin) || 2,
      scoreTrollWin: parseInt(settingsStr.scoreTrollWin) || 4,
      scoreSpottedBonus: parseInt(settingsStr.scoreSpottedBonus) || 1,
      enableSpottedBonusOnLose,
      
      // 追加のアドバンスドルール配点を送信
      scoreTrollSpottedUnanimousPenalty: parseInt(settingsStr.scoreTrollSpottedUnanimousPenalty) || 0,
      scoreCitizenPerfectWinBonus: parseInt(settingsStr.scoreCitizenPerfectWinBonus) || 0,
      scoreTrollPerfectLosePenalty: parseInt(settingsStr.scoreTrollPerfectLosePenalty) || 0,
      scoreCitizenPerfectLosePenalty: parseInt(settingsStr.scoreCitizenPerfectLosePenalty) || 0,
      scoreTrollPerfectWinBonus: parseInt(settingsStr.scoreTrollPerfectWinBonus) || 0,
      scoreTrollCompleteConcealBonus: parseInt(settingsStr.scoreTrollCompleteConcealBonus) || 0,
      scoreCitizenCompleteConcealPenalty: parseInt(settingsStr.scoreCitizenCompleteConcealPenalty) || 0,
      scoreTrollObviousPenalty: parseInt(settingsStr.scoreTrollObviousPenalty) || 0,
      scoreTrollArtisticBonus: parseInt(settingsStr.scoreTrollArtisticBonus) || 0,
    });
  };

  return (
    <div className="max-w-xl mx-auto w-full py-4">
      {/* プレイヤー登録カード */}
      <form onSubmit={handleProceedToSettings} className="w-full">
        <div className="glass-card rounded p-6 md:p-8 relative overflow-hidden val-clip-top-right transition-all duration-300 hover:shadow-[0_0_25px_rgba(255,70,85,0.06)]">
          <div className="absolute top-0 right-0 w-32 h-1 bg-val-red"></div>
          
          <h2 className="text-xl font-bold tracking-widest text-val-red uppercase mb-2">PLAYER REGISTRATION</h2>
          <p className="text-xs text-zinc-400 mb-6 font-mono">
            プレイヤー名と初期エージェントを選択してください
          </p>

          <div className="space-y-4 mb-6">
            {playerNames.map((name, index) => {
              const agentUuid = playerAgentUuids[index];
              const selectedAgent = agents.find((a) => a.uuid === agentUuid);

              return (
                <div key={index} className="flex flex-col gap-1.5 animate-fade-in">
                  <label className="text-xs font-mono text-zinc-400 flex justify-between">
                    <span>PLAYER 0{index + 1}</span>
                    {index === 0 && <span className="text-val-red font-bold">HOST</span>}
                  </label>
                  
                  <div className="flex gap-3 items-center">
                    <button
                      type="button"
                      onClick={() => openAgentModal(index)}
                      className={`w-12 h-12 flex-shrink-0 rounded border flex items-center justify-center transition-all overflow-hidden cursor-pointer ${
                        selectedAgent
                          ? "border-val-cyan bg-zinc-950 hover:border-val-red hover:shadow-[0_0_10px_rgba(0,240,255,0.2)]"
                          : "border-zinc-700 bg-zinc-950/70 text-zinc-500 hover:border-val-cyan hover:text-val-cyan"
                      }`}
                      title={selectedAgent ? `${selectedAgent.displayName} を選択中` : "エージェントを選択"}
                    >
                      {selectedAgent ? (
                        <img
                          src={selectedAgent.displayIcon}
                          alt={selectedAgent.displayName}
                          className="w-full h-full object-cover scale-110"
                        />
                      ) : (
                        <svg className="w-5 h-5 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      )}
                    </button>

                    <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-val-red font-mono text-sm font-bold">
                        {"//"}
                      </span>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => {
                          const val = [...playerNames];
                          val[index] = e.target.value;
                          setPlayerNames(val);
                        }}
                        placeholder={`プレイヤー ${index + 1}`}
                        maxLength={15}
                        className="w-full bg-val-black/50 border border-zinc-700 focus:border-val-red focus:shadow-[0_0_10px_rgba(255,70,85,0.15)] text-val-light px-9 py-2.5 rounded font-medium focus:outline-none transition-all text-sm placeholder-zinc-650"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <button
            type="submit"
            className="w-full bg-val-red hover:bg-val-red/90 text-val-light font-black text-sm uppercase tracking-widest py-3.5 transition-all duration-300 val-clip-button border-b-4 border-black/40 shadow-xl shadow-val-red/10 flex justify-center items-center gap-2 cursor-pointer hover:shadow-[0_0_15px_rgba(255,70,85,0.4)]"
          >
            ゲーム設定へ
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </button>
        </div>
      </form>

      {/* エージェント選択モーダル */}
      {isAgentModalOpen && activePlayerIndex !== null && (
        <div className="fixed inset-0 bg-val-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-val-dark border border-val-cyan max-w-2xl w-full rounded p-6 shadow-2xl relative max-h-[85vh] flex flex-col val-clip-top-right">
            
            <div className="flex justify-between items-center border-b border-zinc-800 pb-4 mb-4">
              <div>
                <h3 className="text-lg font-black tracking-wider text-val-cyan uppercase">
                  SELECT AGENT FOR PLAYER {activePlayerIndex + 1}
                </h3>
                <p className="text-xs text-zinc-500 font-mono">使用するエージェントをクリックして選択してください</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsAgentModalOpen(false);
                  setActivePlayerIndex(null);
                }}
                className="text-zinc-500 hover:text-val-red font-bold font-mono text-xs px-2.5 py-1.5 border border-zinc-850 hover:border-val-red rounded transition-colors cursor-pointer"
              >
                ✕ CLOSE
              </button>
            </div>

            {/* エージェントグリッド (レスポンシブ崩れ対策 pb-[100%] ハック適用) */}
            <div className="overflow-y-auto flex-1 pr-1 scrollbar-thin">
              <div className="grid grid-cols-4 sm:grid-cols-5 gap-[3.5%] py-2">
                {agents.length === 0 ? (
                  <div className="col-span-full py-12 text-center text-zinc-500 font-mono text-sm">
                    エージェント情報を読み込めませんでした。
                  </div>
                ) : (
                  agents.map((agent) => {
                    const isSelectedByOther = getSelectedUuids().includes(agent.uuid) && playerAgentUuids[activePlayerIndex] !== agent.uuid;
                    const isSelectedBySelf = playerAgentUuids[activePlayerIndex] === agent.uuid;

                    return (
                      <div key={agent.uuid} className="w-full h-0 pb-[100%] relative">
                        <button
                          type="button"
                          disabled={isSelectedByOther}
                          onClick={() => handleSelectAgent(agent.uuid)}
                          className={`absolute inset-0 w-full h-full rounded border transition-all duration-200 cursor-pointer overflow-hidden ${
                            isSelectedBySelf
                              ? "border-val-cyan bg-val-cyan/15 shadow-lg shadow-val-cyan/15 scale-95"
                              : isSelectedByOther
                              ? "border-zinc-900 bg-zinc-950/60 opacity-25 cursor-not-allowed"
                              : "border-zinc-800 bg-val-black/60 hover:border-val-red hover:bg-val-red/5 hover:scale-105"
                          }`}
                          title={agent.displayName}
                        >
                          <img
                            src={agent.displayIcon}
                            alt={agent.displayName}
                            className="w-full h-full object-cover scale-110"
                            loading="lazy"
                          />
                          {isSelectedBySelf && (
                            <span className="absolute top-1 right-1 bg-val-cyan text-val-black text-[8px] font-black px-1.5 py-0.5 rounded font-mono z-10">
                              ✓
                            </span>
                          )}
                          {isSelectedByOther && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-[9px] font-black text-zinc-400 font-mono z-10">
                              USED
                            </div>
                          )}
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
            
            <div className="border-t border-zinc-800 pt-4 mt-4 flex justify-between items-center text-xs text-zinc-500 font-mono">
              <span>* 同一ゲーム内で重複したエージェントは選択できません</span>
              {playerAgentUuids[activePlayerIndex] && (
                <button
                  type="button"
                  onClick={() => {
                    const nextUuids = [...playerAgentUuids];
                    nextUuids[activePlayerIndex] = null;
                    setPlayerAgentUuids(nextUuids);
                    setIsAgentModalOpen(false);
                    setActivePlayerIndex(null);
                  }}
                  className="text-val-red hover:underline font-bold cursor-pointer"
                >
                  選択を解除
                </button>
              )}
            </div>

          </div>
        </div>
      )}

      {/* ==================== ゲーム設定ポップアップモーダル (アドバンスド拡張) ==================== */}
      {isSettingsModalOpen && (
        <div className="fixed inset-0 bg-val-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-card max-w-lg w-full rounded p-6 shadow-2xl relative flex flex-col val-clip-top-right border border-val-cyan/40 max-h-[90vh]">
            <div className="absolute top-0 right-0 w-24 h-1 bg-val-cyan"></div>

            <div className="flex justify-between items-center border-b border-zinc-800 pb-4 mb-4">
              <div>
                <h3 className="text-lg font-black tracking-wider text-val-cyan uppercase">
                  GAME SETTINGS
                </h3>
                <p className="text-xs text-zinc-550 font-mono">ゲームルールと各種配点を設定します（0で無効化）</p>
              </div>
              <button
                type="button"
                onClick={() => setIsSettingsModalOpen(false)}
                className="text-zinc-500 hover:text-val-red font-bold font-mono text-xs px-2.5 py-1.5 border border-zinc-850 hover:border-val-red rounded transition-colors cursor-pointer"
              >
                ✕ CLOSE
              </button>
            </div>

            {/* モーダル内部フォーム (スクロール可能) */}
            <div className="space-y-6 overflow-y-auto flex-1 pr-1 scrollbar-thin py-2">
              
              {/* --- セクション1: 基本ルール設定 --- */}
              <div className="space-y-4">
                <h4 className="text-xs font-mono font-bold text-val-cyan tracking-widest border-b border-zinc-850 pb-1 uppercase">
                  1. BASIC RULES
                </h4>
                
                {/* Q. 対戦回数 */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-mono text-zinc-400 flex justify-between">
                    <span>総ラウンド数 (回戦数)</span>
                    <span className="text-[10px] text-zinc-550 font-mono">範囲: 1 - 50</span>
                  </label>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => adjustSetting("maxRounds", -1, 1, 50)}
                      className="w-10 h-10 bg-zinc-900 border border-zinc-800 hover:border-val-red hover:text-val-red text-zinc-400 font-bold rounded font-mono transition-all flex items-center justify-center cursor-pointer select-none"
                    >
                      -
                    </button>
                    <input
                      type="text"
                      value={settingsStr.maxRounds}
                      onChange={(e) => handleInputChange("maxRounds", e.target.value)}
                      className={`flex-1 text-center bg-val-black/50 border ${
                        validationErrors.maxRounds ? "border-val-red" : "border-zinc-700 focus:border-val-cyan"
                      } text-val-light h-10 rounded font-mono focus:outline-none transition-colors text-sm`}
                    />
                    <button
                      type="button"
                      onClick={() => adjustSetting("maxRounds", 1, 1, 50)}
                      className="w-10 h-10 bg-zinc-900 border border-zinc-800 hover:border-val-cyan hover:text-val-cyan text-zinc-400 font-bold rounded font-mono transition-all flex items-center justify-center cursor-pointer select-none"
                    >
                      +
                    </button>
                  </div>
                  {validationErrors.maxRounds && (
                    <span className="text-[10px] text-val-red font-mono font-semibold block mt-0.5 animate-pulse">
                      ⚠️ {validationErrors.maxRounds}
                    </span>
                  )}
                </div>

                {/* Q. 市民勝利点 */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-mono text-zinc-400 flex justify-between">
                    <span>市民勝利ポイント (WIN)</span>
                    <span className="text-[10px] text-zinc-550 font-mono">範囲: 0 - 10</span>
                  </label>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => adjustSetting("scoreCitizenWin", -1, 0, 10)}
                      className="w-10 h-10 bg-zinc-900 border border-zinc-800 hover:border-val-red hover:text-val-red text-zinc-400 font-bold rounded font-mono transition-all flex items-center justify-center cursor-pointer select-none"
                    >
                      -
                    </button>
                    <input
                      type="text"
                      value={settingsStr.scoreCitizenWin}
                      onChange={(e) => handleInputChange("scoreCitizenWin", e.target.value)}
                      className={`flex-1 text-center bg-val-black/50 border ${
                        validationErrors.scoreCitizenWin ? "border-val-red" : "border-zinc-700 focus:border-val-cyan"
                      } text-val-light h-10 rounded font-mono focus:outline-none transition-colors text-sm`}
                    />
                    <button
                      type="button"
                      onClick={() => adjustSetting("scoreCitizenWin", 1, 0, 10)}
                      className="w-10 h-10 bg-zinc-900 border border-zinc-800 hover:border-val-cyan hover:text-val-cyan text-zinc-400 font-bold rounded font-mono transition-all flex items-center justify-center cursor-pointer select-none"
                    >
                      +
                    </button>
                  </div>
                  {validationErrors.scoreCitizenWin && (
                    <span className="text-[10px] text-val-red font-mono font-semibold block mt-0.5 animate-pulse">
                      ⚠️ {validationErrors.scoreCitizenWin}
                    </span>
                  )}
                </div>

                {/* Q. トロール勝利点 */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-mono text-zinc-400 flex justify-between">
                    <span>トロール勝利ポイント (WIN)</span>
                    <span className="text-[10px] text-zinc-550 font-mono">範囲: 0 - 10</span>
                  </label>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => adjustSetting("scoreTrollWin", -1, 0, 10)}
                      className="w-10 h-10 bg-zinc-900 border border-zinc-800 hover:border-val-red hover:text-val-red text-zinc-400 font-bold rounded font-mono transition-all flex items-center justify-center cursor-pointer select-none"
                    >
                      -
                    </button>
                    <input
                      type="text"
                      value={settingsStr.scoreTrollWin}
                      onChange={(e) => handleInputChange("scoreTrollWin", e.target.value)}
                      className={`flex-1 text-center bg-val-black/50 border ${
                        validationErrors.scoreTrollWin ? "border-val-red" : "border-zinc-700 focus:border-val-cyan"
                      } text-val-light h-10 rounded font-mono focus:outline-none transition-colors text-sm`}
                    />
                    <button
                      type="button"
                      onClick={() => adjustSetting("scoreTrollWin", 1, 0, 10)}
                      className="w-10 h-10 bg-zinc-900 border border-zinc-800 hover:border-val-cyan hover:text-val-cyan text-zinc-400 font-bold rounded font-mono transition-all flex items-center justify-center cursor-pointer select-none"
                    >
                      +
                    </button>
                  </div>
                  {validationErrors.scoreTrollWin && (
                    <span className="text-[10px] text-val-red font-mono font-semibold block mt-0.5 animate-pulse">
                      ⚠️ {validationErrors.scoreTrollWin}
                    </span>
                  )}
                </div>

                {/* Q. 見破りボーナス */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-mono text-zinc-400 flex justify-between">
                    <span>トロール個別的中ボーナス (SPOTTED)</span>
                    <span className="text-[10px] text-zinc-550 font-mono">範囲: 0 - 10</span>
                  </label>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => adjustSetting("scoreSpottedBonus", -1, 0, 10)}
                      className="w-10 h-10 bg-zinc-900 border border-zinc-800 hover:border-val-red hover:text-val-red text-zinc-400 font-bold rounded font-mono transition-all flex items-center justify-center cursor-pointer select-none"
                    >
                      -
                    </button>
                    <input
                      type="text"
                      value={settingsStr.scoreSpottedBonus}
                      onChange={(e) => handleInputChange("scoreSpottedBonus", e.target.value)}
                      className={`flex-1 text-center bg-val-black/50 border ${
                        validationErrors.scoreSpottedBonus ? "border-val-red" : "border-zinc-700 focus:border-val-cyan"
                      } text-val-light h-10 rounded font-mono focus:outline-none transition-colors text-sm`}
                    />
                    <button
                      type="button"
                      onClick={() => adjustSetting("scoreSpottedBonus", 1, 0, 10)}
                      className="w-10 h-10 bg-zinc-900 border border-zinc-800 hover:border-val-cyan hover:text-val-cyan text-zinc-400 font-bold rounded font-mono transition-all flex items-center justify-center cursor-pointer select-none"
                    >
                      +
                    </button>
                  </div>
                  {validationErrors.scoreSpottedBonus && (
                    <span className="text-[10px] text-val-red font-mono font-semibold block mt-0.5 animate-pulse">
                      ⚠️ {validationErrors.scoreSpottedBonus}
                    </span>
                  )}
                </div>

                {/* 敗北時見破りボーナス適用トグル */}
                <div className="flex items-center gap-2.5 bg-val-black/45 border border-zinc-850 rounded px-4 py-3">
                  <input
                    type="checkbox"
                    id="enableSpottedBonusOnLose"
                    checked={enableSpottedBonusOnLose}
                    onChange={(e) => setEnableSpottedBonusOnLose(e.target.checked)}
                    className="w-4 h-4 text-val-cyan bg-val-black border-zinc-700 rounded focus:ring-val-cyan focus:outline-none accent-val-cyan cursor-pointer"
                  />
                  <label htmlFor="enableSpottedBonusOnLose" className="text-xs font-mono text-zinc-400 cursor-pointer select-none">
                    敗北した市民でもトロール的中時はボーナス適用
                  </label>
                </div>

              </div>

              {/* --- セクション2: アドバンスド・トロール人狼配点設定 --- */}
              <div className="space-y-4 pt-2">
                <h4 className="text-xs font-mono font-bold text-val-red tracking-widest border-b border-zinc-850 pb-1 uppercase">
                  2. PARTY & ADVANCED SCORE RULES
                </h4>
                <p className="text-[10px] text-zinc-500 font-mono leading-relaxed">
                  ※ マイナス・プラスを自由に調整可能。0点にするとそのルールは判定されません（範囲: -10 ～ 10）
                </p>

                {Object.keys(labelMap).map((key) => {
                  const settingKey = key as keyof typeof settingsStr;
                  const label = labelMap[key];
                  const isPenalty = label.includes("失点") || label.includes("ペナルティ");

                  return (
                    <div key={key} className="flex flex-col gap-1.5 bg-val-black/25 border border-zinc-900 rounded p-3">
                      <label className="text-xs font-mono text-zinc-300 flex justify-between">
                        <span>{label}</span>
                        <span className={`text-[10px] font-mono font-semibold ${isPenalty ? "text-val-red" : "text-val-cyan"}`}>
                          {isPenalty ? "PENALTY" : "BONUS"}
                        </span>
                      </label>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => adjustSetting(settingKey, -1, -10, 10)}
                          className="w-10 h-10 bg-zinc-900 border border-zinc-800 hover:border-val-red hover:text-val-red text-zinc-400 font-bold rounded font-mono transition-all flex items-center justify-center cursor-pointer select-none"
                        >
                          -
                        </button>
                        <input
                          type="text"
                          value={settingsStr[settingKey]}
                          onChange={(e) => handleInputChange(settingKey, e.target.value)}
                          className={`flex-1 text-center bg-val-black/50 border ${
                            validationErrors[settingKey] ? "border-val-red" : "border-zinc-700 focus:border-val-cyan"
                          } text-val-light h-10 rounded font-mono focus:outline-none transition-colors text-sm`}
                        />
                        <button
                          type="button"
                          onClick={() => adjustSetting(settingKey, 1, -10, 10)}
                          className="w-10 h-10 bg-zinc-900 border border-zinc-800 hover:border-val-cyan hover:text-val-cyan text-zinc-400 font-bold rounded font-mono transition-all flex items-center justify-center cursor-pointer select-none"
                        >
                          +
                        </button>
                      </div>
                      {validationErrors[settingKey] && (
                        <span className="text-[10px] text-val-red font-mono font-semibold block mt-0.5 animate-pulse">
                          ⚠️ {validationErrors[settingKey]}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

            </div>

            {/* モーダルフッター */}
            <div className="border-t border-zinc-800 pt-4 mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setIsSettingsModalOpen(false)}
                className="flex-1 py-2.5 border border-zinc-700 hover:border-zinc-550 text-zinc-400 font-bold rounded text-xs uppercase tracking-wider transition-colors cursor-pointer"
              >
                戻る
              </button>
              <button
                type="button"
                disabled={!isValid}
                onClick={handleStartGameFinal}
                className={`flex-1 py-2.5 font-black text-xs uppercase tracking-widest rounded border transition-all duration-300 ${
                  isValid
                    ? "bg-val-cyan text-val-black border-val-cyan hover:shadow-[0_0_15px_rgba(0,240,255,0.4)] cursor-pointer"
                    : "bg-zinc-850 text-zinc-500 border-zinc-900 cursor-not-allowed opacity-50"
                }`}
              >
                ゲームを開始する
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
