
import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  Eye,
  FileImage,
  FileText,
  GripVertical,
  Paperclip,
  Trash2,
  UploadCloud,
  X,
} from 'lucide-react'

// ==========================================
// 1. FILE CONFIGURATION
// ==========================================

const MAX_FILES = 50
const MAX_FILE_SIZE_MB = 10
export const MAX_FILE_SIZE = MAX_FILE_SIZE_MB * 1024 * 1024

export const ALLOWED_EXTENSIONS = [
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.heic',
  '.heif',
  '.pdf',
  '.doc',
  '.docx',
]

const PREVIEW_IMAGE_EXTENSIONS = [
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
]

// ==========================================
// 2. FILE UTILITIES
// ==========================================

function getFileExtension(name: string) {
  const index = name.lastIndexOf('.')

  return index === -1
    ? ''
    : name.slice(index).toLowerCase()
}

function formatFileSize(bytes: number) {
  const mb = bytes / (1024 * 1024)

  if (mb >= 1) {
    return `${mb.toFixed(1)} MB`
  }

  return `${Math.ceil(bytes / 1024)} KB`
}

function getFileKey(file: File) {
  return JSON.stringify([
    file.name,
    file.size,
    file.lastModified,
  ])
}

function isPreviewableImage(file: File) {
  return PREVIEW_IMAGE_EXTENSIONS.includes(
    getFileExtension(file.name),
  )
}

function isPdf(file: File) {
  return getFileExtension(file.name) === '.pdf'
}

function moveFile(
  files: File[],
  from: number,
  to: number,
): File[] {
  if (
    from < 0 ||
    to < 0 ||
    from >= files.length ||
    to >= files.length ||
    from === to
  ) {
    return files
  }

  const nextFiles = [...files]
  const [file] = nextFiles.splice(from, 1)

  if (!file) return files

  nextFiles.splice(to, 0, file)

  return nextFiles
}

// ==========================================
// 3. TEMPORARY FILE URL
// ==========================================

function useObjectUrl(file: File) {
  const [source, setSource] = useState<{
    file: File
    url: string
  } | null>(null)

  useEffect(() => {
    const url = URL.createObjectURL(file)

    setSource({ file, url })

    return () => {
      URL.revokeObjectURL(url)
    }
  }, [file])

  return source?.file === file
    ? source.url
    : null
}

// ==========================================
// 4. IMAGE PREVIEW
// ==========================================

function ImageView({
  url,
  name,
  compact = false,
}: {
  url: string
  name: string
  compact?: boolean
}) {
  const [failed, setFailed] = useState(false)

  if (failed) {
    return (
      <div className="flex min-h-28 flex-col items-center justify-center gap-2 p-3 text-slate-500">
        <FileImage size={26} />

        <p className="text-center text-xs">
          Không thể hiển thị ảnh này.
        </p>
      </div>
    )
  }

  return (
    <img
      src={url}
      alt={name}
      loading={compact ? 'lazy' : 'eager'}
      decoding="async"
      draggable={false}
      onError={() => setFailed(true)}
      className={
        compact
          ? 'h-32 w-full object-contain'
          : 'max-h-[65dvh] w-full object-contain'
      }
    />
  )
}

function ImageThumbnail({ file }: { file: File }) {
  const url = useObjectUrl(file)

  if (!url) {
    return (
      <div className="flex h-32 items-center justify-center text-slate-400">
        <FileImage size={30} />
      </div>
    )
  }

  return (
    <ImageView
      key={url}
      url={url}
      name={file.name}
      compact
    />
  )
}

// ==========================================
// 5. PREVIEW DIALOG
// ==========================================

