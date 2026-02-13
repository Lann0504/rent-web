import { useEffect, useMemo, useRef, useState } from "react"
import JSZip from "jszip"
import { toast } from "sonner"
import { toPng } from "html-to-image"
import { api } from "@/lib/api"
import type { Tenant } from "@/lib/types"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

import jsPDF from "jspdf"

type InvoiceResp = {
  tenant: Tenant
  record: any | null
  previous: any | null
  usage: { electricity: number; water: number }
}

function nowYM() {
  const d = new Date()
  return { year: d.getFullYear(), month: d.getMonth() + 1 }
}
function pad2(n: number) {
  return String(n).padStart(2, "0")
}

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

async function waitNextPaint(times = 2) {
  for (let i = 0; i < times; i++) {
    await new Promise<void>((r) => requestAnimationFrame(() => r()))
  }
}

async function dataUrlToBlob(dataUrl: string) {
  return (await fetch(dataUrl)).blob()
}

function buildInvoiceNode(invoice: InvoiceResp, y: number, m: number) {
  const record = invoice.record
  const prev = invoice.previous
  const room = invoice.tenant.room

  const content = document.createElement("div")
  content.style.width = "800px"
  content.style.border = "1px solid #e5e7eb"
  content.style.borderRadius = "16px"
  content.style.padding = "24px"
  content.style.color = "#111"
  content.style.background = "#fff"
  content.style.fontFamily =
    "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial"

  content.innerHTML = `
    <div style="display:flex;justify-content:space-between;gap:16px;align-items:flex-start;">
      <div>
        <div style="font-size:20px;font-weight:700;">租金单</div>
        <div style="font-size:12px;color:#4b5563;margin-top:4px;">账期：${y} 年 ${pad2(m)} 月</div>
      </div>
      <div style="text-align:right;font-size:12px;">
        <div style="font-weight:600;">${room}</div>
      </div>
    </div>
    <div style="height:1px;background:#e5e7eb;margin:18px 0;"></div>

    ${!record
      ? `<div style="font-size:12px;color:#6b7280;">当前月份没有记录（records 为空）。请先去录入页保存。</div>`
      : `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div style="border:1px solid #e5e7eb;border-radius:12px;padding:14px;">
          <div style="font-size:12px;color:#6b7280;">房租</div>
          <div style="font-size:24px;font-weight:700;margin-top:6px;">${invoice.tenant.rent}</div>
        </div>
        <div style="border:1px solid #e5e7eb;border-radius:12px;padding:14px;">
          <div style="font-size:12px;color:#6b7280;">本月合计</div>
          <div style="font-size:24px;font-weight:700;margin-top:6px;">${Number(record.total).toFixed(2)}</div>
        </div>
      </div>

      <div style="border:1px solid #e5e7eb;border-radius:12px;padding:14px;margin-top:12px;">
        <div style="font-weight:600;">水电明细</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:10px;">
          <div style="border:1px solid #e5e7eb;border-radius:10px;padding:12px;">
            <div style="font-size:12px;color:#6b7280;">电表</div>
            <div style="font-size:12px;margin-top:6px;line-height:1.6;">
              上月读数：${Number(prev?.electricity ?? 0).toFixed(0)}<br/>
              本月读数：${Number(record.electricity ?? 0).toFixed(0)}<br/>
              用量：${Number(invoice.usage.electricity ?? 0).toFixed(0)}
            </div>
            <div style="font-size:12px;margin-top:8px;">
              电费：<span style="font-weight:700;">${Number(record.electricityFee ?? 0).toFixed(2)}</span>
            </div>
          </div>

          <div style="border:1px solid #e5e7eb;border-radius:10px;padding:12px;">
            <div style="font-size:12px;color:#6b7280;">水表</div>
            <div style="font-size:12px;margin-top:6px;line-height:1.6;">
              上月读数：${Number(prev?.water ?? 0).toFixed(0)}<br/>
              本月读数：${Number(record.water ?? 0).toFixed(0)}<br/>
              用量：${Number(invoice.usage.water ?? 0).toFixed(0)}
            </div>
            <div style="font-size:12px;margin-top:8px;">
              水费：<span style="font-weight:700;">${Number(record.waterFee ?? 0).toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>
    `
    }
  `
  return content
}

async function invoiceToPngDataUrl(invoice: InvoiceResp, y: number, m: number) {
  // 不要 display:none / visibility:hidden / 极端负坐标
  const host = document.createElement("div")
  host.style.position = "fixed"
  host.style.left = "0"
  host.style.top = "0"
  host.style.opacity = "0"
  host.style.pointerEvents = "none"
  host.style.transform = "translateX(-120%)"
  host.style.background = "white"
  host.style.zIndex = "-1"
  document.body.appendChild(host)

  const node = buildInvoiceNode(invoice, y, m)
  host.appendChild(node)

  try {
    // @ts-ignore
    if (document.fonts?.ready) {
      // @ts-ignore
      await document.fonts.ready
    }
    await waitNextPaint(2)
    return await toPng(node, { cacheBust: true, pixelRatio: 2 })
  } finally {
    host.remove()
  }
}

export default function GeneratePage() {
  const cur = nowYM()

  const [tenants, setTenants] = useState<Tenant[]>([])
  const [tenantId, setTenantId] = useState<number | null>(null)

  const [year, setYear] = useState<number>(cur.year)
  const [month, setMonth] = useState<number>(cur.month)

  const [data, setData] = useState<InvoiceResp | null>(null)
  const [loading, setLoading] = useState(false)
  const [exportingAll, setExportingAll] = useState(false)

  const previewRef = useRef<HTMLDivElement | null>(null)

  const tenant = useMemo(
    () => tenants.find((t) => t.id === tenantId) ?? null,
    [tenants, tenantId]
  )

  const years = useMemo(() => {
    const y = cur.year
    return [y - 2, y - 1, y, y + 1]
  }, [cur.year])

  useEffect(() => {
    api<Tenant[]>("/api/tenants")
      .then((list) => {
        setTenants(list)
        if (!tenantId && list.length) setTenantId(list[0].id)
      })
      .catch((e) => toast.error(String(e)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loadInvoice() {
    if (!tenantId) return
    setLoading(true)
    try {
      const res = await api<InvoiceResp>(
        `/api/invoice?tenantId=${tenantId}&year=${year}&month=${month}`
      )
      setData(res)
    } catch (e: any) {
      toast.error(e?.message ?? String(e))
      setData(null)
    } finally {
      setLoading(false)
    }
  }

  // 单个导出 PNG：与批量同模板（保证一致）
  async function exportPNG() {
    if (!tenantId) return
    try {
      const invoice = await api<InvoiceResp>(
        `/api/invoice?tenantId=${tenantId}&year=${year}&month=${month}`
      )
      if (!invoice.record) {
        toast.error("该月未录入，无法导出 PNG")
        return
      }
      const dataUrl = await invoiceToPngDataUrl(invoice, year, month)
      const blob = await dataUrlToBlob(dataUrl)
      downloadBlob(`租金单_${invoice.tenant.room}_${year}-${pad2(month)}.png`, blob)
      toast.success("PNG 已导出")
    } catch (e: any) {
      toast.error(e?.message ?? String(e))
    }
  }

  async function exportAllTenantsZip() {
    if (!tenants.length) return
    setExportingAll(true)

    const zip = new JSZip()
    const missing: string[] = []
    const failed: string[] = []
    let okCount = 0

    const toastId = toast.loading("批量导出开始…")

    try {
      let done = 0
      const total = tenants.length

      for (const t of tenants) {
        try {
          const invoice = await api<InvoiceResp>(
            `/api/invoice?tenantId=${t.id}&year=${year}&month=${month}`
          )

          if (!invoice.record) {
            missing.push(t.room)
            continue
          }

          const pngDataUrl = await invoiceToPngDataUrl(invoice, year, month)
          const blob = await dataUrlToBlob(pngDataUrl)
          zip.file(`租金单_${t.room}_${year}-${pad2(month)}.png`, blob)
          okCount++
        } catch {
          failed.push(t.room)
        } finally {
          done++
          if (done % 3 === 0 || done === total) {
            toast.loading(`批量导出中… ${done}/${total}`, { id: toastId })
          }
        }
      }

      if (okCount === 0) {
        toast.error("没有可导出的记录：该月所有住户都未录入或获取失败", { id: toastId })
        return
      }

      if (missing.length) {
        zip.file(
          `未录入清单_${year}-${pad2(month)}.txt`,
          missing.map((r) => `房号 ${r}：该月未录入`).join("\n")
        )
      }

      if (failed.length) {
        zip.file(
          `失败清单_${year}-${pad2(month)}.txt`,
          failed.map((r) => `房号 ${r}：生成失败/接口失败`).join("\n")
        )
      }

      const blob = await zip.generateAsync({ type: "blob" })
      downloadBlob(`租金单_${year}-${pad2(month)}.zip`, blob)

      toast.success(
        `导出完成：${okCount} 张 PNG${missing.length ? `，未录入 ${missing.length}` : ""}${failed.length ? `，失败 ${failed.length}` : ""
        }`,
        { id: toastId }
      )
    } finally {
      setExportingAll(false)
    }
  }

  async function exportPDF() {
    if (!previewRef.current) return
    try {
      const png = await toPng(previewRef.current, {
        cacheBust: true,
        pixelRatio: 2,
      })

      const pdf = new jsPDF("p", "mm", "a4")
      const imgProps = pdf.getImageProperties(png)

      const pageW = pdf.internal.pageSize.getWidth()
      const pageH = pdf.internal.pageSize.getHeight()

      const margin = 10
      const maxW = pageW - margin * 2
      const maxH = pageH - margin * 2

      const imgW = imgProps.width
      const imgH = imgProps.height
      const scale = Math.min(maxW / imgW, maxH / imgH)

      const w = imgW * scale
      const h = imgH * scale

      const x = (pageW - w) / 2
      const y = margin

      pdf.addImage(png, "PNG", x, y, w, h)
      pdf.save(`invoice_${tenant?.room ?? "tenant"}_${year}-${pad2(month)}.pdf`)
      toast.success("PDF 已导出")
    } catch (e: any) {
      toast.error(e?.message ?? String(e))
    }
  }

  useEffect(() => {
    if (!tenantId) return
    loadInvoice()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, year, month])

  const record = data?.record
  const previous = data?.previous

  return (
    <div className="space-y-4">
      {/* 控制区 */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle>生成租金单</CardTitle>

            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={exportPNG} disabled={!tenantId}>
                导出 PNG
              </Button>

              <Button
                size="sm"
                variant="outline"
                onClick={exportAllTenantsZip}
                disabled={exportingAll || tenants.length === 0}
              >
                {exportingAll ? "批量导出中..." : "全部PNG(ZIP)"}
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">住户</div>
              <Select
                value={tenantId ? String(tenantId) : ""}
                onValueChange={(v) => setTenantId(Number(v))}
              >
                <SelectTrigger className="h-9 w-[200px]">
                  <SelectValue placeholder="选择住户" />
                </SelectTrigger>
                <SelectContent>
                  {tenants.map((t) => (
                    <SelectItem key={t.id} value={String(t.id)}>
                      {t.room}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">年份</div>
              <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
                <SelectTrigger className="h-9 w-[120px]">
                  <SelectValue placeholder="年份" />
                </SelectTrigger>
                <SelectContent>
                  {years.map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">月份</div>
              <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
                <SelectTrigger className="h-9 w-[100px]">
                  <SelectValue placeholder="月份" />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 12 }).map((_, i) => {
                    const mm = i + 1
                    return (
                      <SelectItem key={mm} value={String(mm)}>
                        {pad2(mm)}
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* 如果你要把 PDF 按钮加回来，放这里也行：
            <Button size="sm" variant="outline" onClick={exportPDF} disabled={!data}>
              导出 PDF
            </Button>
            */}
          </div>
        </CardContent>
      </Card>

      {/* 预览区 */}
      <Card>
        <CardHeader>
          <CardTitle>预览</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center">
            <div
              ref={previewRef}
              className="w-full max-w-[800px] rounded-xl border bg-white p-6 text-black"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-xl font-semibold">租金单</div>
                  <div className="text-sm text-gray-600">
                    账期：{year} 年 {pad2(month)} 月
                  </div>
                </div>
                <div className="text-right text-sm">
                  <div className="font-medium">
                    {data?.tenant?.room ?? tenant?.room ?? "-"}
                  </div>
                  <div className="text-gray-600">
                    生成时间：{new Date().toLocaleString()}
                  </div>
                </div>
              </div>

              <div className="my-5 h-px bg-gray-200" />

              {!data ? (
                <div className="text-sm text-gray-600">
                  暂无预览（请选择住户/年月）
                </div>
              ) : !record ? (
                <div className="text-sm text-gray-600">
                  当前月份没有记录（records 为空）。请先去录入页保存。
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div className="rounded-lg border p-4">
                      <div className="text-sm text-gray-600">房租</div>
                      <div className="text-2xl font-semibold">{data.tenant.rent}</div>
                    </div>

                    <div className="rounded-lg border p-4">
                      <div className="text-sm text-gray-600">本月合计</div>
                      <div className="text-2xl font-semibold">
                        {Number(record.total).toFixed(2)}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg border p-4 space-y-3">
                    <div className="font-medium">水电明细</div>

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <div className="rounded-md border p-3">
                        <div className="text-sm text-gray-600">电表</div>
                        <div className="text-sm mt-1">
                          上月读数：{Number(previous?.electricity ?? 0).toFixed(0)} <br />
                          本月读数：{Number(record.electricity ?? 0).toFixed(0)} <br />
                          用量：{Number(data.usage.electricity ?? 0).toFixed(0)}
                        </div>
                        <div className="mt-2 text-sm">
                          电费：{" "}
                          <span className="font-semibold">
                            {Number(record.electricityFee ?? 0).toFixed(2)}
                          </span>
                        </div>
                      </div>

                      <div className="rounded-md border p-3">
                        <div className="text-sm text-gray-600">水表</div>
                        <div className="text-sm mt-1">
                          上月读数：{Number(previous?.water ?? 0).toFixed(0)} <br />
                          本月读数：{Number(record.water ?? 0).toFixed(0)} <br />
                          用量：{Number(data.usage.water ?? 0).toFixed(0)}
                        </div>
                        <div className="mt-2 text-sm">
                          水费：{" "}
                          <span className="font-semibold">
                            {Number(record.waterFee ?? 0).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 你要的话可以把备注区加回来 */}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
