"use client";

import { useState, useEffect, useCallback, useTransition, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  FiUser,
  FiMapPin,
  FiEdit3,
  FiHome,
  FiCheck,
  FiLoader,
  FiMap,
  FiExternalLink,
} from "react-icons/fi";
import { FaFax } from "react-icons/fa";
import { updateCustomer } from "@/app/(crm)/book/[book_id]/customer/[customer_id]/actions";
import { useAuthStore } from "@/store/authStore";

interface Customer {
  id: string;
  bookId: string;
  phone: string;
  category: string;
  name: string;
  corporation: string;
  address: string;
  memo: string;
  mail: string;
}

interface CustomerInfoCardProps {
  customer?: Customer | null;
  onCustomerUpdate?: (customer: Customer) => void;
}

/* ---------- 店舗写真 / Street View / Map プレビュー ---------- */

const MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";
const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8082";

type ViewMode = "place" | "streetview" | "map";

interface PlaceInfo {
  placeId: string;
  name: string;
  formattedAddress: string;
  rating?: number;
  userRatingsTotal?: number;
  types: string[];
  businessStatus: string;
  url: string;
  formattedPhoneNumber: string;
  website: string;
  photoUrls: string[];
  openingHours?: { openNow: boolean; weekdayText: string[] };
  fetchedAt: string;
}

