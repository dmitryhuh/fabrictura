export const giftUrl = (path: string) =>
  `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/gifts/${path}`;

export type GiftModel = { id: string; name: string; lottie_path: string; png_path: string | null };
export type GiftBackdrop = {
  id: number;
  name: string;
  center_color: string;
  edge_color: string;
  pattern_color: string;
  text_color: string;
};
export type GiftPattern = { id: number; key: string; name: string; png_path: string | null };
export type Collection = {
  id: string;
  name: string;
  price: number;
  upgrade_price: number;
  supply: number;
  sold: number;
  upgraded: number;
  active: boolean;
  base: GiftModel | null;
};
export type UserGift = {
  id: string;
  number: number | null;
  message: string | null;
  created_at: string;
  upgraded_at: string | null;
  owner_id: string;
  collection: Collection;
  model: GiftModel | null;
  backdrop: GiftBackdrop | null;
  pattern: GiftPattern | null;
  sender: { username: string; display_name: string | null } | null;
  owner: { username: string; display_name: string | null } | null;
  hidden: boolean;
};

export type PinnedGift = {
  id: string;
  model: GiftModel | null;
  collection: { base: GiftModel | null } | null;
};

export type Badge = "staff" | "official";

export const COLLECTION_SELECT =
  "id, name, price, upgrade_price, supply, sold, upgraded, active, base:gift_models!base_model_id(id, name, lottie_path, png_path)";

export const GIFT_SELECT = [
  "id, number, message, created_at, upgraded_at, owner_id, hidden",
  `collection:gift_collections!collection_id(${COLLECTION_SELECT})`,
  "model:gift_models!model_id(id, name, lottie_path, png_path)",
  "backdrop:gift_backdrops!backdrop_id(id, name, center_color, edge_color, pattern_color, text_color)",
  "pattern:gift_patterns!pattern_id(id, key, name, png_path)",
  "sender:profiles!sender_id(username, display_name)",
  "owner:profiles!owner_id(username, display_name)",
].join(", ");

export const PINNED_SELECT =
  "pinned:user_gifts!pinned_gift_id(id, model:gift_models!model_id(id, name, lottie_path, png_path), collection:gift_collections!collection_id(base:gift_models!base_model_id(id, name, lottie_path, png_path)))";