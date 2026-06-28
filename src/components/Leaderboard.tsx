import React, { useMemo } from "react";
import { GameState, Player } from "@/types/game";

interface LeaderboardProps {
  gameState: GameState;
}

export default function Leaderboard({ gameState }: LeaderboardProps) {
  const rankedPlayers = useMemo(() => {
    return [...gameState.players].sort((a, b) => b.totalScore - a.totalScore);
  }, [gameState.players]);

  const underdogScore = useMemo(() => {
    if (gameState.rounds.length === 0) return -1;
    return Math.min(...gameState.players.map((p) => p.totalScore));
  }, [gameState.players, gameState.rounds]);

  // エージェントのグラデーション背景を生成するヘルパー (グラスモルフィズムに馴染むよう透明度を微調整)
  const getAgentGradient = (player: Player, opacityHex1 = "20", opacityHex2 = "05") => {
    if (!player.agent || !player.agent.backgroundGradientColors || player.agent.backgroundGradientColors.length < 2) {
      return {};
    }
    const colors = player.agent.backgroundGradientColors;
    const color1 = colors[0].slice(0, 6);
    const color2 = colors[1].slice(0, 6);
    return {
      background: `linear-gradient(135deg, #${color1}${opacityHex1}, #${color2}${opacityHex2})`,
    };
  };

  return (
    <div className="glass-card rounded p-6 relative overflow-hidden val-clip-top-right transition-all duration-300 hover:shadow-[0_0_30px_rgba(0,240,255,0.06)]">
      <div className="absolute top-0 right-0 w-24 h-1 bg-val-cyan"></div>
      
      <h2 className="text-xl font-bold tracking-widest text-val-cyan uppercase mb-2 flex items-center gap-2">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 00.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138z" />
        </svg>
        REAL-TIME LEADERBOARD
      </h2>
      <p className="text-xs text-zinc-450 mb-6 font-mono uppercase tracking-wider">
        SETTINGS: {gameState.settings.maxRounds} ROUNDS
      </p>

      {/* スコアリスト */}
      <div className="space-y-4">
        {rankedPlayers.map((player, index) => {
          const rank = index + 1;
          let rankBadgeClass = "bg-zinc-800/80 text-zinc-400 border border-zinc-700/50";
          let rankIcon = "";
          let borderClass = "border-zinc-850 bg-val-black/45";
          let textClass = "text-zinc-200";

          // 1〜3位の装飾設定
          if (rank === 1) {
            // 1位ゴールドバッジの視認性改善: 太めの高輝度枠(border-2 border-yellow-100)と強力な発光(shadow)を追加
            rankBadgeClass = "bg-yellow-400 text-val-black font-black border-2 border-yellow-100 shadow-[0_0_15px_rgba(250,204,21,0.55)]";
            rankIcon = "👑";
            borderClass = "border-yellow-500/40 bg-yellow-500/5";
            textClass = "text-yellow-400";
          } else if (rank === 2) {
            // 2位シルバーの視認性改善: コントラストを高め、白銀のグローを適用
            rankBadgeClass = "bg-zinc-100 text-val-black font-black border border-white/60 shadow-[0_0_10px_rgba(255,255,255,0.2)]";
            rankIcon = "🥈";
            borderClass = "border-white/20 bg-white/5";
            textClass = "text-white font-semibold";
          } else if (rank === 3) {
            rankBadgeClass = "bg-amber-700 text-val-light font-black border border-amber-600/40";
            rankIcon = "🥉";
            borderClass = "border-amber-700/35";
            textClass = "text-amber-500";
          }

          // 最下位(UNDERDOG)の判定
          const isUnderdog = underdogScore !== -1 && player.totalScore === underdogScore;
          if (isUnderdog) {
            borderClass = "border-red-500/35 bg-red-950/5";
          }

          // エージェントのグラデーション背景スタイル
          const customBgStyle = getAgentGradient(player, rank === 1 ? "25" : rank === 2 ? "20" : "15", "03");

          return (
            <div
              key={player.id}
              style={customBgStyle}
              className={`relative flex items-center justify-between p-4 border rounded transition-all duration-300 val-clip-path overflow-hidden group ${borderClass} ${
                rank === 1
                  ? "hover:shadow-[0_0_20px_rgba(234,179,8,0.18)] hover:border-yellow-500/60"
                  : rank === 2
                  ? "hover:shadow-[0_0_20px_rgba(255,255,255,0.12)] hover:border-white/40"
                  : isUnderdog
                  ? "hover:shadow-[0_0_20px_rgba(239,68,68,0.12)] hover:border-red-500/50"
                  : "hover:shadow-[0_0_20px_rgba(0,240,255,0.08)] hover:border-val-cyan/40"
              }`}
            >
              {/* 1位エージェントの全身立ち絵 (崩れ防止：ラッパーdivを排除しアスペクト比を維持するimg直接指定) */}
              {rank === 1 && player.agent?.fullPortrait && (
                <img
                  src={player.agent.fullPortrait}
                  alt={player.agent.displayName}
                  className="absolute right-0 bottom-0 h-[140%] w-auto opacity-20 pointer-events-none select-none z-0 object-contain object-right-bottom translate-y-3 translate-x-1.5 hidden sm:block transition-transform duration-700 group-hover:scale-105 group-hover:translate-y-2"
                />
              )}

              <div className="flex items-center gap-3 relative z-10">
                {/* 順位バッジ */}
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-mono font-bold ${rankBadgeClass}`}>
                  {rank}
                </span>

                {/* エージェントミニアイコン */}
                {player.agent && (
                  <div className="w-10 h-10 rounded border border-zinc-700 overflow-hidden bg-val-black/80 flex-shrink-0 flex items-center justify-center transition-all group-hover:border-zinc-550">
                    <img
                      src={player.agent.displayIcon}
                      alt={player.agent.displayName}
                      className="w-full h-full object-cover scale-110"
                    />
                  </div>
                )}

                <div className="flex flex-col">
                  <span className={`font-bold tracking-wide text-sm flex items-center gap-1.5 ${textClass}`}>
                    {player.name}
                    {rankIcon && <span className="text-xs">{rankIcon}</span>}
                    {isUnderdog && (
                      <span className="text-[9px] font-mono font-bold bg-red-950/80 text-red-400 border border-red-800/40 px-1.5 py-0.2 rounded ml-1 animate-pulse">
                        UNDERDOG💀
                      </span>
                    )}
                  </span>
                  <span className="text-[10px] text-zinc-500 font-mono">
                    {player.agent ? `${player.agent.displayName} (${player.id.toUpperCase()})` : `PLAYER ID: ${player.id.toUpperCase()}`}
                  </span>
                </div>
              </div>

              <div className="text-right relative z-10">
                <span className="text-xl font-bold font-mono text-val-cyan tracking-wider group-hover:text-val-cyan-light transition-colors">
                  {player.totalScore}
                </span>
                <span className="text-[10px] text-zinc-500 font-mono ml-1">PTS</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