function AddressMapPreview({ customerId, address }: { customerId: string; address: string }) {
  const accessToken = useAuthStore((s) => s.user?.accessToken);
  const [mode, setMode] = useState<ViewMode>("place");
  const [place, setPlace] = useState<PlaceInfo | null>(null);
  const [placeLoading, setPlaceLoading] = useState(false);
  const [placeChecked, setPlaceChecked] = useState(false);
  const [photoIdx, setPhotoIdx] = useState(0);
  const [svFailed, setSvFailed] = useState(false);
  const trimmed = address.trim();

  // customerId が変わったらリセット
  useEffect(() => {
    setPlace(null);
    setPlaceChecked(false);
    setPhotoIdx(0);
    setSvFailed(false);
    setMode("place");
  }, [customerId]);

  // バックエンド RPC でキャッシュ済み Business Profile を取得
  const fetchPlace = useCallback(async (refresh = false) => {
    if (!accessToken || !customerId) return;
    setPlaceLoading(true);
    try {
      const endpoint = refresh
        ? "googleplace.v1.GooglePlaceService/RefreshGooglePlaceInfo"
        : "googleplace.v1.GooglePlaceService/GetGooglePlaceInfo";
      const r = await fetch(`${API_URL}/${endpoint}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ customerId }),
      });
      if (!r.ok) throw new Error("fetch failed");
      const data = await r.json();
      const p = data.place;
      if (p && p.placeId) {
        setPlace({
          placeId: p.placeId || "",
          name: p.name || "",
          formattedAddress: p.formattedAddress || "",
          rating: p.rating ?? undefined,
          userRatingsTotal: p.userRatingsTotal ?? undefined,
          types: p.types || [],
          businessStatus: p.businessStatus || "",
          url: p.url || "",
          formattedPhoneNumber: p.formattedPhoneNumber || "",
          website: p.website || "",
          photoUrls: p.photoUrls || [],
          openingHours: p.openingHours ?? undefined,
          fetchedAt: p.fetchedAt || "",
        });
        setMode("place");
      } else {
        setPlace(null);
        setMode("streetview");
      }
    } catch {
      setPlace(null);
      setMode("streetview");
    } finally {
      setPlaceLoading(false);
      setPlaceChecked(true);
    }
  }, [accessToken, customerId]);

  useEffect(() => {
    if (!placeChecked) fetchPlace(false);
  }, [placeChecked, fetchPlace]);

  if (!trimmed && !customerId) return null;

  const encoded = encodeURIComponent(trimmed);
  const hasKey = !!MAPS_API_KEY;

  const streetViewImgUrl = hasKey && trimmed
    ? `https://maps.googleapis.com/maps/api/streetview?size=600x340&location=${encoded}&source=outdoor&key=${MAPS_API_KEY}`
    : null;

  const mapEmbedUrl = hasKey && trimmed
    ? `https://www.google.com/maps/embed/v1/place?key=${MAPS_API_KEY}&q=${encoded}&zoom=16`
    : trimmed ? `https://maps.google.com/maps?q=${encoded}&z=16&output=embed` : "";

  const googleMapsLink = place?.url || (trimmed ? `https://www.google.com/maps/search/?api=1&query=${encoded}` : "");

  const hasPlace = place && place.photoUrls.length > 0;
  const hasSV = hasKey && !svFailed && !!trimmed;

  const tabs: { key: ViewMode; label: string }[] = [];
  if (hasPlace) tabs.push({ key: "place", label: "店舗写真" });
  if (hasSV) tabs.push({ key: "streetview", label: "ストリートビュー" });
  if (trimmed) tabs.push({ key: "map", label: "マップ" });

  const activeMode = tabs.find((t) => t.key === mode) ? mode : tabs[0]?.key ?? "map";

  if (!trimmed && !place) return null;

  return (
    <div className="mt-2 rounded-xl overflow-hidden border border-gray-200 bg-gray-50">
      {/* タブ + リフレッシュ + Google Maps リンク */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-gray-100/80 border-b border-gray-200">
        <div className="flex items-center gap-1">
          {placeLoading ? (
            <span className="text-[11px] text-gray-400 flex items-center gap-1">
              <FiLoader className="w-3 h-3 animate-spin" />読み込み中
            </span>
          ) : tabs.length > 1 ? (
            tabs.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setMode(t.key)}
                className={`text-[11px] px-2 py-0.5 rounded-md transition-colors ${
                  activeMode === t.key
                    ? "bg-white text-gray-800 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {t.label}
              </button>
            ))
          ) : (
            <span className="text-[11px] text-gray-500 flex items-center gap-1">
              <FiMap className="w-3 h-3" />{tabs[0]?.label ?? "マップ"}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fetchPlace(true)}
            disabled={placeLoading}
            className="text-[11px] text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
            title="店舗情報を再取得"
          >
            ↻
          </button>
          {googleMapsLink && (
            <a
              href={googleMapsLink}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-blue-500 hover:text-blue-600 flex items-center gap-0.5"
            >
              Google Maps
              <FiExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      </div>

      {/* 店舗情報バー */}
      {activeMode === "place" && place && (
        <div className="px-3 py-2 bg-white border-b border-gray-100 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-700 truncate">{place.name}</span>
            {place.rating != null && (
              <span className="text-[11px] text-gray-500 flex items-center gap-0.5 flex-shrink-0">
                <span className="text-yellow-500">★</span>
                {place.rating}
                {place.userRatingsTotal != null && (
                  <span className="text-gray-400">({place.userRatingsTotal})</span>
                )}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] text-gray-500">
            {place.formattedPhoneNumber && (
              <span className="flex items-center gap-1">
                📞 {place.formattedPhoneNumber}
              </span>
            )}
            {place.website && (
              <a href={place.website} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-600 truncate max-w-[180px]">
                🌐 {place.website.replace(/^https?:\/\/(www\.)?/, "").split("/")[0]}
              </a>
            )}
            {place.openingHours && (
              <span className={place.openingHours.openNow ? "text-green-600" : "text-red-500"}>
                {place.openingHours.openNow ? "🟢 営業中" : "🔴 営業時間外"}
              </span>
            )}
          </div>
        </div>
      )}

      {/* プレビュー */}
      <div className="relative w-full" style={{ aspectRatio: "16/9" }}>
        {activeMode === "place" && hasPlace ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={`place-${customerId}-${photoIdx}`}
              src={place!.photoUrls[photoIdx]}
              alt={place!.name}
              className="absolute inset-0 w-full h-full object-cover"
              loading="lazy"
            />
            {place!.photoUrls.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => setPhotoIdx((i) => (i > 0 ? i - 1 : place!.photoUrls.length - 1))}
                  className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full w-7 h-7 flex items-center justify-center text-sm transition-colors"
                >
                  ‹
                </button>
                <button
                  type="button"
                  onClick={() => setPhotoIdx((i) => (i < place!.photoUrls.length - 1 ? i + 1 : 0))}
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full w-7 h-7 flex items-center justify-center text-sm transition-colors"
                >
                  ›
                </button>
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                  {place!.photoUrls.map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setPhotoIdx(i)}
                      className={`w-1.5 h-1.5 rounded-full transition-colors ${
                        i === photoIdx ? "bg-white" : "bg-white/40"
                      }`}
                    />
                  ))}
                </div>
              </>
            )}
          </>
        ) : activeMode === "streetview" && streetViewImgUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            key={`sv-${trimmed}`}
            src={streetViewImgUrl}
            alt="Street View"
            className="absolute inset-0 w-full h-full object-cover"
            loading="lazy"
            onError={() => { setSvFailed(true); setMode("map"); }}
          />
        ) : mapEmbedUrl ? (
          <iframe
            key={`map-${trimmed}`}
            src={mapEmbedUrl}
            className="absolute inset-0 w-full h-full"
            allowFullScreen
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            title="Google Map"
          />
        ) : null}
      </div>
    </div>
  );
}

export default function CustomerInfoCard({ customer, onCustomerUpdate }: CustomerInfoCardProps) {
  const user = useAuthStore((state) => state.user);
  const [isPending, startTransition] = useTransition();
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const [formData, setFormData] = useState({
    category: "",
    corporation: "",
    name: "",
    address: "",
    memo: "",
  });

  const [isInitialized, setIsInitialized] = useState(false);
  const lastSavedData = useRef<typeof formData | null>(null);

  useEffect(() => {
    if (customer) {
      const newData = {
        category: customer.category || "",
        corporation: customer.corporation || "",
        name: customer.name || "",
        address: customer.address || "",
        memo: customer.memo || "",
      };
      setFormData(newData);
      lastSavedData.current = newData;
      setIsInitialized(true);
    }
  }, [customer]);

  const saveCustomer = useCallback(async () => {
    if (!customer?.id || !user || !isInitialized) return;

    if (
      lastSavedData.current &&
      formData.category === lastSavedData.current.category &&
      formData.corporation === lastSavedData.current.corporation &&
      formData.name === lastSavedData.current.name &&
      formData.address === lastSavedData.current.address &&
      formData.memo === lastSavedData.current.memo
    ) {
      return;
    }

    try {
      const token = user.accessToken;
      setSaveStatus("saving");

      startTransition(async () => {
        const result = await updateCustomer(
          {
            id: customer.id,
            category: formData.category,
            corporation: formData.corporation,
            name: formData.name,
            address: formData.address,
            memo: formData.memo,
          },
          token,
        );

        if (result.success && result.customer) {
          setSaveStatus("saved");
          lastSavedData.current = { ...formData };
          onCustomerUpdate?.(result.customer);
          setTimeout(() => setSaveStatus("idle"), 2000);
        } else {
          setSaveStatus("error");
          console.error(result.error);
          setTimeout(() => setSaveStatus("idle"), 3000);
        }
      });
    } catch (error) {
      console.error("Failed to save customer:", error);
      setSaveStatus("error");
      setTimeout(() => setSaveStatus("idle"), 3000);
    }
  }, [customer?.id, user, isInitialized, formData, onCustomerUpdate]);

  const handleInputChange =
    (field: keyof typeof formData) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setFormData((prev) => ({ ...prev, [field]: e.target.value }));
    };

  const handleBlur = () => {
    saveCustomer();
  };

  return (
    <Card className="border border-gray-200 bg-white rounded-2xl shadow-sm h-full">
      <CardContent className="p-5 space-y-3">
        {/* ヘッダ */}
        <div className="flex items-center justify-between pb-2 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">顧客情報</h2>
          <div className="text-xs">
            {saveStatus === "saving" && (
              <span className="text-gray-400 flex items-center gap-1">
                <FiLoader className="w-3 h-3 animate-spin" />保存中
              </span>
            )}
            {saveStatus === "saved" && (
              <span className="text-green-500 flex items-center gap-1">
                <FiCheck className="w-3 h-3" />保存済
              </span>
            )}
            {saveStatus === "error" && <span className="text-red-500">保存失敗</span>}
          </div>
        </div>

        {/* フィールド — カラフルアイコン (色 = 記憶の手がかり) */}
        <div className="space-y-2.5">
          <div>
            <label className="text-xs font-medium text-gray-400 flex items-center gap-1.5">
              <FiHome className="w-3.5 h-3.5 text-green-500" />カテゴリ
            </label>
            <Input
              className="mt-0.5 border-gray-200 focus:border-blue-400 transition-all"
              value={formData.category}
              onChange={handleInputChange("category")}
              onBlur={handleBlur}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-400 flex items-center gap-1.5">
              <FiUser className="w-3.5 h-3.5 text-purple-500" />法人名
            </label>
            <Input
              className="mt-0.5 border-gray-200 focus:border-blue-400 transition-all"
              value={formData.corporation}
              onChange={handleInputChange("corporation")}
              onBlur={handleBlur}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-400 flex items-center gap-1.5">
              <FiUser className="w-3.5 h-3.5 text-indigo-500" />顧客名
            </label>
            <Input
              className="mt-0.5 border-gray-200 focus:border-blue-400 transition-all"
              value={formData.name}
              onChange={handleInputChange("name")}
              onBlur={handleBlur}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-400 flex items-center gap-1.5">
              <FiMapPin className="w-3.5 h-3.5 text-orange-500" />住所
            </label>
            <Input
              className="mt-0.5 border-gray-200 focus:border-blue-400 transition-all"
              value={formData.address}
              onChange={handleInputChange("address")}
              onBlur={handleBlur}
            />
            {/* 店舗写真 / Street View / Map プレビュー */}
            {customer?.id && <AddressMapPreview customerId={customer.id} address={formData.address} />}
          </div>
          <div>
            <label className="text-xs font-medium text-gray-400 flex items-center gap-1.5">
              <FaFax className="w-3.5 h-3.5 text-emerald-500" />FAX
            </label>
            <Input
              className="mt-0.5 border-gray-200 focus:border-blue-400 transition-all"
              placeholder="FAX"
            />
          </div>
        </div>

        {/* メモ */}
        <div className="pt-1">
          <label className="text-xs font-medium text-gray-400 flex items-center gap-1.5">
            <FiEdit3 className="w-3.5 h-3.5 text-blue-500" />メモ
          </label>
          <Textarea
            className="mt-0.5 min-h-[160px] resize-none border-gray-200 focus:border-blue-400 transition-all"
            placeholder="メモ..."
            value={formData.memo}
            onChange={handleInputChange("memo")}
            onBlur={handleBlur}
          />
        </div>
      </CardContent>
    </Card>
  );
}
