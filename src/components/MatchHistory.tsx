import React, { useState } from "react";
import { GameState } from "@/types/game";

interface MatchHistoryProps {
  gameState: GameState;
}

export default function MatchHistory({ gameState }: MatchHistoryProps) {
  const [openAccordion, setOpenAccordion] = useState<number | null>(null);

  if (gameState.rounds.length === 0) return null;

  return (
    <div className="w-full mt-2 animate-fade-in">
      {/* glass-card を適用 */}
      <div className="glass-card rounded p-6 relative overflow-hidden val-clip-top-right transition-all duration-300 hover:shadow-[0_0_25px_rgba(255,255,255,0.02)]">
        <div className="absolute top-0 right-0 w-24 h-1 bg-zinc-650"></div>

        <h2 className="text-xl font-bold tracking-widest text-zinc-300 uppercase mb-2 flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          MATCH HISTORY
        </h2>
        <p className="text-xs text-zinc-550 mb-6 font-mono">過去ラウンドの役職・投票・ポイント獲得履歴</p>

        <div className="space-y-3">
          {gameState.rounds.map((round) => {
            const isOpen = openAccordion === round.roundNumber;
            const winnerText = round.winningTeam === "citizen" ? "市民チームの勝利" : "トロールの勝利";
            const winnerBadgeColor = round.winningTeam === "citizen" ? "bg-val-cyan/10 text-val-cyan border-val-cyan/20" : "bg-val-red/10 text-val-red border-val-red/20";
            
            // このラウンドでのトロールのエージェント情報を取得
            const trollPlayer = gameState.players.find((p) => p.id === round.trollPlayerId);
            const trollName = trollPlayer?.name || "不明";
            const trollInput = round.inputs[round.trollPlayerId];
            const trollRoundAgent = trollInput?.agent;

            // このラウンド単体での獲得スコアと最下位プレイヤーを計算
            const singleRoundScores = gameState.players.map((p) => {
              const input = round.inputs[p.id];
              return {
                name: p.name,
                score: input ? input.score : 0,
              };
            });
            const minSingleScore = Math.min(...singleRoundScores.map((s) => s.score));
            const singleRoundUnderdogs = singleRoundScores.filter((s) => s.score === minSingleScore);
            const singleUnderdogText = singleRoundUnderdogs.map((s) => s.name).join(", ");

            // このラウンド終了時点での各プレイヤーの累計スコアを計算
            const cumulativeScores: Record<string, number> = {};
            gameState.players.forEach((p) => {
              cumulativeScores[p.id] = 0;
            });

            for (let i = 0; i < round.roundNumber; i++) {
              const r = gameState.rounds[i];
              if (r) {
                gameState.players.forEach((p) => {
                  const input = r.inputs[p.id];
                  if (input) {
                    cumulativeScores[p.id] += input.score;
                  }
                });
              }
            }

            const scoresArray = Object.values(cumulativeScores);
            const minScoreAtRound = scoresArray.length > 0 ? Math.min(...scoresArray) : 0;
            const underdogPlayers = gameState.players.filter((p) => cumulativeScores[p.id] === minScoreAtRound);
            const underdogText = underdogPlayers.map((p) => p.name).join(", ");

            return (
              <div key={round.roundNumber} className="border border-zinc-850 rounded bg-val-black/40 overflow-hidden val-clip-path transition-all duration-300">
                
                {/* アコーディオンヘッダー */}
                <button
                  type="button"
                  onClick={() => setOpenAccordion(isOpen ? null : round.roundNumber)}
                  className="w-full px-5 py-3.5 flex items-center justify-between gap-4 text-left hover:bg-val-gray/15 transition-colors duration-200 cursor-pointer"
                >
                  <div className="flex flex-wrap items-center gap-4">
                    <span className="text-sm font-black font-mono text-val-red uppercase tracking-wider">
                      第 {round.roundNumber} 回戦
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 border rounded uppercase font-mono ${winnerBadgeColor}`}>
                      {winnerText}
                    </span>
                    <span className="text-xs text-zinc-400 flex items-center gap-1.5">
                      トロール:
                      {trollRoundAgent && (
                        <img
                          src={trollRoundAgent.displayIcon}
                          alt={trollName}
                          className="w-5 h-5 rounded border border-zinc-700 object-cover"
                        />
                      )}
                      <span className="font-semibold text-val-light">{trollName}</span>
                    </span>
                    <span className="text-xs text-zinc-550 font-mono hidden md:inline-block border-l border-zinc-800 pl-3">
                      この回最下位: <span className="text-zinc-400 font-bold">{singleUnderdogText}</span> ({minSingleScore}点)
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-zinc-550 font-mono uppercase">{isOpen ? "CLOSE" : "DETAILS"}</span>
                    <svg
                      className={`w-4 h-4 text-zinc-550 transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>

                {/* アコーディオン詳細パネル */}
                {isOpen && (
                  <div className="px-5 pb-5 pt-2 border-t border-zinc-900 bg-val-black/60 space-y-3">
                    <div className="flex flex-wrap items-center justify-between border-b border-zinc-900/60 pb-2 text-[10px] font-mono text-zinc-550">
                      <span>ROUND SUMMARY</span>
                      <span>
                        このラウンド終了時の最下位: <span className="text-val-cyan font-bold">{underdogText}</span> (累計 {minScoreAtRound} 点)
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-5 gap-3.5 mt-2">
                      {gameState.players.map((p) => {
                        const input = round.inputs[p.id];
                        if (!input) return null;
                        
                        const isTroll = input.role === "troll";
                        const votedPlayer = gameState.players.find((vp) => vp.id === input.votedFor);
                        const votedName = votedPlayer?.name || "未投票";
                        const votedPlayerInput = round.inputs[input.votedFor];
                        const votedPlayerRoundAgent = votedPlayerInput?.agent;

                        const isWin = isTroll
                          ? round.winningTeam === "troll"
                          : round.winningTeam === "citizen";
                          
                        // トロール見破り成否
                        const isVotedTrollCorrect = !isTroll && input.votedFor === round.trollPlayerId;

                        return (
                          <div key={p.id} className="p-3.5 bg-val-gray/15 border border-zinc-800/60 rounded val-clip-path flex flex-col justify-between transition-colors hover:border-zinc-700">
                            <div>
                              <div className="flex justify-between items-center mb-2 gap-1">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  {input.agent && (
                                    <img
                                      src={input.agent.displayIcon}
                                      alt={p.name}
                                      className="w-5 h-5 rounded border border-zinc-800 object-cover flex-shrink-0"
                                    />
                                  )}
                                  <span className="font-bold text-xs tracking-wide text-val-light truncate">
                                    {p.name}
                                  </span>
                                </div>
                                
                                {isTroll ? (
                                  <span className="text-[9px] font-mono font-bold bg-val-red/20 text-val-red border border-val-red/35 px-1.5 py-0.2 rounded flex-shrink-0">
                                    TROLL
                                  </span>
                                ) : (
                                  <span className="text-[9px] font-mono bg-zinc-800 text-zinc-400 px-1.5 py-0.2 rounded flex-shrink-0">
                                    CITIZEN
                                  </span>
                                )}
                              </div>

                              {/* 投票と勝敗のログ */}
                              <div className="space-y-1.5 text-[10px] text-zinc-450 font-mono">
                                <div className="flex flex-wrap items-center gap-1">
                                  <span>投票:</span>
                                  {votedPlayerRoundAgent && (
                                    <img
                                      src={votedPlayerRoundAgent.displayIcon}
                                      alt={votedName}
                                      className="w-4 h-4 rounded border border-zinc-800 object-cover flex-shrink-0"
                                    />
                                  )}
                                  <span className={`font-semibold ${isVotedTrollCorrect ? "text-val-cyan" : "text-zinc-400"} truncate max-w-[55px]`}>
                                    {votedName}
                                  </span>
                                  {isVotedTrollCorrect && (
                                    <span className="text-[8px] bg-val-cyan/15 text-val-cyan border border-val-cyan/20 px-1 rounded flex-shrink-0">
                                      的中
                                    </span>
                                  )}
                                </div>
                                <div>
                                  結果: <span className={isWin ? "text-val-cyan font-bold" : "text-zinc-600"}>{isWin ? "WIN" : "LOSE"}</span>
                                </div>
                              </div>
                            </div>

                            <div className="mt-3 pt-2 border-t border-zinc-900/80 flex justify-between items-end">
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
  );
}
