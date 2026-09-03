"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Progress } from "@/components/ui/progress"
import { FiUpload, FiFile, FiCheck, FiAlertCircle, FiX, FiZap } from "react-icons/fi"
import { useAuthStore } from "@/store/authStore"

interface CSVPreviewData {
  headers: string[]
  rows: string[][]      // プレビュー用 (先頭10行)
  allRows: string[][]   // 全行 (AI補完・インポートに使用)
  totalRows: number
}

interface ImportResult {
  bookId: string
  importedCount: number
  failedCount: number
  errors: Array<{
    lineNumber: number
    errorMessage: string
  }>
}

// Phase 27j: AI 補完 (Gemini) の結果
interface EnrichmentStatus {
  enabled: boolean
  model: string
}

interface EnrichedRow {
  fields: Record<string, string>
  confidence: number
  changed: boolean
}

type ImportStep = "select" | "preview" | "importing" | "result"

// canonical フィールド (backend の ImportBook / EnrichCustomerRows と揃える)
const CANONICAL_FIELDS = ["phone", "category", "name", "corporation", "address", "memo", "mail"] as const
const FIELD_LABELS: Record<string, string> = {
  phone: "電話番号",
  category: "カテゴリ",
  name: "担当者名",
  corporation: "会社名",
  address: "住所",
  memo: "メモ",
  mail: "メール",
}

// AI 補完の対象行数上限 (コスト対策。バックエンドは 500行/リクエスト制限)
const ENRICH_MAX_ROWS = 500
// 1 リクエストあたりの行数 (分割して送る)
const ENRICH_CHUNK_SIZE = 100

// backend の ImportBook と同じヘッダ→canonical マッピング (lower/trim, email→mail)
function mapRowToCanonical(headers: string[], row: string[]): Record<string, string> {
  const out: Record<string, string> = {}
  headers.forEach((h, i) => {
    if (i >= row.length) return
    let key = h.trim().toLowerCase()
    if (key === "email") key = "mail"
    if ((CANONICAL_FIELDS as readonly string[]).includes(key) || key === "id") {
      out[key] = row[i]
    }
  })
  return out
}

