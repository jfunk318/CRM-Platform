import Link from "next/link";
import { requireStaff } from "@/lib/auth/session";
import { LEAD_STAGES, loadPipeline, type Stage, STAGES, winRate } from "@/lib/crm/pipeline";
import { type BoardColumn, PipelineBoard } from "@/components/admin/pipeline-board";

export const metadata = { title: "Pipeline" };

const PERIODS = { "30": "30 days", "90": "90 days", "365": "a year" } as const;
const money = (n: number) => `$${Math.round(n).toLocaleString()}`;

/** "today", "3d", "2w", "4mo" since a card reached its stage. */
function age(since: Date, now: Date) {
  const days = Math.floor((now.getTime() - since.getTime()) / 86_400_000);
  if (days < 1) return "today";
  if (days < 14) return `${days}d`;
  if (days < 60) return `${Math.floor(days / 7)}w`;
  return `${Math.floor(days / 30)}mo`;
}

/** Leads and quotes from first contact to won or lost. */
export default async function PipelinePage({ searchParams }: { searchParams: Promise<{ owner?: string; period?: string }> }) {
  const staff = await requireStaff(["SALES"]);
  const { db } = staff;
  const sp = await searchParams;
  const period = sp.period && sp.period in PERIODS ? (sp.period as keyof typeof PERIODS) : "30";
  const owner = sp.owner ?? "";
  const ownerId = owner === "me" ? staff.id : owner || null;
  const now = new Date();
  const [cards, staffList] = await Promise.all([
    loadPipeline(db, { ownerId, days: Number(period), now }),
    db.staffUser.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  const stats = winRate(cards);
  const open = cards.filter((c) => !["WON", "LOST"].includes(c.stage));
  const openValue = open.reduce((t, c) => t + (c.value?.toNumber() ?? 0), 0);
  const columns: BoardColumn[] = (Object.keys(STAGES) as Stage[]).map((stage) => {
    const list = cards.filter((c) => c.stage === stage);
    return {
      stage,
      label: STAGES[stage],
      leadDrop: LEAD_STAGES.includes(stage),
      total: list.reduce((t, c) => t + (c.value?.toNumber() ?? 0), 0),
      cards: list.map((c) => ({ ...c, value: c.value?.toNumber() ?? null, age: age(c.since, now) })),
    };
  });
  const href = (p: Record<string, string>) => {
    const qs = new URLSearchParams(Object.entries({ owner, period, ...p }).filter(([k, v]) => v && !(k === "period" && v === "30")));
    return `/admin/pipeline${qs.size ? `?${qs}` : ""}`;
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title">Pipeline</h1>
          <p className="text-sm text-gray-600" data-testid="pipeline-summary">
            {open.length} open, worth {money(openValue)} · last {PERIODS[period]}: {stats.won} won ({money(stats.wonValue.toNumber())}), {stats.lost} lost
            {stats.rate !== null && <> · win rate {Math.round(stats.rate * 100)}%</>}
          </p>
        </div>
        <form className="flex flex-wrap items-end gap-2">
          <select className="input w-40" name="owner" defaultValue={owner} aria-label="Whose">
            <option value="">Everyone&apos;s</option>
            <option value="me">Mine</option>
            {staffList.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select className="input w-48" name="period" defaultValue={period} aria-label="Won and lost in the last">
            {Object.entries(PERIODS).map(([k, v]) => <option key={k} value={k}>Won/lost: {v}</option>)}
          </select>
          <button className="btn-secondary">Show</button>
        </form>
      </div>
      <PipelineBoard columns={columns} />
      <p className="text-sm">
        <Link href="/admin/leads" className="text-brand-700 hover:underline">All leads</Link> ·{" "}
        <Link href={href({})} className="text-brand-700 hover:underline">Refresh</Link>
      </p>
    </div>
  );
}
