import {
  Bar,
  BarChart,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { CabinetResponse } from '../../lib/logika-api'

export type CabinetStatsTabProps = {
  cabinetData: CabinetResponse | null
  cabinetLoading: boolean
  chartData: { m: string; s: number }[]
  biasData: { name: string; v: number }[]
}

export function CabinetStatsTab({
  cabinetData,
  cabinetLoading,
  chartData,
  biasData,
}: CabinetStatsTabProps) {
  return (
    <div>
      <h2 className="text-2xl font-medium">Статистика</h2>
      {cabinetData?.stats?.totals && (
        <p className="text-muted mt-2 text-sm">
          Всего сессий: {cabinetData.stats.totals.sessions}, завершённых анализов:{' '}
          {cabinetData.stats.totals.completed}
        </p>
      )}
      {cabinetLoading && <p className="text-muted mt-6 text-sm">Загрузка…</p>}
      <div className="mt-8 h-64 w-full">
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <XAxis dataKey="m" stroke="#5a5a62" fontSize={11} />
              <YAxis stroke="#5a5a62" fontSize={11} domain={[0, 100]} />
              <Tooltip contentStyle={{ background: '#121214', border: '1px solid #222226' }} />
              <Line type="monotone" dataKey="s" stroke="#c4f542" strokeWidth={2} dot />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          !cabinetLoading && (
            <p className="text-muted flex h-full items-center justify-center text-sm">
              Нет данных по месяцам — заверши хотя бы один анализ.
            </p>
          )
        )}
      </div>
      <div className="mt-10 h-56 w-full">
        {biasData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={biasData}>
              <XAxis
                dataKey="name"
                stroke="#5a5a62"
                fontSize={10}
                interval={0}
                angle={-20}
                height={60}
              />
              <YAxis stroke="#5a5a62" fontSize={11} allowDecimals={false} />
              <Tooltip contentStyle={{ background: '#121214', border: '1px solid #222226' }} />
              <Bar dataKey="v" fill="#c4f542" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          !cabinetLoading && (
            <p className="text-muted flex h-full items-center justify-center text-sm">
              Искажения появятся после отчётов с заполненными biases.
            </p>
          )
        )}
      </div>
      <div className="mt-10 grid gap-4 md:grid-cols-2">
        <div className="border-border bg-card rounded-[12px] border p-5">
          <p className="text-dim font-mono text-xs uppercase tracking-[0.08em]">
            Лучший результат (по оценке)
          </p>
          <p className="mt-3 text-lg">
            {cabinetData?.stats?.highlight_high
              ? `${cabinetData.stats.highlight_high.score ?? '—'} / 100 — ${cabinetData.stats.highlight_high.verdict_short ?? cabinetData.stats.highlight_high.dilemma_short}`
              : '—'}
          </p>
        </div>
        <div className="border-border bg-card rounded-[12px] border p-5">
          <p className="text-dim font-mono text-xs uppercase tracking-[0.08em]">Ниже всего (по оценке)</p>
          <p className="mt-3 text-lg">
            {cabinetData?.stats?.highlight_low
              ? `${cabinetData.stats.highlight_low.score ?? '—'} / 100 — ${cabinetData.stats.highlight_low.verdict_short ?? cabinetData.stats.highlight_low.dilemma_short}`
              : '—'}
          </p>
        </div>
      </div>
    </div>
  )
}