function csvEscape(v: string): string {
  if (/[",\n\r]/.test(v)) {
    return '"' + v.replace(/"/g, '""') + '"'
  }
  return v
}

interface CSVImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImportSuccess?: (bookId: string) => void
}

export function CSVImportDialog({ open, onOpenChange, onImportSuccess }: CSVImportDialogProps) {
  const [step, setStep] = useState<ImportStep>("select")
  const [file, setFile] = useState<File | null>(null)
  const [previewData, setPreviewData] = useState<CSVPreviewData | null>(null)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [importProgress, setImportProgress] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  // Phase 27j: AI 補完
  const [enrichStatus, setEnrichStatus] = useState<EnrichmentStatus | null>(null)
  const [enriching, setEnriching] = useState(false)
  const [enrichProgress, setEnrichProgress] = useState(0)
  const [enrichedRows, setEnrichedRows] = useState<Map<number, EnrichedRow> | null>(null)
  const [appliedRows, setAppliedRows] = useState<Set<number>>(new Set())
  const fileInputRef = useRef<HTMLInputElement>(null)
  const user = useAuthStore((state) => state.user)

  const apiUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8082'

  const resetState = useCallback(() => {
    setStep("select")
    setFile(null)
    setPreviewData(null)
    setImportResult(null)
    setError(null)
    setImportProgress(0)
    setEnriching(false)
    setEnrichProgress(0)
    setEnrichedRows(null)
    setAppliedRows(new Set())
  }, [])

  const handleClose = useCallback(() => {
    resetState()
    onOpenChange(false)
  }, [resetState, onOpenChange])

  // ダイアログを開いたときに AI 補完が利用可能か確認する
  useEffect(() => {
    if (!open || !user) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`${apiUrl}/customer.v1.CustomerService/GetEnrichmentStatus`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${user.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        })
        if (!res.ok) throw new Error(`status ${res.status}`)
        const data = await res.json()
        if (!cancelled) {
          setEnrichStatus({ enabled: !!data.enabled, model: data.model || "" })
        }
      } catch {
        if (!cancelled) setEnrichStatus({ enabled: false, model: "" })
      }
    })()
    return () => { cancelled = true }
  }, [open, user, apiUrl])

  const parseCSV = (content: string): CSVPreviewData => {
    const lines = content.split(/\r?\n/).filter(line => line.trim())
    if (lines.length === 0) {
      throw new Error("CSVファイルが空です")
    }

    // Simple CSV parser (handles basic cases)
    const parseRow = (row: string): string[] => {
      const result: string[] = []
      let current = ""
      let inQuotes = false

      for (let i = 0; i < row.length; i++) {
        const char = row[i]
        if (char === '"') {
          if (inQuotes && row[i + 1] === '"') {
            current += '"'
            i++
          } else {
            inQuotes = !inQuotes
          }
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim())
          current = ""
        } else {
          current += char
        }
      }
      result.push(current.trim())
      return result
    }

    const headers = parseRow(lines[0])
    const allRows = lines.slice(1).map(parseRow)

    return {
      headers,
      rows: allRows.slice(0, 10), // Preview first 10 rows
      allRows,
      totalRows: allRows.length,
    }
  }

  const handleFileSelect = async (selectedFile: File) => {
    setError(null)

    if (!selectedFile.name.endsWith('.csv')) {
      setError("CSVファイルのみアップロード可能です")
      return
    }

    if (selectedFile.size > 10 * 1024 * 1024) { // 10MB limit
      setError("ファイルサイズは10MB以下にしてください")
      return
    }

    try {
      const content = await selectedFile.text()
      const preview = parseCSV(content)
      setFile(selectedFile)
      setPreviewData(preview)
      setEnrichedRows(null)
      setAppliedRows(new Set())
      setStep("preview")
    } catch (err: any) {
      setError(err.message || "ファイルの読み込みに失敗しました")
    }
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile) {
      handleFileSelect(droppedFile)
    }
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  // Phase 27j: Gemini で行データを正規化・補完する (提案のみ、元データは不変)
  const handleEnrich = async () => {
    if (!previewData || !user || enriching) return
    setError(null)
    setEnriching(true)
    setEnrichProgress(0)

    try {
      const targetRows = previewData.allRows.slice(0, ENRICH_MAX_ROWS)
      const results = new Map<number, EnrichedRow>()

      for (let start = 0; start < targetRows.length; start += ENRICH_CHUNK_SIZE) {
        const chunk = targetRows.slice(start, start + ENRICH_CHUNK_SIZE)
        const res = await fetch(`${apiUrl}/customer.v1.CustomerService/EnrichCustomerRows`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${user.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            headers: previewData.headers,
            rows: chunk.map((cells) => ({ cells })),
          }),
        })
        if (!res.ok) {
          const text = await res.text()
          throw new Error(`AI補完に失敗しました: ${text}`)
        }
        const data = await res.json()
        for (const r of data.rows || []) {
          const localIdx = r.rowIndex ?? r.row_index ?? 0
          results.set(start + Number(localIdx), {
            fields: r.fields || {},
            confidence: Number(r.confidence ?? 0),
            changed: !!r.changed,
          })
        }
        setEnrichProgress(Math.round(Math.min(100, ((start + chunk.length) / targetRows.length) * 100)))
      }

      const changedIdx = new Set<number>()
      results.forEach((v, k) => { if (v.changed) changedIdx.add(k) })
      setEnrichedRows(results)
      setAppliedRows(changedIdx) // 変更提案のある行はデフォルトで適用 ON
    } catch (err: any) {
      setError(err.message || "AI補完中にエラーが発生しました")
    } finally {
      setEnriching(false)
    }
  }

  const discardEnrichment = () => {
    setEnrichedRows(null)
    setAppliedRows(new Set())
  }

  const toggleAppliedRow = (idx: number) => {
    setAppliedRows((prev) => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
  }

  const applyAll = () => {
    if (!enrichedRows) return
    const all = new Set<number>()
    enrichedRows.forEach((v, k) => { if (v.changed) all.add(k) })
    setAppliedRows(all)
  }

  // 補完適用後の CSV を canonical ヘッダで組み立てる
  const buildEnrichedCSV = (): string => {
    if (!previewData) return ""
    const hasId = previewData.headers.some((h) => h.trim().toLowerCase() === "id")
    const outHeaders = hasId ? ["id", ...CANONICAL_FIELDS] : [...CANONICAL_FIELDS]
    const lines = [outHeaders.join(",")]
    previewData.allRows.forEach((row, i) => {
      const base = mapRowToCanonical(previewData.headers, row)
      const enriched = enrichedRows?.get(i)
      const merged = (enriched && appliedRows.has(i))
        ? { ...base, ...enriched.fields }
        : base
      lines.push(outHeaders.map((h) => csvEscape(merged[h] ?? "")).join(","))
    })
    return lines.join("\r\n")
  }

  const handleImport = async () => {
    if (!file || !user) return

    setStep("importing")
    setImportProgress(10)

    try {
      const token = user.accessToken
      let base64Content: string
      const useEnriched = enrichedRows !== null && appliedRows.size > 0
      if (useEnriched) {
        // AI補完を適用した行を canonical CSV に組み立て直して送る
        const csv = buildEnrichedCSV()
        const bytes = new TextEncoder().encode(csv)
        base64Content = btoa(
          Array.from(bytes).reduce((data, byte) => data + String.fromCharCode(byte), '')
        )
      } else {
        const fileContent = await file.arrayBuffer()
        base64Content = btoa(
          new Uint8Array(fileContent).reduce(
            (data, byte) => data + String.fromCharCode(byte),
            ''
          )
        )
      }

      setImportProgress(30)

      const response = await fetch(`${apiUrl}/book.v1.BookService/ImportBook`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          file_name: file.name,
          file_content: base64Content,
          owner_id: user.sub,
        }),
      })

      setImportProgress(80)

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`インポートに失敗しました: ${errorText}`)
      }

      const result = await response.json()
      setImportProgress(100)

      setImportResult({
        bookId: result.book_id || result.bookId,
        importedCount: result.imported_count || result.importedCount || 0,
        failedCount: result.failed_count || result.failedCount || 0,
        errors: (result.errors || []).map((e: any) => ({
          lineNumber: e.line_number || e.lineNumber,
          errorMessage: e.error_message || e.errorMessage,
        })),
      })
      setStep("result")

      if (onImportSuccess && (result.book_id || result.bookId)) {
        onImportSuccess(result.book_id || result.bookId)
      }
    } catch (err: any) {
      setError(err.message || "インポート中にエラーが発生しました")
      setStep("preview")
    }
  }

  const renderSelectStep = () => (
    <div className="p-6">
      <div
        className={`
          border-2 border-dashed rounded-lg p-12 text-center
          transition-colors cursor-pointer
          ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}
        `}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
          className="hidden"
        />
        <FiUpload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
        <p className="text-lg font-medium text-gray-700 mb-2">
          CSVファイルをドラッグ＆ドロップ
        </p>
        <p className="text-sm text-gray-500 mb-4">
          または クリックしてファイルを選択
        </p>
        <p className="text-xs text-gray-400">
          対応形式: CSV (最大10MB、50,000行まで)
        </p>
      </div>

      {error && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <FiAlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <div className="mt-6 p-4 bg-gray-50 rounded-lg">
        <h4 className="font-medium text-gray-700 mb-2">CSVフォーマット</h4>
        <p className="text-sm text-gray-600 mb-2">
          以下のカラムを含むCSVファイルをアップロードしてください:
        </p>
        <code className="text-xs bg-gray-100 p-2 rounded block">
          id (任意), phone, category, name, corporation, address, memo
        </code>
        <p className="text-xs text-gray-500 mt-2">
          列名が揃っていないCSVも、プレビュー画面の「AIで補完・整形」で自動マッピング・正規化できます。
        </p>
      </div>
    </div>
  )

  // AI補完結果 (before → after) のプレビューテーブル
  const renderEnrichedPreview = () => {
    if (!previewData || !enrichedRows) return null
    const changedIndices: number[] = []
    enrichedRows.forEach((v, k) => { if (v.changed) changedIndices.push(k) })
    changedIndices.sort((a, b) => a - b)
    const shown = changedIndices.slice(0, 20)

    return (
      <div className="flex-1 overflow-auto px-6 pb-4">
        <div className="mb-3 p-3 bg-violet-50 border border-violet-200 rounded-lg">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-violet-800">
              <FiZap className="inline w-4 h-4 mr-1" />
              {enrichedRows.size} 行を解析し、{changedIndices.length} 行に補完・整形の提案があります
              （適用対象: {appliedRows.size} 行）
            </p>
            <div className="flex gap-2 flex-shrink-0">
              <Button variant="outline" size="sm" onClick={applyAll}>
                全て適用
              </Button>
              <Button variant="outline" size="sm" onClick={() => setAppliedRows(new Set())}>
                全て解除
              </Button>
              <Button variant="outline" size="sm" onClick={discardEnrichment}>
                <FiX className="w-4 h-4 mr-1" />
                提案を破棄
              </Button>
            </div>
          </div>
        </div>

        <div className="border rounded-2xl overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-100">
                <TableHead className="w-14 text-center text-gray-600">適用</TableHead>
                <TableHead className="w-12 text-center text-gray-600">行</TableHead>
                {CANONICAL_FIELDS.map((f) => (
                  <TableHead key={f} className="text-gray-600 font-medium whitespace-nowrap">
                    {FIELD_LABELS[f]}
                  </TableHead>
                ))}
                <TableHead className="w-16 text-center text-gray-600">確信度</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shown.map((idx) => {
                const enriched = enrichedRows.get(idx)!
                const orig = mapRowToCanonical(previewData.headers, previewData.allRows[idx])
                return (
                  <TableRow key={idx} className={appliedRows.has(idx) ? "bg-green-50/50" : "opacity-60"}>
                    <TableCell className="text-center">
                      <input
                        type="checkbox"
                        checked={appliedRows.has(idx)}
                        onChange={() => toggleAppliedRow(idx)}
                        className="w-4 h-4 accent-violet-600 cursor-pointer"
                      />
                    </TableCell>
                    <TableCell className="text-center text-gray-400 text-sm">{idx + 2}</TableCell>
                    {CANONICAL_FIELDS.map((f) => {
                      const before = (orig[f] ?? "").trim()
                      const after = enriched.fields[f]
                      const isChanged = after !== undefined && after !== "" && after !== before
                      return (
                        <TableCell key={f} className="text-sm max-w-[180px]">
                          {isChanged ? (
                            <div>
                              {before && (
                                <div className="text-xs text-red-400 line-through truncate">{before}</div>
                              )}
                              <div className="text-green-700 font-medium truncate">{after}</div>
                            </div>
                          ) : (
                            <span className="text-gray-700 truncate block">
                              {before || <span className="text-gray-300">-</span>}
                            </span>
                          )}
                        </TableCell>
                      )
                    })}
                    <TableCell className="text-center text-xs text-gray-500">
                      {Math.round(enriched.confidence * 100)}%
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
        {changedIndices.length > 20 && (
          <p className="text-sm text-gray-500 mt-2 text-center">
            他 {changedIndices.length - 20} 行の提案は表示を省略しています（「全て適用/解除」は全行に効きます）
          </p>
        )}
        {previewData.totalRows > ENRICH_MAX_ROWS && (
          <p className="text-xs text-amber-600 mt-2 text-center">
            AI補完の対象は先頭 {ENRICH_MAX_ROWS} 行までです（{ENRICH_MAX_ROWS + 1} 行目以降は元データのまま取り込まれます）
          </p>
        )}
      </div>
    )
  }

  const renderPreviewStep = () => (
    <div className="flex flex-col min-h-0 flex-1">
      <div className="p-6 pb-0">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-blue-100 rounded-lg">
            <FiFile className="w-5 h-5 text-blue-600" />
          </div>
          <div className="flex-1">
            <p className="font-medium text-gray-900">{file?.name}</p>
            <p className="text-sm text-gray-500">
              {previewData?.totalRows.toLocaleString()} 件の顧客データ
              {enrichedRows && enrichStatus?.model && (
                <span className="ml-2 text-violet-600">/ AI補完済み ({enrichStatus.model})</span>
              )}
            </p>
          </div>
        </div>
      </div>

      {enriching ? (
        <div className="flex-1 px-6 pb-6 flex flex-col items-center justify-center py-10">
          <div className="w-12 h-12 mb-4 relative">
            <div className="absolute inset-0 rounded-full border-4 border-gray-200"></div>
            <div className="absolute inset-0 rounded-full border-4 border-violet-600 border-t-transparent animate-spin"></div>
          </div>
          <p className="text-sm font-medium text-gray-700 mb-3">AIがデータを解析・整形しています...</p>
          <div className="w-full max-w-xs">
            <Progress value={enrichProgress} />
            <p className="text-xs text-gray-400 mt-1 text-center">{enrichProgress}%</p>
          </div>
        </div>
      ) : enrichedRows ? (
        renderEnrichedPreview()
      ) : (
        <div className="flex-1 overflow-auto px-6 pb-4">
          <div className="border rounded-2xl overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-100">
                  <TableHead className="w-12 text-center text-gray-600">#</TableHead>
                  {previewData?.headers.map((header, index) => (
                    <TableHead key={index} className="text-gray-600 font-medium">
                      {header}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {previewData?.rows.map((row, rowIndex) => (
                  <TableRow key={rowIndex} className="hover:bg-gray-50">
                    <TableCell className="text-center text-gray-400 text-sm">
                      {rowIndex + 1}
                    </TableCell>
                    {row.map((cell, cellIndex) => (
                      <TableCell key={cellIndex} className="text-sm text-gray-700 max-w-[200px] truncate">
                        {cell || <span className="text-gray-300">-</span>}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {previewData && previewData.totalRows > 10 && (
            <p className="text-sm text-gray-500 mt-2 text-center">
              最初の10件を表示しています（全{previewData.totalRows.toLocaleString()}件）
            </p>
          )}
        </div>
      )}

      {error && (
        <div className="mx-6 mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <FiAlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}
    </div>
  )

  const renderImportingStep = () => (
    <div className="p-6 py-12">
      <div className="text-center">
        <div className="w-16 h-16 mx-auto mb-6 relative">
          <div className="absolute inset-0 rounded-full border-4 border-gray-200"></div>
          <div className="absolute inset-0 rounded-full border-4 border-blue-600 border-t-transparent animate-spin"></div>
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          インポート中...
        </h3>
        <p className="text-sm text-gray-500 mb-6">
          {previewData?.totalRows.toLocaleString()} 件のデータを処理しています
        </p>
        <div className="max-w-xs mx-auto">
          <Progress value={importProgress} />
          <p className="text-sm text-gray-400 mt-2">{importProgress}%</p>
        </div>
      </div>
    </div>
  )

  const renderResultStep = () => (
    <div className="p-6">
      <div className="text-center mb-6">
        {importResult && importResult.failedCount === 0 ? (
          <>
            <div className="w-16 h-16 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
              <FiCheck className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="text-lg font-medium text-gray-900">
              インポート完了
            </h3>
          </>
        ) : (
          <>
            <div className="w-16 h-16 mx-auto mb-4 bg-yellow-100 rounded-full flex items-center justify-center">
              <FiAlertCircle className="w-8 h-8 text-yellow-600" />
            </div>
            <h3 className="text-lg font-medium text-gray-900">
              インポート完了（一部エラーあり）
            </h3>
          </>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <Card className="border-green-200 bg-green-50">
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-green-700">
              {importResult?.importedCount.toLocaleString()}
            </p>
            <p className="text-sm text-green-600">成功</p>
          </CardContent>
        </Card>
        <Card className={`${importResult?.failedCount ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-gray-50'}`}>
          <CardContent className="p-4 text-center">
            <p className={`text-3xl font-bold ${importResult?.failedCount ? 'text-red-700' : 'text-gray-700'}`}>
              {importResult?.failedCount.toLocaleString()}
            </p>
            <p className={`text-sm ${importResult?.failedCount ? 'text-red-600' : 'text-gray-600'}`}>
              失敗
            </p>
          </CardContent>
        </Card>
      </div>

      {importResult?.errors && importResult.errors.length > 0 && (
        <div className="border border-red-200 rounded-lg overflow-hidden">
          <div className="bg-red-50 px-4 py-2 border-b border-red-200">
            <p className="font-medium text-red-700">エラー詳細</p>
          </div>
          <div className="max-h-40 overflow-auto">
            {importResult.errors.slice(0, 10).map((err, index) => (
              <div
                key={index}
                className="px-4 py-2 text-sm border-b border-red-100 last:border-0"
              >
                <span className="font-medium text-red-600">行 {err.lineNumber}:</span>
                <span className="text-gray-600 ml-2">{err.errorMessage}</span>
              </div>
            ))}
            {importResult.errors.length > 10 && (
              <div className="px-4 py-2 text-sm text-gray-500 bg-gray-50">
                他 {importResult.errors.length - 10} 件のエラー
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )

  const enrichDisabled = !enrichStatus?.enabled

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl">
        <DialogClose onClose={handleClose} />
        <DialogHeader>
          <DialogTitle>
            {step === "select" && "CSVインポート"}
            {step === "preview" && "インポート内容の確認"}
            {step === "importing" && "インポート処理"}
            {step === "result" && "インポート結果"}
          </DialogTitle>
          <DialogDescription>
            {step === "select" && "顧客データをCSVファイルからインポートします"}
            {step === "preview" && "インポートする内容を確認してください"}
            {step === "importing" && "しばらくお待ちください..."}
            {step === "result" && "インポート処理が完了しました"}
          </DialogDescription>
        </DialogHeader>

        {step === "select" && renderSelectStep()}
        {step === "preview" && renderPreviewStep()}
        {step === "importing" && renderImportingStep()}
        {step === "result" && renderResultStep()}

        {step !== "importing" && (
          <DialogFooter>
            {step === "select" && (
              <Button variant="outline" onClick={handleClose}>
                キャンセル
              </Button>
            )}
            {step === "preview" && (
              <>
                <Button variant="outline" onClick={() => { resetState() }} disabled={enriching}>
                  ファイルを変更
                </Button>
                {!enrichedRows && (
                  <span
                    title={enrichDisabled ? "AI補完は無効です: 管理者が GEMINI_API_KEY を設定してください" : `Gemini (${enrichStatus?.model}) でデータを正規化・補完します`}
                    className="inline-block"
                    data-testid="enrich-button-wrapper"
                  >
                    <Button
                      variant="outline"
                      onClick={handleEnrich}
                      disabled={enrichDisabled || enriching}
                      className="border-violet-300 text-violet-700 hover:bg-violet-50 disabled:opacity-50"
                    >
                      <FiZap className="w-4 h-4 mr-2" />
                      AIで補完・整形
                    </Button>
                  </span>
                )}
                <Button
                  onClick={handleImport}
                  disabled={enriching}
                  className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
                >
                  <FiUpload className="w-4 h-4 mr-2" />
                  {enrichedRows && appliedRows.size > 0
                    ? `補完を適用してインポート (${appliedRows.size}行)`
                    : "インポート開始"}
                </Button>
              </>
            )}
            {step === "result" && (
              <Button onClick={handleClose}>
                閉じる
              </Button>
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
