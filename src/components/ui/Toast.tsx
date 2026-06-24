'use client'

import { useEffect, useState } from 'react'

type ToastType = 'info' | 'success' | 'error' | 'warning'

interface ToastState {
  message: string
  type: ToastType
  id: number
}

let _showToast: (msg: string, type?: ToastType, duration?: number) => void = () => {}

export function showToast(msg: string, type: ToastType = 'info', duration = 3000) {
  _showToast(msg, type, duration)
}

export function ToastProvider() {
  const [toast, setToast] = useState<ToastState | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    _showToast = (msg, type = 'info', duration = 3000) => {
      setToast({ message: msg, type, id: Date.now() })
      setVisible(true)
      setTimeout(() => setVisible(false), duration)
    }
  }, [])

  if (!toast) return null

  return (
    <div className={`toast toast-${toast.type}${visible ? ' show' : ''}`}>
      {toast.message}
    </div>
  )
}
