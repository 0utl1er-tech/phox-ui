"use client"

import { useState, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Progress } from "@/components/ui/progress"
import { FiUpload, FiFile, FiCheck, FiAlertCircle, FiInfo } from "react-icons/fi"
import { useAuthStore } from "@/store/authStore"

interface CSVPreviewData {
  headers: string[]
  rows: string[][]
  totalRows: number
}

interface ImportResult {
  importedCount: number
  failedCount: number
  errors: Array<{
    lineNumber: number
    errorMessage: string
  }>
}

type ImportStep = "select" | "preview" | "importing" | "result"

interface ContactMasterImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImportSuccess?: () => void
}

// 必須カラム: customer_id
const REQUIRED_COLUMNS = ["customer_id"]
const OPTIONAL_COLUMNS = ["name", "sex", "phone", "mail", "fax"]

export function ContactMasterImportDialog({ open, onOpenChange, onImportSuccess }: ContactMasterImportDialogProps) {
  const [step, setStep] = useState<ImportStep>("select")
  const [file, setFile] = useState<File | null>(null)
  const [previewData, setPreviewData] = useState<CSVPreviewData | null>(null)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [importProgress, setImportProgress] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const user = useAuthStore((state) => state.user)

  const resetState = useCallback(() => {
    setStep("select")
    setFile(null)
    setPreviewData(null)
    setImportResult(null)
    setError(null)
    setImportProgress(0)
  }, [])

  const handleClose = useCallback(() => {
    resetState()
    onOpenChange(false)
  }, [resetState, onOpenChange])

  const parseCSV = (content: string): CSVPreviewData => {
    const lines = content.split(/\r?\n/).filter(line => line.trim())
    if (lines.length === 0) {
      throw new Error("CSVファイルが空です")
    }

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
    
    // 必須カラムのチェック
    const lowerHeaders = headers.map(h => h.toLowerCase())
    const missingColumns = REQUIRED_COLUMNS.filter(col => !lowerHeaders.includes(col.toLowerCase()))
    if (missingColumns.length > 0) {
      throw new Error(`必須カラムがありません: ${missingColumns.join(", ")}`)
    }

    const rows = lines.slice(1).map(line => parseRow(line))
    const previewRows = rows.slice(0, 10)

    return {
      headers,
      rows: previewRows,
      totalRows: rows.length
    }
  }

  const handleFileSelect = useCallback(async (selectedFile: File) => {
    setError(null)
    
    if (!selectedFile.name.endsWith('.csv')) {
      setError("CSVファイルを選択してください")
      return
    }

    try {
      const content = await selectedFile.text()
      const parsed = parseCSV(content)
      setFile(selectedFile)
      setPreviewData(parsed)
      setStep("preview")
    } catch (e: any) {
      setError(e.message)
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile) {
      handleFileSelect(droppedFile)
    }
  }, [handleFileSelect])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleImport = useCallback(async () => {
    if (!file || !user) return

    setStep("importing")
    setImportProgress(0)

    try {
      const content = await file.text()
      const token = await user.getIdToken()
      const apiUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8082'

      // プログレスアニメーション
      const progressInterval = setInterval(() => {
        setImportProgress(prev => Math.min(prev + 10, 90))
      }, 200)

      const response = await fetch(`${apiUrl}/contact.v1.ContactService/ImportContactWithCustomer`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          csv_data: content,
        }),
      })

      clearInterval(progressInterval)
      setImportProgress(100)

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`インポートに失敗しました: ${errorText}`)
      }

      const result = await response.json()
      setImportResult({
        importedCount: result.imported_count || result.importedCount || 0,
        failedCount: result.failed_count || result.failedCount || 0,
        errors: (result.errors || []).map((err: any) => ({
          lineNumber: err.line_number || err.lineNumber || 0,
          errorMessage: err.error_message || err.errorMessage || err.message || '',
        })),
      })
      setStep("result")
      
      if (onImportSuccess) {
        onImportSuccess()
      }
    } catch (e: any) {
      setError(e.message)
      setStep("preview")
    }
  }, [file, user, onImportSuccess])

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FiUpload className="w-5 h-5" />
            連絡先CSVインポート
          </DialogTitle>
          <DialogDescription>
            連絡先データをCSVファイルからインポートします
          </DialogDescription>
        </DialogHeader>

        {step === "select" && (
          <div className="space-y-4">
            {/* CSVフォーマット説明 */}
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="p-4">
                <div className="flex items-start gap-2">
                  <FiInfo className="w-5 h-5 text-blue-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-blue-800 mb-2">CSVフォーマット</p>
                    <p className="text-sm text-blue-700 mb-2">
                      <strong>必須カラム:</strong> customer_id
                    </p>
                    <p className="text-sm text-blue-700 mb-2">
                      <strong>任意カラム:</strong> name, sex, phone, mail, fax
                    </p>
                    <p className="text-xs text-blue-600 font-mono bg-blue-100 p-2 rounded">
                      customer_id,name,sex,phone,mail,fax<br/>
                      550e8400-e29b-41d4-a716-446655440000,山田太郎,男,03-1234-5678,yamada@example.com,03-1234-5679
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* ファイル選択エリア */}
            <Card
              className={`border-2 border-dashed transition-colors ${
                isDragging 
                  ? 'border-blue-500 bg-blue-50' 
                  : 'border-gray-300 hover:border-gray-400'
              }`}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
            >
              <CardContent className="p-8">
                <div className="text-center">
                  <FiFile className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 mb-2">
                    CSVファイルをドラッグ＆ドロップ
                  </p>
                  <p className="text-gray-400 text-sm mb-4">または</p>
                  <Button
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    ファイルを選択
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={(e) => {
                      const selectedFile = e.target.files?.[0]
                      if (selectedFile) handleFileSelect(selectedFile)
                    }}
                  />
                </div>
              </CardContent>
            </Card>

            {error && (
              <Card className="border-red-200 bg-red-50">
                <CardContent className="p-4 flex items-center gap-2 text-red-600">
                  <FiAlertCircle className="w-5 h-5" />
                  {error}
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {step === "preview" && previewData && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{file?.name}</p>
                <p className="text-sm text-gray-500">
                  {previewData.totalRows}件のデータ（プレビュー: 最初の10件）
                </p>
              </div>
              <Button variant="outline" onClick={resetState}>
                別のファイルを選択
              </Button>
            </div>

            {/* 必須カラム確認 */}
            <Card className="bg-green-50 border-green-200">
              <CardContent className="p-3 flex items-center gap-2 text-green-700">
                <FiCheck className="w-5 h-5" />
                必須カラム「customer_id」が含まれています
              </CardContent>
            </Card>

            <div className="border rounded-lg overflow-x-auto max-h-[300px]">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-100">
                    <TableHead className="font-medium text-gray-700">#</TableHead>
                    {previewData.headers.map((header, i) => (
                      <TableHead key={i} className="font-medium text-gray-700">
                        {REQUIRED_COLUMNS.includes(header.toLowerCase()) ? (
                          <span className="flex items-center gap-1">
                            {header}
                            <span className="text-red-500">*</span>
                          </span>
                        ) : header}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewData.rows.map((row, rowIndex) => (
                    <TableRow key={rowIndex}>
                      <TableCell className="text-gray-500">{rowIndex + 1}</TableCell>
                      {row.map((cell, cellIndex) => (
                        <TableCell key={cellIndex} className="max-w-[200px] truncate">
                          {cell || <span className="text-gray-400">-</span>}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {error && (
              <Card className="border-red-200 bg-red-50">
                <CardContent className="p-4 flex items-center gap-2 text-red-600">
                  <FiAlertCircle className="w-5 h-5" />
                  {error}
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {step === "importing" && (
          <div className="py-8 space-y-4">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-lg font-medium">インポート中...</p>
              <p className="text-sm text-gray-500">しばらくお待ちください</p>
            </div>
            <Progress value={importProgress} className="w-full" />
            <p className="text-center text-sm text-gray-500">{importProgress}%</p>
          </div>
        )}

        {step === "result" && importResult && (
          <div className="space-y-4">
            <div className="text-center py-4">
              {importResult.failedCount === 0 ? (
                <div className="flex flex-col items-center">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                    <FiCheck className="w-8 h-8 text-green-600" />
                  </div>
                  <p className="text-lg font-medium text-green-600">インポート完了</p>
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mb-4">
                    <FiAlertCircle className="w-8 h-8 text-yellow-600" />
                  </div>
                  <p className="text-lg font-medium text-yellow-600">一部エラーがありました</p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Card className="bg-green-50 border-green-200">
                <CardContent className="p-4 text-center">
                  <p className="text-3xl font-bold text-green-600">{importResult.importedCount}</p>
                  <p className="text-sm text-green-700">件インポート成功</p>
                </CardContent>
              </Card>
              <Card className={`${importResult.failedCount > 0 ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'}`}>
                <CardContent className="p-4 text-center">
                  <p className={`text-3xl font-bold ${importResult.failedCount > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                    {importResult.failedCount}
                  </p>
                  <p className={`text-sm ${importResult.failedCount > 0 ? 'text-red-700' : 'text-gray-500'}`}>
                    件失敗
                  </p>
                </CardContent>
              </Card>
            </div>

            {importResult.errors.length > 0 && (
              <Card className="border-red-200">
                <CardContent className="p-4">
                  <p className="font-medium text-red-600 mb-2">エラー詳細:</p>
                  <div className="max-h-[200px] overflow-y-auto space-y-2">
                    {importResult.errors.map((err, i) => (
                      <div key={i} className="text-sm bg-red-50 p-2 rounded">
                        <span className="font-medium">行 {err.lineNumber}:</span> {err.errorMessage}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        <DialogFooter>
          {step === "select" && (
            <Button variant="outline" onClick={handleClose}>
              キャンセル
            </Button>
          )}
          {step === "preview" && (
            <>
              <Button variant="outline" onClick={resetState}>
                戻る
              </Button>
              <Button 
                onClick={handleImport}
                className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
              >
                インポート開始
              </Button>
            </>
          )}
          {step === "result" && (
            <Button onClick={handleClose}>
              閉じる
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
