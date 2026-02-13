import { useEffect, useMemo, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { toast } from "sonner"

import { api } from "@/lib/api"
import type { Tenant, RecordRow } from "@/lib/types"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

function nowYM() {
  const d = new Date()
  return { year: d.getFullYear(), month: d.getMonth() + 1 }
}
function prevYM(year: number, month: number) {
  let y = year
  let m = month - 1
  if (m === 0) {
    m = 12
    y -= 1
  }
  return { year: y, month: m }
}
function nextYM(year: number, month: number) {
  let y = year
  let m = month + 1
  if (m === 13) {
    m = 1
    y += 1
  }
  return { year: y, month: m }
}

export default function RecordPage() {
  const [sp] = useSearchParams()
  const tenantIdFromQuery = sp.get("tenantId")

  const cur = nowYM()
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [tenantId, setTenantId] = useState<number | null>(
    tenantIdFromQuery ? Number(tenantIdFromQuery) : null
  )

  const [year, setYear] = useState(cur.year)
  const [month, setMonth] = useState(cur.month)

  const [prevElectricity, setPrevElectricity] = useState(0)
  const [prevWater, setPrevWater] = useState(0)
  const [electricity, setElectricity] = useState<number>(0)
  const [water, setWater] = useState<number>(0)

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const tenant = useMemo(
    () => tenants.find((t) => t.id === tenantId) ?? null,
    [tenants, tenantId]
  )

  // ===== 费用规则：兼容旧项目 record.vue =====
  const electricityUsage = useMemo(
    () => Math.max(0, electricity - prevElectricity),
    [electricity, prevElectricity]
  )
  const waterUsage = useMemo(
    () => Math.max(0, water - prevWater),
    [water, prevWater]
  )

  const electricityAmount = useMemo(() => {
    if (!tenant) return 0
    return (electricityUsage + 1) * tenant.electricityRate
  }, [tenant, electricityUsage])

  const waterAmount = useMemo(() => {
    if (!tenant) return 0
    return (waterUsage + 1) * tenant.waterRate
  }, [tenant, waterUsage])

  const electricityFee = useMemo(() => electricityAmount - 1, [electricityAmount])
  const waterFee = useMemo(() => waterAmount - 4.5, [waterAmount])

  const total = useMemo(() => {
    if (!tenant) return 0
    return tenant.rent + electricityAmount + waterAmount
  }, [tenant, electricityAmount, waterAmount])

  useEffect(() => {
    api<Tenant[]>("/api/tenants")
      .then((list) => {
        setTenants(list)
        if (!tenantId && list.length) setTenantId(list[0].id)
      })
      .catch((e) => toast.error(String(e)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!tenantId) return
    setLoading(true)

    ;(async () => {
      try {
        const prev = await api<any>(
          `/api/records/previous?tenantId=${tenantId}&year=${year}&month=${month}`
        )
        const pe = Number(prev?.electricity ?? 0)
        const pw = Number(prev?.water ?? 0)
        setPrevElectricity(pe)
        setPrevWater(pw)

        const rows = await api<any[]>(
          `/api/records?tenantId=${tenantId}&year=${year}&month=${month}`
        )
        const curOne = rows?.[0] ?? null

        if (curOne) {
          setElectricity(Number(curOne.electricity ?? 0))
          setWater(Number(curOne.water ?? 0))
        } else {
          setElectricity(pe)
          setWater(pw)
        }
      } catch (e: any) {
        toast.error(e?.message ?? String(e))
      } finally {
        setLoading(false)
      }
    })()
  }, [tenantId, year, month])

  async function onSave() {
    if (!tenantId || !tenant) return

    if (electricity < prevElectricity) {
      toast.error("本月电表读数不能小于上月读数")
      return
    }
    if (water < prevWater) {
      toast.error("本月水表读数不能小于上月读数")
      return
    }

    const payload: RecordRow = {
      tenantId,
      year,
      month,
      electricity,
      water,
      electricityFee,
      waterFee,
      total,
    }

    setSaving(true)
    try {
      await api("/api/records", { method: "PUT", body: JSON.stringify(payload) })
      toast.success("保存成功")
    } catch (e: any) {
      toast.error(e?.message ?? String(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>录入抄表</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2">
              <div className="text-sm text-muted-foreground">住户</div>
              <div className="w-64">
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
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const p = prevYM(year, month)
                  setYear(p.year)
                  setMonth(p.month)
                }}
              >
                上月
              </Button>

              <div className="min-w-28 text-center font-medium">
                {year}/{String(month).padStart(2, "0")}
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const n = nextYM(year, month)
                  setYear(n.year)
                  setMonth(n.month)
                }}
              >
                下月
              </Button>
            </div>
          </div>

          {loading ? <div className="text-sm text-muted-foreground">加载中...</div> : null}

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">电表</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-sm text-muted-foreground">
                  上月读数：{prevElectricity}
                </div>
                <Input
                  type="number"
                  value={electricity}
                  onChange={(e) => setElectricity(Number(e.target.value))}
                  placeholder="本月电表读数"
                />
                <div className="text-sm">
                  用量：{electricityUsage}；金额：{electricityAmount.toFixed(2)}；费用：
                  {electricityFee.toFixed(2)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">水表</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-sm text-muted-foreground">上月读数：{prevWater}</div>
                <Input
                  type="number"
                  value={water}
                  onChange={(e) => setWater(Number(e.target.value))}
                  placeholder="本月水表读数"
                />
                <div className="text-sm">
                  用量：{waterUsage}；金额：{waterAmount.toFixed(2)}；费用：
                  {waterFee.toFixed(2)}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardContent className="pt-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="space-y-1">
                <div className="text-sm text-muted-foreground">房租：{tenant?.rent ?? 0}</div>
                <div className="text-lg font-semibold">合计：{total.toFixed(2)}</div>
              </div>
              <Button onClick={onSave} disabled={saving || !tenantId}>
                {saving ? "保存中..." : "保存"}
              </Button>
            </CardContent>
          </Card>
        </CardContent>
      </Card>
    </div>
  )
}
