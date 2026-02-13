import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { toast } from "sonner"

import { api } from "@/lib/api"
import type { Tenant, RecordRow } from "@/lib/types"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

function nowYM() {
  const d = new Date()
  return { year: d.getFullYear(), month: d.getMonth() + 1 }
}
function ymLabel(y: number, m: number) {
  return `${y}/${String(m).padStart(2, "0")}`
}

function downloadText(filename: string, content: string, mime = "text/plain;charset=utf-8") {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

function csvEscape(v: any) {
  const s = String(v ?? "")
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replaceAll('"', '""')}"`
  }
  return s
}

export default function HistoryPage() {
  const cur = nowYM()

  const [tenants, setTenants] = useState<Tenant[]>([])
  const [tenantId, setTenantId] = useState<number | "all">("all")

  const [year, setYear] = useState<number | "all">(cur.year)
  const [month, setMonth] = useState<number | "all">("all")

  const [rows, setRows] = useState<RecordRow[]>([])
  const [loading, setLoading] = useState(false)

  const totalSum = useMemo(() => {
    return rows.reduce((acc, r) => acc + Number(r.total ?? 0), 0)
  }, [rows])

  async function load() {
    setLoading(true)
    try {
      const qs = new URLSearchParams()
      if (tenantId !== "all") qs.set("tenantId", String(tenantId))
      if (year !== "all") qs.set("year", String(year))
      if (month !== "all") qs.set("month", String(month))

      const data = await api<RecordRow[]>(`/api/records?${qs.toString()}`)
      setRows(data)
    } catch (e: any) {
      toast.error(e?.message ?? String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    ; (async () => {
      try {
        const t = await api<Tenant[]>("/api/tenants")
        setTenants(t)
      } catch (e: any) {
        toast.error(e?.message ?? String(e))
      }
    })()
  }, [])

  // 默认加载一次（当前年 + all month）
  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function exportCSV() {
    if (!rows.length) {
      toast.message("没有数据可导出")
      return
    }

    // 表头
    const header = [
      "房号",
      "年份",
      "月份",
      "电读数",
      "水读数",
      "电费",
      "水费",
      "合计(total)",
    ]

    const lines = [header.join(",")]

    for (const r of rows) {
      lines.push(
        [
          csvEscape(r.room ?? ""),
          csvEscape(r.year),
          csvEscape(r.month),
          csvEscape(r.electricity),
          csvEscape(r.water),
          csvEscape(r.electricityFee),
          csvEscape(r.waterFee),
          csvEscape(Number(r.total).toFixed(2)),
        ].join(",")
      )
    }

    const suffixParts = [
      tenantId === "all" ? "allTenants" : `tenant_${tenantId}`,
      year === "all" ? "allYears" : `y${year}`,
      month === "all" ? "allMonths" : `m${String(month).padStart(2, "0")}`,
    ]
    const filename = `history_${suffixParts.join("_")}.csv`

    downloadText(filename, lines.join("\n"), "text/csv;charset=utf-8")
  }

  const years = useMemo(() => {
    // 你也可以改成从 records 里动态取范围；这里先给一个常见范围
    const y = cur.year
    return [y - 2, y - 1, y, y + 1]
  }, [cur.year])

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>历史记录</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 筛选区 */}
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3 md:items-end">
              {/* Tenant */}
              <div className="space-y-1">
                <div className="text-sm text-muted-foreground">住户</div>
                <Select
                  value={tenantId === "all" ? "all" : String(tenantId)}
                  onValueChange={(v) => setTenantId(v === "all" ? "all" : Number(v))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="全部住户" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部住户</SelectItem>
                    {tenants.map((t) => (
                      <SelectItem key={t.id} value={String(t.id)}>
                        {t.room}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Year */}
              <div className="space-y-1">
                <div className="text-sm text-muted-foreground">年份</div>
                <Select
                  value={year === "all" ? "all" : String(year)}
                  onValueChange={(v) => setYear(v === "all" ? "all" : Number(v))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="全部年份" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部年份</SelectItem>
                    {years.map((y) => (
                      <SelectItem key={y} value={String(y)}>
                        {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Month */}
              <div className="space-y-1">
                <div className="text-sm text-muted-foreground">月份</div>
                <Select
                  value={month === "all" ? "all" : String(month)}
                  onValueChange={(v) => setMonth(v === "all" ? "all" : Number(v))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="全部月份" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部月份</SelectItem>
                    {Array.from({ length: 12 }).map((_, i) => {
                      const m = i + 1
                      return (
                        <SelectItem key={m} value={String(m)}>
                          {String(m).padStart(2, "0")}
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={exportCSV}>
                导出 CSV
              </Button>
              <Button onClick={load} disabled={loading}>
                {loading ? "查询中..." : "查询"}
              </Button>
            </div>
          </div>

          {/* 汇总 */}
          <div className="flex items-center justify-between rounded-md border p-3 text-sm">
            <div className="text-muted-foreground">
              当前筛选：{" "}
              {tenantId === "all"
                ? "全部住户"
                : `Tenant#${tenantId}`}{" "}
              · {year === "all" ? "全部年份" : year} ·{" "}
              {month === "all" ? "全部月份" : String(month).padStart(2, "0")}
            </div>
            <div className="font-medium">
              合计：{totalSum.toFixed(2)}（{rows.length} 条）
            </div>
          </div>

          {/* 表格 */}
          {loading ? (
            <div className="text-sm text-muted-foreground">加载中...</div>
          ) : rows.length === 0 ? (
            <div className="text-sm text-muted-foreground">暂无数据</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>房号</TableHead>
                  <TableHead>月份</TableHead>
                  <TableHead className="text-right">电读数</TableHead>
                  <TableHead className="text-right">水读数</TableHead>
                  <TableHead className="text-right">电费</TableHead>
                  <TableHead className="text-right">水费</TableHead>
                  <TableHead className="text-right">合计</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={`${r.tenantId}-${r.year}-${r.month}`}>
                    <TableCell className="font-medium">{r.room ?? ""}</TableCell>
                    <TableCell>{ymLabel(r.year, r.month)}</TableCell>
                    <TableCell className="text-right">{Number(r.electricity).toFixed(0)}</TableCell>
                    <TableCell className="text-right">{Number(r.water).toFixed(0)}</TableCell>
                    <TableCell className="text-right">{Number(r.electricityFee).toFixed(2)}</TableCell>
                    <TableCell className="text-right">{Number(r.waterFee).toFixed(2)}</TableCell>
                    <TableCell className="text-right font-medium">{Number(r.total).toFixed(2)}</TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="outline" size="sm">
                        <Link to={`/record?tenantId=${r.tenantId}`}>去录入</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