export function PreviewDialog({
  file,
  onClose,
}: {
  file: File
  onClose: () => void
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const url = useObjectUrl(file)

  useEffect(() => {
    const dialog = dialogRef.current

    if (dialog && !dialog.open) {
      dialog.showModal()
    }
  }, [])

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      aria-label="Xem trước tệp bài làm"
      className="fixed inset-0 m-auto max-h-[90dvh] w-11/12 max-w-4xl overflow-auto rounded-2xl border border-slate-200 bg-white p-0 shadow-xl backdrop:bg-slate-900/60"
    >
      {/* Preview header */}
      <div className="flex items-start justify-between gap-3 border-b border-slate-200 p-4 sm:p-5">
        <div className="min-w-0">
          <h2 className="break-all text-base font-bold text-slate-900">
            {file.name}
          </h2>

          <p className="mt-1 text-xs text-slate-500">
            {formatFileSize(file.size)}
          </p>
        </div>

        <button
          type="button"
          aria-label="Đóng xem trước"
          onClick={() => dialogRef.current?.close()}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
        >
          <X size={23} />
        </button>
      </div>

      {/* Preview content */}
      <div className="bg-slate-50 p-4">
        {!url ? (
          <p className="py-10 text-center text-sm text-slate-500">
            Đang chuẩn bị bản xem trước...
          </p>
        ) : isPreviewableImage(file) ? (
          <ImageView
            key={url}
            url={url}
            name={file.name}
          />
        ) : isPdf(file) ? (
          <div className="space-y-3">
            <iframe
              src={url}
              title={`Xem trước ${file.name}`}
              className="h-[60dvh] w-full rounded-lg border border-slate-200 bg-white"
            />

            <p className="text-xs text-slate-500">
              Nếu PDF không hiển thị, hãy thử mở
              trong tab mới.
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <FileText
              size={48}
              className="text-primary"
            />

            <h3 className="font-semibold text-slate-900">
              Chưa hỗ trợ xem trực tiếp định dạng này
            </h3>

            <p className="max-w-sm text-sm leading-6 text-slate-500">
              Tệp Word, HEIC hoặc HEIF vẫn được giữ
              trong danh sách bài làm.
            </p>
          </div>
        )}
      </div>

      {/* Preview footer */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 p-4">
        {url && (
          <div className="flex flex-wrap gap-3">
            {(isPdf(file) ||
              isPreviewableImage(file)) && (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg px-3 py-2 text-sm font-semibold text-primary hover:bg-blue-50"
              >
                Mở trong tab mới
              </a>
            )}

            <a
              href={url}
              download={file.name}
              className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
            >
              Tải bản gốc
            </a>
          </div>
        )}

        <button
          type="button"
          onClick={() => dialogRef.current?.close()}
          className="ml-auto rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white"
        >
          Đóng
        </button>
      </div>
    </dialog>
  )
}

// ==========================================
// 6. MAIN SUBMISSION COMPONENT
// ==========================================

function SubmissionDraft() {
  const inputRef = useRef<HTMLInputElement>(null)

  const [files, setFiles] = useState<File[]>([])
  const [error, setError] = useState('')

  const [previewFile, setPreviewFile] =
    useState<File | null>(null)

  const [draggingKey, setDraggingKey] =
    useState<string | null>(null)

  const totalSize = files.reduce(
    (total, file) => total + file.size,
    0,
  )

  // Validate selected files
  function handleFileChange(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const incomingFiles = Array.from(
      event.target.files ?? [],
    )

    event.target.value = ''

    if (incomingFiles.length === 0) return

    const nextFiles = [...files]
    const errors: string[] = []

    for (const file of incomingFiles) {
      const extension = getFileExtension(file.name)

      if (!ALLOWED_EXTENSIONS.includes(extension)) {
        errors.push(
          `${file.name}: định dạng không được hỗ trợ.`,
        )
        continue
      }

      if (file.size === 0) {
        errors.push(
          `${file.name}: tệp đang trống.`,
        )
        continue
      }

      if (file.size > MAX_FILE_SIZE) {
        errors.push(
          `${file.name}: vượt quá ${MAX_FILE_SIZE_MB} MB.`,
        )
        continue
      }

      const isDuplicate = nextFiles.some(
        (existingFile) =>
          getFileKey(existingFile) === getFileKey(file),
      )

      if (isDuplicate) {
        errors.push(
          `${file.name}: tệp này đã được chọn.`,
        )
        continue
      }

      if (nextFiles.length >= MAX_FILES) {
        errors.push(
          `Chỉ được chọn tối đa ${MAX_FILES} tệp.`,
        )
        break
      }

      nextFiles.push(file)
    }

    setFiles(nextFiles)
    setError(errors.join(' '))
  }

  // Remove one file
  function removeFile(key: string) {
    setFiles((currentFiles) =>
      currentFiles.filter(
        (file) => getFileKey(file) !== key,
      ),
    )

    setError('')
  }

  // Remove all files
  function clearFiles() {
    setFiles([])
    setPreviewFile(null)
    setDraggingKey(null)
    setError('')
  }

  // Move by arrow buttons
  function moveByDirection(
    key: string,
    direction: -1 | 1,
  ) {
    setFiles((currentFiles) => {
      const index = currentFiles.findIndex(
        (file) => getFileKey(file) === key,
      )

      return moveFile(
        currentFiles,
        index,
        index + direction,
      )
    })
  }

  // Move by drag and drop
  function moveToTarget(targetKey: string) {
    if (draggingKey === null) return

    setFiles((currentFiles) => {
      const from = currentFiles.findIndex(
        (file) => getFileKey(file) === draggingKey,
      )

      const to = currentFiles.findIndex(
        (file) => getFileKey(file) === targetKey,
      )

      return moveFile(currentFiles, from, to)
    })

    setDraggingKey(null)
  }

  return (
    <section
      aria-label="Chuẩn bị tệp bài làm"
      className="space-y-4"
    >
      {/* File input */}
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ALLOWED_EXTENSIONS.join(',')}
        onChange={handleFileChange}
        className="sr-only"
        tabIndex={-1}
        aria-label="Chọn tệp bài làm"
      />

      {/* File selection area */}
      <div className="rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 p-5 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-primary">
          <UploadCloud size={25} />
        </div>

        <h3 className="mt-3 text-sm font-bold text-slate-900">
          Chuẩn bị bài làm
        </h3>

        <p className="mt-2 text-xs leading-5 text-slate-500">
          Chọn ảnh chụp bài làm, PDF hoặc tài liệu
          Word từ thiết bị của bạn.
        </p>

        <button
          type="button"
          disabled={files.length >= MAX_FILES}
          onClick={() => inputRef.current?.click()}
          className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Paperclip size={17} />

          {files.length > 0
            ? 'Thêm tệp bài làm'
            : 'Chọn tệp bài làm'}
        </button>

        <p className="mt-3 text-xs text-slate-500">
          Tối đa {MAX_FILES} tệp · {MAX_FILE_SIZE_MB} MB mỗi tệp
        </p>
      </div>

      {/* Validation errors */}
      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-xs text-red-700"
        >
          <AlertCircle
            size={18}
            className="mt-0.5 shrink-0"
          />

          <p className="min-w-0 break-words leading-5">
            {error}
          </p>
        </div>
      )}

      {/* Selected files */}
      {files.length > 0 && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-900">
              Tệp đã chọn ({files.length}/{MAX_FILES})
            </h3>

            <button
              type="button"
              onClick={clearFiles}
              className="text-xs font-semibold text-red-600 hover:underline"
            >
              Xóa tất cả
            </button>
          </div>

          {/* Total size */}
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="text-slate-500">
                Tổng dung lượng
              </span>

              <span className="font-bold text-slate-800">
                {formatFileSize(totalSize)}
              </span>
            </div>

            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-primary transition-all motion-reduce:transition-none"
                style={{
                  width: `${(files.length / MAX_FILES) * 100}%`,
                }}
              />
            </div>

            <p className="mt-2 text-xs text-slate-500">
              Còn có thể chọn {MAX_FILES - files.length} tệp
            </p>
          </div>

          <p className="text-xs leading-5 text-slate-500">
            Kiểm tra thứ tự các trang bài làm.
            Dùng mũi tên hoặc kéo biểu tượng tay nắm
            trên máy tính để sắp xếp.
          </p>

          {/* File grid */}
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,160px),1fr))] gap-3">
            {files.map((file, index) => {
              const key = getFileKey(file)
              const image = isPreviewableImage(file)

              return (
                <li
                  key={key}
                  onDragOver={(event) => {
                    if (draggingKey === null) return

                    event.preventDefault()
                    event.dataTransfer.dropEffect = 'move'
                  }}
                  onDrop={(event) => {
                    if (draggingKey === null) return

                    event.preventDefault()
                    moveToTarget(key)
                  }}
                  className={`min-w-0 overflow-hidden rounded-xl border bg-white ${
                    draggingKey === key
                      ? 'border-primary opacity-50'
                      : 'border-slate-200'
                  }`}
                >
                  {/* File preview */}
                  <button
                    type="button"
                    onClick={() => setPreviewFile(file)}
                    aria-label={`Xem trước ${file.name}`}
                    className="relative block w-full overflow-hidden bg-slate-100 text-left"
                  >
                    {image ? (
                      <ImageThumbnail file={file} />
                    ) : (
                      <div className="flex h-32 flex-col items-center justify-center gap-2 text-primary">
                        <FileText size={36} />

                        <span className="text-xs font-semibold uppercase">
                          {getFileExtension(file.name).slice(1)}
                        </span>
                      </div>
                    )}

                    <span className="absolute left-2 top-2 rounded-md bg-slate-900/80 px-2 py-1 text-[10px] font-bold text-white">
                      {image ? 'Trang' : 'Tệp'} {index + 1}
                    </span>

                    <span className="absolute bottom-2 right-2 flex h-7 w-7 items-center justify-center rounded-md bg-white text-slate-700">
                      <Eye size={16} />
                    </span>
                  </button>

                  {/* File information */}
                  <div className="p-3">
                    <p
                      title={file.name}
                      className="truncate text-xs font-semibold text-slate-900"
                    >
                      {file.name}
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                      {formatFileSize(file.size)}
                    </p>

                    {/* Reorder and remove actions */}
                    <div className="mt-3 flex items-center gap-1">
                      <span
                        draggable
                        aria-hidden="true"
                        title="Kéo để thay đổi thứ tự"
                        onDragStart={(event) => {
                          event.dataTransfer.effectAllowed =
                            'move'

                          event.dataTransfer.setData(
                            'text/plain',
                            'lst-submission-file',
                          )

                          setDraggingKey(key)
                        }}
                        onDragEnd={() =>
                          setDraggingKey(null)
                        }
                        className="hidden cursor-grab items-center justify-center p-1 text-slate-400 active:cursor-grabbing sm:flex"
                      >
                        <GripVertical size={16} />
                      </span>

                      <button
                        type="button"
                        disabled={index === 0}
                        aria-label={`Di chuyển ${file.name} lên`}
                        onClick={() =>
                          moveByDirection(key, -1)
                        }
                        className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-30"
                      >
                        <ArrowUp size={17} />
                      </button>

                      <button
                        type="button"
                        disabled={index === files.length - 1}
                        aria-label={`Di chuyển ${file.name} xuống`}
                        onClick={() =>
                          moveByDirection(key, 1)
                        }
                        className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-30"
                      >
                        <ArrowDown size={17} />
                      </button>

                      <button
                        type="button"
                        aria-label={`Xóa ${file.name}`}
                        onClick={() => removeFile(key)}
                        className="ml-auto flex h-9 w-9 items-center justify-center rounded-lg text-red-600 hover:bg-red-50"
                      >
                        <Trash2 size={17} />
                      </button>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>

          {/* Selected state */}
          <div className="rounded-lg bg-blue-50 p-3 text-xs leading-5 text-primary">
            Đã chuẩn bị {files.length} tệp bài làm.
            Hãy kiểm tra thứ tự trước khi nộp.
            Các tệp chưa được gửi lên máy chủ.
          </div>
        </div>
      )}

      {/* Local draft notice */}
      <p className="text-xs leading-5 text-slate-500">
        Lưu ý: Tệp chỉ được giữ tạm trong trang hiện tại.
        Khi tải lại hoặc rời trang, lựa chọn có thể bị mất.
      </p>

      {/* Preview dialog */}
      {previewFile && (
        <PreviewDialog
          key={getFileKey(previewFile)}
          file={previewFile}
          onClose={() => setPreviewFile(null)}
        />
      )}
    </section>
  )
}

export default SubmissionDraft
