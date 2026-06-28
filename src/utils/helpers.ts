import { Player } from "@/types/game";

export const safeBtoa = (str: string): string => {
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

export const safeAtob = (str: string): string => {
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

export const getDefaultVoteFor = (players: Player[], playerId: string): string => {
  const other = players.find((op) => op.id !== playerId);
  return other ? other.id : "";
};
