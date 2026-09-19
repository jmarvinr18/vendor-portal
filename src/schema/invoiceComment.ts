// Mirrors vendor-portal-api/app/schema/invoice_comment.py.

export type CommentAuthor = 'AP Team' | 'Vendor'

export interface InvoiceComment {
  id: string
  author: CommentAuthor
  message: string
  postedOn: string
}

export interface InvoiceCommentInput {
  message: string
}
