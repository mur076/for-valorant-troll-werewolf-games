import React, { useState, useMemo } from "react";
import { GameState, AgentData } from "@/types/game";
import { getDefaultVoteFor } from "@/utils/helpers";

interface RoundInputFormProps {
  gameState: GameState;
  agents: AgentData[];
  onConfirmRound: (
    trollPlayerId: string,
    winningTeam: "citizen" | "troll",
    votes: Record<string, string>,
    roundAgents: Record<string, string>,
    isObviousTroll: boolean,
    isArtisticTroll: boolean
  ) => void;
  isReadOnly: boolean;
}

export default function RoundInputForm({ gameState, agents, onConfirmRound, isReadOnly }: RoundInputFormProps) {
  const [roundTrollId, setRoundTrollId] = useState<string>(gameState.players[0]?.id || "p1");
  const [roundWinningTeam, setRoundWinningTeam] = useState<"citizen" | "troll">("citizen");
  
  // トロール特別評価用オプションフラグ
  const [isObviousTroll, setIsObviousTroll] = useState(false);
  const [isArtisticTroll, setIsArtisticTroll] = useState(false);

  // 各プレイヤーの投票先初期状態を設定
  const [roundVotes, setRoundVotes] = useState<Record<string, string>>(() => {
    const initialVotes: Record<string, string> = {};
    gameState.players.forEach((p) => {
      initialVotes[p.id] = getDefaultVoteFor(gameState.players, p.id);
    });
    return initialVotes;
  });

  // 各プレイヤーのこのラウンドでのエージェント選択状態 (プレイヤーID -> エージェントUUID)
  const [roundAgents, setRoundAgents] = useState<Record<string, string>>(() => {
    const initialAgents: Record<string, string> = {};
    gameState.players.forEach((p) => {
      initialAgents[p.id] = p.agent?.uuid || "";
    });
    return initialAgents;
  });

  // モーダル制御
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activePlayerId, setActivePlayerId] = useState<string | null>(null);

  // エージェント取得ヘルパー
  const getPlayerRoundAgent = (playerId: string) => {
    const uuid = roundAgents[playerId];
    return agents.find((a) => a.uuid === uuid);
  };

  const handleVoteChange = (voterId: string, targetId: string) => {
    if (voterId === targetId) return; // 自己投票はブロック
    setRoundVotes((prev) => ({
      ...prev,
      [voterId]: targetId,
    }));
  };

  const handleSelectAgent = (agentUuid: string) => {
    if (!activePlayerId) return;
    const nextAgents = { ...roundAgents };
    
    const existingEntry = Object.entries(nextAgents).find(([pid, uuid]) => uuid === agentUuid && pid !== activePlayerId);
    if (existingEntry) {
      nextAgents[existingEntry[0]] = "";
    }
    
    nextAgents[activePlayerId] = agentUuid;
    setRoundAgents(nextAgents);
    setIsModalOpen(false);
    setActivePlayerId(null);
  };

  const openAgentModal = (playerId: string) => {
    setActivePlayerId(playerId);
    setIsModalOpen(true);
  };

  // エージェントの重複なし全員選択のバリデーション
  const isAgentsValid = useMemo(() => {
    const uuids = Object.values(roundAgents).filter(Boolean);
    return uuids.length === 5 && new Set(uuids).size === 5;
  }, [roundAgents]);

  const handleConfirm = () => {
    if (!isAgentsValid) return;

    const finalVotes = { ...roundVotes };
    gameState.players.forEach((p) => {
      if (!finalVotes[p.id] || finalVotes[p.id] === p.id) {
        finalVotes[p.id] = getDefaultVoteFor(gameState.players, p.id);
      }
    });

    onConfirmRound(roundTrollId, roundWinningTeam, finalVotes, roundAgents, isObviousTroll, isArtisticTroll);
  };

  // すでに選択されているエージェントのUUIDリストを取得
  const getSelectedUuids = () => {
    return Object.values(roundAgents).filter(Boolean);
  };

  const selectedTrollPlayer = gameState.players.find((p) => p.id === roundTrollId);

  return (
    <>
      <div className="glass-card rounded p-6 relative overflow-hidden val-clip-top-right transition-all duration-300 hover:shadow-[0_0_25px_rgba(255,70,85,0.05)]">
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
            {gameState.currentRound}<span className="text-zinc-600 text-sm">/{gameState.settings.maxRounds}</span>
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
          
          {/* Q0. 今ラウンドのエージェント割り当て */}
          <div className="border-b border-zinc-850 pb-5">
            <label className="text-xs font-mono text-val-cyan tracking-wider uppercase block mb-3">
              Q0. 各プレイヤーの使用エージェントを選択してください
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
              {gameState.players.map((p) => {
                const roundAgent = getPlayerRoundAgent(p.id);
                return (
                  <div key={p.id} className="bg-val-black/30 border border-zinc-850 p-2.5 rounded flex flex-col items-center justify-between gap-2 val-clip-path">
                    <span className="text-[10px] font-mono text-zinc-400 truncate max-w-[80px] w-full text-center">
                      {p.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => openAgentModal(p.id)}
                      className={`w-14 h-14 rounded border flex items-center justify-center transition-all overflow-hidden cursor-pointer ${
                        roundAgent
                          ? "border-val-cyan bg-zinc-950 hover:border-val-red hover:shadow-[0_0_10px_rgba(0,240,255,0.2)]"
                          : "border-zinc-800 bg-zinc-950/70 text-zinc-600 hover:border-val-cyan hover:text-val-cyan"
                      }`}
                      title={roundAgent ? `${roundAgent.displayName} を選択中` : "エージェントを選択"}
                    >
                      {roundAgent ? (
                        <img
                          src={roundAgent.displayIcon}
                          alt={roundAgent.displayName}
                          className="w-full h-full object-cover scale-110"
                        />
                      ) : (
                        <svg className="w-6 h-6 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                        </svg>
                      )}
                    </button>
                    <span className="text-[10px] font-bold text-zinc-300 tracking-wide truncate max-w-[80px]">
                      {roundAgent ? roundAgent.displayName : "未選択"}
                    </span>
                  </div>
                );
              })}
            </div>
            {!isAgentsValid && (
              <span className="text-[10px] text-val-red font-mono font-semibold block mt-2.5">
                ⚠️ 全員のエージェントを重複なく選択してください（確定するには必須です）
              </span>
            )}
          </div>

          {/* Q1. 本当のトロールは誰？ */}
          <div>
            <label className="text-xs font-mono text-val-red tracking-wider uppercase block mb-2.5">
              Q1. 本当のトロールは誰でしたか？
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {gameState.players.map((p) => {
                const roundAgent = getPlayerRoundAgent(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setRoundTrollId(p.id)}
                    className={`py-2.5 px-2 text-xs font-bold border rounded transition-all duration-200 val-clip-path flex flex-col items-center gap-1.5 cursor-pointer ${
                      roundTrollId === p.id
                        ? "bg-val-red border-val-red text-val-light shadow-md shadow-val-red/10 hover:shadow-[0_0_10px_rgba(255,70,85,0.3)]"
                        : "bg-val-black/60 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-val-light"
                    }`}
                  >
                    {roundAgent ? (
                      <img
                        src={roundAgent.displayIcon}
                        alt={p.name}
                        className="w-8 h-8 rounded border border-zinc-800 bg-zinc-900 object-cover"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded border border-zinc-850 bg-zinc-900 flex items-center justify-center text-zinc-500 font-bold font-mono">
                        ?
                      </div>
                    )}
                    <span className="truncate max-w-[80px] text-[11px]">{p.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Q2. どちらが勝ちましたか？ */}
          <div>
            <label className="text-xs font-mono text-val-red tracking-wider uppercase block mb-2.5">
              Q2. どちらのチームが勝利しましたか？
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setRoundWinningTeam("citizen")}
                className={`py-3 px-4 text-xs font-black border rounded tracking-widest uppercase transition-all duration-200 val-clip-path cursor-pointer ${
                  roundWinningTeam === "citizen"
                    ? "bg-val-cyan/15 border-val-cyan text-val-cyan shadow-md shadow-val-cyan/5 hover:shadow-[0_0_15px_rgba(0,240,255,0.2)]"
                    : "bg-val-black/60 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-val-light"
                }`}
              >
                市民チームの勝ち
              </button>
              <button
                type="button"
                onClick={() => setRoundWinningTeam("troll")}
                className={`py-3 px-4 text-xs font-black border rounded tracking-widest uppercase transition-all duration-200 val-clip-path cursor-pointer ${
                  roundWinningTeam === "troll"
                    ? "bg-val-red/15 border-val-red text-val-red shadow-md shadow-val-red/5 hover:shadow-[0_0_15px_rgba(255,70,85,0.2)]"
                    : "bg-val-black/60 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-val-light"
                }`}
              >
                トロールの勝ち
              </button>
            </div>
          </div>

          {/* Q2.5. トロールプレイ特別評価 (アドバンスド新仕様) */}
          <div className="border-t border-b border-zinc-900 py-4">
            <label className="text-xs font-mono text-zinc-400 tracking-wider uppercase block mb-2.5 flex justify-between">
              <span>Q2.5. トロールプレイ評価 (オプション)</span>
              <span className="text-[10px] text-zinc-550 font-mono">
                対象: {selectedTrollPlayer?.name || "トロール"}
              </span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setIsObviousTroll(!isObviousTroll)}
                className={`py-2 px-3 text-xs font-bold border rounded transition-all duration-200 val-clip-path cursor-pointer flex items-center justify-center gap-1.5 ${
                  isObviousTroll
                    ? "bg-val-red/25 border-val-red text-val-red shadow-[0_0_10px_rgba(255,70,85,0.2)]"
                    : "bg-val-black/45 border-zinc-800 text-zinc-500 hover:border-zinc-700"
                }`}
              >
                <span>⚠️</span>
                バレバレ戦犯 (失点: {gameState.settings.scoreTrollObviousPenalty}点)
              </button>
              <button
                type="button"
                onClick={() => setIsArtisticTroll(!isArtisticTroll)}
                className={`py-2 px-3 text-xs font-bold border rounded transition-all duration-200 val-clip-path cursor-pointer flex items-center justify-center gap-1.5 ${
                  isArtisticTroll
                    ? "bg-yellow-500/15 border-yellow-500/70 text-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.2)]"
                    : "bg-val-black/45 border-zinc-800 text-zinc-500 hover:border-zinc-700"
                }`}
              >
                <span>✨</span>
                芸術的神プレイ (ボーナス: +{gameState.settings.scoreTrollArtisticBonus}点)
              </button>
            </div>
          </div>

          {/* Q3. 各プレイヤーのトロール投票先 */}
          <div>
            <div className="flex justify-between items-center mb-2.5">
              <label className="text-xs font-mono text-val-red tracking-wider uppercase">
                Q3. 各プレイヤーがトロールだと思って投票した相手は？
              </label>
              <span className="text-[10px] text-zinc-500 font-mono">
                的中時ボーナス +{gameState.settings.scoreSpottedBonus}点 
                {gameState.settings.enableSpottedBonusOnLose && " (敗北時も適用)"}
              </span>
            </div>

            <div className="space-y-3 bg-val-black/40 border border-zinc-800/80 rounded p-4">
              {gameState.players.map((p) => {
                const isThisPlayerTroll = p.id === roundTrollId;
                const currentVote = roundVotes[p.id] || getDefaultVoteFor(gameState.players, p.id);
                const voterRoundAgent = getPlayerRoundAgent(p.id);

                return (
                  <div key={p.id} className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 py-2 border-b border-zinc-900/60 last:border-0">
                    <div className="flex items-center gap-2.5">
                      {voterRoundAgent ? (
                        <img
                          src={voterRoundAgent.displayIcon}
                          alt={p.name}
                          className="w-7 h-7 rounded border border-zinc-800 bg-zinc-900 object-cover"
                        />
                      ) : (
                        <div className="w-7 h-7 rounded border border-zinc-850 bg-zinc-900 flex items-center justify-center text-[10px] text-zinc-500 font-bold font-mono">
                          ?
                        </div>
                      )}
                      <span className="text-xs font-semibold tracking-wide text-zinc-200">
                        {p.name}
                      </span>
                      {isThisPlayerTroll ? (
                        <span className="text-[9px] font-mono bg-val-red/20 text-val-red px-2 py-0.5 rounded border border-val-red/30">
                          TROLL
                        </span>
                      ) : (
                        <span className="text-[9px] font-mono bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded">
                          CITIZEN
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 mt-1 xl:mt-0">
                      <span className="text-[10px] text-zinc-550 font-mono uppercase mr-1 flex-shrink-0">VOTE FOR:</span>
                      <div className="flex flex-wrap gap-1.5">
                        {gameState.players
                          .filter((other) => other.id !== p.id)
                          .map((other) => {
                            const isSelected = currentVote === other.id;
                            const otherRoundAgent = getPlayerRoundAgent(other.id);

                            return (
                              <button
                                key={other.id}
                                type="button"
                                onClick={() => handleVoteChange(p.id, other.id)}
                                className={`w-28 h-8 rounded border flex items-center gap-1.5 px-2 transition-all duration-200 cursor-pointer ${
                                  isSelected
                                    ? "border-val-red bg-val-red/25 scale-95 shadow-[0_0_8px_rgba(255,70,85,0.2)]"
                                    : "border-zinc-800 bg-val-black hover:border-zinc-650 hover:bg-zinc-950"
                                }`}
                                title={`${other.name}に投票`}
                              >
                                {otherRoundAgent ? (
                                  <img
                                    src={otherRoundAgent.displayIcon}
                                    alt={other.name}
                                    className="w-5 h-5 rounded border border-zinc-850 object-cover flex-shrink-0"
                                  />
                                ) : (
                                  <div className="w-5 h-5 rounded bg-zinc-800 flex items-center justify-center text-[9px] font-black text-zinc-500 flex-shrink-0 font-mono">
                                    ?
                                  </div>
                                )}
                                <span className="text-[10px] font-bold text-zinc-300 truncate flex-1 text-left">
                                  {other.name}
                                </span>
                              </button>
                            );
                          })}
                      </div>
                    </div>

                  </div>
                );
              })}
            </div>
          </div>

          {/* 確定ボタン */}
          <button
            type="button"
            disabled={!isAgentsValid}
            onClick={handleConfirm}
            className={`w-full mt-4 text-val-light font-black text-sm uppercase tracking-widest py-3 transition-all duration-300 val-clip-button border-b-4 border-black/40 shadow-xl flex justify-center items-center gap-2 ${
              isAgentsValid
                ? "bg-val-red hover:bg-val-red/90 hover:shadow-[0_0_15px_rgba(255,70,85,0.4)] cursor-pointer"
                : "bg-zinc-850 text-zinc-500 border-zinc-900 cursor-not-allowed opacity-50 shadow-none"
            }`}
          >
            第 {gameState.currentRound} 回戦を確定する
          </button>
        </div>
      )}
      </div>

      {/* エージェント選択モーダル (親の overflow-hidden の外に出すことで、切り取られバグを完全防止) */}
      {isModalOpen && activePlayerId !== null && (
        <div className="fixed inset-0 bg-val-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-val-dark border border-val-cyan max-w-2xl w-full rounded p-6 shadow-2xl relative max-h-[85vh] flex flex-col val-clip-top-right">
            
            <div className="flex justify-between items-center border-b border-zinc-800 pb-4 mb-4">
              <div>
                <h3 className="text-lg font-black tracking-wider text-val-cyan uppercase">
                  SELECT ROUND AGENT
                </h3>
                <p className="text-xs text-zinc-500 font-mono">
                  このプレイヤーがこのラウンドで使用したエージェントを選択してください
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsModalOpen(false);
                  setActivePlayerId(null);
                }}
                className="text-zinc-500 hover:text-val-red font-bold font-mono text-xs px-2.5 py-1.5 border border-zinc-850 hover:border-val-red rounded transition-colors cursor-pointer"
              >
                ✕ CLOSE
              </button>
            </div>

            {/* エージェントグリッド領域 (スクロールとグリッド計算を分離して崩れを防止) */}
            <div className="overflow-y-auto flex-1 pr-1 scrollbar-thin">
              <div className="grid grid-cols-4 sm:grid-cols-5 gap-[3.5%] py-2">
                {agents.length === 0 ? (
                  <div className="col-span-full py-12 text-center text-zinc-500 font-mono text-sm">
                    エージェント情報を読み込めませんでした。
                  </div>
                ) : (
                  agents.map((agent) => {
                    const isSelectedByOther = getSelectedUuids().includes(agent.uuid) && roundAgents[activePlayerId] !== agent.uuid;
                    const isSelectedBySelf = roundAgents[activePlayerId] === agent.uuid;

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
              <span>* 1ラウンド内で重複したエージェントは選択できません</span>
              {roundAgents[activePlayerId] && (
                <button
                  type="button"
                  onClick={() => {
                    const nextAgents = { ...roundAgents };
                    nextAgents[activePlayerId] = "";
                    setRoundAgents(nextAgents);
                    setIsModalOpen(false);
                    setActivePlayerId(null);
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
    </>
  );
}
