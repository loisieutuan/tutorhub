export type Assignment = {
  id: string
  title: string
  subject: string
  description: string
  fileName: string
  fileType: 'image' | 'pdf' | 'word'
  assignedAt: string
  dueAt: string
  submittedAt: string | null
}

export const assignments: Assignment[] = [
  {
    id: 'ASG-001',
    title: 'Bài tập phương trình bậc hai',
    subject: 'Toán học',
    description: 'Hoàn thành toàn bộ bài tập trong file đề.',
    fileName: 'phuong-trinh-bac-hai.pdf',
    fileType: 'pdf',
    assignedAt: '2026-11-23T08:00:00+07:00',
    dueAt: '2026-11-26T20:00:00+07:00',
    submittedAt: null,
  },
  {
    id: 'ASG-002',
    title: 'IELTS Writing Task 1',
    subject: 'Tiếng Anh',
    description: 'Viết bài hoàn chỉnh theo yêu cầu trong đề.',
    fileName: 'ielts-writing-task-1.docx',
    fileType: 'word',
    assignedAt: '2026-11-24T08:00:00+07:00',
    dueAt: '2026-11-27T20:00:00+07:00',
    submittedAt: null,
  },
  {
    id: 'ASG-003',
    title: 'Bài tập chương Điện học',
    subject: 'Vật lý',
    description: 'Giải các bài tập và trình bày lời giải đầy đủ.',
    fileName: 'bai-tap-dien-hoc.jpg',
    fileType: 'image',
    assignedAt: '2026-11-27T08:00:00+07:00',
    dueAt: '2026-11-29T20:00:00+07:00',
    submittedAt: null,
  },
  {
    id: 'ASG-004',
    title: 'Ôn tập hàm số',
    subject: 'Toán học',
    description: 'Hoàn thành bài ôn tập hàm số.',
    fileName: 'on-tap-ham-so.pdf',
    fileType: 'pdf',
    assignedAt: '2026-11-22T08:00:00+07:00',
    dueAt: '2026-11-25T20:00:00+07:00',
    submittedAt: '2026-11-25T18:30:00+07:00',
  },
  {
    id: 'ASG-005',
    title: 'Bài tập ngữ pháp Unit 4',
    subject: 'Tiếng Anh',
    description: 'Hoàn thành các bài tập trong tài liệu.',
    fileName: 'grammar-unit-4.docx',
    fileType: 'word',
    assignedAt: '2026-11-23T08:00:00+07:00',
    dueAt: '2026-11-26T20:00:00+07:00',
    submittedAt: '2026-11-26T21:15:00+07:00',
  },
]