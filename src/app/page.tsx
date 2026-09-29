import Dashboard from "@/components/Dashboard";

// layout.tsx의 metadata와 서버 렌더를 유지하기 위해 Server Component로 둔다.
// 상태는 Dashboard(Client)만 가진다
export default function Home() {
  return (
    <main className="max-w-6xl mx-auto px-4 py-10 space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-white">Shorts Idea Lab</h1>
        <p className="text-sm text-neutral-400">
          생활 꿀팁 · 명언 · 자기객관화 쇼츠 트렌드를 분석하고 다음 콘텐츠를 추천합니다
        </p>
      </header>
      <Dashboard />
    </main>
  );
}
