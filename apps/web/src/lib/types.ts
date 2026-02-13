export type Tenant = {
  id: number
  room: string
  name: string
  electricityRate: number
  waterRate: number
  rent: number
}

export type RecordRow = {
  id?: number
  tenantId: number
  room?: string
  name?: string
  year: number
  month: number
  electricity: number
  water: number
  electricityFee: number
  waterFee: number
  total: number
}

export type RecentRecord = {
  id: number
  tenantId: number
  room: string
  name: string
  year: number
  month: number
  total: number
  updatedAt: string
}