"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [mode, setMode] = useState<"home" | "join">("home");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function createRoom() {
    if (!name.trim()) return setError("請輸入你的名字");
    setLoading(true);
    setError("");
    const res = await fetch("/api/room/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerName: name }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error);
      setLoading(false);
      return;
    }
    localStorage.setItem("playerId", data.playerId);
    localStorage.setItem("playerName", name);
    router.push(`/room/${data.roomId}`);
  }

  async function joinRoom() {
    if (!name.trim()) return setError("請輸入你的名字");
    if (!roomCode.trim()) return setError("請輸入房間號碼");
    setLoading(true);
    setError("");
    const res = await fetch("/api/room/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerName: name, roomId: roomCode }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error);
      setLoading(false);
      return;
    }
    localStorage.setItem("playerId", data.playerId);
    localStorage.setItem("playerName", name);
    router.push(`/room/${data.roomId}`);
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md text-center">
        <div className="text-6xl mb-2">🤰</div>
        <h1 className="text-4xl font-bold text-amber-700 mb-1">大腹翁</h1>
        <p className="text-gray-500 mb-4 text-sm">最會生孩子的才是贏家！</p>

        {/* Game rules summary */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-6 text-left text-sm">
          <div className="grid grid-cols-1 gap-1.5">
            <div className="flex items-start gap-2">
              <span className="text-base leading-none mt-0.5">💕</span>
              <span className="text-gray-600">
                <b>汽車旅館</b>→ 進行人與人的連結，擲骰高者生孩子！
              </span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-base leading-none mt-0.5">🎉</span>
              <span className="text-gray-600">
                <b>多人派對</b>→ 所有人一起黑皮，擲骰雙數生孩子！
              </span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-base leading-none mt-0.5">😈</span>
              <span className="text-gray-600">
                <b>親子鑑定</b>→ 孩子有你的DNA？骰贏孩子就是你的！
              </span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-base leading-none mt-0.5">🏆</span>
              <span className="text-gray-600">
                <b>先擁有 5 個孩子通過起點</b>的玩家獲勝！（2–8 人）
              </span>
            </div>
          </div>
        </div>

        <div className="mb-4">
          <input
            className="w-full border-2 border-amber-200 rounded-xl px-4 py-3 text-center text-lg focus:outline-none focus:border-amber-400"
            placeholder="你的名字"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) =>
              e.key === "Enter" && mode === "home" && createRoom()
            }
            maxLength={12}
          />
        </div>

        {mode === "join" && (
          <div className="mb-4">
            <input
              className="w-full border-2 border-amber-200 rounded-xl px-4 py-3 text-center text-lg tracking-widest uppercase focus:outline-none focus:border-amber-400"
              placeholder="房間號碼（6碼）"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && joinRoom()}
              maxLength={6}
            />
          </div>
        )}

        {error && <p className="text-red-500 text-sm mb-3">{error}</p>}

        {mode === "home" ? (
          <div className="flex flex-col gap-3">
            <button
              onClick={createRoom}
              disabled={loading}
              className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-3 rounded-xl text-lg transition disabled:opacity-50"
            >
              {loading ? "建立中..." : "🏠 建立房間"}
            </button>
            <button
              onClick={() => {
                setMode("join");
                setError("");
              }}
              className="w-full border-2 border-amber-300 text-amber-700 font-bold py-3 rounded-xl text-lg hover:bg-amber-50 transition"
            >
              🚪 加入房間
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <button
              onClick={joinRoom}
              disabled={loading}
              className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-3 rounded-xl text-lg transition disabled:opacity-50"
            >
              {loading ? "加入中..." : "🚪 加入"}
            </button>
            <button
              onClick={() => {
                setMode("home");
                setError("");
              }}
              className="text-gray-400 hover:text-gray-600 text-sm"
            >
              ← 返回
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
