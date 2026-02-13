import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { toast } from "sonner"

import { api } from "@/lib/api"
import type { Tenant, RecentRecord } from "@/lib/types"

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

function ymLabel(y: number, m: number) {
  return `${y}/${String(m).padStart(2, "0")}`
}

export default function HomePage() {
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [tenantId, setTenantId] = useState<number | null>(null)

  const [recent, setRecent] = useState<RecentRecord[]>([])
  const [loading, setLoading] = useState(true)

  const selectedTenant = useMemo(
    () => tenants.find((t) => t.id === tenantId) ?? null,
    [tenants, tenantId]
  )

  useEffect(() => {
    setLoading(true)
    ;(async () => {
      try {
        const [t, r] = await Promise.all([
          api<Tenant[]>("/api/tenants"),
          api<RecentRecord[]>("/api/records/recent?limit=10"),
        ])
        setTenants(t)
        if (!tenantId && t.length) setTenantId(t[0].id)
        setRecent(r)
      } catch (e: any) {
        toast.error(e?.message ?? String(e))
      } finally {
        setLoading(false)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {/* 左侧：选择住户 + 快捷入口 */}
      <Card className="md:col-span-1">
        <CardHeader>
          <CardTitle>住户</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-sm text-muted-foreground">选择一个住户进行录入</div>

          <Select
            value={tenantId ? String(tenantId) : ""}
            onValueChange={(v) => setTenantId(Number(v))}
          >
            <SelectTrigger>
              <SelectValue placeholder="选择住户" />
            </SelectTrigger>
            <SelectContent>
              {tenants.map((t) => (
                <SelectItem key={t.id} value={String(t.id)}>
                  {t.room} {t.name ? `- ${t.name}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="pt-1">
            <Button asChild className="w-full" disabled={!tenantId}>
              <Link to={tenantId ? `/record?tenantId=${tenantId}` : "/record"}>
                去录入
              </Link>
            </Button>
          </div>

          {selectedTenant ? (
            <div className="rounded-md border p-3 text-sm space-y-1">
              <div className="font-medium">
                {selectedTenant.room}
              </div>
              <div className="text-muted-foreground">
                房租：{selectedTenant.rent}
              </div>
              <div className="text-muted-foreground">
                电费率：{selectedTenant.electricityRate} / 水费率：{selectedTenant.waterRate}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* 右侧：最近记录 */}
      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle>最近录入</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <div className="text-sm text-muted-foreground">加载中...</div>
          ) : recent.length === 0 ? (
            <div className="text-sm text-muted-foreground">暂无记录</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>房号</TableHead>
                  <TableHead>月份</TableHead>
                  <TableHead className="text-right">合计</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recent.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.room}</TableCell>
                    <TableCell>{ymLabel(r.year, r.month)}</TableCell>
                    <TableCell className="text-right">{Number(r.total).toFixed(2)}</TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="outline" size="sm">
                        <Link to={`/record?tenantId=${r.tenantId}`}>继续录入</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          <div className="flex justify-end">
            <Button asChild variant="outline">
              <Link to="/history">查看全部历史</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
