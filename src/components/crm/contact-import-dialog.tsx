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
  DialogClose,
} from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Progress } from "@/components/ui/progress"
import { FiUpload, FiFile, FiCheck, FiAlertCircle } from "react-icons/fi"
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

interface ContactImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  customerId: string
  onImportSuccess?: () => void
}

export function ContactImportDialog({ open, onOpenChange, customerId, onImportSuccess }: ContactImportDialogProps) {
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
    const rows = lines.slice(1).map(parseRow)

    return {
      headers,
      rows: rows.slice(0, 10),
      totalRows: rows.length,
    }
  }

  const handleFileSelect = async (selectedFile: File) => {
    setError(null)
    
    if (!selectedFile.name.endsWith('.csv')) {
      setError("CSVファイルのみアップロード可能です")
      return
    }

    if (selectedFile.size > 10 * 1024 * 1024) {
      setError("ファイルサイズは10MB以下にしてください")
      return
    }

    try {
      const content = await selectedFile.text()
      const preview = parseCSV(content)
      setFile(selectedFile)
      setPreviewData(preview)
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

  const handleImport = async () => {
    if (!file || !user) return

    setStep("importing")
    setImportProgress(10)

    try {
      const token = await user.getIdToken()
      const fileContent = await file.arrayBuffer()
      const base64Content = btoa(
        new Uint8Array(fileContent).reduce(
          (data, byte) => data + String.fromCharCode(byte),
          ''
        )
      )

      setImportProgress(30)

      const apiUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8082'
      const response = await fetch(`${apiUrl}/contact.v1.ContactService/ImportContact`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customer_id: customerId,
          file_name: file.name,
          file_content: base64Content,
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
        importedCount: result.imported_count || result.importedCount || 0,
        failedCount: result.failed_count || result.failedCount || 0,
        errors: (result.errors || []).map((e: any) => ({
          lineNumber: e.line_number || e.lineNumber,
          errorMessage: e.error_message || e.errorMessage,
        })),
      })
      setStep("result")

      if (onImportSuccess) {
        onImportSuccess()
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
          対応形式: CSV (最大10MB)
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
          name, sex, phone, mail, fax
        </code>
      </div>
    </div>
  )

  const renderPreviewStep = () => (
    <div className="flex flex-col min-h-0 flex-1">
      <div className="p-6 pb-0">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-blue-100 rounded-lg">
            <FiFile className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <p className="font-medium text-gray-900">{file?.name}</p>
            <p className="text-sm text-gray-500">
              {previewData?.totalRows.toLocaleString()} 件の連絡先データ
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-6 pb-4">
        <div className="border rounded-lg overflow-hidden">
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

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl">
        <DialogClose onClose={handleClose} />
        <DialogHeader>
          <DialogTitle>
            {step === "select" && "連絡先CSVインポート"}
            {step === "preview" && "インポート内容の確認"}
            {step === "importing" && "インポート処理"}
            {step === "result" && "インポート結果"}
          </DialogTitle>
          <DialogDescription>
            {step === "select" && "連絡先データをCSVファイルからインポートします"}
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
                <Button variant="outline" onClick={() => { resetState() }}>
                  ファイルを変更
                </Button>
                <Button
                  onClick={handleImport}
                  className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
                >
                  <FiUpload className="w-4 h-4 mr-2" />
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
        )}
      </DialogContent>
    </Dialog>
  )
}
